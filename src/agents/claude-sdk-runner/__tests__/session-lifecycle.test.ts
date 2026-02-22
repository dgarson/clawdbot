/**
 * Session Lifecycle Contract Tests
 *
 * Derived from: implementation-plan.md Section 4.1 (createClaudeSdkSession pseudocode),
 * Section 4.4 (session state architecture: resume not history concatenation, session ID persistence),
 * Section 11.1 (ClaudeSdkSession type contract),
 * claude-agent-sdk-api.md Section 2 (session ID lifecycle, resume parameter),
 * pi-runtime-baseline.md Section 3 (session interface surface used by attempt.ts).
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { ClaudeSdkSession, ClaudeSdkSessionParams } from "../types.js";

// ---------------------------------------------------------------------------
// Mock the Agent SDK query() function
// ---------------------------------------------------------------------------

// We use a factory that returns an async generator yielding mock SDKMessages
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
  const mod = await import("../create-session.js");
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

// ---------------------------------------------------------------------------
// Section 3.1: Session Creation and Resume
// ---------------------------------------------------------------------------

describe("session lifecycle — session creation and resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures session_id from Agent SDK init event", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    await session.prompt("Hello");
    expect(session.claudeSdkSessionId).toBe("sess_server_abc123");
  });

  it("passes resume parameter on subsequent prompt() calls", async () => {
    const queryMock = await importQuery();
    // First call: returns session_id via init
    queryMock.mockImplementationOnce(() => makeMockQueryGen(INIT_MESSAGES)());
    // Second call: should be called with resume option
    queryMock.mockImplementationOnce(() =>
      makeMockQueryGen([{ type: "result", subtype: "success", result: "done" }])(),
    );

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    // First prompt — captures session_id
    await session.prompt("First question");
    expect(session.claudeSdkSessionId).toBe("sess_server_abc123");

    // Second prompt — should pass resume
    await session.prompt("Follow up question");
    expect(queryMock).toHaveBeenCalledTimes(2);
    const secondCall = queryMock.mock.calls[1];
    expect(secondCall[0].options?.resume).toBe("sess_server_abc123");
  });

  it("merges caller-provided mcpServers with internal openclaw-tools bridge", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const externalServer = { type: "sse", url: "http://localhost:3001/mcp" };
    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        mcpServers: { "external-db": externalServer },
      }),
    );

    await session.prompt("Hello");

    const call = queryMock.mock.calls[0];
    const servers = call[0].options?.mcpServers as Record<string, unknown>;
    // External server is present
    expect(servers["external-db"]).toBe(externalServer);
    // Internal openclaw-tools bridge is always present
    expect(servers["openclaw-tools"]).toBeDefined();
  });

  it("openclaw-tools cannot be overwritten by caller mcpServers", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        mcpServers: { "openclaw-tools": { type: "fake", url: "http://evil" } },
      }),
    );

    await session.prompt("Hello");

    const call = queryMock.mock.calls[0];
    const servers = call[0].options?.mcpServers as Record<string, unknown>;
    // openclaw-tools must be the INTERNAL bridge, not the caller's fake
    const server = servers["openclaw-tools"] as { type: string };
    expect(server.type).not.toBe("fake");
  });

  it("does NOT concatenate message history into prompt text", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementationOnce(() => makeMockQueryGen(INIT_MESSAGES)());
    queryMock.mockImplementationOnce(() =>
      makeMockQueryGen([{ type: "result", subtype: "success", result: "done" }])(),
    );

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    // Simulate some messages history
    session.agent.replaceMessages([
      { role: "user", content: [{ type: "text", text: "Earlier message" }] },
      { role: "assistant", content: [{ type: "text", text: "Earlier response" }] },
    ] as never[]);

    await session.prompt("First question");
    await session.prompt("New question");

    // The second query call should have prompt as exactly "New question" — no history
    const secondCall = queryMock.mock.calls[1];
    expect(secondCall[0].prompt).toBe("New question");
    // history must NOT be in the prompt string
    expect(secondCall[0].prompt).not.toContain("Earlier message");
    expect(secondCall[0].prompt).not.toContain("Earlier response");
  });

  it("persists session_id via sessionManager.appendCustomEntry on dispose()", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const appendCustomEntry = vi.fn();
    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        sessionManager: { appendCustomEntry },
      }),
    );

    await session.prompt("Hello");
    session.dispose();

    expect(appendCustomEntry).toHaveBeenCalledWith(
      "openclaw:claude-sdk-session-id",
      "sess_server_abc123",
    );
  });

  it("loads session_id from claudeSdkResumeSessionId on first prompt call", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() =>
      makeMockQueryGen([{ type: "result", subtype: "success", result: "done" }])(),
    );

    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        claudeSdkResumeSessionId: "sess_prev_999",
      }),
    );

    await session.prompt("First message");

    // Should call query with resume = "sess_prev_999"
    const firstCall = queryMock.mock.calls[0];
    expect(firstCall[0].options?.resume).toBe("sess_prev_999");
  });
});

// ---------------------------------------------------------------------------
// Section 3.2: Session Interface Compatibility
// ---------------------------------------------------------------------------

describe("session lifecycle — interface compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("session has all required properties for attempt.ts duck-typed interface", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen([])());

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    expect(typeof session.prompt).toBe("function");
    expect(typeof session.steer).toBe("function");
    expect(typeof session.abort).toBe("function");
    expect(typeof session.dispose).toBe("function");
    expect(typeof session.subscribe).toBe("function");
    expect(typeof session.abortCompaction).toBe("function");
    expect(typeof session.isStreaming).toBe("boolean");
    expect(typeof session.isCompacting).toBe("boolean");
    expect(Array.isArray(session.messages)).toBe(true);
    expect(typeof session.sessionId).toBe("string");
    expect(session.agent).toBeDefined();
    expect(typeof session.agent.replaceMessages).toBe("function");
  });

  it("agent.replaceMessages updates local messages array without API call", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen([])());

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    const msg = { role: "assistant", content: [{ type: "text", text: "hi" }] };
    session.agent.replaceMessages([msg] as never[]);
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]).toEqual(msg);
    // No additional API calls triggered by replaceMessages
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("agent.streamFn is writable without error (Pi compat shim)", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen([])());

    const createSession = await importCreateSession();
    const session = (await createSession(makeParams())) as ClaudeSdkSession & {
      agent: { streamFn: unknown };
    };
    expect(() => {
      session.agent.streamFn = () => {};
    }).not.toThrow();
  });

  it("subscribe returns an unsubscribe function that stops event delivery", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    const received: unknown[] = [];
    const unsub = session.subscribe((evt: unknown) => {
      received.push(evt);
    });

    expect(typeof unsub).toBe("function");
    unsub();

    await session.prompt("Hello");
    // After unsubscribe, no events received
    expect(received).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Section 3.3: Abort and Control
// ---------------------------------------------------------------------------

describe("session lifecycle — abort and control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isStreaming is false before prompt() and false after", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());
    expect(session.isStreaming).toBe(false);
    const promptPromise = session.prompt("Hello");
    await promptPromise;
    expect(session.isStreaming).toBe(false);
  });

  it("steer() queues text for next prompt", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    await session.steer("additional context");
    // Steer queues text — it should be incorporated in the next prompt call
    // Verify the steer doesn't throw
    expect(session.isStreaming).toBe(false);
  });

  it("steer() mid-loop: interrupts current query and resumes with steer text", async () => {
    const queryMock = await importQuery();

    // First query: yields init + assistant, then a second assistant message
    // We'll steer after the first assistant message
    let steerInjected = false;
    const firstQueryMessages = [
      { type: "system", subtype: "init", session_id: "sess_steer_1" },
      {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "Working on it..." }] },
      },
      // This message should NOT be reached if steer interrupts
      {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "Still going..." }] },
      },
      { type: "result", subtype: "success" },
    ];

    // Build a generator that lets us inject steer between messages
    let messageIndex = 0;
    const firstGen = {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        if (messageIndex >= firstQueryMessages.length) {
          return { value: undefined, done: true as const };
        }
        const msg = firstQueryMessages[messageIndex++];
        return { value: msg, done: false as const };
      },
      async return() {
        return { value: undefined, done: true as const };
      },
      interrupt: vi.fn(async () => {}),
    };

    // Second query (after interrupt+resume): yields a response to the steer
    const secondGen = {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        if (steerInjected) {
          return { value: undefined, done: true as const };
        }
        steerInjected = true;
        return {
          value: {
            type: "result",
            subtype: "success",
          },
          done: false as const,
        };
      },
      async return() {
        return { value: undefined, done: true as const };
      },
      interrupt: vi.fn(async () => {}),
    };

    queryMock.mockReturnValueOnce(firstGen).mockReturnValueOnce(secondGen);

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    // Subscribe to capture events, and steer after first assistant message
    let assistantCount = 0;
    session.subscribe((evt: unknown) => {
      const e = evt as { type: string };
      if (e.type === "message_end") {
        assistantCount++;
        if (assistantCount === 1) {
          // Steer after first assistant message
          void session.steer("urgent: change direction");
        }
      }
    });

    await session.prompt("Initial task");

    // query() should have been called twice: once for initial, once for steer resume
    expect(queryMock).toHaveBeenCalledTimes(2);
    // Second call should have the steer text as prompt
    const secondCall = queryMock.mock.calls[1];
    expect(secondCall[0].prompt).toBe("urgent: change direction");
    // Second call should have resume set
    expect(secondCall[0].options?.resume).toBe("sess_steer_1");
    // interrupt() should have been called on the first query
    expect(firstGen.interrupt).toHaveBeenCalled();
  });

  it("abort() calls queryInstance.interrupt() to cancel in-flight SDK query", async () => {
    const queryMock = await importQuery();
    let interruptCalled = false;
    // Create a generator that blocks until abort, simulating a long-running query
    const blockingGen = {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        // Wait a tick to let abort fire
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { value: { type: "result", subtype: "end" }, done: false };
      },
      async return() {
        return { value: undefined, done: true };
      },
      interrupt: vi.fn(async () => {
        interruptCalled = true;
      }),
    };
    queryMock.mockReturnValue(blockingGen);

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    const promptPromise = session.prompt("Hello");
    // Abort after a microtask to ensure prompt() has started
    await new Promise((resolve) => setTimeout(resolve, 10));
    session.abort();
    await promptPromise;

    expect(interruptCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section 3.4: Messages state updated during prompt
// ---------------------------------------------------------------------------

describe("session lifecycle — messages state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appends assistant messages to state.messages during prompt()", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() =>
      makeMockQueryGen([
        { type: "system", subtype: "init", session_id: "sess_1" },
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello! How can I help?" }],
          },
        },
        { type: "result", subtype: "success" },
      ])(),
    );

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    expect(session.messages).toHaveLength(0);
    await session.prompt("Hello");

    // After prompt, messages should contain the assistant response
    expect(session.messages.length).toBeGreaterThan(0);
    const lastMsg = session.messages[session.messages.length - 1] as {
      role: string;
      content: Array<{ type: string; text?: string }>;
    };
    expect(lastMsg.role).toBe("assistant");
    expect(lastMsg.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: "Hello! How can I help?" }),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Section 3.5: Multimodal image input
// ---------------------------------------------------------------------------

describe("session lifecycle — multimodal images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes images in the prompt content when provided", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() =>
      makeMockQueryGen([{ type: "result", subtype: "success" }])(),
    );

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    await session.prompt("What's in this image?", {
      images: [{ type: "image", media_type: "image/png", data: "iVBOR_base64data" }],
    } as never);

    const call = queryMock.mock.calls[0];
    // The images should NOT be in a separate queryOptions.images field
    // (SDK doesn't support that). They should be encoded in the prompt
    // or passed as structured content.
    const options = call[0].options as Record<string, unknown>;
    expect(options.images).toBeUndefined();
    // The prompt should contain the image data somehow
    // (either as data URI in prompt text or as structured content blocks)
    const prompt = call[0].prompt;
    expect(typeof prompt === "string" ? prompt : JSON.stringify(prompt)).toContain(
      "iVBOR_base64data",
    );
  });
});

// ---------------------------------------------------------------------------
// Section 3.6: Provider env wiring
// ---------------------------------------------------------------------------

describe("session lifecycle — provider env wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes provider env to query() when provider is zai", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        claudeSdkConfig: { provider: "zai" },
        resolvedProviderAuth: { apiKey: "sk-zai-test", source: "test", mode: "api-key" },
      }),
    );

    await session.prompt("Hello");

    const call = queryMock.mock.calls[0];
    const options = call[0].options as Record<string, unknown>;
    const env = options["env"] as Record<string, string>;
    expect(env).toBeDefined();
    expect(env["ANTHROPIC_BASE_URL"]).toContain("z.ai");
    expect(env["ANTHROPIC_API_KEY"]).toBe("sk-zai-test");
    expect(env["ANTHROPIC_HAIKU_MODEL"]).toBe("GLM-4.7");
  });

  it("sets a sanitized env for claude-code provider", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const prevApiKey = process.env.ANTHROPIC_API_KEY;
    const prevAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;
    process.env.ANTHROPIC_API_KEY = "sk-ant-inherited";
    process.env.ANTHROPIC_AUTH_TOKEN = "oauth-token";

    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        claudeSdkConfig: { provider: "claude-code" },
      }),
    );

    try {
      await session.prompt("Hello");

      const call = queryMock.mock.calls[0];
      const options = call[0].options as Record<string, unknown>;
      const env = options["env"] as Record<string, string>;
      expect(env).toBeDefined();
      expect(env["ANTHROPIC_API_KEY"]).toBeUndefined();
      expect(env["ANTHROPIC_AUTH_TOKEN"]).toBeUndefined();
    } finally {
      process.env.ANTHROPIC_API_KEY = prevApiKey;
      process.env.ANTHROPIC_AUTH_TOKEN = prevAuthToken;
    }
  });

  it("omits non-claude model ids for claude-code provider so SDK uses its own default model", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        modelId: "MiniMax-M2.5",
        claudeSdkConfig: { provider: "claude-code" },
      }),
    );

    await session.prompt("Hello");

    const call = queryMock.mock.calls[0];
    const options = call[0].options as Record<string, unknown>;
    expect(options["model"]).toBeUndefined();
  });

  it("keeps claude model ids for claude-code provider", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        modelId: "claude-sonnet-4-6",
        claudeSdkConfig: { provider: "claude-code" },
      }),
    );

    await session.prompt("Hello");

    const call = queryMock.mock.calls[0];
    const options = call[0].options as Record<string, unknown>;
    expect(options["model"]).toBe("claude-sonnet-4-6");
  });
});

// ---------------------------------------------------------------------------
// Parity gap guards — these tests encode expected end-state behavior.
// Some may fail until runtime parity fixes are implemented.
// ---------------------------------------------------------------------------

describe("session lifecycle — parity guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables Claude built-in tools so OpenClaw MCP tools are the only execution path", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    await session.prompt("Hello");

    const call = queryMock.mock.calls[0];
    const options = call[0].options as Record<string, unknown>;
    expect(options.tools).toEqual([]);
  });

  it("throws when SDK returns result subtype error_* so failures do not look successful", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() =>
      makeMockQueryGen([
        { type: "system", subtype: "init", session_id: "sess_err_1" },
        {
          type: "result",
          subtype: "error_during_execution",
          is_error: true,
          errors: ["Tool execution failed"],
        },
      ])(),
    );

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    await expect(session.prompt("Hello")).rejects.toThrow("Tool execution failed");
  });

  it("prefers SDK result error message over trailing process exit code errors", async () => {
    const queryMock = await importQuery();
    let emittedResult = false;
    const iter = {
      [Symbol.asyncIterator]() {
        return this;
      },
      async next() {
        if (!emittedResult) {
          emittedResult = true;
          return {
            done: false as const,
            value: {
              type: "result",
              subtype: "error_during_execution",
              is_error: true,
              errors: ["Model validation failed"],
            },
          };
        }
        throw new Error("Claude Code process exited with code 1");
      },
      async return() {
        return { done: true as const, value: undefined };
      },
      interrupt: vi.fn(async () => {}),
    };
    queryMock.mockReturnValue(iter);

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    await expect(session.prompt("Hello")).rejects.toThrow("Model validation failed");
  });

  it("does not pass unsupported stream params through query options in claude-sdk mode", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        extraParams: {
          temperature: 0.2,
          maxTokens: 256,
        },
      }),
    );

    await session.prompt("Hello");

    const call = queryMock.mock.calls[0];
    const options = call[0].options as Record<string, unknown>;
    expect(options).not.toHaveProperty("temperature");
    expect(options).not.toHaveProperty("maxTokens");
  });

  it("adds spawnClaudeCodeProcess diagnostics hook to query options", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    await session.prompt("Hello");

    const call = queryMock.mock.calls[0];
    const options = call[0].options as Record<string, unknown>;
    expect(typeof options.spawnClaudeCodeProcess).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Section 4.1: Streaming configuration
// ---------------------------------------------------------------------------

describe("session lifecycle — streaming configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes includePartialMessages: true in query options", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(makeParams());

    await session.prompt("Hello");

    const call = queryMock.mock.calls[0];
    const options = call[0].options as Record<string, unknown>;
    expect(options.includePartialMessages).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section 4.2: User message persistence
// ---------------------------------------------------------------------------

describe("session lifecycle — user message persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists user message via appendMessage before query", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const appendMessage = vi.fn(() => "msg-id");
    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        sessionManager: { appendMessage },
      }),
    );

    await session.prompt("Hello agent");

    // appendMessage should have been called with user message
    const userCall = appendMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { role: string }).role === "user",
    );
    expect(userCall).toBeDefined();
    const userMsg = (userCall as unknown[])[0] as {
      role: string;
      content: string;
      timestamp: number;
    };
    expect(userMsg.role).toBe("user");
    expect(userMsg.content).toBe("Hello agent");
    expect(typeof userMsg.timestamp).toBe("number");
  });

  it("does not throw when sessionManager is undefined", async () => {
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const createSession = await importCreateSession();
    const session = await createSession(makeParams({ sessionManager: undefined }));

    await expect(session.prompt("Hello")).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Section 4.3: Streaming integration — stream_event messages produce real-time
// events AND the complete assistant message triggers persistence
// ---------------------------------------------------------------------------

describe("session lifecycle — streaming integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stream_event messages produce real-time events and assistant triggers persistence", async () => {
    const queryMock = await importQuery();

    const streamingMessages = [
      { type: "system", subtype: "init", session_id: "sess_stream_1" },
      // Stream events
      {
        type: "stream_event",
        event: {
          type: "message_start",
          message: { role: "assistant", content: [], model: "claude-sonnet-4-5-20250514" },
        },
      },
      {
        type: "stream_event",
        event: { type: "content_block_start", index: 0, content_block: { type: "text" } },
      },
      {
        type: "stream_event",
        event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hi" } },
      },
      {
        type: "stream_event",
        event: { type: "content_block_stop", index: 0 },
      },
      {
        type: "stream_event",
        event: { type: "message_stop" },
      },
      // Complete assistant message (triggers persistence)
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hi" }],
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      },
      { type: "result", subtype: "success" },
    ];
    queryMock.mockImplementation(() => makeMockQueryGen(streamingMessages)());

    const appendMessage = vi.fn(() => "msg-id");
    const createSession = await importCreateSession();
    const session = await createSession(
      makeParams({
        sessionManager: { appendMessage },
      }),
    );

    const receivedEvents: Array<Record<string, unknown>> = [];
    session.subscribe((evt: unknown) => {
      receivedEvents.push(evt as Record<string, unknown>);
    });

    await session.prompt("Hello");

    // Real-time events were emitted from stream_event messages
    const eventTypes = receivedEvents.map((e) => e.type);
    expect(eventTypes).toContain("message_start");
    expect(eventTypes).toContain("message_update");
    expect(eventTypes).toContain("message_end");

    // But the complete assistant message did NOT re-emit message_start/end
    // (dedup logic). Count message_start occurrences — should be exactly 1.
    const messageStartCount = eventTypes.filter((t) => t === "message_start").length;
    expect(messageStartCount).toBe(1);

    // Persistence was triggered — appendMessage called with assistant message
    const assistantCall = appendMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { role: string }).role === "assistant",
    );
    expect(assistantCall).toBeDefined();
    const persistedMsg = (assistantCall as unknown[])[0] as { role: string; api: string };
    expect(persistedMsg.api).toBe("anthropic-messages");
  });
});
