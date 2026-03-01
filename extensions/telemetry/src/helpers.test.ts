import { describe, expect, it } from "vitest";
import {
  captureInput,
  captureResult,
  estimateBytes,
  extractExecCommand,
  extractFilePath,
  extractToolMeta,
  generateEventId,
  shouldExternalize,
} from "./helpers.js";

describe("generateEventId", () => {
  it("returns a string prefixed with evt_", () => {
    const id = generateEventId();
    expect(id).toMatch(/^evt_[0-9a-f]{16}$/);
  });

  it("returns unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEventId()));
    expect(ids.size).toBe(100);
  });
});

describe("estimateBytes", () => {
  it("returns 0 for null or undefined", () => {
    expect(estimateBytes(null)).toBe(0);
    expect(estimateBytes(undefined)).toBe(0);
  });

  it("counts bytes of a JSON-serialized string", () => {
    const bytes = estimateBytes("hello");
    // JSON.stringify("hello") = '"hello"' which is 7 bytes
    expect(bytes).toBe(7);
  });

  it("counts bytes of an object", () => {
    const bytes = estimateBytes({ a: 1 });
    expect(bytes).toBeGreaterThan(0);
  });
});

describe("shouldExternalize", () => {
  it("returns false when threshold is 0 (keep forever)", () => {
    expect(shouldExternalize("x".repeat(100_000), 0)).toBe(false);
  });

  it("returns false when data is smaller than threshold", () => {
    expect(shouldExternalize("hi", 4096)).toBe(false);
  });

  it("returns true when data exceeds threshold", () => {
    const bigString = "x".repeat(5000);
    expect(shouldExternalize(bigString, 4096)).toBe(true);
  });
});

describe("extractFilePath", () => {
  it("returns file_path for 'read' tool", () => {
    expect(extractFilePath("Read", { file_path: "/src/foo.ts" })).toBe("/src/foo.ts");
  });

  it("returns path for 'write' tool when file_path absent", () => {
    expect(extractFilePath("write", { path: "/out/bar.js" })).toBe("/out/bar.js");
  });

  it("returns path for 'glob' tool", () => {
    expect(extractFilePath("Glob", { path: "src/**/*.ts" })).toBe("src/**/*.ts");
  });

  it("returns path for 'grep' tool", () => {
    expect(extractFilePath("grep", { path: "/src" })).toBe("/src");
  });

  it("returns undefined for 'bash' tool", () => {
    expect(extractFilePath("bash", { command: "ls" })).toBeUndefined();
  });

  it("returns undefined for unknown tool with no path params", () => {
    expect(extractFilePath("MyCustomTool", {})).toBeUndefined();
  });
});

describe("extractExecCommand", () => {
  it("returns command for 'bash' tool", () => {
    expect(extractExecCommand("Bash", { command: "npm test" })).toBe("npm test");
  });

  it("returns command for 'exec' tool", () => {
    expect(extractExecCommand("exec", { command: "echo hi" })).toBe("echo hi");
  });

  it("returns undefined for 'read' tool", () => {
    expect(extractExecCommand("read", { command: "ls" })).toBeUndefined();
  });

  it("returns undefined when params has no command field", () => {
    expect(extractExecCommand("bash", {})).toBeUndefined();
  });
});

describe("extractToolMeta", () => {
  it("extracts filePath for read tool", () => {
    const meta = extractToolMeta("read", { file_path: "/foo/bar.ts" });
    expect(meta.filePath).toBe("/foo/bar.ts");
    expect(meta.execCommand).toBeUndefined();
  });

  it("extracts execCommand for bash tool", () => {
    const meta = extractToolMeta("bash", { command: "git status" });
    expect(meta.execCommand).toBe("git status");
    expect(meta.filePath).toBeUndefined();
  });

  it("returns empty object when no meta can be extracted", () => {
    const meta = extractToolMeta("SomeTool", {});
    expect(Object.keys(meta)).toHaveLength(0);
  });

  it("handles non-object params gracefully", () => {
    const meta = extractToolMeta("read", null);
    expect(Object.keys(meta)).toHaveLength(0);
  });
});

describe("captureResult", () => {
  it("returns undefined for mode 'none'", () => {
    expect(captureResult("some output", "none")).toBeUndefined();
  });

  it("returns full value for mode 'full'", () => {
    const result = { a: 1 };
    expect(captureResult(result, "full")).toBe(result);
  });

  it("truncates to 500 chars for mode 'summary' (string input)", () => {
    const longStr = "x".repeat(600);
    const captured = captureResult(longStr, "summary");
    expect(typeof captured).toBe("string");
    expect((captured as string).length).toBe(500);
  });

  it("truncates JSON-stringified value for mode 'summary' (object input)", () => {
    const obj = { data: "y".repeat(1000) };
    const captured = captureResult(obj, "summary");
    expect(typeof captured).toBe("string");
    expect((captured as string).length).toBe(500);
  });
});

describe("captureInput", () => {
  it("returns undefined for mode 'none'", () => {
    expect(captureInput({ a: "value" }, "none")).toBeUndefined();
  });

  it("returns full params for mode 'full'", () => {
    const params = { file_path: "/foo.ts", content: "hello" };
    expect(captureInput(params, "full")).toBe(params);
  });

  it("truncates long string values for mode 'summary'", () => {
    const params = { short: "hi", long: "z".repeat(600) };
    const captured = captureInput(params, "summary")!;
    expect(captured.short).toBe("hi");
    expect(typeof captured.long).toBe("string");
    expect((captured.long as string).length).toBeLessThanOrEqual(520); // 500 + suffix note
    expect((captured.long as string)).toContain("600 chars");
  });

  it("preserves non-string values for mode 'summary'", () => {
    const params = { count: 42, flag: true };
    const captured = captureInput(params, "summary")!;
    expect(captured.count).toBe(42);
    expect(captured.flag).toBe(true);
  });
});
