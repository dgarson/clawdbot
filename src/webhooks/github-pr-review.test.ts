import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AI_BOT_ACCOUNTS,
  formatSlackNotification,
  loadState,
  pollPRReviewComments,
  saveState,
  type PRReviewMonitorState,
} from "./github-pr-review.js";

describe("github-pr-review", () => {
  const getPageArg = (args: string[], key: string): string | undefined => {
    for (let i = 0; i < args.length - 1; i += 1) {
      if (args[i] === "-f" && args[i + 1].startsWith(`${key}=`)) {
        return args[i + 1].slice(key.length + 1);
      }
    }
    return undefined;
  };

  it("formatSlackNotification includes bot name, PR link, and comment body", () => {
    const text = formatSlackNotification({
      repo: "openclaw/openclaw",
      prNumber: 12,
      pr: { number: 12, html_url: "https://github.com/openclaw/openclaw/pull/12" },
      comment: {
        id: 123,
        html_url: "https://github.com/openclaw/openclaw/pull/12#discussion_r123",
        body: "Please add tests.",
        user: { login: "coderabbitai[bot]" },
        path: "src/index.ts",
        line: 9,
      },
    });

    expect(text).toContain("coderabbitai[bot]");
    expect(text).toContain("https://github.com/openclaw/openclaw/pull/12");
    expect(text).toContain("Please add tests");
    expect(text).toContain("src/index.ts:9");
  });

  it("loadState returns default state when file missing", async () => {
    const state = await loadState("/path/does/not/exist/pr-review-state.json");
    expect(state.version).toBe(1);
    expect(state.prs).toEqual({});
  });

  it("saveState writes a valid json file (round-trip)", async () => {
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-pr-review-state-"));
    const file = path.join(dir, "state.json");

    const input: PRReviewMonitorState = {
      version: 1,
      lastPollAt: "2026-02-08T00:00:00Z",
      prs: { "12": { processedCommentIds: [1, 2, 3] } },
    };

    await saveState(file, input);
    const output = await loadState(file);
    expect(output).toEqual(input);
  });

  it("pollPRReviewComments seeds state on bootstrap without notifying", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs/promises");

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-pr-review-poll-"));
    const statePath = path.join(dir, "state.json");

    const gh = vi.fn(async (args: string[]) => {
      const endpoint = args[0] ?? "";
      if (endpoint.endsWith("/pulls")) {
        const page = getPageArg(args, "page");
        if (page && page !== "1") {
          return JSON.stringify([]);
        }
        return JSON.stringify([{ number: 7, html_url: "https://github.com/o/r/pull/7" }]);
      }
      if (endpoint.endsWith("/pulls/7/comments")) {
        const page = getPageArg(args, "page");
        if (page && page !== "1") {
          return JSON.stringify([]);
        }
        return JSON.stringify([
          {
            id: 101,
            body: "AI suggestion",
            html_url: "https://github.com/o/r/pull/7#discussion_r101",
            user: { login: DEFAULT_AI_BOT_ACCOUNTS[0] },
            created_at: "2026-02-08T00:00:00Z",
          },
        ]);
      }
      throw new Error("Unexpected gh call: " + JSON.stringify(args));
    });

    const slackSend = vi.fn(async () => {});

    const first = await pollPRReviewComments({
      repo: "o/r",
      slackChannel: "#cb-ideas",
      statePath,
      gh,
      slackSend,
    });

    expect(first.newComments).toHaveLength(0);
    expect(slackSend).toHaveBeenCalledTimes(0);

    const seeded = await loadState(statePath);
    expect(seeded.lastPollAt).toBeTruthy();
    expect(seeded.prs["7"]?.processedCommentIds).toEqual([101]);
  });

  it("pollPRReviewComments notifies once and tracks state", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs/promises");

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-pr-review-poll-"));
    const statePath = path.join(dir, "state.json");

    await saveState(statePath, { version: 1, lastPollAt: "2026-02-07T00:00:00Z", prs: {} });

    const gh = vi.fn(async (args: string[]) => {
      const endpoint = args[0] ?? "";
      if (endpoint.endsWith("/pulls")) {
        const page = getPageArg(args, "page");
        if (page && page !== "1") {
          return JSON.stringify([]);
        }
        return JSON.stringify([{ number: 7, html_url: "https://github.com/o/r/pull/7" }]);
      }
      if (endpoint.endsWith("/pulls/7/comments")) {
        const page = getPageArg(args, "page");
        if (page && page !== "1") {
          return JSON.stringify([]);
        }
        return JSON.stringify([
          {
            id: 101,
            body: "AI suggestion",
            html_url: "https://github.com/o/r/pull/7#discussion_r101",
            user: { login: DEFAULT_AI_BOT_ACCOUNTS[0] },
            created_at: "2026-02-08T00:00:00Z",
          },
          {
            id: 102,
            body: "Human comment",
            html_url: "https://github.com/o/r/pull/7#discussion_r102",
            user: { login: "octocat" },
            created_at: "2026-02-08T00:00:00Z",
          },
        ]);
      }
      if (endpoint.includes("/reactions")) {
        return JSON.stringify({ ok: true });
      }
      throw new Error("Unexpected gh call: " + JSON.stringify(args));
    });

    const slackSend = vi.fn(async () => {});

    const first = await pollPRReviewComments({
      repo: "o/r",
      slackChannel: "#cb-ideas",
      statePath,
      gh,
      slackSend,
    });

    expect(first.newComments).toHaveLength(1);
    expect(slackSend).toHaveBeenCalledTimes(1);

    const second = await pollPRReviewComments({
      repo: "o/r",
      slackChannel: "#cb-ideas",
      statePath,
      gh,
      slackSend,
    });

    expect(second.newComments).toHaveLength(0);
    expect(slackSend).toHaveBeenCalledTimes(1);
  });

  it("pollPRReviewComments ignores comments created before lastPollAt", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs/promises");

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-pr-review-poll-"));
    const statePath = path.join(dir, "state.json");

    await saveState(statePath, { version: 1, lastPollAt: "2026-02-08T00:00:00Z", prs: {} });

    const gh = vi.fn(async (args: string[]) => {
      const endpoint = args[0] ?? "";
      if (endpoint.endsWith("/pulls")) {
        const page = getPageArg(args, "page");
        if (page && page !== "1") {
          return JSON.stringify([]);
        }
        return JSON.stringify([{ number: 7, html_url: "https://github.com/o/r/pull/7" }]);
      }
      if (endpoint.endsWith("/pulls/7/comments")) {
        const page = getPageArg(args, "page");
        if (page && page !== "1") {
          return JSON.stringify([]);
        }
        return JSON.stringify([
          {
            id: 201,
            body: "Old AI suggestion",
            html_url: "https://github.com/o/r/pull/7#discussion_r201",
            user: { login: DEFAULT_AI_BOT_ACCOUNTS[0] },
            created_at: "2026-02-07T00:00:00Z",
          },
        ]);
      }
      throw new Error("Unexpected gh call: " + JSON.stringify(args));
    });

    const slackSend = vi.fn(async () => {});

    const first = await pollPRReviewComments({
      repo: "o/r",
      slackChannel: "#cb-ideas",
      statePath,
      gh,
      slackSend,
    });

    expect(first.newComments).toHaveLength(0);
    expect(slackSend).toHaveBeenCalledTimes(0);

    const seeded = await loadState(statePath);
    expect(seeded.prs["7"]?.processedCommentIds).toEqual([201]);
  });

  it("pollPRReviewComments paginates pull requests and comments", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs/promises");

    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-pr-review-poll-"));
    const statePath = path.join(dir, "state.json");

    await saveState(statePath, { version: 1, lastPollAt: "2026-02-07T00:00:00Z", prs: {} });

    const gh = vi.fn(async (args: string[]) => {
      const endpoint = args[0] ?? "";
      const page = getPageArg(args, "page") ?? "1";
      if (endpoint.endsWith("/pulls")) {
        if (page === "1") {
          return JSON.stringify([{ number: 7, html_url: "https://github.com/o/r/pull/7" }]);
        }
        return JSON.stringify([]);
      }
      if (endpoint.endsWith("/pulls/7/comments")) {
        if (page === "1") {
          return JSON.stringify([
            {
              id: 301,
              body: "AI suggestion",
              html_url: "https://github.com/o/r/pull/7#discussion_r301",
              user: { login: DEFAULT_AI_BOT_ACCOUNTS[0] },
              created_at: "2026-02-08T00:00:00Z",
            },
          ]);
        }
        return JSON.stringify([]);
      }
      if (endpoint.includes("/reactions")) {
        return JSON.stringify({ ok: true });
      }
      throw new Error("Unexpected gh call: " + JSON.stringify(args));
    });

    const slackSend = vi.fn(async () => {});

    const result = await pollPRReviewComments({
      repo: "o/r",
      slackChannel: "#cb-ideas",
      statePath,
      gh,
      slackSend,
      pageSize: 1,
    });

    expect(result.newComments).toHaveLength(1);
    expect(slackSend).toHaveBeenCalledTimes(1);

    const pullPageCalls = gh.mock.calls.filter((call) => (call[0]?.[0] ?? "").endsWith("/pulls"));
    const commentPageCalls = gh.mock.calls.filter((call) =>
      (call[0]?.[0] ?? "").endsWith("/pulls/7/comments"),
    );
    const pullPages = pullPageCalls.map((call) => getPageArg(call[0], "page"));
    const commentPages = commentPageCalls.map((call) => getPageArg(call[0], "page"));
    expect(pullPages).toEqual(["1", "2"]);
    expect(commentPages).toEqual(["1", "2"]);
  });
});
