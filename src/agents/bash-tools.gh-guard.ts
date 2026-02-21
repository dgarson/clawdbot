import fs from "node:fs/promises";
import path from "node:path";
import { splitShellArgs } from "../utils/shell-argv.js";

export type ExecGhGuardConfig = {
  enabled?: boolean;
  protectedBranches?: string[];
  allowedPrRepos?: string[];
  requireExplicitPrRepo?: boolean;
};

function normalizeBranch(value: string): string {
  return value
    .replace(/^refs\/heads\//i, "")
    .trim()
    .toLowerCase();
}

function normalizeRepo(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  const withoutScheme = trimmed.replace(/^[a-z]+:\/\//, "");
  const parts = withoutScheme.split("/").filter(Boolean);
  if (parts.length < 2) {
    return "";
  }
  const hostLike = parts[0]?.includes(".") || parts[0]?.includes(":");
  const repoParts = hostLike ? parts.slice(1) : parts;
  if (repoParts.length < 2) {
    return "";
  }
  return `${repoParts[repoParts.length - 2]}/${repoParts[repoParts.length - 1]}`;
}

function splitShellSegments(raw: string): string[] {
  const segments: string[] = [];
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let start = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (!inSingle && ch === "\\") {
      escaped = true;
      continue;
    }
    if (!inDouble && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (inSingle || inDouble) {
      continue;
    }

    const two = raw.slice(i, i + 2);
    if (two === "&&" || two === "||") {
      const seg = raw.slice(start, i).trim();
      if (seg) {
        segments.push(seg);
      }
      start = i + 2;
      i += 1;
      continue;
    }
    if (ch === ";") {
      const seg = raw.slice(start, i).trim();
      if (seg) {
        segments.push(seg);
      }
      start = i + 1;
    }
  }

  const tail = raw.slice(start).trim();
  if (tail) {
    segments.push(tail);
  }
  return segments;
}

async function readCurrentGitBranch(workdir: string): Promise<string | null> {
  try {
    const gitDir = path.resolve(workdir, ".git");
    const stat = await fs.stat(gitDir);
    if (!stat.isDirectory()) {
      return null;
    }
    const head = (await fs.readFile(path.join(gitDir, "HEAD"), "utf-8")).trim();
    const match = /^ref:\s+refs\/heads\/(.+)$/i.exec(head);
    return match?.[1] ? normalizeBranch(match[1]) : null;
  } catch {
    return null;
  }
}

function findGitPushDestinations(tokens: string[], currentBranch: string | null): string[] {
  if (tokens.length < 2 || tokens[0] !== "git" || tokens[1] !== "push") {
    return [];
  }

  const positional: string[] = [];
  for (let i = 2; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) {
      continue;
    }
    if (token.startsWith("-")) {
      const takesValue = token === "--repo" || token === "-r" || token === "--set-upstream";
      if (takesValue) {
        i += 1;
      }
      continue;
    }
    positional.push(token);
  }

  const refspecs = positional.slice(1);
  if (refspecs.length === 0) {
    return currentBranch ? [currentBranch] : [];
  }

  return refspecs
    .map((refspec) => {
      const destination = refspec.includes(":") ? (refspec.split(":").at(-1) ?? "") : refspec;
      if (destination === "HEAD") {
        return currentBranch;
      }
      return normalizeBranch(destination);
    })
    .filter((branch): branch is string => Boolean(branch));
}

function parseGhPrRepo(tokens: string[]): string | null {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) {
      continue;
    }
    if (token === "--repo" || token === "-R") {
      return tokens[i + 1] ?? null;
    }
    if (token.startsWith("--repo=") || token.startsWith("-R=")) {
      return token.split("=").slice(1).join("=") || null;
    }
  }
  return null;
}

export async function validateGhCommandGuard(params: {
  command: string;
  workdir: string;
  config?: ExecGhGuardConfig;
}): Promise<void> {
  if (!params.config?.enabled) {
    return;
  }

  const protectedBranches = new Set(
    (params.config.protectedBranches ?? ["main"]).map(normalizeBranch).filter(Boolean),
  );
  const requireExplicitPrRepo = params.config.requireExplicitPrRepo !== false;
  const allowedRepos = new Set(
    (params.config.allowedPrRepos ?? []).map(normalizeRepo).filter(Boolean),
  );
  const currentBranch = await readCurrentGitBranch(params.workdir);

  for (const segment of splitShellSegments(params.command)) {
    const tokens = splitShellArgs(segment);
    if (!tokens || tokens.length < 2) {
      continue;
    }

    if (tokens[0] === "git" && tokens[1] === "push") {
      const destinations = findGitPushDestinations(tokens, currentBranch);
      const blocked = destinations.find((branch) => protectedBranches.has(branch));
      if (blocked) {
        throw new Error(
          `exec denied by tools.exec.ghGuard: git push to protected branch '${blocked}' is blocked.`,
        );
      }
    }

    if (tokens[0] === "gh" && tokens[1] === "pr" && tokens[2] === "create") {
      const rawRepo = parseGhPrRepo(tokens);
      const repo = rawRepo ? normalizeRepo(rawRepo) : "";
      if (requireExplicitPrRepo && !repo) {
        throw new Error(
          "exec denied by tools.exec.ghGuard: gh pr create requires --repo/-R targeting your fork.",
        );
      }
      if (allowedRepos.size > 0 && (!repo || !allowedRepos.has(repo))) {
        throw new Error(
          `exec denied by tools.exec.ghGuard: gh pr create repo must be one of: ${Array.from(
            allowedRepos,
          ).join(", ")}.`,
        );
      }
    }
  }
}
