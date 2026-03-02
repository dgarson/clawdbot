import { describe, it, expect } from "vitest";
import { shouldBlockTool, checkFileScope, checkToolAccess } from "./boundaries.js";

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

describe("checkFileScope", () => {
  it("returns null when no scope defined", () => {
    expect(checkFileScope(undefined, "src/foo.ts")).toBeNull();
    expect(checkFileScope([], "src/foo.ts")).toBeNull();
  });

  it("returns null when no file path provided", () => {
    expect(checkFileScope(["src/"], undefined)).toBeNull();
  });

  it("allows file within directory scope (trailing slash)", () => {
    expect(checkFileScope(["src/components/"], "src/components/Button.tsx")).toBeNull();
  });

  it("allows file within directory scope (no trailing slash)", () => {
    expect(checkFileScope(["src/components"], "src/components/Button.tsx")).toBeNull();
  });

  it("allows exact file match", () => {
    expect(checkFileScope(["src/index.ts"], "src/index.ts")).toBeNull();
  });

  it("blocks file outside all scopes", () => {
    const result = checkFileScope(["src/components/"], "lib/utils.ts");
    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("outside assigned scope"),
    });
  });

  it("allows file matching any of multiple scopes", () => {
    expect(checkFileScope(["src/", "tests/"], "tests/foo.test.ts")).toBeNull();
  });

  it("handles relative paths with leading ./", () => {
    expect(checkFileScope(["src/"], "./src/foo.ts")).toBeNull();
    expect(checkFileScope(["./src/"], "src/foo.ts")).toBeNull();
  });

  it("handles double slashes in paths", () => {
    expect(checkFileScope(["src/"], "src//foo.ts")).toBeNull();
  });
});

describe("checkToolAccess", () => {
  it("blocks role-restricted tool before checking scope", () => {
    const result = checkToolAccess("scout", "write_file", ["src/"], { file_path: "src/foo.ts" });
    expect(result).toEqual({ block: true, reason: expect.stringContaining("scout") });
  });

  it("blocks out-of-scope write_file for builder", () => {
    const result = checkToolAccess("builder", "write_file", ["src/"], { file_path: "lib/foo.ts" });
    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("outside assigned scope"),
    });
  });

  it("allows in-scope write_file for builder", () => {
    const result = checkToolAccess("builder", "write_file", ["src/"], { file_path: "src/foo.ts" });
    expect(result).toBeNull();
  });

  it("allows write_file when no scope set", () => {
    const result = checkToolAccess("builder", "write_file", undefined, {
      file_path: "anywhere/foo.ts",
    });
    expect(result).toBeNull();
  });

  it("checks file_path param for write_file", () => {
    const result = checkToolAccess("builder", "write_file", ["src/"], { file_path: "src/bar.ts" });
    expect(result).toBeNull();
  });

  it("checks path param as fallback", () => {
    const result = checkToolAccess("builder", "edit_file", ["src/"], { path: "lib/bar.ts" });
    expect(result).toEqual({
      block: true,
      reason: expect.stringContaining("outside assigned scope"),
    });
  });

  it("skips scope check for non-file tools", () => {
    const result = checkToolAccess("builder", "read_file", ["src/"], { file_path: "lib/foo.ts" });
    expect(result).toBeNull();
  });
});
