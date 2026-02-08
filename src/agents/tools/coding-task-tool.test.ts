import { describe, expect, it, vi } from "vitest";
import "../test-helpers/fast-core-tools.js";
import type { OpenClawConfig } from "../../config/config.js";

vi.mock("../claude-agent-sdk/sdk.js", () => ({
  loadClaudeAgentSdk: async () => {
    throw new Error("mock: sdk unavailable");
  },
}));

import { createCodingTaskTool } from "./coding-task-tool.js";

describe("coding_task tool", () => {
  it("is disabled by default", async () => {
    const tool = createCodingTaskTool();
    const result = await tool.execute("call1", { task: "Plan how to refactor foo" });
    expect(result.details).toMatchObject({ status: "disabled" });
  });

  it("registers when enabled and fails gracefully when SDK is missing", async () => {
    const cfg: OpenClawConfig = {
      tools: { codingTask: { enabled: true } },
    };
    const tool = createCodingTaskTool({ config: cfg });

    const result = await tool.execute("call1", { task: "Plan how to refactor foo" });
    expect(result.details).toMatchObject({
      status: "error",
      error: "sdk_unavailable",
    });
  });
});
