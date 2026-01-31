import { describe, expect, it } from "vitest";
import { resolveAgentRuntimeKind } from "./main-agent-runtime-factory.js";
import type { MoltbotConfig } from "../config/config.js";

describe("resolveAgentRuntimeKind", () => {
  it("returns 'pi' as default when no config is set", () => {
    const config = {} as MoltbotConfig;
    const result = resolveAgentRuntimeKind(config, "main");
    expect(result).toBe("pi");
  });

  it("returns agents.defaults.runtime when set", () => {
    const config = {
      agents: {
        defaults: {
          runtime: "ccsdk" as const,
        },
      },
    } as MoltbotConfig;
    const result = resolveAgentRuntimeKind(config, "main");
    expect(result).toBe("ccsdk");
  });

  it("returns per-agent runtime when set", () => {
    const config = {
      agents: {
        defaults: {
          runtime: "pi" as const,
        },
        list: [
          {
            id: "test-agent",
            runtime: "ccsdk" as const,
          },
        ],
      },
    } as MoltbotConfig;
    const result = resolveAgentRuntimeKind(config, "test-agent");
    expect(result).toBe("ccsdk");
  });

  it("per-agent runtime overrides defaults", () => {
    const config = {
      agents: {
        defaults: {
          runtime: "ccsdk" as const,
        },
        list: [
          {
            id: "pi-agent",
            runtime: "pi" as const,
          },
        ],
      },
    } as MoltbotConfig;
    const result = resolveAgentRuntimeKind(config, "pi-agent");
    expect(result).toBe("pi");
  });

  it("falls back to defaults if per-agent runtime not set", () => {
    const config = {
      agents: {
        defaults: {
          runtime: "ccsdk" as const,
        },
        list: [
          {
            id: "other-agent",
            // no runtime set
          },
        ],
      },
    } as MoltbotConfig;
    const result = resolveAgentRuntimeKind(config, "other-agent");
    expect(result).toBe("ccsdk");
  });
});
