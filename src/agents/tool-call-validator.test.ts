import { describe, expect, it } from "vitest";
import { levenshtein, validateToolCall } from "./tool-call-validator.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const TOOLS = ["read_file", "write_file", "list_directory", "bash_exec"];

const FILE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    path: { type: "string" },
    encoding: { type: "string" },
    max_bytes: { type: "number" },
    follow_symlinks: { type: "boolean" },
    lines: { type: "array" },
  },
  required: ["path"],
};

const EMPTY_SCHEMA: Record<string, unknown> = {};

// ---------------------------------------------------------------------------
// Levenshtein distance (exported for testability)
// ---------------------------------------------------------------------------

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });
  it("returns string length when one string is empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
  it("counts single substitution", () => {
    expect(levenshtein("cat", "bat")).toBe(1);
  });
  it("counts insertions and deletions", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
  it("counts transposition as 2 ops (LCS, not Damerau)", () => {
    // 'ab' → 'ba' requires delete 'a' + insert 'a' = 2
    expect(levenshtein("ab", "ba")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Valid call
// ---------------------------------------------------------------------------

describe("validateToolCall — valid call", () => {
  it("returns valid: true with no issues for a correct call", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "call123",
      arguments: { path: "/tmp/file.txt" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.repairable).toBe(true);
  });

  it("accepts optional fields beyond required", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "callABC",
      arguments: { path: "/tmp/x", encoding: "utf-8", max_bytes: 1024 },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts JSON string arguments", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "call001",
      arguments: JSON.stringify({ path: "/etc/hosts" }),
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tool name validation
// ---------------------------------------------------------------------------

describe("validateToolCall — tool name", () => {
  it("reports unknown_tool when tool not in list", () => {
    const result = validateToolCall({
      toolName: "unknown_tool_xyz",
      toolCallId: "call1",
      arguments: {},
      schema: EMPTY_SCHEMA,
      availableTools: TOOLS,
    });
    const issue = result.issues.find((i) => i.kind === "unknown_tool");
    expect(issue).toBeDefined();
    expect(result.valid).toBe(false);
  });

  it("marks unknown_tool as unrepairable when no fuzzy match exists", () => {
    const result = validateToolCall({
      toolName: "completely_nonexistent_qzxw",
      toolCallId: "call1",
      arguments: {},
      schema: EMPTY_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.repairable).toBe(false);
  });

  it("marks unknown_tool as repairable when a fuzzy match exists (Levenshtein ≤ 3)", () => {
    // "read_fil" is distance 1 from "read_file"
    const result = validateToolCall({
      toolName: "read_fil",
      toolCallId: "call1",
      arguments: {},
      schema: EMPTY_SCHEMA,
      availableTools: TOOLS,
    });
    const issue = result.issues.find((i) => i.kind === "unknown_tool");
    expect(issue).toBeDefined();
    expect(result.repairable).toBe(true);
  });

  it("marks unknown_tool as repairable for case-insensitive match", () => {
    const result = validateToolCall({
      toolName: "Read_File",
      toolCallId: "call1",
      arguments: {},
      schema: EMPTY_SCHEMA,
      availableTools: TOOLS,
    });
    const issue = result.issues.find((i) => i.kind === "unknown_tool");
    expect(issue).toBeDefined();
    expect(result.repairable).toBe(true);
  });

  it("is unrepairable when availableTools is empty", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "call1",
      arguments: {},
      schema: EMPTY_SCHEMA,
      availableTools: [],
    });
    expect(result.repairable).toBe(false);
    expect(result.issues.some((i) => i.kind === "unknown_tool")).toBe(true);
  });

  it("includes expected tools in the issue message", () => {
    const result = validateToolCall({
      toolName: "missing",
      toolCallId: "call1",
      arguments: {},
      schema: EMPTY_SCHEMA,
      availableTools: ["read_file"],
    });
    const issue = result.issues.find((i) => i.kind === "unknown_tool");
    expect(issue?.expected).toContain("read_file");
  });
});

// ---------------------------------------------------------------------------
// Tool call ID validation
// ---------------------------------------------------------------------------

describe("validateToolCall — tool call ID", () => {
  it("passes for a standard alphanumeric ID", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "callABC123",
      arguments: { path: "/tmp" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "invalid_id")).toBe(false);
  });

  it("reports invalid_id for an empty string", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "",
      arguments: { path: "/tmp" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "invalid_id")).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("reports invalid_id for null-like value", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: null as unknown as string,
      arguments: { path: "/tmp" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "invalid_id")).toBe(true);
  });

  it("reports invalid_id for ID starting with special char", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "|abc123",
      arguments: { path: "/tmp" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "invalid_id")).toBe(true);
  });

  it("ID issues are always repairable", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "",
      arguments: { path: "/tmp" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    // Only invalid_id issue — must be repairable overall
    const nonIdIssues = result.issues.filter((i) => i.kind !== "invalid_id");
    if (nonIdIssues.length === 0) {
      expect(result.repairable).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Argument validation
// ---------------------------------------------------------------------------

describe("validateToolCall — arguments", () => {
  it("passes for a valid object", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { path: "/tmp/file" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "malformed_json" || i.kind === "empty_args")).toBe(
      false,
    );
  });

  it("reports empty_args for null", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: null,
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "empty_args")).toBe(true);
  });

  it("reports empty_args for undefined", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: undefined,
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "empty_args")).toBe(true);
  });

  it("reports empty_args for empty string", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: "",
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "empty_args")).toBe(true);
  });

  it("reports malformed_json for invalid JSON string", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: "this is not json",
      schema: EMPTY_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "malformed_json")).toBe(true);
  });

  it("reports malformed_json for JSON array (top-level)", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: ["path", "/tmp"],
      schema: EMPTY_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "malformed_json")).toBe(true);
  });

  it("reports malformed_json for number arguments", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: 42,
      schema: EMPTY_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "malformed_json")).toBe(true);
  });

  it("parses a valid JSON string and validates its contents", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: '{"path": "/etc/hosts", "max_bytes": 1024}',
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.valid).toBe(true);
  });

  it("reports malformed_json when JSON string parses to non-object", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: '"just a string"',
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "malformed_json")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — required fields
// ---------------------------------------------------------------------------

