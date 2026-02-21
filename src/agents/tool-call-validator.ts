/**
 * Tool-call validation layer for non-Anthropic models.
 *
 * Validates tool calls produced by models with known tool-calling quirks
 * (MiniMax M2.5, GLM-5, Grok 4) and determines whether issues are
 * repairable by the companion repair module.
 */

export type ToolCallIssue = {
  kind:
    | "missing_required"
    | "wrong_type"
    | "malformed_json"
    | "unknown_tool"
    | "invalid_id"
    | "empty_args"
    | "extra_params";
  field?: string;
  expected?: string;
  actual?: string;
  message: string;
};

export type ToolCallValidation = {
  valid: boolean;
  issues: ToolCallIssue[];
  /**
   * true  → the repair function can likely fix all issues
   * false → at least one issue is irreparable (e.g. unknown tool with no fuzzy match)
   */
  repairable: boolean;
};

// ---------------------------------------------------------------------------
// Levenshtein distance (no external deps)
// ---------------------------------------------------------------------------

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // dp[i][j] = edit distance between a[0..i-1] and b[0..j-1]
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = Array.from({ length: n + 1 }, () => 0);
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]!;
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hasFuzzyToolMatch(name: string, available: string[]): boolean {
  const lower = name.toLowerCase();
  for (const tool of available) {
    if (tool.toLowerCase() === lower) {
      return true;
    }
    if (levenshtein(name, tool) <= 3) {
      return true;
    }
  }
  return false;
}

function getJsonType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function matchesSchemaType(value: unknown, schemaType: string | string[]): boolean {
  const types = Array.isArray(schemaType) ? schemaType : [schemaType];
  const actualType = getJsonType(value);
  return types.some((t) => {
    if (t === actualType) {
      return true;
    }
    // JSON Schema: "integer" is a subset of "number"
    if (t === "integer" && typeof value === "number" && Number.isInteger(value)) {
      return true;
    }
    return false;
  });
}

/** Returns true if value could be coerced to targetType by the repair module. */
function isCoercible(value: unknown, targetType: string): boolean {
  switch (targetType) {
    case "boolean":
      if (typeof value === "string") {
        const lower = value.toLowerCase();
        return lower === "true" || lower === "false" || lower === "1" || lower === "0";
      }
      if (typeof value === "number") {
        return value === 0 || value === 1;
      }
      return false;
    case "number":
    case "integer":
      return typeof value === "string" && !Number.isNaN(Number(value));
    case "string":
      return value !== null && value !== undefined && typeof value !== "object";
    case "array":
      return !Array.isArray(value);
    default:
      return false;
  }
}

function isToolCallIdValid(id: unknown): boolean {
  return typeof id === "string" && id.length > 0 && /^[a-zA-Z0-9]/.test(id);
}

// ---------------------------------------------------------------------------
// Main validation function
// ---------------------------------------------------------------------------

