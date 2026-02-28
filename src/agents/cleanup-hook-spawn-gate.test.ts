import { describe, expect, it, vi } from "vitest";
import { runInCleanupHookScope } from "./cleanup-hook-gate.js";

// Prevent heavy transitive module init from running during import.
vi.mock("./tools/sessions-spawn.subagent.js", () => ({
  executeSessionsSpawnSubagent: vi.fn().mockResolvedValue({ status: "accepted" }),
}));
vi.mock("./tools/sessions-spawn.acp.js", () => ({
  executeSessionsSpawnAcp: vi.fn().mockResolvedValue({ status: "accepted" }),
}));
vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({}),
}));

const { executeSessionsSpawnTool } = await import("./tools/sessions-spawn.execute.js");

describe("spawn gate: executeSessionsSpawnTool", () => {
  it("returns error result when called inside cleanup scope", async () => {
    let result: { status: string; error?: string } | undefined;
    await runInCleanupHookScope(async () => {
      result = await executeSessionsSpawnTool({ task: "do something" });
    });
    expect(result).toMatchObject({
      status: "error",
      error: expect.stringContaining("cleanup hook"),
    });
  });

  it("proceeds past the gate when called outside cleanup scope", async () => {
    // Outside scope the gate is not triggered — normal spawn logic runs.
    // The mocked subagent handler returns "accepted".
    const result = await executeSessionsSpawnTool({ task: "do something" });
    expect(result.status).toBe("accepted");
  });
});
