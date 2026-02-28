/**
 * Scratchpad Integration Tests for createClaudeSdkSession
 *
 * Covers:
 * - System prompt section injection (enabled/disabled)
 * - Scratchpad content prepended to SDK prompt (not persisted content)
 * - Session resume: loads scratchpad from JSONL entries (last entry wins)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { resetGlobalHookRunner } from "../../plugins/hook-runner-global.js";
import { SCRATCHPAD_ENTRY_KEY, SCRATCHPAD_NOTES_KEY } from "./scratchpad/scratchpad-tool.js";
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
      // eslint-disable-next-line -- mock.calls tuple type doesn't reflect runtime shape
      const calls = appendMessage.mock.calls as unknown[][];
      const persistedContent = (calls[0]?.[0] as { content?: unknown } | undefined)?.content;
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

      // eslint-disable-next-line -- mock.calls tuple type doesn't reflect runtime shape
      const calls = appendMessage.mock.calls as unknown[][];
      const persistedContent = (calls[0]?.[0] as { content?: unknown } | undefined)?.content;
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

  // -------------------------------------------------------------------------
  // Auto-trigger nudge tests
  // -------------------------------------------------------------------------

  describe("auto-trigger nudges", () => {
    describe("turn-count nudge", () => {
      it("injects nudge after configured number of turns when scratchpad is empty", async () => {
        const queryMock = await importQuery();
        queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

        const createSession = await importCreateSession();
        const session = await createSession(
          makeParams({
            claudeSdkConfig: { scratchpad: { nudgeAfterTurns: 3 } },
          }),
        );

        // Turns 1 and 2: no nudge
        await session.prompt("turn 1");
        await session.prompt("turn 2");
        for (let i = 0; i < 2; i++) {
          const p = queryMock.mock.calls[i][0].prompt;
          const t = typeof p === "string" ? p : JSON.stringify(p);
          expect(t).not.toContain("[Hint:");
        }

        // Turn 3: should have nudge
        await session.prompt("turn 3");
        const sdkPrompt = queryMock.mock.calls[2][0].prompt;
        const promptText = typeof sdkPrompt === "string" ? sdkPrompt : JSON.stringify(sdkPrompt);
        expect(promptText).toContain("[Hint:");
        expect(promptText).toContain("scratchpad");
      });

      it("does not inject nudge when scratchpad has content", async () => {
        const queryMock = await importQuery();
        queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

        const createSession = await importCreateSession();
        const session = await createSession(
          makeParams({
            claudeSdkConfig: { scratchpad: { nudgeAfterTurns: 1 } },
            sessionManager: {
              appendMessage: vi.fn(() => "msg-id"),
              getEntries: () => [
                { type: "custom", customType: SCRATCHPAD_NOTES_KEY, data: "existing notes" },
              ],
            },
          }),
        );

        await session.prompt("turn 1");
        const sdkPrompt = queryMock.mock.calls[0][0].prompt;
        const promptText = typeof sdkPrompt === "string" ? sdkPrompt : JSON.stringify(sdkPrompt);
        expect(promptText).not.toContain("[Hint:");
      });

      it("does not inject nudge when nudgeAfterTurns is 0", async () => {
        const queryMock = await importQuery();
        queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

        const createSession = await importCreateSession();
        const session = await createSession(
          makeParams({
            claudeSdkConfig: { scratchpad: { nudgeAfterTurns: 0 } },
          }),
        );

        for (let i = 0; i < 10; i++) {
          await session.prompt(`turn ${i + 1}`);
        }

        for (const call of queryMock.mock.calls) {
          const p = call[0].prompt;
          const t = typeof p === "string" ? p : JSON.stringify(p);
          expect(t).not.toContain("[Hint:");
        }
      });

      it("does not inject nudge when nudgeAfterTurns is not set", async () => {
        const queryMock = await importQuery();
        queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

        const createSession = await importCreateSession();
        const session = await createSession(makeParams());

        for (let i = 0; i < 5; i++) {
          await session.prompt(`turn ${i + 1}`);
        }

        for (const call of queryMock.mock.calls) {
          const p = call[0].prompt;
          const t = typeof p === "string" ? p : JSON.stringify(p);
          expect(t).not.toContain("[Hint:");
        }
      });
    });

    describe("post-compaction nudge", () => {
      it("injects nudge after compaction when enabled", async () => {
        const queryMock = await importQuery();
        const compactionMessages = [
          { type: "system", subtype: "init", session_id: "sess_1" },
          {
            type: "system",
            subtype: "compact_boundary",
            session_id: "sess_1",
            compact_metadata: { trigger: "auto", pre_tokens: 50000 },
          },
          {
            type: "assistant",
            message: { role: "assistant", content: [{ type: "text", text: "Compacted!" }] },
          },
          { type: "result", subtype: "success", result: "Compacted!" },
        ];
        queryMock
          .mockImplementationOnce(() => makeMockQueryGen(compactionMessages)())
          .mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

        const createSession = await importCreateSession();
        const session = await createSession(
          makeParams({
            claudeSdkConfig: { scratchpad: { nudgeAfterCompaction: 1 } },
          }),
        );

        await session.prompt("first");
        await session.prompt("second");
        const sdkPrompt = queryMock.mock.calls[1][0].prompt;
        const promptText = typeof sdkPrompt === "string" ? sdkPrompt : JSON.stringify(sdkPrompt);
        expect(promptText).toContain("[Hint:");
        expect(promptText).toContain("compact");
      });

      it("does not inject nudge when nudgeAfterCompaction is 0", async () => {
        const queryMock = await importQuery();
        const compactionMessages = [
          { type: "system", subtype: "init", session_id: "sess_1" },
          {
            type: "system",
            subtype: "compact_boundary",
            session_id: "sess_1",
            compact_metadata: { trigger: "auto", pre_tokens: 50000 },
          },
          {
            type: "assistant",
            message: { role: "assistant", content: [{ type: "text", text: "Compacted!" }] },
          },
          { type: "result", subtype: "success", result: "Compacted!" },
        ];
        queryMock
          .mockImplementationOnce(() => makeMockQueryGen(compactionMessages)())
          .mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

        const createSession = await importCreateSession();
        const session = await createSession(
          makeParams({
            claudeSdkConfig: { scratchpad: { nudgeAfterCompaction: 0 } },
          }),
        );

        await session.prompt("first");
        await session.prompt("second");
        const sdkPrompt = queryMock.mock.calls[1][0].prompt;
        const promptText = typeof sdkPrompt === "string" ? sdkPrompt : JSON.stringify(sdkPrompt);
        expect(promptText).not.toContain("[Hint:");
      });
    });

    describe("system prompt auto-nudge notice", () => {
      it("includes auto-nudge notice in system prompt when triggers enabled", async () => {
        const queryMock = await importQuery();
        queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

        const createSession = await importCreateSession();
        const session = await createSession(
          makeParams({
            claudeSdkConfig: { scratchpad: { nudgeAfterTurns: 5 } },
          }),
        );
        await session.prompt("hello");

        const callArgs = queryMock.mock.calls[0][0];
        expect(callArgs.options.systemPrompt).toContain("Auto-nudges enabled");
      });

      it("does not include auto-nudge notice when no triggers enabled", async () => {
        const queryMock = await importQuery();
        queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

        const createSession = await importCreateSession();
        const session = await createSession(makeParams());
        await session.prompt("hello");

        const callArgs = queryMock.mock.calls[0][0];
        expect(callArgs.options.systemPrompt).not.toContain("Auto-nudges enabled");
      });
    });
  });
});