export function validateToolCall(params: {
  toolName: string;
  toolCallId: string;
  arguments: unknown;
  schema: Record<string, unknown>;
  availableTools: string[];
}): ToolCallValidation {
  const issues: ToolCallIssue[] = [];
  // Tracks which issue indices are definitively unrepairable.
  const unrepairableIndices = new Set<number>();

  // --- 1. Tool name ---
  if (!params.availableTools.includes(params.toolName)) {
    const canFuzzy = hasFuzzyToolMatch(params.toolName, params.availableTools);
    const idx = issues.length;
    issues.push({
      kind: "unknown_tool",
      expected:
        params.availableTools.length > 0
          ? params.availableTools.join(", ")
          : "(no tools available)",
      actual: params.toolName,
      message: canFuzzy
        ? `Unknown tool "${params.toolName}" — a fuzzy match exists and may be corrected`
        : `Unknown tool "${params.toolName}" — no similar tool found; cannot repair`,
    });
    if (!canFuzzy) {
      unrepairableIndices.add(idx);
    }
  }

  // --- 2. Tool call ID ---
  if (!isToolCallIdValid(params.toolCallId)) {
    issues.push({
      kind: "invalid_id",
      expected: "non-empty string starting with [a-zA-Z0-9]",
      actual: String(params.toolCallId ?? ""),
      message:
        !params.toolCallId || String(params.toolCallId).trim() === ""
          ? "Tool call ID is empty or missing — a new ID will be generated"
          : `Tool call ID "${params.toolCallId}" has invalid format — will be sanitized`,
    });
    // Always repairable
  }

  // --- 3. Arguments: parse/type check ---
  let parsedArgs: Record<string, unknown> | null = null;
  const raw = params.arguments;

  if (raw === null || raw === undefined) {
    issues.push({
      kind: "empty_args",
      message: "Arguments are null or undefined — will default to {}",
    });
    parsedArgs = {};
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "null" || trimmed === "undefined") {
      issues.push({
        kind: "empty_args",
        message: `Arguments string is empty or null-like ("${trimmed}") — will default to {}`,
      });
      parsedArgs = {};
    } else {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          parsedArgs = parsed as Record<string, unknown>;
        } else {
          issues.push({
            kind: "malformed_json",
            actual: Array.isArray(parsed) ? "array" : typeof parsed,
            expected: "object",
            message: `Arguments JSON parsed to non-object type (${Array.isArray(parsed) ? "array" : typeof parsed})`,
          });
          parsedArgs = {};
        }
      } catch {
        issues.push({
          kind: "malformed_json",
          actual: trimmed.slice(0, 120),
          expected: "valid JSON object",
          message: `Arguments string is not valid JSON: "${trimmed.slice(0, 120)}"`,
        });
        // parsedArgs stays null; no schema checks possible — but still repairable
      }
    }
  } else if (!Array.isArray(raw) && typeof raw === "object") {
    parsedArgs = raw as Record<string, unknown>;
  } else if (Array.isArray(raw)) {
    issues.push({
      kind: "malformed_json",
      actual: "array",
      expected: "object",
      message: "Arguments is an array; expected a JSON object",
    });
    parsedArgs = {};
  } else {
    issues.push({
      kind: "malformed_json",
      actual: typeof raw,
      expected: "object",
      message: `Arguments have unexpected type "${typeof raw}"`,
    });
    parsedArgs = {};
  }

  // --- 4. Schema-based checks (only when we have a parsed object) ---
  if (parsedArgs !== null) {
    const properties = params.schema.properties as
      | Record<string, Record<string, unknown>>
      | undefined;
    const required = params.schema.required as string[] | undefined;

    // 4a. Required fields
    if (Array.isArray(required)) {
      for (const reqField of required) {
        if (!(reqField in parsedArgs)) {
          issues.push({
            kind: "missing_required",
            field: reqField,
            expected: "present",
            actual: "absent",
            message: `Required field "${reqField}" is missing from arguments`,
          });
          // Repairable: repair module will attempt relocation / normalization
        }
      }
    }

    if (properties) {
      const knownParams = new Set(Object.keys(properties));

      for (const [field, value] of Object.entries(parsedArgs)) {
        const propSchema = properties[field];

        // 4b. Extra parameters
        if (!propSchema) {
          issues.push({
            kind: "extra_params",
            field,
            message: `Parameter "${field}" is not defined in the schema`,
          });
          // Always repairable (strip it)
          continue;
        }

        // 4c. Type mismatch
        const schemaType = propSchema.type as string | string[] | undefined;
        if (schemaType !== undefined && !matchesSchemaType(value, schemaType)) {
          const types = Array.isArray(schemaType) ? schemaType : [schemaType];
          const coercible = types.some((t) => isCoercible(value, t));
          issues.push({
            kind: "wrong_type",
            field,
            expected: types.join(" | "),
            actual: getJsonType(value),
            message:
              `Field "${field}": expected ${types.join(" | ")}, ` +
              `got ${getJsonType(value)}${coercible ? " (coercible)" : ""}`,
          });
          // Repairable via coercion (we are optimistic even when not directly coercible)
        }
      }

      // Satisfy linter — knownParams is only used in the loop above
      void knownParams;
    }
  }

  const valid = issues.length === 0;
  const repairable = unrepairableIndices.size === 0;

  return { valid, issues, repairable };
}
