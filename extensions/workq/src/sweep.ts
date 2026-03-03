import { execSync } from "node:child_process";
import path from "node:path";
import type { SweepCandidate, WorkqDatabaseApi } from "./types.js";

export type SweepMode = "dry-run" | "apply";

export interface SweepOptions {
  staleAfterMinutes: number;
  autoDone: boolean;
  autoRelease: boolean;
  mode: SweepMode;
  actorId?: string;
  cwd?: string;
}

export interface SweepEvidence {
  kind: "closes" | "refs" | "mention";
  issueRef: string;
  commit: string;
  message: string;
}

export interface SweepAction {
  issueRef: string;
  from: string;
  action: "auto-done" | "auto-in-review" | "auto-release" | "annotate-stale" | "noop";
  reason: string;
  evidence?: SweepEvidence;
}

export interface SweepResult {
  staleAfterMinutes: number;
  totalCandidates: number;
  actions: SweepAction[];
  counts: Record<SweepAction["action"], number>;
}

const WORKQ_CLOSES = /^\s*closes\s+workq:(\S+)\s*$/gim;
const WORKQ_REFS = /^\s*refs\s+workq:(\S+)\s*$/gim;

function normalizeIssueRef(value: string): string {
  return value.trim().replace(/[.,;:!?]+$/, "");
}

function readGitCommits(cwd: string): Array<{ sha: string; body: string }> {
  const records = execSync("git log --pretty=format:%H%x1f%B%x1e -n 500", {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  const commits: Array<{ sha: string; body: string }> = [];
  for (const raw of records.split("\x1e")) {
    const entry = raw.trim();
    if (!entry) {
      continue;
    }
    const [sha, body] = entry.split("\x1f");
    if (!sha || !body) {
      continue;
    }
    commits.push({ sha: sha.trim(), body: body.trim() });
  }

  return commits;
}

function extractEvidenceByRef(
  issueRefs: string[],
  commits: Array<{ sha: string; body: string }>,
): Map<string, SweepEvidence> {
  const wanted = new Set(issueRefs.map((ref) => normalizeIssueRef(ref).toLowerCase()));
  const evidence = new Map<string, SweepEvidence>();

  for (const commit of commits) {
    const body = commit.body;

    const closes = [...body.matchAll(WORKQ_CLOSES)].map((match) =>
      normalizeIssueRef(match[1] ?? ""),
    );
    for (const ref of closes) {
      const key = ref.toLowerCase();
      if (!wanted.has(key) || evidence.has(key)) {
        continue;
      }
      evidence.set(key, {
        kind: "closes",
        issueRef: ref,
        commit: commit.sha,
        message: body.split("\n", 1)[0] ?? "",
      });
    }

    const refs = [...body.matchAll(WORKQ_REFS)].map((match) => normalizeIssueRef(match[1] ?? ""));
    for (const ref of refs) {
      const key = ref.toLowerCase();
      if (!wanted.has(key) || evidence.has(key)) {
        continue;
      }
      evidence.set(key, {
        kind: "refs",
        issueRef: ref,
        commit: commit.sha,
        message: body.split("\n", 1)[0] ?? "",
      });
    }

    const lower = body.toLowerCase();
    for (const wantedRef of wanted) {
      if (evidence.has(wantedRef)) {
        continue;
      }
      if (!lower.includes(wantedRef)) {
        continue;
      }
      evidence.set(wantedRef, {
        kind: "mention",
        issueRef: wantedRef,
        commit: commit.sha,
        message: body.split("\n", 1)[0] ?? "",
      });
    }
  }

  return evidence;
}

function decideAction(
  candidate: SweepCandidate,
  evidence: SweepEvidence | undefined,
  options: SweepOptions,
): SweepAction {
  if (evidence) {
    if (options.autoDone && evidence.kind === "closes") {
      return {
        issueRef: candidate.issueRef,
        from: candidate.status,
        action: "auto-done",
        reason: "matching closes workq footer found",
        evidence,
      };
    }

    return {
      issueRef: candidate.issueRef,
      from: candidate.status,
      action: "auto-in-review",
      reason: "commit evidence found; awaiting confirmation",
      evidence,
    };
  }

  if (options.autoRelease) {
    return {
      issueRef: candidate.issueRef,
      from: candidate.status,
      action: "auto-release",
      reason: "stale item with no commit evidence",
    };
  }

  return {
    issueRef: candidate.issueRef,
    from: candidate.status,
    action: "annotate-stale",
    reason: "stale item with no commit evidence",
  };
}

export function runWorkqSweep(db: WorkqDatabaseApi, options: SweepOptions): SweepResult {
  const staleAfterMinutes = Math.max(1, Math.floor(options.staleAfterMinutes));
  const actorId = options.actorId ?? "system:workq-sweep";
  const cwd = path.resolve(options.cwd ?? process.cwd());

  const candidates = db.findStaleActiveItems(staleAfterMinutes);
  if (!candidates.length) {
    return {
      staleAfterMinutes,
      totalCandidates: 0,
      actions: [],
      counts: {
        "auto-done": 0,
        "auto-in-review": 0,
        "auto-release": 0,
        "annotate-stale": 0,
        noop: 0,
      },
    };
  }

  const commits = readGitCommits(cwd);
  const evidenceByRef = extractEvidenceByRef(
    candidates.map((item) => item.issueRef),
    commits,
  );

  const actions = candidates.map((candidate) => {
    const evidence = evidenceByRef.get(candidate.issueRef.toLowerCase());
    return decideAction(candidate, evidence, options);
  });

  if (options.mode === "apply") {
    for (const action of actions) {
      if (action.action === "auto-done") {
        db.systemMarkDone({
          issueRef: action.issueRef,
          actorId,
          summary: `auto-closed by sweep: ${action.reason}`,
          prUrl: action.evidence ? `commit:${action.evidence.commit}` : undefined,
        });
      } else if (action.action === "auto-in-review") {
        db.systemMoveToInReview({
          issueRef: action.issueRef,
          actorId,
          reason: `auto-advanced by sweep: ${action.reason}`,
        });
      } else if (action.action === "auto-release") {
        db.systemReleaseToUnclaimed({
          issueRef: action.issueRef,
          actorId,
          reason: `auto-released by sweep: ${action.reason}`,
        });
      } else if (action.action === "annotate-stale") {
        db.systemAnnotate({
          issueRef: action.issueRef,
          actorId,
          note: `sweep note: ${action.reason}`,
        });
      }
    }
  }

  const counts: SweepResult["counts"] = {
    "auto-done": 0,
    "auto-in-review": 0,
    "auto-release": 0,
    "annotate-stale": 0,
    noop: 0,
  };

  for (const action of actions) {
    counts[action.action] += 1;
  }

  return {
    staleAfterMinutes,
    totalCandidates: candidates.length,
    actions,
    counts,
  };
}
