import { execFile } from "node:child_process";
import type { WorkItem, WorkItemPayload } from "./types.js";

const CODEX_TASK_URL_RE = /https:\/\/chatgpt\.com\/codex\/tasks\/task_[A-Za-z0-9_-]+/g;
const REVIEW_COMMENT_ID_RE = /discussion_r(\d+)/;
const REVIEW_COMMENT_API_RE = /pulls\/comments\/(\d+)/;
const GITHUB_REPO_RE = /github\.com\/([^/\s]+\/[^/\s#]+)/;

export type CodexTaskLinkStatus = "posted" | "skipped" | "no_pr" | "error";

export type CodexTaskLinkResult = {
  status: CodexTaskLinkStatus;
  note?: string;
  taskUrl?: string;
  prNumber?: number;
};

type LinkCodexTaskParams = {
  item: WorkItem;
  payload: WorkItemPayload;
  transcript?: unknown[];
  log?: (msg: string, meta?: Record<string, unknown>) => void;
  gh?: (args: string[]) => Promise<string>;
  now?: Date;
};

function extractCodexTaskUrls(text: string): string[] {
  const matches = text.match(CODEX_TASK_URL_RE) ?? [];
  return Array.from(new Set(matches));
}

function extractReviewCommentId(text: string): number | undefined {
  const match = text.match(REVIEW_COMMENT_ID_RE) ?? text.match(REVIEW_COMMENT_API_RE);
  if (!match?.[1]) {
    return undefined;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractRepo(text: string): string | undefined {
  const match = text.match(GITHUB_REPO_RE);
  if (!match?.[1]) {
    return undefined;
  }
  return match[1];
}

function buildTaskDescription(item: WorkItem): string {
  if (item.description && item.description.trim()) {
    return `${item.title}: ${item.description.trim()}`;
  }
  return item.title;
}

function formatCodexTaskComment(params: {
  taskDescription: string;
  taskUrl: string;
  repo: string;
  branch: string;
  timestamp: Date;
}): string {
  return [
    "🤖 **Codex Task Submitted**",
    `📋 **Task:** ${params.taskDescription}`,
    `🔗 **Codex Task URL:** ${params.taskUrl}`,
    `📦 **Repository:** ${params.repo}`,
    `🌿 **Branch:** ${params.branch}`,
    `⏱️ **Submitted:** ${params.timestamp.toISOString()}`,
  ].join("\n");
}

async function ghApi(args: string[]): Promise<string> {
  return await new Promise((resolve, reject) => {
    execFile("gh", ["api", ...args], { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr?.toString() || err.message));
        return;
      }
      resolve(stdout.toString());
    });
  });
}

async function ghPrList(args: string[]): Promise<string> {
  return await new Promise((resolve, reject) => {
    execFile(
      "gh",
      ["pr", "list", ...args],
      { maxBuffer: 1024 * 1024 * 10 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.toString() || err.message));
          return;
        }
        resolve(stdout.toString());
      },
    );
  });
}

async function resolvePrNumber(
  gh: (args: string[]) => Promise<string>,
  repo: string,
  branch: string,
): Promise<number | undefined> {
  const raw = await gh(["--head", branch, "--json", "number", "--repo", repo]);
  const parsed = JSON.parse(raw) as Array<{ number?: number }>;
  const number = parsed?.[0]?.number;
  return typeof number === "number" ? number : undefined;
}

async function postCodexTaskComment(params: {
  ghApiImpl: (args: string[]) => Promise<string>;
  repo: string;
  prNumber?: number;
  reviewCommentId?: number;
  body: string;
}): Promise<void> {
  if (params.reviewCommentId) {
    await params.ghApiImpl([
      "-H",
      "Accept: application/vnd.github+json",
      `repos/${params.repo}/pulls/comments/${params.reviewCommentId}/replies`,
      "-f",
      `body=${params.body}`,
    ]);
    return;
  }
  if (!params.prNumber) {
    throw new Error("prNumber required for root-level comment");
  }
  await params.ghApiImpl([
    "-H",
    "Accept: application/vnd.github+json",
    `repos/${params.repo}/issues/${params.prNumber}/comments`,
    "-f",
    `body=${params.body}`,
  ]);
}

function stringifyTranscript(transcript?: unknown[]): string {
  if (!transcript || transcript.length === 0) {
    return "";
  }
  try {
    return JSON.stringify(transcript);
  } catch {
    return "";
  }
}

function collectContextText(item: WorkItem, payload: WorkItemPayload): string {
  const contextUrls = Array.isArray(payload.contextUrls) ? payload.contextUrls : [];
  const parts = [item.title, item.description ?? "", payload.instructions ?? "", ...contextUrls];
  return parts.filter((p) => typeof p === "string" && p.trim()).join("\n");
}

export async function linkCodexTaskForWorkItem(
  params: LinkCodexTaskParams,
): Promise<CodexTaskLinkResult | null> {
  const transcriptText = stringifyTranscript(params.transcript);
  const taskUrls = extractCodexTaskUrls(transcriptText);
  if (taskUrls.length === 0) {
    return null;
  }

  const taskUrl = taskUrls[0];
  const taskDescription = buildTaskDescription(params.item);
  const contextText = collectContextText(params.item, params.payload);
  const repo = params.payload.repo?.trim() || extractRepo(contextText);
  const branch = params.payload.branchName?.trim() || undefined;

  if (!repo || !branch) {
    const missingBranch =
      !branch && typeof params.payload.branchPrefix === "string"
        ? "Codex task detected, but branchPrefix was provided without a resolved branch name."
        : "Codex task detected, but repo/branch info is missing for PR linking.";
    return {
      status: "skipped",
      taskUrl,
      note: missingBranch,
    };
  }

  const reviewCommentId = extractReviewCommentId(contextText);
  const ghApiImpl = params.gh ?? ghApi;
  const ghPrListImpl = params.gh ?? ghPrList;

  let prNumber: number | undefined;
  if (!reviewCommentId) {
    try {
      prNumber = await resolvePrNumber(ghPrListImpl, repo, branch);
    } catch (err) {
      return {
        status: "error",
        taskUrl,
        note: `Failed to resolve PR for branch "${branch}": ${String(err)}`,
      };
    }
    if (!prNumber) {
      return {
        status: "no_pr",
        taskUrl,
        note: `No open PR found for branch "${branch}".`,
      };
    }
  }

  const timestamp = params.now ?? new Date();
  const body = formatCodexTaskComment({
    taskDescription,
    taskUrl,
    repo,
    branch,
    timestamp,
  });

  try {
    await postCodexTaskComment({
      ghApiImpl,
      repo,
      prNumber,
      reviewCommentId,
      body,
    });
    return { status: "posted", taskUrl, prNumber };
  } catch (err) {
    params.log?.("codex task link comment failed", { error: String(err), repo, branch });
    return {
      status: "error",
      taskUrl,
      note: `Failed to post PR comment: ${String(err)}`,
    };
  }
}
