import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveAgentRuntime } from "./agent-runtime.js";
import type { OpenClawConfig } from "../config/config.js";

describe("resolveAgentRuntime", () => {
  const originalEnv = process.env.OPENCLAW_AGENT_RUNTIME;

  beforeEach(() => {
    delete process.env.OPENCLAW_AGENT_RUNTIME;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OPENCLAW_AGENT_RUNTIME = originalEnv;
    } else {
      delete process.env.OPENCLAW_AGENT_RUNTIME;
    }
  });

  it("returns 'pi' by default when no config or env var", () => {
    const cfg: OpenClawConfig = {};
    expect(resolveAgentRuntime(cfg, "main")).toBe("pi");
  });

  it("returns 'pi' when agent not in list", () => {
    const cfg: OpenClawConfig = {
      agents: {
        list: [{ id: "other" }],
      },
    };
    expect(resolveAgentRuntime(cfg, "main")).toBe("pi");
  });

  describe("per-agent entry runtime", () => {
    it("returns runtime from per-agent entry when set to claude-sdk", () => {
      const cfg: OpenClawConfig = {
        agents: {
          list: [{ id: "main", runtime: "claude-sdk" } as any],
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("claude-sdk");
    });

    it("returns runtime from per-agent entry when set to pi", () => {
      const cfg: OpenClawConfig = {
        agents: {
          list: [{ id: "main", runtime: "pi" } as any],
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("pi");
    });

    it("per-agent entry takes priority over defaults", () => {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: { runtime: "pi" } as any,
          list: [{ id: "main", runtime: "claude-sdk" } as any],
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("claude-sdk");
    });

    it("per-agent entry takes priority over env var", () => {
      process.env.OPENCLAW_AGENT_RUNTIME = "pi";
      const cfg: OpenClawConfig = {
        agents: {
          list: [{ id: "main", runtime: "claude-sdk" } as any],
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("claude-sdk");
    });

    it("normalizes agent id for matching", () => {
      const cfg: OpenClawConfig = {
        agents: {
          list: [{ id: "Main", runtime: "claude-sdk" } as any],
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("claude-sdk");
      expect(resolveAgentRuntime(cfg, "MAIN")).toBe("claude-sdk");
    });
  });

  describe("global defaults runtime", () => {
    it("returns runtime from defaults when set to claude-sdk", () => {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: { runtime: "claude-sdk" } as any,
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("claude-sdk");
    });

    it("returns runtime from defaults when set to pi", () => {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: { runtime: "pi" } as any,
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("pi");
    });

    it("defaults take priority over env var", () => {
      process.env.OPENCLAW_AGENT_RUNTIME = "pi";
      const cfg: OpenClawConfig = {
        agents: {
          defaults: { runtime: "claude-sdk" } as any,
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("claude-sdk");
    });

    it("uses defaults when agent not in list", () => {
      const cfg: OpenClawConfig = {
        agents: {
          defaults: { runtime: "claude-sdk" } as any,
          list: [{ id: "other" }],
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("claude-sdk");
    });
  });

  describe("OPENCLAW_AGENT_RUNTIME env var", () => {
    it("returns claude-sdk from env var", () => {
      process.env.OPENCLAW_AGENT_RUNTIME = "claude-sdk";
      const cfg: OpenClawConfig = {};
      expect(resolveAgentRuntime(cfg, "main")).toBe("claude-sdk");
    });

    it("returns pi from env var", () => {
      process.env.OPENCLAW_AGENT_RUNTIME = "pi";
      const cfg: OpenClawConfig = {};
      expect(resolveAgentRuntime(cfg, "main")).toBe("pi");
    });

    it("ignores invalid env var values", () => {
      process.env.OPENCLAW_AGENT_RUNTIME = "invalid";
      const cfg: OpenClawConfig = {};
      expect(resolveAgentRuntime(cfg, "main")).toBe("pi");
    });
  });

  describe("priority order", () => {
    it("full priority cascade: agent > defaults > env > default", () => {
      // Set all sources
      process.env.OPENCLAW_AGENT_RUNTIME = "pi";
      const cfg: OpenClawConfig = {
        agents: {
          defaults: { runtime: "pi" } as any,
          list: [{ id: "agent-override", runtime: "claude-sdk" } as any, { id: "no-override" }],
        },
      };

      // Agent with override uses agent setting
      expect(resolveAgentRuntime(cfg, "agent-override")).toBe("claude-sdk");

      // Agent without override falls through to defaults
      expect(resolveAgentRuntime(cfg, "no-override")).toBe("pi");

      // Unknown agent falls through to defaults
      expect(resolveAgentRuntime(cfg, "unknown")).toBe("pi");
    });

    it("falls through to env when no config runtime", () => {
      process.env.OPENCLAW_AGENT_RUNTIME = "claude-sdk";
      const cfg: OpenClawConfig = {
        agents: {
          defaults: { workspace: "/some/path" }, // defaults without runtime
          list: [{ id: "main" }], // agent without runtime
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("claude-sdk");
    });
  });

  describe("edge cases", () => {
    it("handles undefined agents config", () => {
      const cfg: OpenClawConfig = { agents: undefined };
      expect(resolveAgentRuntime(cfg, "main")).toBe("pi");
    });

    it("handles null-ish list entries", () => {
      const cfg: OpenClawConfig = {
        agents: {
          list: [null as any, undefined as any, { id: "main", runtime: "claude-sdk" } as any],
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("claude-sdk");
    });

    it("handles invalid runtime values in config", () => {
      const cfg: OpenClawConfig = {
        agents: {
          list: [{ id: "main", runtime: "invalid" } as any],
        },
      };
      expect(resolveAgentRuntime(cfg, "main")).toBe("pi");
    });
  });
});
