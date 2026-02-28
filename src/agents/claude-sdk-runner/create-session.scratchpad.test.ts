/**
 * Scratchpad Integration Tests for createClaudeSdkSession
 *
 * Covers:
 * - System prompt section injection (enabled/disabled)
 * - Scratchpad content prepended to SDK prompt (not persisted content)
 * - Session resume: loads scratchpad from JSONL entries (last entry wins)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { SCRATCHPAD_ENTRY_KEY } from "../../../extensions/scratchpad/scratchpad-tool.js";
import { resetGlobalHookRunner } from "../../plugins/hook-runner-global.js";
import type { ClaudeSdkSessionParams } from "./types.js";

// ---------------------------------------------------------------------------
// Mock the Agent SDK query() function
// ---------------------------------------------------------------------------

function makeMockQueryGen(messages: Array<Record<string, unknown>>) {
  return async function* () {
    for (const msg of messages) {
      yield msg;
    }
  };
}

vi.mock("@anthropic-ai/claude-agent-sdk", () => {
  return {
    query: vi.fn(),
    createSdkMcpServer: vi.fn(() => ({ name: "mock-mcp-server", type: "mock" })),
    tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: unknown) => ({
      name,
      handler,
    })),
  };
});

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------

async function importCreateSession() {
  const mod = await import("./create-session.js");
  return mod.createClaudeSdkSession;
}

async function importQuery() {
  const mod = await import("@anthropic-ai/claude-agent-sdk");
  return mod.query as Mock;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeParams(overrides?: Partial<ClaudeSdkSessionParams>): ClaudeSdkSessionParams {
  return {
    workspaceDir: "/workspace",
    sessionId: "sess_local_001",
    modelId: "claude-sonnet-4-5-20250514",
    tools: [],
    customTools: [],
    systemPrompt: "You are a helpful assistant.",
    sessionManager: {
      appendMessage: vi.fn(() => "msg-id"),
    },
    ...overrides,
  };
}

const INIT_MESSAGES = [
  { type: "system", subtype: "init", session_id: "sess_server_abc123" },
  {
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text: "Hello!" }] },
  },
  { type: "result", subtype: "success", result: "Hello!" },
];

afterEach(() => {
  vi.unstubAllEnvs();
  resetGlobalHookRunner();
});

// ---------------------------------------------------------------------------
// Scratchpad integration tests
// ---------------------------------------------------------------------------

describe("scratchpad integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("system prompt section", () => {
    it("includes scratchpad guidance in system prompt by default", async () => {
      const queryMock = await importQuery();
      queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

      const createSession = await importCreateSession();
      const session = await createSession(makeParams());
      await session.prompt("hello");

      const callArgs = queryMock.mock.calls[0][0];
      expect(callArgs.options.systemPrompt).toContain("Session Scratchpad");
    });

    it("omits scratchpad section when scratchpad.enabled is false", async () => {
      const queryMock = await importQuery();
      queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

      const createSession = await importCreateSession();
      const session = await createSession(
        makeParams({
          claudeSdkConfig: { scratchpad: { enabled: false } },
        }),
      );
      await session.prompt("hello");

      const callArgs = queryMock.mock.calls[0][0];
      expect(callArgs.options.systemPrompt).not.toContain("Session Scratchpad");
    });

    it("includes session.scratchpad tool name in system prompt when enabled", async () => {
      const queryMock = await importQuery();
      queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

      const createSession = await importCreateSession();
      const session = await createSession(makeParams());
      await session.prompt("hello");

      const callArgs = queryMock.mock.calls[0][0];
      expect(callArgs.options.systemPrompt).toContain("session.scratchpad");
    });
  });

  describe("prompt injection", () => {
    it("prepends scratchpad to SDK prompt when scratchpad has content", async () => {
      const queryMock = await importQuery();
      queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

      const appendMessage = vi.fn(() => "msg-id");
      const createSession = await importCreateSession();
      const session = await createSession(
        makeParams({
          sessionManager: {
            appendMessage,
            getEntries: () => [
              {
                type: "custom",
                customType: SCRATCHPAD_ENTRY_KEY,
                data: "## My Plan\n1. Do X",
              },
            ],
          },
        }),
      );
      await session.prompt("continue");

      // SDK prompt should contain scratchpad prefix and content
      const sdkPrompt = queryMock.mock.calls[0][0].prompt;
      const promptText = typeof sdkPrompt === "string" ? sdkPrompt : JSON.stringify(sdkPrompt);
      expect(promptText).toContain("[Session Scratchpad");
      expect(promptText).toContain("My Plan");

      // Persisted message should NOT contain scratchpad prefix
      const persistedContent = appendMessage.mock.calls[0]?.[0]?.content;
      const persistedText =
        typeof persistedContent === "string" ? persistedContent : JSON.stringify(persistedContent);
      expect(persistedText).not.toContain("[Session Scratchpad");
    });

    it("does not prepend scratchpad when scratchpad is empty", async () => {
      const queryMock = await importQuery();
      queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

      const createSession = await importCreateSession();
      const session = await createSession(makeParams());
      await session.prompt("hello");

      const sdkPrompt = queryMock.mock.calls[0][0].prompt;
      const promptText = typeof sdkPrompt === "string" ? sdkPrompt : JSON.stringify(sdkPrompt);
      expect(promptText).not.toContain("[Session Scratchpad");
    });

    it("sdk prompt contains user text after scratchpad block", async () => {
      const queryMock = await importQuery();
      queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

      const createSession = await importCreateSession();
      const session = await createSession(
        makeParams({
          sessionManager: {
            appendMessage: vi.fn(() => "msg-id"),
            getEntries: () => [
              {
                type: "custom",
                customType: SCRATCHPAD_ENTRY_KEY,
                data: "some scratchpad content",
              },
            ],
          },
        }),
      );
      await session.prompt("my user message");

      const sdkPrompt = queryMock.mock.calls[0][0].prompt;
      const promptText = typeof sdkPrompt === "string" ? sdkPrompt : JSON.stringify(sdkPrompt);
      expect(promptText).toContain("my user message");
    });

    it("persisted content equals plain user text without scratchpad prefix", async () => {
      const queryMock = await importQuery();
      queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

      const appendMessage = vi.fn(() => "msg-id");
      const createSession = await importCreateSession();
      const session = await createSession(
        makeParams({
          sessionManager: {
            appendMessage,
            getEntries: () => [
              {
                type: "custom",
                customType: SCRATCHPAD_ENTRY_KEY,
                data: "persistent plan",
              },
            ],
          },
        }),
      );
      await session.prompt("user input text");

      const persistedContent = appendMessage.mock.calls[0]?.[0]?.content;
      const persistedText =
        typeof persistedContent === "string" ? persistedContent : JSON.stringify(persistedContent);
      expect(persistedText).toContain("user input text");
      expect(persistedText).not.toContain("persistent plan");
    });
  });

  describe("session resume", () => {
    it("loads scratchpad from JSONL entries on session creation", async () => {
      const queryMock = await importQuery();
      queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

      const createSession = await importCreateSession();
      const session = await createSession(
        makeParams({
          sessionManager: {
            appendMessage: vi.fn(() => "msg-id"),
            getEntries: () => [
              {
                type: "custom",
                customType: SCRATCHPAD_ENTRY_KEY,
                data: "first version",
              },
              {
                type: "custom",
                customType: SCRATCHPAD_ENTRY_KEY,
                data: "updated version",
              },
            ],
          },
        }),
      );
      await session.prompt("hello");

      // Should use the LAST scratchpad entry
      const sdkPrompt = queryMock.mock.calls[0][0].prompt;
      const promptText = typeof sdkPrompt === "string" ? sdkPrompt : JSON.stringify(sdkPrompt);
      expect(promptText).toContain("updated version");
      expect(promptText).not.toContain("first version");
    });

    it("uses SCRATCHPAD_ENTRY_KEY to identify scratchpad entries", async () => {
      const queryMock = await importQuery();
      queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

      const createSession = await importCreateSession();
      const session = await createSession(
        makeParams({
          sessionManager: {
            appendMessage: vi.fn(() => "msg-id"),
            getEntries: () => [
              // Wrong customType — should be ignored
              {
                type: "custom",
                customType: "some:other:key",
                data: "should not appear",
              },
              // Correct customType
              {
                type: "custom",
                customType: SCRATCHPAD_ENTRY_KEY,
                data: "correct scratchpad",
              },
            ],
          },
        }),
      );
      await session.prompt("hello");

      const sdkPrompt = queryMock.mock.calls[0][0].prompt;
      const promptText = typeof sdkPrompt === "string" ? sdkPrompt : JSON.stringify(sdkPrompt);
      expect(promptText).toContain("correct scratchpad");
      expect(promptText).not.toContain("should not appear");
    });

    it("does not prepend scratchpad when no scratchpad entry exists in history", async () => {
      const queryMock = await importQuery();
      queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

      const createSession = await importCreateSession();
      const session = await createSession(
        makeParams({
          sessionManager: {
            appendMessage: vi.fn(() => "msg-id"),
            getEntries: () => [
              // Only non-scratchpad entries
              { type: "custom", customType: "openclaw:claude-sdk-session-id", data: "sess_old" },
            ],
          },
        }),
      );
      await session.prompt("hello");

      const sdkPrompt = queryMock.mock.calls[0][0].prompt;
      const promptText = typeof sdkPrompt === "string" ? sdkPrompt : JSON.stringify(sdkPrompt);
      expect(promptText).not.toContain("[Session Scratchpad");
    });
  });
});
