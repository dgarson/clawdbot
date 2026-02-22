import type { WebClient } from "@slack/web-api";
import { vi } from "vitest";

export type SlackEditTestClient = WebClient & {
  chat: {
    update: ReturnType<typeof vi.fn>;
  };
};

export type SlackSendTestClient = WebClient & {
  conversations: {
    open: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  chat: {
    postMessage: ReturnType<typeof vi.fn>;
  };
};

export function installSlackBlockTestMocks() {
  vi.mock("../config/config.js", () => ({
    loadConfig: () => ({}),
  }));

  vi.mock("./accounts.js", () => ({
    resolveSlackAccount: () => ({
      accountId: "default",
      botToken: "xoxb-test",
      botTokenSource: "config",
      config: {},
    }),
  }));
}

export function createSlackEditTestClient(): SlackEditTestClient {
  return {
    chat: {
      update: vi.fn(async () => ({ ok: true })),
    },
  } as unknown as SlackEditTestClient;
}

export function createSlackSendTestClient(
  channels: Array<{ id: string; name: string; is_archived?: boolean }> = [],
): SlackSendTestClient {
  return {
    conversations: {
      open: vi.fn(async () => ({ channel: { id: "D123" } })),
      list: vi.fn(async () => ({ channels })),
    },
    chat: {
      postMessage: vi.fn(async () => ({ ts: "171234.567" })),
    },
  } as unknown as SlackSendTestClient;
}
