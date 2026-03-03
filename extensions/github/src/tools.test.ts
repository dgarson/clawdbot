import { describe, expect, it, vi } from "vitest";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";
import { createGithubTools } from "./tools.js";

type MockCommandResponse = {
  code?: number;
  stdout?: string;
  stderr?: string;
  termination?: "exit" | "timeout" | "no-output-timeout" | "signal";
};

function makeApi(pluginConfig?: Record<string, unknown>) {
  const queue: MockCommandResponse[] = [];
  const run = vi.fn(async (_argv: string[], _opts: unknown) => {
    const next = queue.shift() ?? { code: 0, stdout: "{}", stderr: "", termination: "exit" };
    return {
      pid: 123,
      stdout: next.stdout ?? "",
      stderr: next.stderr ?? "",
      code: next.code ?? 0,
      signal: null,
      killed: false,
      termination: next.termination ?? "exit",
      noOutputTimedOut: false,
    };
  });

  const api = {
    pluginConfig,
    runtime: {
      system: {
        runCommandWithTimeout: run,
      },
    },
  } as unknown as OpenClawPluginApi;

  return { api, queue, run };
}

function getTool(api: OpenClawPluginApi, name: string) {
  const tool = createGithubTools(api).find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  return tool;
}

function readDetails(result: unknown): Record<string, unknown> {
  const record = result as { details?: unknown };
  return (record.details as Record<string, unknown>) ?? {};
}

describe("github plugin tools", () => {
  it("registers the expected granular tool set", () => {
    const { api } = makeApi();
    const names = createGithubTools(api).map((tool) => tool.name);

    expect(names).toEqual([
      "github_commit_show",
      "github_diff_compare",
      "github_pr_list",
      "github_pr_view",
      "github_pr_checks",
      "github_pr_comments_list",
      "github_pr_comment_create",
      "github_pr_comment_edit",
      "github_pr_comment_delete",
      "github_pr_create",
      "github_pr_edit",
      "github_pr_update_branch",
      "github_pr_close",
      "github_pr_reopen",
      "github_pr_merge",
    ]);
  });

  it("truncates commit file patch content", async () => {
    const { api, queue } = makeApi();
    const tool = getTool(api, "github_commit_show");

    queue.push({
      stdout: JSON.stringify({
        sha: "abc",
        files: [{ filename: "a.ts", patch: "0123456789ABCDEFGHIJ" }],
      }),
    });

    const result = await tool.execute("call-1", {
      repo: "openclaw/openclaw",
      ref: "abc",
      maxPatchChars: 10,
    });
    const details = readDetails(result);

    expect(details.ok).toBe(true);
    const commit = details.commit as Record<string, unknown>;
    const files = commit.files as Array<Record<string, unknown>>;
    const patch = String(files[0]?.patch ?? "");
    expect(patch).toContain("... (truncated");
  });

  it("blocks write tool when repo is outside writeAllowedRepos", async () => {
    const { api, run } = makeApi({ writeAllowedRepos: ["someone/else"] });
    const tool = getTool(api, "github_pr_close");

    const result = await tool.execute("call-2", {
      repo: "openclaw/openclaw",
      number: 5,
    });
    const details = readDetails(result);

    expect(details.ok).toBe(false);
    expect(String(details.error ?? "")).toContain("writeAllowedRepos");
    expect(run).not.toHaveBeenCalled();
  });

  it("creates issue comments through the issues comments endpoint", async () => {
    const { api, queue, run } = makeApi();
    const tool = getTool(api, "github_pr_comment_create");

    queue.push({
      stdout: JSON.stringify({ id: 101, body: "hello" }),
    });

    const result = await tool.execute("call-3", {
      repo: "openclaw/openclaw",
      number: 12,
      kind: "issue",
      body: "hello",
    });
    const details = readDetails(result);

    expect(details.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    const argv = run.mock.calls[0]?.[0] as string[];
    const opts = run.mock.calls[0]?.[1] as { input?: string };
    expect(argv).toContain("repos/openclaw/openclaw/issues/12/comments");
    expect(opts.input).toContain('"body":"hello"');
  });

  it("validates required review comment fields", async () => {
    const { api, run } = makeApi();
    const tool = getTool(api, "github_pr_comment_create");

    const result = await tool.execute("call-4", {
      repo: "openclaw/openclaw",
      number: 12,
      kind: "review",
      body: "needs commit/path/line",
    });
    const details = readDetails(result);

    expect(details.ok).toBe(false);
    expect(String(details.error ?? "")).toContain("commitId required");
    expect(run).not.toHaveBeenCalled();
  });

  it("merges PR then deletes same-repo head branch when requested", async () => {
    const { api, queue, run } = makeApi();
    const tool = getTool(api, "github_pr_merge");

    queue.push({ stdout: JSON.stringify({ merged: true, message: "merged" }) });
    queue.push({
      stdout: JSON.stringify({
        head: {
          ref: "feature/test-branch",
          repo: { full_name: "openclaw/openclaw" },
        },
      }),
    });
    queue.push({ stdout: "" });

    const result = await tool.execute("call-5", {
      repo: "openclaw/openclaw",
      number: 99,
      method: "squash",
      deleteBranch: true,
    });
    const details = readDetails(result);

    expect(details.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(3);
    const deleteArgv = run.mock.calls[2]?.[0] as string[];
    expect(deleteArgv).toContain("repos/openclaw/openclaw/git/refs/heads/feature%2Ftest-branch");
    const deleteInfo = details.deleteBranch as Record<string, unknown>;
    expect(deleteInfo.deleted).toBe(true);
  });
});
