import { describe, expect, it, vi } from "vitest";
import { ReplayInterceptor } from "./interceptor.js";
import { InMemoryReplayRecorder } from "./recorder.js";

describe("ReplayInterceptor", () => {
  it("captures tool calls and results into replay events", async () => {
    const recorder = new InMemoryReplayRecorder({
      replayId: "replay-1",
      sessionId: "session-1",
      agentId: "agent-1",
    });
    const interceptor = new ReplayInterceptor({ mode: "capture", recorder });

    const result = await interceptor.execute({
      toolName: "web_search",
      toolCallId: "call-1",
      params: { query: "test" },
      invoke: async () => ({ ok: true, answer: "done" }),
    });

    expect(result).toEqual({ ok: true, answer: "done" });

    const events = recorder.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      category: "tool",
      type: "tool.call",
      correlationId: "call-1",
      data: {
        toolName: "web_search",
        params: { query: "test" },
        outcome: { ok: true, result: { ok: true, answer: "done" } },
      },
    });
  });

  it("replays recorded results without invoking the live tool", async () => {
    const interceptor = new ReplayInterceptor({
      mode: "replay",
      events: [
        {
          seq: 0,
          ts: "2026-02-24T00:00:00.000Z",
          category: "tool",
          type: "tool.call",
          data: {
            toolName: "exec",
            params: { command: "echo hi" },
            outcome: { ok: true, result: { stdout: "hi\n" } },
          },
        },
      ],
    });

    const invoke = vi.fn(async () => ({ stdout: "should-not-run" }));
    const result = await interceptor.execute({
      toolName: "exec",
      toolCallId: "call-1",
      params: { command: "echo hi" },
      invoke,
    });

    expect(result).toEqual({ stdout: "hi\n" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("redacts sensitive data in captured params and results", async () => {
    const recorder = new InMemoryReplayRecorder({
      replayId: "replay-2",
      sessionId: "session-1",
      agentId: "agent-1",
    });
    const interceptor = new ReplayInterceptor({ mode: "capture", recorder, redacted: true });

    const secret = "sk-1234567890abcdefghijklmnop";
    await interceptor.execute({
      toolName: "web_fetch",
      params: { header: `Authorization: Bearer ${secret}` },
      invoke: async () => ({ token: secret }),
    });

    const event = recorder.getEvents()[0];
    const payload = event?.data as {
      params: { header: string };
      outcome: { result: { token: string } };
    };
    expect(payload.params.header).toContain("Bearer sk-123");
    expect(payload.params.header).not.toContain(secret);
    expect(payload.outcome.result.token).toContain("sk-123");
    expect(payload.outcome.result.token).not.toContain(secret);
  });

  it("replays recorded tool errors", async () => {
    const interceptor = new ReplayInterceptor({
      mode: "replay",
      events: [
        {
          seq: 0,
          ts: "2026-02-24T00:00:00.000Z",
          category: "tool",
          type: "tool.call",
          data: {
            toolName: "exec",
            params: { command: "false" },
            outcome: {
              ok: false,
              error: { name: "Error", message: "command failed" },
            },
          },
        },
      ],
    });

    await expect(
      interceptor.execute({
        toolName: "exec",
        params: { command: "false" },
        invoke: async () => ({ ok: true }),
      }),
    ).rejects.toThrow("command failed");
  });
});
