/**
 * Prompt Section Contributor types (P8).
 *
 * These are extracted from types.ts to keep that file focused on the plugin
 * API surface and hook types. Import from types.ts for public usage — it
 * re-exports everything here.
 */

/**
 * Context passed to a prompt section builder. Contains the agent and session
 * context available when the system prompt is being assembled.
 */
export type PromptSectionContext = {
  agentId: string;
  sessionKey: string;
  /** Agent metadata from config (see P2). */
  agentMetadata?: Record<string, unknown>;
  /** Current spawn depth (0 = top-level). */
  spawnDepth?: number;
  isSubagent?: boolean;
  /** Names of tools available in this run. */
  toolNames?: string[];
  /** Lane identifier (e.g. "main", "subagent", "cron"). */
  lane?: string;
};

/**
 * Returns the text content for a prompt section, or null/undefined/empty string
 * to omit the section entirely. The return value is appended as a Markdown-style
 * section headed with "## <name>" unless you include the heading yourself.
 */
export type PromptSectionBuilder = (
  ctx: PromptSectionContext,
) => string | null | undefined | Promise<string | null | undefined>;

/**
 * Named injection slots within the core system prompt.
 *
 * Slots mark positions where plugin sections can be injected.
 * `"end"` (the default) appends after all core content.
 *
 * Use `"replace:<slot>"` to suppress the core section at that position
 * and inject your own content instead.
 *
 * Available slots:
 * - `"after:identity"`        — after the opening assistant identity line
 * - `"after:tooling"`         — after ## Tooling + ## Tool Call Style
 * - `"after:safety"`          — after ## Safety
 * - `"after:workspace"`       — after ## Workspace
 * - `"after:context-files"`   — after # Project Context (injected files)
 * - `"before:silent-replies"` — immediately before ## Silent Replies
 * - `"before:runtime"`        — immediately before ## Runtime
 * - `"end"`                   — after ## Runtime (default)
 * - `"replace:silent-replies"` — suppress ## Silent Replies, inject here
 * - `"replace:heartbeats"`    — suppress ## Heartbeats, inject here
 * - `"replace:safety"`        — suppress ## Safety, inject domain-specific policy here
 * - `"replace:runtime"`       — suppress ## Runtime, inject here (e.g. evaluation agents
 *                               with no channel/model context)
 * - `"replace:identity"`      — suppress the opening identity line, inject persona here
 * - `"replace:tooling"`       — suppress ## Tooling + ## Tool Call Style (e.g. evaluation
 *                               agents with no tools)
 */
export type PromptSectionSlot =
  | "after:identity"
  | "after:tooling"
  | "after:safety"
  | "after:workspace"
  | "after:context-files"
  | "before:silent-replies"
  | "before:runtime"
  | "end"
  | "replace:silent-replies"
  | "replace:heartbeats"
  | "replace:safety"
  | "replace:runtime"
  | "replace:identity"
  | "replace:tooling";

export type PromptSectionOptions = {
  /**
   * Lower priority numbers appear earlier within the same slot. Default: 100.
   * Core sections use priorities 0-50; plugin sections should use 50+.
   */
  priority?: number;
  /**
   * Where in the core prompt to inject this section.
   * Default: `"end"` (appended after ## Runtime).
   */
  slot?: PromptSectionSlot;
  /**
   * Optional condition predicate. When it returns false the section is skipped
   * entirely without calling the builder (avoids unnecessary async work).
   */
  condition?: (ctx: PromptSectionContext) => boolean;
  /**
   * When true, wraps the builder output in a "## <name>" Markdown heading.
   * Default: true.
   */
  addHeading?: boolean;
};

/** Internal registry entry for a prompt section contributor. */
export type PromptSectionRegistration = {
  pluginId: string;
  name: string;
  builder: PromptSectionBuilder;
  priority: number;
  slot: PromptSectionSlot;
  condition?: (ctx: PromptSectionContext) => boolean;
  addHeading: boolean;
};
