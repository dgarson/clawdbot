/**
 * GitHub PR Review Comment Monitor
 *
 * Polls GitHub for new PR review comments from known AI review bots and
 * notifies via Slack. Adds 👀 reaction when first seen.
 *
 * Uses `gh api` for GitHub access.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sendMessageSlack } from "../slack/send.js";

// ────────────────────────────── Types ──────────────────────────────

export interface GitHubUser {
  login?: string;
  html_url?: string;
  type?: string;
}

export interface GitHubPullRequest {
  number: number;
  title?: string;
  html_url?: string;
  url?: string;
}

export interface GitHubPullReviewComment {
  id: number;
  body?: string;
  html_url?: string;
  pull_request_url?: string;
  created_at?: string;
  updated_at?: string;
  user?: GitHubUser;
  pull_request_review_id?: number;
  path?: string;
  line?: number;
  start_line?: number;
  commit_id?: string;
}

export interface PRReviewMonitorState {
  version: 1;
  lastPollAt?: string;
  prs: Record<
    string,
    {
      processedCommentIds: number[];
    }
  >;
}

export interface PRReviewMonitorOptions {
  repo: string; // owner/name
  /** Slack target like "#cb-ideas" or "slack:C123" */
  slackChannel: string;
  /** Bot accounts to detect (GitHub user logins). */
  botAccounts?: string[];
  /** GitHub API page size for list calls (max 100). */
  pageSize?: number;
  /** Override state file location (for tests). */
  statePath?: string;
  /** Only scan this PR number (for tests / debugging). */
  prNumber?: number;
  /** Logger */
  log?: (msg: string) => void;
  /** Execute gh (for tests). */
  gh?: (args: string[]) => Promise<string>;
  /** Slack send override (for tests). */
  slackSend?: (to: string, text: string) => Promise<void>;
}

export const DEFAULT_AI_BOT_ACCOUNTS = [
  "coderabbitai[bot]",
  "sourcery-ai[bot]",
  "codiumai-pr-agent-pro[bot]",
  "ellipsis-dev[bot]",
  "claude-ai[bot]",
  "openai-gpt[bot]",
];

export const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const DEFAULT_STATE_PATH = path.join(os.homedir(), ".openclaw", "pr-review-state.json");

// ────────────────────────────── Public API ──────────────────────────────

export async function pollPRReviewComments(opts: PRReviewMonitorOptions): Promise<{
  newComments: Array<{ prNumber: number; comment: GitHubPullReviewComment }>;
}> {
  const gh = opts.gh ?? ghApi;
  const slackSend =
    opts.slackSend ??
    (async (to: string, text: string) => {
      await sendMessageSlack(to, text);
    });

  const statePath = opts.statePath ?? DEFAULT_STATE_PATH;
  const state = await loadState(statePath);
  const parsedLastPollAtMs = state.lastPollAt ? Date.parse(state.lastPollAt) : undefined;
  const lastPollAtMs =
    typeof parsedLastPollAtMs === "number" && Number.isFinite(parsedLastPollAtMs)
      ? parsedLastPollAtMs
      : undefined;
  const isBootstrap = typeof lastPollAtMs !== "number";
  const botAccounts = (opts.botAccounts ?? DEFAULT_AI_BOT_ACCOUNTS).map((s) => s.toLowerCase());

  const pageSize = resolvePageSize(opts.pageSize);
  const prs: GitHubPullRequest[] = opts.prNumber
    ? [{ number: opts.prNumber }]
    : await listOpenPullRequests(gh, opts.repo, pageSize);

  const newComments: Array<{ prNumber: number; comment: GitHubPullReviewComment }> = [];

  for (const pr of prs) {
    const prNumber = pr.number;
    const comments = await listPullReviewComments(gh, opts.repo, prNumber, pageSize);

    for (const comment of comments) {
      const login = (comment.user?.login ?? "").toLowerCase();
      if (!login || !botAccounts.includes(login)) continue;

      if (isProcessed(state, prNumber, comment.id)) continue;

      if (isBootstrap) {
        markProcessed(state, prNumber, comment.id);
        continue;
      }

      if (typeof lastPollAtMs === "number" && comment.created_at) {
        const createdAtMs = Date.parse(comment.created_at);
        if (Number.isFinite(createdAtMs) && createdAtMs <= lastPollAtMs) {
          markProcessed(state, prNumber, comment.id);
          continue;
        }
      }

      // Send Slack notification first so we don't miss it if reaction fails
      const message = formatSlackNotification({ repo: opts.repo, prNumber, pr, comment });
      await slackSend(opts.slackChannel, message);

      // Add 👀 reaction (in progress / seen)
      await addReactionToPullReviewComment(gh, opts.repo, comment.id, "eyes").catch((err) => {
        opts.log?.(
          `pr-review-monitor: failed to add reaction to comment ${comment.id}: ${String(err)}`,
        );
      });

      markProcessed(state, prNumber, comment.id);
      newComments.push({ prNumber, comment });
    }
  }

  state.lastPollAt = new Date().toISOString();
  await saveState(statePath, state);

  return { newComments };
}

export async function addReactionToPullReviewComment(
  gh: (args: string[]) => Promise<string>,
  repo: string,
  commentId: number,
  reaction: "eyes" | "white_check_mark" | string,
): Promise<void> {
  // Requires preview header for reactions API
  await gh([
    "-H",
    "Accept: application/vnd.github+json",
    "repos/" + repo + "/pulls/comments/" + String(commentId) + "/reactions",
    "-f",
    `content=${reaction}`,
  ]);
}

