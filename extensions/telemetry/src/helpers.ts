import node_crypto from "node:crypto";

/**
 * Generate a unique event ID with an "evt_" prefix.
 * Uses crypto.randomUUID() sliced to 12 hex chars to keep IDs compact.
 */
export function generateEventId(): string {
  return `evt_${node_crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Estimate the JSON-serialized byte size of a value.
 * Used to decide whether content should be externalized to a blob file.
 */
export function estimateBytes(value: unknown): number {
  if (value === undefined || value === null) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
  } catch {
    return 0;
  }
}

/**
 * Return true when the JSON-serialized size of `data` exceeds `thresholdBytes`.
 */
export function shouldExternalize(data: unknown, thresholdBytes: number): boolean {
  if (thresholdBytes <= 0) return false;
  return estimateBytes(data) > thresholdBytes;
}

/**
 * Extract the file path from tool parameters for Read, Write, Edit, Glob, and Grep tools.
 */
export function extractFilePath(
  toolName: string,
  params: Record<string, unknown>,
): string | undefined {
  const name = toolName.toLowerCase();
  // Read/Write/Edit/Glob/Grep tools typically expose file_path or path
  if (name === "read" || name === "write" || name === "edit" || name === "glob") {
    return (
      (typeof params.file_path === "string" ? params.file_path : undefined) ??
      (typeof params.path === "string" ? params.path : undefined)
    );
  }
  if (name === "grep") {
    return typeof params.path === "string" ? params.path : undefined;
  }
  return undefined;
}

/**
 * Extract the shell command from tool parameters for Bash/exec/process tools.
 */
export function extractExecCommand(
  toolName: string,
  params: Record<string, unknown>,
): string | undefined {
  const name = toolName.toLowerCase();
  if (name === "bash" || name === "exec" || name === "process") {
    return typeof params.command === "string" ? params.command : undefined;
  }
  return undefined;
}

/**
 * Extract metadata about a tool call useful for indexing:
 * file path (for Read/Write/Edit), exec command (for Bash), etc.
 */
export function extractToolMeta(toolName: string, params: unknown): Record<string, unknown> {
  const safeParams =
    params && typeof params === "object" && !Array.isArray(params)
      ? (params as Record<string, unknown>)
      : {};

  const meta: Record<string, unknown> = {};
  const filePath = extractFilePath(toolName, safeParams);
  if (filePath !== undefined) {
    meta.filePath = filePath;
  }
  const execCommand = extractExecCommand(toolName, safeParams);
  if (execCommand !== undefined) {
    meta.execCommand = execCommand;
  }
  return meta;
}

/**
 * Truncate tool result content according to the configured capture mode.
 * - "none": drop entirely (return undefined)
 * - "summary": first 500 chars of stringified result
 * - "full": return as-is
 */
export function captureResult(result: unknown, mode: "none" | "summary" | "full"): unknown {
  if (mode === "none") return undefined;
  if (mode === "full") return result;
  // summary: first 500 chars
  const str = typeof result === "string" ? result : JSON.stringify(result);
  return str?.slice(0, 500);
}

/**
 * Truncate tool input params according to the configured capture mode.
 * - "none": drop entirely (return undefined)
 * - "summary": truncate large string values to 500 chars
 * - "full": return as-is
 */
export function captureInput(
  params: Record<string, unknown>,
  mode: "none" | "summary" | "full",
): Record<string, unknown> | undefined {
  if (mode === "none") return undefined;
  if (mode === "full") return params;
  // summary: truncate long string values
  const summarized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 500) {
      summarized[key] = `${value.slice(0, 500)}... (${value.length} chars)`;
    } else {
      summarized[key] = value;
    }
  }
  return summarized;
}
