/**
 * Tool-call repair module for non-Anthropic models.
 *
 * Applies a prioritised sequence of repair strategies to tool calls that
 * fail validation, producing a best-effort corrected call.  All repair
 * logic is self-contained — no external runtime dependencies.
 *
 * Supported providers with specific fixes:
 *   - MiniMax M2.5  — extra argument wrapping
 *   - GLM-5 / ZhipuAI — alternative field names
 *   - Grok 4        — similar wrapping patterns to MiniMax
 */

import { createHash } from "node:crypto";

export type RepairResult = {
  /** true if at least one change was made to the original call */
  repaired: boolean;
  toolName: string;
  toolCallId: string;
  arguments: Record<string, unknown>;
  /** Human-readable list of changes made, in application order */
  repairs: string[];
};

// ---------------------------------------------------------------------------
// Levenshtein distance (no external deps)
// ---------------------------------------------------------------------------

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
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
// Strategy 3: Tool name fuzzy matching
// ---------------------------------------------------------------------------

export function findBestToolMatch(name: string, available: string[]): string | null {
  if (available.includes(name)) {
    return name;
  }

  // Case-insensitive exact match
  const lower = name.toLowerCase();
  const caseMatch = available.find((t) => t.toLowerCase() === lower);
  if (caseMatch !== undefined) {
    return caseMatch;
  }

  // Levenshtein ≤ 3
  let bestMatch: string | null = null;
  let bestDist = 4; // exclusive upper bound
  for (const tool of available) {
    const dist = levenshtein(name, tool);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = tool;
    }
  }
  return bestMatch;
}

// ---------------------------------------------------------------------------
// Strategy 4: Parameter name normalisation (camelCase ↔ snake_case)
// ---------------------------------------------------------------------------