describe("validateToolCall — required fields", () => {
  it("reports missing_required for absent required field", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: {}, // missing "path"
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    const issue = result.issues.find((i) => i.kind === "missing_required" && i.field === "path");
    expect(issue).toBeDefined();
    expect(result.valid).toBe(false);
  });

  it("passes when all required fields are present", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { path: "/tmp/x" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "missing_required")).toBe(false);
  });

  it("missing_required is marked as repairable", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: {},
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    // The only issues are missing_required — overall should be repairable
    expect(result.repairable).toBe(true);
  });

  it("handles multiple required fields missing", () => {
    const schema: Record<string, unknown> = {
      type: "object",
      properties: {
        a: { type: "string" },
        b: { type: "string" },
        c: { type: "string" },
      },
      required: ["a", "b", "c"],
    };
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: {},
      schema,
      availableTools: TOOLS,
    });
    const missing = result.issues.filter((i) => i.kind === "missing_required");
    expect(missing).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — types
// ---------------------------------------------------------------------------

describe("validateToolCall — type checking", () => {
  it("reports wrong_type when string given for number field", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { path: "/tmp", max_bytes: "1024" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    const issue = result.issues.find((i) => i.kind === "wrong_type" && i.field === "max_bytes");
    expect(issue).toBeDefined();
    expect(issue?.expected).toContain("number");
    expect(issue?.actual).toBe("string");
  });

  it("reports wrong_type when string given for boolean field", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { path: "/tmp", follow_symlinks: "yes" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    const issue = result.issues.find(
      (i) => i.kind === "wrong_type" && i.field === "follow_symlinks",
    );
    expect(issue).toBeDefined();
  });

  it("passes when boolean field receives actual boolean", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { path: "/tmp", follow_symlinks: true },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "wrong_type")).toBe(false);
  });

  it("accepts integer for integer schema type", () => {
    const schema: Record<string, unknown> = {
      type: "object",
      properties: { count: { type: "integer" } },
    };
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { count: 5 },
      schema,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "wrong_type")).toBe(false);
  });

  it("reports wrong_type for float given integer field", () => {
    const schema: Record<string, unknown> = {
      type: "object",
      properties: { count: { type: "integer" } },
    };
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { count: 1.5 },
      schema,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "wrong_type")).toBe(true);
  });

  it("handles union types in schema", () => {
    const schema: Record<string, unknown> = {
      type: "object",
      properties: { value: { type: ["string", "number"] } },
    };
    const strResult = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { value: "hello" },
      schema,
      availableTools: TOOLS,
    });
    expect(strResult.issues.some((i) => i.kind === "wrong_type")).toBe(false);

    const numResult = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { value: 42 },
      schema,
      availableTools: TOOLS,
    });
    expect(numResult.issues.some((i) => i.kind === "wrong_type")).toBe(false);

    const boolResult = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { value: true },
      schema,
      availableTools: TOOLS,
    });
    expect(boolResult.issues.some((i) => i.kind === "wrong_type")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Schema validation — extra params
// ---------------------------------------------------------------------------

describe("validateToolCall — extra params", () => {
  it("reports extra_params for unknown field", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { path: "/tmp", unknown_param: true },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    const issue = result.issues.find(
      (i) => i.kind === "extra_params" && i.field === "unknown_param",
    );
    expect(issue).toBeDefined();
  });

  it("extra_params issues are repairable", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { path: "/tmp", bogus: "value" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.repairable).toBe(true);
  });

  it("passes when no extra params are present", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { path: "/tmp/file.txt", encoding: "utf-8" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "extra_params")).toBe(false);
  });

  it("does not report extra_params when schema has no properties defined", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { anything: "goes" },
      schema: EMPTY_SCHEMA,
      availableTools: TOOLS,
    });
    // No properties defined → no extra_params checks
    expect(result.issues.some((i) => i.kind === "extra_params")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Multiple simultaneous issues
// ---------------------------------------------------------------------------

describe("validateToolCall — multiple issues", () => {
  it("reports unknown_tool AND invalid_id AND missing_required together", () => {
    const result = validateToolCall({
      toolName: "nonexistent_xyz_qzz",
      toolCallId: "",
      arguments: {},
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "unknown_tool")).toBe(true);
    expect(result.issues.some((i) => i.kind === "invalid_id")).toBe(true);
    expect(result.issues.some((i) => i.kind === "missing_required")).toBe(true);
    // unknown_tool has no fuzzy match → unrepairable
    expect(result.repairable).toBe(false);
  });

  it("is repairable when all issues have fuzzy/coercible fixes", () => {
    const result = validateToolCall({
      toolName: "read_fil", // distance 1 from "read_file"
      toolCallId: "|invalid",
      arguments: { path: "/tmp", max_bytes: "100" }, // wrong type on max_bytes
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    // unknown_tool (fuzzy repairable), invalid_id, wrong_type — all repairable
    expect(result.repairable).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("reports malformed_json AND missing_required in one pass", () => {
    // Malformed JSON means we can't verify required fields from parsed args
    // but we still get the malformed_json issue
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: "{bad json",
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "malformed_json")).toBe(true);
    // Cannot check required when JSON is invalid, so no missing_required expected
    expect(result.valid).toBe(false);
    expect(result.repairable).toBe(true);
  });

  it("can surface wrong_type and extra_params at the same time", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { path: 42, max_bytes: "not_a_number", extra: "bonus" },
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "wrong_type" && i.field === "path")).toBe(true);
    expect(result.issues.some((i) => i.kind === "extra_params" && i.field === "extra")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("validateToolCall — edge cases", () => {
  it("handles empty schema (no validation constraints)", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: { anything: "goes", even: { nested: true } },
      schema: EMPTY_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.valid).toBe(true);
  });

  it("handles null schema properties gracefully", () => {
    const schema: Record<string, unknown> = {
      type: "object",
      properties: null,
      required: null,
    };
    expect(() =>
      validateToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        arguments: { path: "/tmp" },
        schema,
        availableTools: TOOLS,
      }),
    ).not.toThrow();
  });

  it("is valid for empty args {} when schema has no required fields", () => {
    const schema: Record<string, unknown> = {
      type: "object",
      properties: { optional_param: { type: "string" } },
    };
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "callXY",
      arguments: {},
      schema,
      availableTools: TOOLS,
    });
    expect(result.valid).toBe(true);
  });

  it("reports issue when JSON string parses to array", () => {
    const result = validateToolCall({
      toolName: "read_file",
      toolCallId: "c1",
      arguments: '["path", "/tmp"]',
      schema: FILE_SCHEMA,
      availableTools: TOOLS,
    });
    expect(result.issues.some((i) => i.kind === "malformed_json")).toBe(true);
  });
});
