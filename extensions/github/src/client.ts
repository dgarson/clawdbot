import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

type CommandTermination = "exit" | "timeout" | "no-output-timeout" | "signal";

export type GithubPermission = "read" | "write" | "merge";

export type GithubPluginConfig = {
  allowedRepos?: string[];
  writeAllowedRepos?: string[];
  mergeAllowedRepos?: string[];
  timeoutMs: number;
  maxFiles: number;
  maxPatchChars: number;
};

export type GhCommandResult = {
  argv: string[];
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
  termination: CommandTermination;
};

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_FILES = 100;
const DEFAULT_MAX_PATCH_CHARS = 8_000;

const REPO_SLUG_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function normalizeRepoList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const repos = raw
    .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
    .filter(Boolean);
  return repos.length > 0 ? Array.from(new Set(repos)) : undefined;
}

function coercePositiveInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  const value = Math.floor(raw);
  if (value <= 0) {
    return fallback;
  }
  return value;
}

export function resolveGithubPluginConfig(pluginConfig: unknown): GithubPluginConfig {
  const cfg =
    pluginConfig && typeof pluginConfig === "object"
      ? (pluginConfig as Record<string, unknown>)
      : undefined;

  return {
    allowedRepos: normalizeRepoList(cfg?.allowedRepos),
    writeAllowedRepos: normalizeRepoList(cfg?.writeAllowedRepos),
    mergeAllowedRepos: normalizeRepoList(cfg?.mergeAllowedRepos),
    timeoutMs: coercePositiveInt(cfg?.timeoutMs, DEFAULT_TIMEOUT_MS),
    maxFiles: coercePositiveInt(cfg?.maxFiles, DEFAULT_MAX_FILES),
    maxPatchChars: coercePositiveInt(cfg?.maxPatchChars, DEFAULT_MAX_PATCH_CHARS),
  };
}

export function parseRepoSlug(repoRaw: string): string {
  const repo = repoRaw.trim();
  if (!REPO_SLUG_RE.test(repo)) {
    throw new Error(`Invalid repo slug: ${repoRaw}`);
  }
  return repo;
}

function repoInList(repo: string, list: string[] | undefined): boolean {
  if (!list || list.length === 0) {
    return true;
  }
  return list.includes(repo.toLowerCase());
}

export function assertRepoAllowed(params: {
  repo: string;
  config: GithubPluginConfig;
  permission: GithubPermission;
}) {
  const repo = params.repo.toLowerCase();
  const { config, permission } = params;

  if (!repoInList(repo, config.allowedRepos)) {
    throw new Error(
      `Repository ${params.repo} is not in github.allowedRepos for this plugin configuration`,
    );
  }

  if (permission === "write" || permission === "merge") {
    if (!repoInList(repo, config.writeAllowedRepos)) {
      throw new Error(
        `Repository ${params.repo} is not in github.writeAllowedRepos for write operations`,
      );
    }
  }

  if (permission === "merge") {
    if (!repoInList(repo, config.mergeAllowedRepos)) {
      throw new Error(
        `Repository ${params.repo} is not in github.mergeAllowedRepos for merge operations`,
      );
    }
  }
}

export async function runGhCommand(params: {
  api: OpenClawPluginApi;
  args: string[];
  timeoutMs: number;
  input?: string;
}): Promise<GhCommandResult> {
  const argv = ["gh", ...params.args];
  const result = await params.api.runtime.system.runCommandWithTimeout(argv, {
    timeoutMs: params.timeoutMs,
    input: params.input,
  });

  return {
    argv,
    ok: result.code === 0,
    stdout: result.stdout,
    stderr: result.stderr,
    code: result.code,
    termination: result.termination,
  };
}

export function ghFailureMessage(result: GhCommandResult): string {
  const cmd = result.argv.join(" ");
  const status = `exit=${String(result.code)} termination=${result.termination}`;
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  const detail = stderr || stdout || "no output";
  return `GitHub CLI command failed (${status}): ${cmd}\n${detail}`;
}

export async function resolveRepoSlug(params: {
  api: OpenClawPluginApi;
  repoRaw: unknown;
  timeoutMs: number;
}): Promise<string> {
  if (typeof params.repoRaw === "string" && params.repoRaw.trim()) {
    return parseRepoSlug(params.repoRaw);
  }

  const probe = await runGhCommand({
    api: params.api,
    timeoutMs: params.timeoutMs,
    args: ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
  });
  if (!probe.ok) {
    throw new Error(
      "repo is required when not inside a GitHub repository context (or when gh cannot infer it)",
    );
  }

  return parseRepoSlug(probe.stdout.trim());
}

export function buildRepoEndpoint(repo: string, suffix?: string): string {
  const slug = parseRepoSlug(repo);
  const [owner, name] = slug.split("/");
  const safeOwner = encodeURIComponent(owner ?? "");
  const safeName = encodeURIComponent(name ?? "");
  const tail = suffix ? `/${suffix.replace(/^\/+/, "")}` : "";
  return `repos/${safeOwner}/${safeName}${tail}`;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export async function ghApiJson<T = unknown>(params: {
  api: OpenClawPluginApi;
  endpoint: string;
  timeoutMs: number;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}): Promise<T> {
  const args = ["api", params.endpoint];
  const method = params.method ?? "GET";
  if (method !== "GET") {
    args.push("-X", method);
  }

  let input: string | undefined;
  if (params.body !== undefined) {
    args.push("--input", "-");
    input = JSON.stringify(params.body);
  }

  const result = await runGhCommand({
    api: params.api,
    args,
    timeoutMs: params.timeoutMs,
    input,
  });

  if (!result.ok) {
    throw new Error(ghFailureMessage(result));
  }

  const stdout = result.stdout.trim();
  if (!stdout) {
    return {} as T;
  }

  try {
    return JSON.parse(stdout) as T;
  } catch {
    throw new Error(`Expected JSON response from gh api, got: ${stdout.slice(0, 400)}`);
  }
}

export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n... (truncated ${text.length - maxChars} chars)`;
}

export function normalizePositiveInt(raw: unknown, fallback: number, max?: number): number {
  const base = coercePositiveInt(raw, fallback);
  if (typeof max === "number" && Number.isFinite(max)) {
    return Math.min(base, Math.floor(max));
  }
  return base;
}

export function readBoolean(raw: unknown, fallback = false): boolean {
  if (typeof raw !== "boolean") {
    return fallback;
  }
  return raw;
}
