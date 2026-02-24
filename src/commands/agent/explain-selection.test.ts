import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeEnv } from "../../runtime.js";
import { withTempHome as withTempHomeBase } from "../../../test/helpers/temp-home.js";
import * as configModule from "../../config/config.js";
import { agentExplainSelectionCommand } from "./explain-selection.js";

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  return withTempHomeBase(fn, { prefix: "openclaw-agent-explain-" });
}

const runtime: RuntimeEnv = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
};

describe("agentExplainSelectionCommand", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (runtime.log as ReturnType<typeof vi.fn>).mockClear();
  });

  it("reports selected model and session override details as JSON", async () => {
    await withTempHome(async (home) => {
      const store = path.join(home, "sessions.json");
      fs.writeFileSync(
        store,
        JSON.stringify(
          {
            "agent:main:main": {
              sessionId: "session-1",
              updatedAt: Date.now(),
              providerOverride: "openai",
              modelOverride: "gpt-5.2",
            },
          },
          null,
          2,
        ),
      );

      vi.spyOn(configModule, "loadConfig").mockReturnValue({
        agents: {
          defaults: {
            model: { primary: "anthropic/claude-opus-4-5", fallbacks: ["openai/gpt-5.2"] },
            models: {
              "anthropic/claude-opus-4-5": {},
              "openai/gpt-5.2": {},
            },
            workspace: path.join(home, "workspace"),
          },
        },
        session: { store, mainKey: "main" },
      });

      await agentExplainSelectionCommand(
        {
          sessionKey: "agent:main:main",
          json: true,
        },
        runtime,
      );

      const logged = (runtime.log as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;
      const parsed = JSON.parse(logged) as {
        selected: { provider: string; model: string };
        storedOverride?: { resolved?: { allowed: boolean } };
        steps: Array<{ source: string }>;
      };

      expect(parsed.selected).toEqual({ provider: "openai", model: "gpt-5.2" });
      expect(parsed.storedOverride?.resolved?.allowed).toBe(true);
      expect(parsed.steps.some((step) => step.source === "final")).toBe(true);
    });
  });

  it("requires a selector input", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue({});

    await expect(agentExplainSelectionCommand({}, runtime)).rejects.toThrow(
      "Pass --to <E.164>, --session-id, --session-key, or --agent",
    );
  });
});