export async function markFeedbackResolved(opts: {
  repo: string;
  commentId: number;
  gh?: (args: string[]) => Promise<string>;
  log?: (msg: string) => void;
}): Promise<void> {
  const gh = opts.gh ?? ghApi;
  // Best-effort: add ✅. Removing 👀 is optional and requires extra API calls.
  await addReactionToPullReviewComment(gh, opts.repo, opts.commentId, "white_check_mark").catch(
    (err) => {
      opts.log?.(`pr-review-monitor: failed to add resolved reaction: ${String(err)}`);
    },
  );
}

// ────────────────────────────── State ──────────────────────────────

export async function loadState(statePath: string): Promise<PRReviewMonitorState> {
  try {
    const raw = await fs.readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw) as PRReviewMonitorState;
    if (!parsed || parsed.version !== 1 || typeof parsed.prs !== "object" || parsed.prs === null) {
      return { version: 1, prs: {} };
    }
    // Normalize
    for (const k of Object.keys(parsed.prs)) {
      const entry = parsed.prs[k];
      if (!entry || !Array.isArray(entry.processedCommentIds)) {
        parsed.prs[k] = { processedCommentIds: [] };
      }
    }
    return parsed;
  } catch {
    return { version: 1, prs: {} };
  }
}

export async function saveState(statePath: string, state: PRReviewMonitorState): Promise<void> {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

function isProcessed(state: PRReviewMonitorState, prNumber: number, commentId: number): boolean {
  const key = String(prNumber);
  const entry = state.prs[key];
  return Boolean(entry?.processedCommentIds?.includes(commentId));
}

function markProcessed(state: PRReviewMonitorState, prNumber: number, commentId: number): void {
  const key = String(prNumber);
  const entry = (state.prs[key] ??= { processedCommentIds: [] });
  if (!entry.processedCommentIds.includes(commentId)) {
    entry.processedCommentIds.push(commentId);
    // Prevent unbounded growth
    if (entry.processedCommentIds.length > 5000) {
      entry.processedCommentIds = entry.processedCommentIds.slice(-3000);
    }
  }
}

// ────────────────────────────── GitHub API ──────────────────────────────

async function listOpenPullRequests(
  gh: (args: string[]) => Promise<string>,
  repo: string,
  pageSize: number,
): Promise<GitHubPullRequest[]> {
  return await listPaged<GitHubPullRequest>(gh, "repos/" + repo + "/pulls", pageSize, [
    "-f",
    "state=open",
  ]);
}

async function listPullReviewComments(
  gh: (args: string[]) => Promise<string>,
  repo: string,
  prNumber: number,
  pageSize: number,
): Promise<GitHubPullReviewComment[]> {
  return await listPaged<GitHubPullReviewComment>(
    gh,
    "repos/" + repo + "/pulls/" + String(prNumber) + "/comments",
    pageSize,
  );
}

export async function ghApi(args: string[]): Promise<string> {
  return await new Promise((resolve, reject) => {
    execFile("gh", ["api", ...args], { maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr?.toString() || err.message));
        return;
      }
      resolve(stdout.toString());
    });
  });
}

function resolvePageSize(pageSize?: number): number {
  if (typeof pageSize !== "number" || !Number.isFinite(pageSize)) {
    return DEFAULT_PAGE_SIZE;
  }
  const normalized = Math.floor(pageSize);
  if (normalized <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(normalized, MAX_PAGE_SIZE);
}

async function listPaged<T>(
  gh: (args: string[]) => Promise<string>,
  endpoint: string,
  pageSize: number,
  extraArgs: string[] = [],
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= 1000; page += 1) {
    const raw = await gh([
      endpoint,
      ...extraArgs,
      "-f",
      `per_page=${pageSize}`,
      "-f",
      `page=${page}`,
    ]);
    const parsed = JSON.parse(raw) as unknown;
    const batch = Array.isArray(parsed) ? (parsed as T[]) : [];
    if (batch.length === 0) {
      break;
    }
    items.push(...batch);
    if (batch.length < pageSize) {
      break;
    }
  }
  return items;
}

// ────────────────────────────── Slack formatting ──────────────────────────────

export function formatSlackNotification(params: {
  repo: string;
  prNumber: number;
  pr?: GitHubPullRequest;
  comment: GitHubPullReviewComment;
}): string {
  const prUrl = params.pr?.html_url ?? `https://github.com/${params.repo}/pull/${params.prNumber}`;
  const commentUrl = params.comment.html_url ?? `${prUrl}#discussion_r${params.comment.id}`;
  const bot = params.comment.user?.login ?? "unknown";
  const body = (params.comment.body ?? "").trim();
  const snippet = body.length > 1500 ? body.slice(0, 1500) + "…" : body;

  const loc =
    params.comment.path && typeof params.comment.line === "number"
      ? `${params.comment.path}:${params.comment.line}`
      : params.comment.path
        ? params.comment.path
        : undefined;

  return [
    `New AI PR review comment from *${bot}*`,
    `PR: ${prUrl}`,
    `Comment: ${commentUrl}`,
    loc ? `Location: ${loc}` : null,
    "",
    snippet ? snippet : "(no body)",
  ]
    .filter((x): x is string => Boolean(x))
    .join("\n");
}
