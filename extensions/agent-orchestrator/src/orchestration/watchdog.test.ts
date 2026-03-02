import { describe, it, expect } from "vitest";
import type { OrchestratorSessionState } from "../types.js";
import { detectStaleAgents } from "./watchdog.js";

describe("detectStaleAgents", () => {
  it("detects stale agents", () => {
    const now = Date.now();
    const sessions = new Map<string, OrchestratorSessionState>([
      ["s1", { role: "builder", status: "active", lastActivity: now - 600_000 }],
      ["s2", { role: "scout", status: "active", lastActivity: now - 100_000 }],
      ["s3", { role: "reviewer", status: "completed", lastActivity: now - 900_000 }],
    ]);

    const stale = detectStaleAgents(sessions, 300_000, now);
    expect(stale).toHaveLength(1);
    expect(stale[0].sessionKey).toBe("s1");
    expect(stale[0].elapsedMs).toBeGreaterThanOrEqual(600_000);
  });

  it("ignores completed agents", () => {
    const now = Date.now();
    const sessions = new Map<string, OrchestratorSessionState>([
      ["s1", { role: "builder", status: "completed", lastActivity: now - 999_000 }],
    ]);
    const stale = detectStaleAgents(sessions, 300_000, now);
    expect(stale).toHaveLength(0);
  });

  it("ignores agents without lastActivity", () => {
    const sessions = new Map<string, OrchestratorSessionState>([
      ["s1", { role: "builder", status: "active" }],
    ]);
    const stale = detectStaleAgents(sessions, 300_000, Date.now());
    expect(stale).toHaveLength(0);
  });
});
