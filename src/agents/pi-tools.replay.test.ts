import { describe, expect, it, vi } from "vitest";
import { ReplayInterceptor } from "../replay/interceptor.js";
import { wrapToolWithReplayInterceptor } from "./pi-tools.replay.js";

describe("wrapToolWithReplayInterceptor", () => {
  it("replays recorded tool output without invoking the wrapped tool", async () => {
    const execute = vi.fn(async () => {
      throw new Error("should not execute");
    });
    const replay = new ReplayInterceptor({
      mode: "replay",
      events: [
        {
          seq: 0,
          ts: "2026-02-24T00:00:00.000Z",
          category: "tool",
          type: "tool.call",
          data: {
            toolName: "read",
            params: { path: "file.txt" },
            outcome: { ok: true, result: { text: "cached" } },
          },
        },
      ],
    });
    const tool = wrapToolWithReplayInterceptor(
      {
        name: "read",
        description: "",
        parameters: { type: "object", properties: {} },
        execute,
      },
      replay,
    );

    const result = await tool.execute?.("call-2", { path: "file.txt" });
    expect(result).toEqual({ text: "cached" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("preserves extra execute arguments used by client tools", async () => {
    const interceptor = new ReplayInterceptor({ mode: "off" });
    const execute = vi.fn(async (...args: unknown[]) => ({ argsLength: args.length }));
    const tool = wrapToolWithReplayInterceptor(
      {
        name: "client_tool",
        description: "",
        parameters: { type: "object", properties: {} },
        execute,
      },
      interceptor,
    );

    const extensionContext = { ui: true };
    const result = await tool.execute?.(
      "call-1",
      { value: 1 },
      undefined,
      undefined,
      extensionContext,
    );

    expect(result).toEqual({ argsLength: 5 });
    expect(execute).toHaveBeenCalledWith(
      "call-1",
      { value: 1 },
      undefined,
      undefined,
      extensionContext,
    );
  });
});