export function camelToSnake(s: string): string {
  return s
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Given an argument key and a list of known schema keys, return the canonical
 * key name, or null if no mapping is found.
 */
export function normalizeParamName(argKey: string, knownKeys: string[]): string | null {
  if (knownKeys.includes(argKey)) {
    return argKey;
  }

  const asSnake = camelToSnake(argKey);
  if (knownKeys.includes(asSnake)) {
    return asSnake;
  }

  const asCamel = snakeToCamel(argKey);
  if (knownKeys.includes(asCamel)) {
    return asCamel;
  }

  // Case-insensitive fallback
  const lower = argKey.toLowerCase();
  const ciMatch = knownKeys.find((k) => k.toLowerCase() === lower);
  if (ciMatch !== undefined) {
    return ciMatch;
  }

  // Try camelCase / snake_case of known keys
  for (const known of knownKeys) {
    if (camelToSnake(known) === argKey) {
      return known;
    }
    if (snakeToCamel(known) === argKey) {
      return known;
    }
    if (camelToSnake(known).toLowerCase() === lower) {
      return known;
    }
    if (snakeToCamel(known).toLowerCase() === lower) {
      return known;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Strategy 1: JSON fix-up
// ---------------------------------------------------------------------------

function tryParse(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return null;
}

export function fixJson(raw: string): {
  parsed: Record<string, unknown>;
  repairs: string[];
} | null {
  const repairs: string[] = [];

  // Fast path: already valid
  const direct = tryParse(raw);
  if (direct) {
    return { parsed: direct, repairs: [] };
  }

  // Remove UTF-8 BOM before any trimming (trim() also strips \uFEFF)
  let s = raw;
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
    repairs.push("Removed BOM character");
    const v = tryParse(s);
    if (v) {
      return { parsed: v, repairs };
    }
  }

  s = s.trim();

  // Replace single quotes → double quotes
  // (conservative: only when the string contains single-quoted constructs)
  if (s.includes("'")) {
    const doubled = s.replace(/'/g, '"');
    const v = tryParse(doubled);
    if (v) {
      repairs.push("Replaced single quotes with double quotes");
      return { parsed: v, repairs };
    }
    // Keep the doubled version as base for subsequent repairs
    s = doubled;
    repairs.push("Replaced single quotes with double quotes (continuing)");
  }

  // Fix trailing commas before } or ]
  const noTrailing = s.replace(/,(\s*[}\]])/g, "$1");
  if (noTrailing !== s) {
    repairs.push("Removed trailing commas");
    s = noTrailing;
    const v = tryParse(s);
    if (v) {
      return { parsed: v, repairs };
    }
  }

  // Quote unquoted object keys:  {key: value} → {"key": value}
  const quotedKeys = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
  if (quotedKeys !== s) {
    repairs.push("Quoted unquoted object keys");
    s = quotedKeys;
    const v = tryParse(s);
    if (v) {
      return { parsed: v, repairs };
    }
  }

  // Add missing opening brace if the string looks like key:value pairs
  if (!s.startsWith("{") && !s.startsWith("[") && s.includes(":")) {
    const withOpen = "{" + s;
    const openB = (withOpen.match(/\{/g) ?? []).length;
    const closeB = (withOpen.match(/\}/g) ?? []).length;
    const withBoth = openB > closeB ? withOpen + "}".repeat(openB - closeB) : withOpen;
    const v = tryParse(withBoth);
    if (v) {
      repairs.push("Added missing opening (and closing) braces");
      return { parsed: v, repairs };
    }
    s = withOpen;
  }

  // Add missing closing brackets/braces
  const openBrackets = (s.match(/\[/g) ?? []).length;
  const closeBrackets = (s.match(/\]/g) ?? []).length;
  const openBraces = (s.match(/\{/g) ?? []).length;
  const closeBraces = (s.match(/\}/g) ?? []).length;

  let fixed = s;
  if (openBrackets > closeBrackets) {
    fixed += "]".repeat(openBrackets - closeBrackets);
    repairs.push(`Added ${openBrackets - closeBrackets} missing closing bracket(s)`);
  }
  if (openBraces > closeBraces) {
    fixed += "}".repeat(openBraces - closeBraces);
    repairs.push(`Added ${openBraces - closeBraces} missing closing brace(s)`);
  }

  if (fixed !== s) {
    const v = tryParse(fixed);
    if (v) {
      return { parsed: v, repairs };
    }
  }

  // Last resort: try all repairs combined in one pass
  let combo = raw.trim();
  combo = combo.replace(/'/g, '"');
  combo = combo.replace(/,(\s*[}\]])/g, "$1");
  combo = combo.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
  const comboOpenB = (combo.match(/\{/g) ?? []).length;
  const comboCloseB = (combo.match(/\}/g) ?? []).length;
  if (comboOpenB > comboCloseB) {
    combo += "}".repeat(comboOpenB - comboCloseB);
  }
  const v2 = tryParse(combo);
  if (v2) {
    repairs.push("Applied combined JSON fixes");
    return { parsed: v2, repairs };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Strategy 2: Type coercion
// ---------------------------------------------------------------------------

export function coerceType(
  value: unknown,
  schemaType: string | string[],
): { coerced: unknown; repaired: boolean } {
  const types = Array.isArray(schemaType) ? schemaType : [schemaType];

  // If the value already satisfies one of the union types, do not coerce.
  const getJsonType = (v: unknown): string => {
    if (v === null) {
      return "null";
    }
    if (Array.isArray(v)) {
      return "array";
    }
    return typeof v;
  };
  const actualType = getJsonType(value);
  for (const t of types) {
    if (t === actualType) {
      return { coerced: value, repaired: false };
    }
    if (t === "integer" && typeof value === "number" && Number.isInteger(value)) {
      return { coerced: value, repaired: false };
    }
  }

  for (const targetType of types) {
    // string → boolean
    if (targetType === "boolean" && typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "true" || lower === "1") {
        return { coerced: true, repaired: true };
      }
      if (lower === "false" || lower === "0") {
        return { coerced: false, repaired: true };
      }
    }
    // number → boolean (0/1)
    if (targetType === "boolean" && typeof value === "number") {
      if (value === 1) {
        return { coerced: true, repaired: true };
      }
      if (value === 0) {
        return { coerced: false, repaired: true };
      }
    }
    // string → number / integer
    if ((targetType === "number" || targetType === "integer") && typeof value === "string") {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        if (targetType === "integer" && !Number.isInteger(num)) {
          return { coerced: Math.round(num), repaired: true };
        }
        return { coerced: num, repaired: true };
      }
    }
    // any scalar → string (use JSON.stringify for non-primitives to avoid [object Object])
    if (targetType === "string" && typeof value !== "string" && value !== null) {
      const str =
        typeof value === "object" ? JSON.stringify(value) : String(value as number | boolean);
      return { coerced: str, repaired: true };
    }
    // scalar/object → array (wrap)
    if (targetType === "array" && !Array.isArray(value)) {
      return { coerced: [value], repaired: true };
    }
  }

  return { coerced: value, repaired: false };
}

// ---------------------------------------------------------------------------
// Strategy 6: Tool call ID generation / sanitisation
// ---------------------------------------------------------------------------

function generateToolCallId(): string {
  const hex = createHash("sha1")
    .update(`tccall-${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, 12);
  return `call${hex}`;
}

function sanitizeExistingId(id: string): string {
  const alpha = id.replace(/[^a-zA-Z0-9]/g, "");
  return alpha.length > 0 ? alpha.slice(0, 40) : generateToolCallId();
}

// ---------------------------------------------------------------------------
// Strategy 7: Provider-specific fixes
// ---------------------------------------------------------------------------

const WRAPPER_KEYS = [
  "args",
  "arguments",
  "parameters",
  "params",
  "input",
  "inputs",
  "data",
  "body",
  "payload",
  "tool_input",
  "function_arguments",
];

type UnwrapResult = {
  value: Record<string, unknown>;
  how: "object" | "string-parsed" | "string-fixed";
};

function tryUnwrapSingleKey(
  args: Record<string, unknown>,
  wrapperKey: string,
): UnwrapResult | null {
  const inner = args[wrapperKey];
  if (typeof inner === "object" && inner !== null && !Array.isArray(inner)) {
    return { value: inner as Record<string, unknown>, how: "object" };
  }
  if (typeof inner === "string") {
    const parsed = tryParse(inner);
    if (parsed) {
      return { value: parsed, how: "string-parsed" };
    }
    // Try JSON fix-up for malformed strings (e.g. single quotes, trailing commas)
    const fixed = fixJson(inner);
    if (fixed) {
      return { value: fixed.parsed, how: "string-fixed" };
    }
  }
  return null;
}

function applyMinimaxFix(
  args: Record<string, unknown>,
  schema: Record<string, unknown>,
): { fixed: Record<string, unknown>; repairs: string[] } | null {
  const keys = Object.keys(args);

  // Single wrapper key
  if (keys.length === 1) {
    const k = keys[0];
    if (WRAPPER_KEYS.includes(k)) {
      const result = tryUnwrapSingleKey(args, k);
      if (result) {
        const verb =
          result.how === "object"
            ? "unwrapped"
            : result.how === "string-parsed"
              ? "decoded JSON string"
              : "decoded and fixed malformed JSON string";
        return {
          fixed: result.value,
          repairs: [`MiniMax: ${verb} arguments from "${k}" wrapper`],
        };
      }
    }
  }

  // Multi-key: look for a known wrapper key alongside other keys
  for (const wk of WRAPPER_KEYS) {
    if (wk in args) {
      const result = tryUnwrapSingleKey(args, wk);
      if (result) {
        const verb =
          result.how === "object"
            ? "decoded"
            : result.how === "string-parsed"
              ? "decoded JSON string"
              : "decoded and fixed malformed JSON string";
        return {
          fixed: result.value,
          repairs: [`MiniMax: ${verb} from "${wk}" field`],
        };
      }
    }
  }

  void schema;
  return null;
}

function applyGlmFix(
  args: Record<string, unknown>,
  schema: Record<string, unknown>,
): { fixed: Record<string, unknown>; repairs: string[] } | null {
  // GLM-5 uses "parameters" or "function_arguments" as the wrapper
  for (const wk of ["parameters", "function_arguments", "tool_input", "inputs"]) {
    if (wk in args) {
      const result = tryUnwrapSingleKey(args, wk);
      if (result) {
        const verb =
          result.how === "object"
            ? "unwrapped arguments from"
            : result.how === "string-parsed"
              ? "decoded JSON string from"
              : "decoded and fixed malformed JSON from";
        return {
          fixed: result.value,
          repairs: [`GLM-5: ${verb} "${wk}" field`],
        };
      }
    }
  }

  void schema;
  return null;
}

function applyGrokFix(
  args: Record<string, unknown>,
  schema: Record<string, unknown>,
): { fixed: Record<string, unknown>; repairs: string[] } | null {
  // Grok 4 has similar wrapping issues to MiniMax
  return applyMinimaxFix(args, schema);
}

/**
 * Generic wrapper detection for unknown providers.
 * Only applies when:
 *   - args has exactly one key
 *   - that key is a known wrapper name
 *   - the key is NOT expected by the schema's properties
 */
function applyGenericWrapFix(
  args: Record<string, unknown>,
  schema: Record<string, unknown>,
): { fixed: Record<string, unknown>; repairs: string[] } | null {
  const keys = Object.keys(args);
  if (keys.length !== 1) {
    return null;
  }

  const k = keys[0];
  if (!WRAPPER_KEYS.includes(k)) {
    return null;
  }

  const properties = schema.properties as Record<string, unknown> | undefined;
  if (properties && k in properties) {
    return null;
  } // schema expects this key

  const result = tryUnwrapSingleKey(args, k);
  if (result) {
    const verb =
      result.how === "object"
        ? "unwrapped"
        : result.how === "string-parsed"
          ? "decoded JSON string"
          : "decoded and fixed malformed JSON string";
    return {
      fixed: result.value,
      repairs: [`Generic: ${verb} from "${k}" wrapper key`],
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main repair function
// ---------------------------------------------------------------------------

export function repairToolCall(params: {
  toolName: string;
  toolCallId: string;
  rawArguments: unknown;
  schema: Record<string, unknown>;
  availableTools: string[];
  provider?: string;
}): RepairResult {
  const repairs: string[] = [];
  let toolName = params.toolName;
  let toolCallId = params.toolCallId;
  let args: Record<string, unknown> = {};

  // -------------------------------------------------------------------------
  // Strategy 6: Tool call ID
  // -------------------------------------------------------------------------
  if (
    !params.toolCallId ||
    typeof params.toolCallId !== "string" ||
    params.toolCallId.trim() === ""
  ) {
    toolCallId = generateToolCallId();
    repairs.push(`Generated new tool call ID: "${toolCallId}"`);
  } else if (!/^[a-zA-Z0-9]/.test(params.toolCallId)) {
    const sanitized = sanitizeExistingId(params.toolCallId);
    repairs.push(`Sanitized tool call ID from "${params.toolCallId}" to "${sanitized}"`);
    toolCallId = sanitized;
  }

  // -------------------------------------------------------------------------
  // Strategy 3: Tool name fuzzy matching
  // -------------------------------------------------------------------------
  if (params.availableTools.length > 0 && !params.availableTools.includes(toolName)) {
    const match = findBestToolMatch(toolName, params.availableTools);
    if (match !== null) {
      repairs.push(`Fuzzy-matched tool name "${toolName}" → "${match}"`);
      toolName = match;
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 1 & Parse: Resolve rawArguments → args object
  // -------------------------------------------------------------------------
  const raw = params.rawArguments;

  if (raw === null || raw === undefined) {
    args = {};
    repairs.push("Arguments were null/undefined — defaulted to {}");
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    args = raw as Record<string, unknown>;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "null" || trimmed === "undefined") {
      args = {};
      repairs.push(`Arguments string "${trimmed}" normalised to {}`);
    } else {
      const fixed = fixJson(trimmed);
      if (fixed) {
        args = fixed.parsed;
        for (const r of fixed.repairs) {
          repairs.push(`JSON fix-up: ${r}`);
        }
      } else {
        args = {};
        repairs.push(
          `WARNING: Could not parse arguments as JSON ("${trimmed.slice(0, 80)}") — defaulted to {}`,
        );
      }
    }
  } else if (Array.isArray(raw)) {
    // Some providers wrap args in an array
    if (
      raw.length === 1 &&
      typeof raw[0] === "object" &&
      raw[0] !== null &&
      !Array.isArray(raw[0])
    ) {
      args = raw[0] as Record<string, unknown>;
      repairs.push("Unwrapped arguments from single-element array");
    } else {
      args = {};
      repairs.push("Arguments were an array (not unwrappable) — defaulted to {}");
    }
  } else {
    args = {};
    repairs.push(`Arguments were ${typeof raw} — defaulted to {}`);
  }

  // -------------------------------------------------------------------------
  // Strategy 7: Provider-specific fixes
  // -------------------------------------------------------------------------
  const provider = (params.provider ?? "").toLowerCase();

  if (provider.includes("minimax") || provider.includes("mini-max")) {
    const result = applyMinimaxFix(args, params.schema);
    if (result) {
      args = result.fixed;
      repairs.push(...result.repairs);
    }
  } else if (
    provider.includes("glm") ||
    provider.includes("zhipu") ||
    provider.includes("chatglm")
  ) {
    const result = applyGlmFix(args, params.schema);
    if (result) {
      args = result.fixed;
      repairs.push(...result.repairs);
    }
  } else if (provider.includes("grok") || provider.includes("xai") || provider.includes("x-ai")) {
    const result = applyGrokFix(args, params.schema);
    if (result) {
      args = result.fixed;
      repairs.push(...result.repairs);
    }
  } else {
    // Unknown provider: apply generic wrapper heuristic
    const result = applyGenericWrapFix(args, params.schema);
    if (result) {
      args = result.fixed;
      repairs.push(...result.repairs);
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 4: Parameter name normalisation
  // -------------------------------------------------------------------------
  const properties = params.schema.properties as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (properties) {
    const knownKeys = Object.keys(properties);
    const normalised: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      const canonical = normalizeParamName(key, knownKeys);
      if (canonical !== null && canonical !== key) {
        normalised[canonical] = value;
        repairs.push(`Normalised parameter name "${key}" → "${canonical}"`);
      } else {
        normalised[key] = value;
      }
    }

    args = normalised;

    // -----------------------------------------------------------------------
    // Strategy 2: Type coercion
    // -----------------------------------------------------------------------
    for (const [field, propSchema] of Object.entries(properties)) {
      if (!(field in args)) {
        continue;
      }
      const schemaType = propSchema.type as string | string[] | undefined;
      if (schemaType === undefined) {
        continue;
      }

      const { coerced, repaired: wasRepaired } = coerceType(args[field], schemaType);
      if (wasRepaired) {
        const typeName = Array.isArray(schemaType) ? schemaType.join("|") : schemaType;
        repairs.push(
          `Coerced "${field}" from ${typeof args[field]} to ${typeName} (value: ${JSON.stringify(coerced)})`,
        );
        args[field] = coerced;
      }
    }

    // -----------------------------------------------------------------------
    // Strategy 5: Missing required params relocation
    // -----------------------------------------------------------------------
    const required = params.schema.required as string[] | undefined;
    if (Array.isArray(required)) {
      for (const reqField of required) {
        if (reqField in args) {
          continue;
        }

        // Look through all current arg keys for anything that maps to reqField
        for (const argKey of Object.keys(args)) {
          if (knownKeys.includes(argKey)) {
            continue;
          } // it's a known param, not an extra

          const mapped = normalizeParamName(argKey, [reqField]);
          if (mapped === reqField) {
            args[reqField] = args[argKey];
            delete args[argKey];
            repairs.push(`Relocated "${argKey}" → required field "${reqField}"`);
            break;
          }
        }
      }
    }
  }

  return {
    repaired: repairs.length > 0,
    toolName,
    toolCallId,
    arguments: args,
    repairs,
  };
}
