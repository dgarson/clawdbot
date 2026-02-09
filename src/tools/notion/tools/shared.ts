/**
 * Shared types and utilities for Notion tools.
 */

import type { NotionApiOptions } from "../api.js";

export interface NotionToolOptions {
  /** Notion API key. */
  apiKey: string;
  /** Optional custom fetch function. */
  fetchFn?: typeof fetch;
}

export function toApiOpts(opts: NotionToolOptions): NotionApiOptions {
  return {
    apiKey: opts.apiKey,
    fetchFn: opts.fetchFn,
  };
}

/** Safely parse a JSON string parameter that the LLM may provide as string or object. */
export function parseJsonParam(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}
