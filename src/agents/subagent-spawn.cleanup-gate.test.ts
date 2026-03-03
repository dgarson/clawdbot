import { describe, expect, it, vi } from "vitest";
import { runInCleanupHookScope } from "./cleanup-hook-gate.js";

// Break circular dep: subagent-spawn → (chain) → sessions-spawn-tool → subagent-spawn
// which causes SUBAGENT_SPAWN_MODES to be undefined during module init.
vi.mock("./tools/sessions-spawn-tool.js", () => ({
  createSessionsSpawnTool: vi.fn().mockReturnValue({ name: "sessions_spawn" }),
}));
vi.mock("../gateway/call.js", () => ({
  callGateway: vi.fn().mockResolvedValue({ status: "accepted" }),
}));
vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return { ...actual, loadConfig: vi.fn().mockReturnValue({}) };
});
vi.mock("../plugins/hook-runner-global.js", () => ({
  getGlobalHookRunner: vi.fn().mockReturnValue(null),
}));

const { spawnSubagentDirect } = await import("./subagent-spawn.js");

describe("spawn gate: spawnSubagentDirect", () => {
  it("throws when called inside cleanup hook scope", async () => {
    await runInCleanupHookScope(async () => {
      await expect(spawnSubagentDirect({ task: "do something" }, {})).rejects.toThrow(
        "cleanup hook",
      );
    });
  });

  it("does not throw the cleanup gate error when called outside scope", async () => {
    // Outside scope: gate check is skipped, normal logic runs.
    // With mocked deps it may throw for other reasons — confirm not the gate error.
    try {
      await spawnSubagentDirect({ task: "test" }, {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).not.toContain("cleanup hook");
    }
  });
});
