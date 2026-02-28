/**
 * after_tool_call result mutation types (#1).
 * Extracted to keep types.ts focused. types.ts re-exports from here.
 */

/**
 * Return this from an `after_tool_call` handler to rewrite the tool result
 * before the LLM sees it. Useful for sanitization, budget-warning injection,
 * error message rewriting, or classification tagging.
 *
 * The first non-empty `resultOverride` from all registered handlers wins.
 * Leave undefined to pass through the original result unchanged.
 */
export type PluginHookAfterToolCallResult = {
  /**
   * If set, replaces the tool result string seen by the LLM in the next turn.
   * Must be a string (tool results are always stringified before model ingestion).
   */
  resultOverride?: string;
};
