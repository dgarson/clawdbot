import { describe, it, expect } from "vitest";
import { shouldBlockTool } from "./boundaries.js";

describe("shouldBlockTool", () => {
  it("blocks write tools for scout", () => {
    const result = shouldBlockTool("scout", "write_file");
    expect(result).toEqual({ block: true, reason: expect.stringContaining("scout") });
  });

  it("allows read tools for scout", () => {
    const result = shouldBlockTool("scout", "read_file");
    expect(result).toBeNull();
  });

  it("allows write tools for builder", () => {
    const result = shouldBlockTool("builder", "write_file");
    expect(result).toBeNull();
  });

  it("blocks orchestration tools for builder", () => {
    const result = shouldBlockTool("builder", "decompose_task");
    expect(result).toEqual({ block: true, reason: expect.stringContaining("builder") });
  });

  it("allows orchestration tools for lead", () => {
    const result = shouldBlockTool("lead", "decompose_task");
    expect(result).toBeNull();
  });

  it("returns null for unknown roles", () => {
    const result = shouldBlockTool(undefined, "write_file");
    expect(result).toBeNull();
  });
});
