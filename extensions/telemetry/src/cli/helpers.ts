/**
 * Shared CLI formatting and output helpers for telemetry commands.
 */

import type { Command } from "commander";

/** Options inherited from the parent `tel` command. */
export type GlobalOpts = {
  json?: boolean;
  agent?: string;
};

/**
 * Read --json and --agent from the parent command's options.
 */
export function getGlobalOpts(cmd: Command): GlobalOpts {
  const parentOpts = cmd.parent?.opts() ?? {};
  return {
    json: parentOpts.json === true,
    agent: parentOpts.agent as string | undefined,
  };
}

/**
 * Parse an ISO date string or epoch ms string into a Unix timestamp in ms.
 * Returns undefined if the input is undefined or empty.
 */
export function parseDate(input: string | undefined): number | undefined {
  if (!input) return undefined;
  const asNum = Number(input);
  if (!Number.isNaN(asNum)) return asNum;
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) return d.getTime();
  return undefined;
}

/** Format a timestamp (ms) as a human-readable string. */
export function fmtTs(ts: number | null | undefined): string {
  if (ts == null) return "-";
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
}

/** Format a duration in ms as "1234ms" or "12.3s". */
export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Format a cost in USD. */
export function fmtCost(usd: number | null | undefined): string {
  if (usd == null) return "-";
  return `$${usd.toFixed(4)}`;
}

/**
 * Output a list of rows. In JSON mode, emits JSON.stringify(data).
 * Otherwise, emits console.table with mapped columns.
 */
export function output<T>(
  data: T[],
  tableMapper: (item: T) => Record<string, unknown>,
  opts: GlobalOpts,
): void {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (data.length === 0) {
    console.log("No results found.");
  } else {
    console.table(data.map(tableMapper));
  }
}

/**
 * Output a single detail object. In JSON mode, emits JSON.stringify(obj).
 * Otherwise, emits key-value lines.
 */
export function outputDetail(obj: Record<string, unknown>, opts: GlobalOpts): void {
  if (opts.json) {
    console.log(JSON.stringify(obj, null, 2));
  } else {
    for (const [key, val] of Object.entries(obj)) {
      const label = key.padEnd(14);
      console.log(`  ${label}: ${val}`);
    }
  }
}
