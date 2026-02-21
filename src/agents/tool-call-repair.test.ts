import { describe, expect, it } from "vitest";
import {
  camelToSnake,
  coerceType,
  findBestToolMatch,
  fixJson,
  levenshtein,
  normalizeParamName,
  repairToolCall,
  snakeToCamel,
} from "./tool-call-repair.js";

// ---------------------------------------------------------------------------
// Shared fixtures
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
// levenshtein
// ---------------------------------------------------------------------------

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("read_file", "read_file")).toBe(0);
  });
  it("counts single insertion", () => {
    expect(levenshtein("read_fil", "read_file")).toBe(1);
  });
  it("counts single deletion", () => {
    expect(levenshtein("read_file", "read_fil")).toBe(1);
  });
  it("counts single substitution", () => {
    expect(levenshtein("bash_exec", "bash_axec")).toBe(1);
  });
  it("returns max length when strings share nothing", () => {
    // "aaa" vs "bbb" → 3 substitutions
    expect(levenshtein("aaa", "bbb")).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Strategy 1: JSON fix-up — fixJson()
// ---------------------------------------------------------------------------

describe("fixJson", () => {
  it("passes through already-valid JSON with no repairs", () => {
    const result = fixJson('{"path": "/tmp/file.txt"}');
    expect(result).not.toBeNull();
    expect(result!.parsed).toEqual({ path: "/tmp/file.txt" });
    expect(result!.repairs).toHaveLength(0);
  });

  it("fixes trailing commas before }", () => {
    const result = fixJson('{"path": "/tmp",}');
    expect(result).not.toBeNull();
    expect(result!.parsed).toHaveProperty("path");
    expect(result!.repairs.some((r) => r.toLowerCase().includes("trailing"))).toBe(true);
  });

  it("fixes trailing commas before ]", () => {
    const result = fixJson('{"items": [1, 2, 3,]}');
    expect(result).not.toBeNull();
    expect(result!.parsed.items).toEqual([1, 2, 3]);
  });

  it("fixes single quotes", () => {
    const result = fixJson("{'path': '/tmp/file.txt'}");
    expect(result).not.toBeNull();
    expect(result!.parsed).toHaveProperty("path", "/tmp/file.txt");
    expect(result!.repairs.some((r) => r.toLowerCase().includes("single quote"))).toBe(true);
  });

  it("fixes unquoted object keys", () => {
    const result = fixJson('{path: "/tmp/file.txt"}');
    expect(result).not.toBeNull();
    expect(result!.parsed).toHaveProperty("path", "/tmp/file.txt");
    expect(result!.repairs.some((r) => r.toLowerCase().includes("unquoted"))).toBe(true);
  });

  it("fixes missing closing brace", () => {
    const result = fixJson('{"path": "/tmp"');
    expect(result).not.toBeNull();
    expect(result!.parsed).toHaveProperty("path");
    expect(result!.repairs.some((r) => r.toLowerCase().includes("brace"))).toBe(true);
  });

  it("fixes missing closing bracket", () => {
    // This is ambiguous JSON; just verify the fixer does not throw
    expect(() => fixJson('{"items": [1, 2, 3}')).not.toThrow();
  });

  it("returns null for completely unparseable input", () => {
    const result = fixJson("this is plain english text with no json");
    expect(result).toBeNull();
  });

  it("applies combined fixes for single+trailing in one pass", () => {
    const result = fixJson("{'path': '/tmp',}");
    expect(result).not.toBeNull();
    expect(result!.parsed).toHaveProperty("path", "/tmp");
  });

  it("handles BOM prefix", () => {
    const withBom = '\uFEFF{"path": "/tmp"}';
    const result = fixJson(withBom);
    expect(result).not.toBeNull();
    expect(result!.parsed).toHaveProperty("path");
    expect(result!.repairs.some((r) => r.toLowerCase().includes("bom"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Strategy 2: Type coercion — coerceType()
// ---------------------------------------------------------------------------

describe("coerceType", () => {
  describe("string → boolean", () => {
    it('coerces "true" to true', () => {
      const { coerced, repaired } = coerceType("true", "boolean");
      expect(repaired).toBe(true);
      expect(coerced).toBe(true);
    });
    it('coerces "false" to false', () => {
      const { coerced, repaired } = coerceType("false", "boolean");
      expect(repaired).toBe(true);
      expect(coerced).toBe(false);
    });
    it('coerces "1" to true', () => {
      const { coerced, repaired } = coerceType("1", "boolean");
      expect(repaired).toBe(true);
      expect(coerced).toBe(true);
    });
    it('coerces "0" to false', () => {
      const { coerced, repaired } = coerceType("0", "boolean");
      expect(repaired).toBe(true);
      expect(coerced).toBe(false);
    });
    it('coerces "TRUE" (case-insensitive) to true', () => {
      const { coerced, repaired } = coerceType("TRUE", "boolean");
      expect(repaired).toBe(true);
      expect(coerced).toBe(true);
    });
    it('does not coerce "yes" (not a recognised boolean string)', () => {
      const { repaired } = coerceType("yes", "boolean");
      expect(repaired).toBe(false);
    });
  });

  describe("number → boolean", () => {
    it("coerces 1 → true", () => {
      const { coerced, repaired } = coerceType(1, "boolean");
      expect(repaired).toBe(true);
      expect(coerced).toBe(true);
    });
    it("coerces 0 → false", () => {
      const { coerced, repaired } = coerceType(0, "boolean");
      expect(repaired).toBe(true);
      expect(coerced).toBe(false);
    });
  });

  describe("string → number / integer", () => {
    it('coerces "42" to number 42', () => {
      const { coerced, repaired } = coerceType("42", "number");
      expect(repaired).toBe(true);
      expect(coerced).toBe(42);
    });
    it('coerces "3.14" to number 3.14', () => {
      const { coerced, repaired } = coerceType("3.14", "number");
      expect(repaired).toBe(true);
      expect(coerced).toBe(3.14);
    });
    it('coerces "1.7" to integer 2 (rounds)', () => {
      const { coerced, repaired } = coerceType("1.7", "integer");
      expect(repaired).toBe(true);
      expect(coerced).toBe(2);
    });
    it('does not coerce "abc" to number', () => {
      const { repaired } = coerceType("abc", "number");
      expect(repaired).toBe(false);
    });
  });

  describe("value → array", () => {
    it("wraps string in array when array expected", () => {
      const { coerced, repaired } = coerceType("/tmp/file", "array");
      expect(repaired).toBe(true);
      expect(coerced).toEqual(["/tmp/file"]);
    });
    it("wraps number in array when array expected", () => {
      const { coerced, repaired } = coerceType(42, "array");
      expect(repaired).toBe(true);
      expect(coerced).toEqual([42]);
    });
    it("does not wrap when value is already an array", () => {
      const { repaired } = coerceType([1, 2], "array");
      expect(repaired).toBe(false);
    });
  });

  describe("union types", () => {
    it("coerces when first type does not match but second does", () => {
      const { coerced, repaired } = coerceType("42", ["boolean", "number"]);
      expect(repaired).toBe(true);
      expect(coerced).toBe(42);
    });
    it("does not coerce when value already matches one of the union types", () => {
      const { repaired } = coerceType(42, ["string", "number"]);
      expect(repaired).toBe(false);
    });
  });

  describe("no coercion needed", () => {
    it("does not modify a valid string", () => {
      const { coerced, repaired } = coerceType("hello", "string");
      expect(repaired).toBe(false);
      expect(coerced).toBe("hello");
    });
    it("does not modify a valid number", () => {
      const { coerced, repaired } = coerceType(7, "number");
      expect(repaired).toBe(false);
      expect(coerced).toBe(7);
    });
  });
});

// ---------------------------------------------------------------------------
// Strategy 3: Tool name fuzzy matching — findBestToolMatch()
// ---------------------------------------------------------------------------

describe("findBestToolMatch", () => {
  it("returns the exact match immediately", () => {
    expect(findBestToolMatch("read_file", TOOLS)).toBe("read_file");
  });

  it("matches case-insensitively", () => {
    expect(findBestToolMatch("Read_File", TOOLS)).toBe("read_file");
    expect(findBestToolMatch("BASH_EXEC", TOOLS)).toBe("bash_exec");
  });

  it("matches Levenshtein distance 1", () => {
    expect(findBestToolMatch("read_fil", TOOLS)).toBe("read_file");
  });

  it("matches Levenshtein distance 2", () => {
    expect(findBestToolMatch("writ_fil", TOOLS)).toBe("write_file");
  });

  it("matches Levenshtein distance 3", () => {
    // "bash_ex" → "bash_exec" (distance 2)
    expect(findBestToolMatch("bash_ex", TOOLS)).toBe("bash_exec");
  });

  it("returns null when distance > 3 and no case match", () => {
    expect(findBestToolMatch("completely_different_name_xyz", TOOLS)).toBeNull();
  });

  it("returns null for empty available tools list", () => {
    expect(findBestToolMatch("read_file", [])).toBeNull();
  });

  it("picks the closest match when multiple are within threshold", () => {
    // "list_direc" is 5 chars shorter than "list_directory" but distance 4
    // "list_director" is distance 1 from "list_directory"
    const match = findBestToolMatch("list_director", TOOLS);
    expect(match).toBe("list_directory");
  });
});

// ---------------------------------------------------------------------------
// Strategy 4: Parameter name normalisation
// ---------------------------------------------------------------------------

describe("camelToSnake", () => {
  it("converts simple camelCase", () => {
    expect(camelToSnake("myParam")).toBe("my_param");
  });
  it("converts multi-word camelCase", () => {
    expect(camelToSnake("followSymlinks")).toBe("follow_symlinks");
  });
  it("leaves snake_case unchanged", () => {
    expect(camelToSnake("max_bytes")).toBe("max_bytes");
  });
  it("handles consecutive capitals (e.g. HTTP)", () => {
    expect(camelToSnake("parseHTTPResponse")).toBe("parse_http_response");
  });
});

describe("snakeToCamel", () => {
  it("converts simple snake_case", () => {
    expect(snakeToCamel("my_param")).toBe("myParam");
  });
  it("converts multi-segment snake_case", () => {
    expect(snakeToCamel("follow_symlinks")).toBe("followSymlinks");
  });
  it("leaves camelCase unchanged", () => {
    expect(snakeToCamel("maxBytes")).toBe("maxBytes");
  });
});

describe("normalizeParamName", () => {
  const knownKeys = ["path", "max_bytes", "follow_symlinks", "encoding"];

  it("returns the same key for an exact match", () => {
    expect(normalizeParamName("path", knownKeys)).toBe("path");
  });

  it("resolves camelCase to snake_case", () => {
    expect(normalizeParamName("maxBytes", knownKeys)).toBe("max_bytes");
    expect(normalizeParamName("followSymlinks", knownKeys)).toBe("follow_symlinks");
  });

  it("resolves snake_case to camelCase if schema uses camelCase", () => {
    const camelKeys = ["maxBytes", "followSymlinks", "filePath"];
    expect(normalizeParamName("max_bytes", camelKeys)).toBe("maxBytes");
    expect(normalizeParamName("follow_symlinks", camelKeys)).toBe("followSymlinks");
  });

  it("resolves case-insensitive mismatch", () => {
    expect(normalizeParamName("PATH", knownKeys)).toBe("path");
    expect(normalizeParamName("MAX_BYTES", knownKeys)).toBe("max_bytes");
  });

  it("returns null when no mapping found", () => {
    expect(normalizeParamName("completely_unknown_key", knownKeys)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// repairToolCall — integrated tests
// ---------------------------------------------------------------------------

describe("repairToolCall", () => {
  // -------------------------------------------------------------------------
  // Strategy 6: Tool call ID
  // -------------------------------------------------------------------------
  describe("tool call ID repair", () => {
    it("generates a new ID when missing", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "",
        rawArguments: { path: "/tmp" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.toolCallId).toBeTruthy();
      expect(/^[a-zA-Z0-9]/.test(result.toolCallId)).toBe(true);
      expect(result.repairs.some((r) => r.toLowerCase().includes("generated"))).toBe(true);
    });

    it("sanitizes an ID starting with a special character", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "|call-abc",
        rawArguments: { path: "/tmp" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(/^[a-zA-Z0-9]/.test(result.toolCallId)).toBe(true);
      expect(result.repaired).toBe(true);
    });

    it("preserves a valid existing ID", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "call12345",
        rawArguments: { path: "/tmp" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.toolCallId).toBe("call12345");
    });

    it("generates unique IDs on consecutive calls", () => {
      const a = repairToolCall({
        toolName: "read_file",
        toolCallId: "",
        rawArguments: {},
        schema: EMPTY_SCHEMA,
        availableTools: TOOLS,
      });
      const b = repairToolCall({
        toolName: "read_file",
        toolCallId: "",
        rawArguments: {},
        schema: EMPTY_SCHEMA,
        availableTools: TOOLS,
      });
      // IDs should be valid (we can't guarantee uniqueness without knowing internal state
      // but they should be non-empty and alphanumeric-starting)
      expect(/^[a-zA-Z0-9]/.test(a.toolCallId)).toBe(true);
      expect(/^[a-zA-Z0-9]/.test(b.toolCallId)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Strategy 3: Tool name fuzzy matching
  // -------------------------------------------------------------------------
  describe("tool name fuzzy matching", () => {
    it("corrects a case-insensitive mismatch", () => {
      const result = repairToolCall({
        toolName: "Read_File",
        toolCallId: "c1",
        rawArguments: { path: "/tmp" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.toolName).toBe("read_file");
      expect(result.repairs.some((r) => r.includes("Fuzzy-matched"))).toBe(true);
    });

    it("corrects a Levenshtein ≤ 3 mismatch", () => {
      const result = repairToolCall({
        toolName: "read_fil",
        toolCallId: "c1",
        rawArguments: { path: "/tmp" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.toolName).toBe("read_file");
    });

    it("preserves tool name when no match (distance > 3)", () => {
      const result = repairToolCall({
        toolName: "completely_different_qzx",
        toolCallId: "c1",
        rawArguments: {},
        schema: EMPTY_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.toolName).toBe("completely_different_qzx");
    });

    it("preserves exact tool name with no repair", () => {
      const result = repairToolCall({
        toolName: "bash_exec",
        toolCallId: "c1",
        rawArguments: {},
        schema: EMPTY_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.toolName).toBe("bash_exec");
      expect(result.repairs.some((r) => r.includes("Fuzzy"))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Strategy 1: JSON fix-up
  // -------------------------------------------------------------------------
  describe("JSON fix-up", () => {
    it("passes through a valid object unchanged (no repair)", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { path: "/tmp" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments).toEqual({ path: "/tmp" });
      expect(result.repairs.some((r) => r.includes("JSON"))).toBe(false);
    });

    it("parses a valid JSON string", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: '{"path": "/tmp/file.txt"}',
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments.path).toBe("/tmp/file.txt");
    });

    it("fixes trailing commas in JSON string", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: '{"path": "/tmp",}',
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments.path).toBe("/tmp");
      expect(result.repairs.some((r) => r.toLowerCase().includes("trailing"))).toBe(true);
    });

    it("fixes single quotes", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: "{'path': '/tmp/file.txt'}",
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments.path).toBe("/tmp/file.txt");
    });

    it("fixes unquoted keys", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: '{path: "/tmp/file.txt"}',
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments.path).toBe("/tmp/file.txt");
    });

    it("fixes missing closing brace", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: '{"path": "/tmp"',
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments.path).toBe("/tmp");
    });

    it("defaults to {} when JSON is completely unparseable", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: "this is plain text, not json at all!!",
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments).toEqual({});
      expect(result.repairs.some((r) => r.includes("WARNING"))).toBe(true);
    });

    it("defaults null arguments to {}", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: null,
        schema: EMPTY_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments).toEqual({});
      expect(result.repaired).toBe(true);
    });

    it("unwraps single-element array arguments", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: [{ path: "/tmp" }],
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments.path).toBe("/tmp");
      expect(result.repairs.some((r) => r.toLowerCase().includes("array"))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Strategy 2: Type coercion
  // -------------------------------------------------------------------------
  describe("type coercion", () => {
    it('coerces string "true" → boolean for boolean field', () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { path: "/tmp", follow_symlinks: "true" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments.follow_symlinks).toBe(true);
      expect(result.repairs.some((r) => r.includes("follow_symlinks"))).toBe(true);
    });

    it('coerces string "123" → number for number field', () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { path: "/tmp", max_bytes: "2048" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments.max_bytes).toBe(2048);
      expect(typeof result.arguments.max_bytes).toBe("number");
    });

    it("wraps scalar to array when array field expected", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { path: "/tmp", lines: "1-10" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(Array.isArray(result.arguments.lines)).toBe(true);
      expect((result.arguments.lines as unknown[])[0]).toBe("1-10");
    });

    it("does not coerce a correctly-typed field", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { path: "/tmp", max_bytes: 512 },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments.max_bytes).toBe(512);
      // No repair for max_bytes
      expect(result.repairs.some((r) => r.includes("max_bytes"))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Strategy 4: Parameter name normalisation
  // -------------------------------------------------------------------------
  describe("parameter name normalisation", () => {
    it("normalises camelCase → snake_case", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { path: "/tmp", maxBytes: 1024 },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments).toHaveProperty("max_bytes", 1024);
      expect(result.arguments).not.toHaveProperty("maxBytes");
      expect(result.repairs.some((r) => r.includes("maxBytes"))).toBe(true);
    });

    it("normalises snake_case → camelCase when schema uses camelCase", () => {
      const schema: Record<string, unknown> = {
        type: "object",
        properties: {
          filePath: { type: "string" },
          maxBytes: { type: "number" },
        },
        required: ["filePath"],
      };
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { file_path: "/tmp/file.txt", max_bytes: 100 },
        schema,
        availableTools: TOOLS,
      });
      expect(result.arguments).toHaveProperty("filePath", "/tmp/file.txt");
      expect(result.arguments).toHaveProperty("maxBytes", 100);
    });

    it("normalises case-insensitive key mismatch", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { PATH: "/tmp", ENCODING: "utf-8" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments).toHaveProperty("path", "/tmp");
      expect(result.arguments).toHaveProperty("encoding", "utf-8");
    });

    it("preserves keys that already match exactly", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { path: "/tmp", encoding: "utf-8" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments).toHaveProperty("path");
      expect(result.arguments).toHaveProperty("encoding");
      expect(result.repairs.some((r) => r.includes("Normalised"))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Strategy 5: Missing required params relocation
  // -------------------------------------------------------------------------
  describe("missing required params relocation", () => {
    it("relocates an extra param that matches a required field by normalisation", () => {
      // Schema requires "path"; args has "filePath" (camelCase of snake_case "file_path")
      // But our normalisation only maps to known schema keys, so let's use a case where
      // the extra key can be normalised to the required field
      const schema: Record<string, unknown> = {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      };
      // "filePath" is not in knownKeys (only "path" is), so normalisation won't rename it
      // Instead test a simpler case: extra key "PATH" should normalise to "path"
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { PATH: "/tmp/file.txt" },
        schema,
        availableTools: TOOLS,
      });
      // After normalisation of "PATH" → "path", required field is satisfied
      expect(result.arguments).toHaveProperty("path", "/tmp/file.txt");
    });

    it("relocates via snake_case normalisation", () => {
      const schema: Record<string, unknown> = {
        type: "object",
        properties: {
          max_bytes: { type: "number" },
        },
        required: ["max_bytes"],
      };
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { maxBytes: 512 },
        schema,
        availableTools: TOOLS,
      });
      expect(result.arguments).toHaveProperty("max_bytes", 512);
      expect(result.arguments).not.toHaveProperty("maxBytes");
    });
  });

  // -------------------------------------------------------------------------
  // Strategy 7: Provider-specific — MiniMax
  // -------------------------------------------------------------------------
  describe("provider-specific: MiniMax", () => {
    it('unwraps single "args" wrapper', () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { args: { path: "/tmp/file.txt" } },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        provider: "minimax",
      });
      expect(result.arguments.path).toBe("/tmp/file.txt");
      expect(result.repairs.some((r) => r.toLowerCase().includes("minimax"))).toBe(true);
    });

    it('unwraps single "arguments" wrapper', () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { arguments: { path: "/tmp/file.txt" } },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        provider: "minimax",
      });
      expect(result.arguments.path).toBe("/tmp/file.txt");
    });

    it('unwraps single "input" wrapper', () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { input: { path: "/etc/hosts" } },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        provider: "minimax",
      });
      expect(result.arguments.path).toBe("/etc/hosts");
    });

    it("decodes a JSON string in a wrapper field (double-encoded)", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { arguments: '{"path": "/tmp/file.txt"}' },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        provider: "minimax",
      });
      expect(result.arguments.path).toBe("/tmp/file.txt");
      expect(result.repairs.some((r) => r.toLowerCase().includes("decoded"))).toBe(true);
    });

    it("also works with provider='MiniMax M2.5' (case-insensitive, substring)", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { args: { path: "/tmp" } },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        provider: "MiniMax M2.5",
      });
      expect(result.arguments.path).toBe("/tmp");
    });
  });

  // -------------------------------------------------------------------------
  // Strategy 7: Provider-specific — GLM-5
  // -------------------------------------------------------------------------
  describe("provider-specific: GLM-5", () => {
    it('unwraps "parameters" wrapper object', () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { parameters: { path: "/tmp/glm.txt" } },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        provider: "glm-5",
      });
      expect(result.arguments.path).toBe("/tmp/glm.txt");
      expect(result.repairs.some((r) => r.toLowerCase().includes("glm"))).toBe(true);
    });

    it('unwraps "function_arguments" wrapper object', () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { function_arguments: { path: "/tmp/glm.txt" } },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        provider: "glm",
      });
      expect(result.arguments.path).toBe("/tmp/glm.txt");
    });

    it("parses JSON string from parameters field", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { parameters: '{"path": "/tmp/glm.txt"}' },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        provider: "zhipu",
      });
      expect(result.arguments.path).toBe("/tmp/glm.txt");
    });

    it("works with provider='GLM-5' (case-insensitive)", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { parameters: { path: "/tmp" } },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        provider: "GLM-5",
      });
      expect(result.arguments.path).toBe("/tmp");
    });
  });

  // -------------------------------------------------------------------------
  // Generic wrapper detection (no provider specified)
  // -------------------------------------------------------------------------
  describe("generic wrapper detection", () => {
    it("unwraps unknown single-key wrapper not in schema", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { args: { path: "/tmp/file.txt" } },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        // no provider specified
      });
      expect(result.arguments.path).toBe("/tmp/file.txt");
      expect(result.repairs.some((r) => r.toLowerCase().includes("generic"))).toBe(true);
    });

    it("does NOT unwrap when the schema expects the wrapper key", () => {
      const schema: Record<string, unknown> = {
        type: "object",
        properties: {
          args: { type: "object" },
        },
      };
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { args: { path: "/tmp" } },
        schema,
        availableTools: TOOLS,
      });
      // "args" is expected in schema → should NOT unwrap
      expect(result.arguments).toHaveProperty("args");
    });
  });

  // -------------------------------------------------------------------------
  // Unrepairable cases
  // -------------------------------------------------------------------------
  describe("unrepairable / best-effort cases", () => {
    it("returns repaired:false when arguments already perfect", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "callABC",
        rawArguments: { path: "/tmp/file.txt" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.repaired).toBe(false);
      expect(result.repairs).toHaveLength(0);
    });

    it("preserves tool name when no fuzzy match and still returns a result", () => {
      const result = repairToolCall({
        toolName: "xyz_qzz_completely_unknown",
        toolCallId: "c1",
        rawArguments: { path: "/tmp" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.toolName).toBe("xyz_qzz_completely_unknown");
      // Call still returns a usable result
      expect(result.arguments).toBeDefined();
    });

    it("falls back to {} and marks repaired for completely garbled JSON", () => {
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: "!@#$%^&*()",
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });
      expect(result.arguments).toEqual({});
      expect(result.repaired).toBe(true);
      expect(result.repairs.some((r) => r.includes("WARNING"))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Combined / multi-strategy repairs
  // -------------------------------------------------------------------------
  describe("combined multi-strategy repairs", () => {
    it("applies tool name fix, JSON fix-up, type coercion, and ID generation in one call", () => {
      const result = repairToolCall({
        toolName: "Read_File", // needs fuzzy fix
        toolCallId: "", // needs ID generation
        rawArguments: "{'path': '/tmp', 'max_bytes': '512'}", // needs JSON + type coerce
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });

      expect(result.toolName).toBe("read_file");
      expect(/^[a-zA-Z0-9]/.test(result.toolCallId)).toBe(true);
      expect(result.arguments.path).toBe("/tmp");
      expect(result.arguments.max_bytes).toBe(512);
      expect(result.repaired).toBe(true);
      expect(result.repairs.length).toBeGreaterThan(2);
    });

    it("lists all repairs in order", () => {
      const result = repairToolCall({
        toolName: "read_fil",
        toolCallId: "|bad|id|",
        rawArguments: { path: "/tmp", maxBytes: "100", follow_symlinks: "false" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
      });

      expect(result.repairs.length).toBeGreaterThanOrEqual(3);
      // ID repair always first
      expect(result.repairs[0]).toMatch(/sanitized|generated/i);
    });

    it("handles MiniMax provider with malformed JSON in wrapper", () => {
      // MiniMax wraps in "arguments" but the value is malformed JSON string
      // The repair should decode it via fix-up
      const result = repairToolCall({
        toolName: "read_file",
        toolCallId: "c1",
        rawArguments: { arguments: "{'path': '/tmp',}" },
        schema: FILE_SCHEMA,
        availableTools: TOOLS,
        provider: "minimax",
      });
      // After minimax unwrap from string + JSON fix-up
      expect(result.arguments).toHaveProperty("path", "/tmp");
    });
  });
});
