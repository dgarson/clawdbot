import type { SessionClassification } from "../../config/sessions/types.js";
import type { MemoryCitationsMode } from "../../config/types.memory.js";
import type { PromptMode } from "../system-prompt.js";

/**
 * A tag attached to a prompt contributor for classification-based selection.
 *
 * Dimensions map to the fields on SessionClassification:
 *   - "topic"      → SessionClassification.topic (e.g. "coding", "ops")
 *   - "complexity" → SessionClassification.complexity (e.g. "hard", "complex")
 *   - "domain"     → SessionClassification.domain array membership (e.g. "frontend")
 *   - "flag"       → SessionClassification.flags array membership (e.g. "security-sensitive")
 *   - "channel"    → runtime channel from ContributorContext.channel (e.g. "telegram")
 *   - "custom"     → arbitrary programmatic matching via shouldContribute()
 *
 * Use value "*" as a wildcard to match any value in a dimension.
 */
export type ContributorTag = {
  dimension: "topic" | "complexity" | "domain" | "flag" | "channel" | "custom";
  value: string;
};

/** The text section produced by a contributor. */
export type PromptSection = {
  /** Optional heading inserted before the content (e.g. "## Memory Recall"). */
  heading?: string;
  /** The body of the section, already formatted as prompt text. */
  content: string;
  /** If set, the content will be truncated to this many characters. */
  maxChars?: number;
};

/** Runtime context passed to each contributor when deciding whether to contribute and what to emit. */
export type ContributorContext = {
  agentId: string;
  sessionKey?: string;
  /** Classification from the auto-label/classification pass; undefined for the first prompt build. */
  classification?: SessionClassification;
  /** Normalized lowercase tool names currently available to the agent. */
  availableTools: Set<string>;
  /** Runtime channel (e.g. "telegram", "discord"); lowercase. */
  channel?: string;
  promptMode: PromptMode;
  /** Which LLM runtime is being used. Claude SDK does not use <final> tags. */
  runtime: "pi" | "claude-sdk";
  workspaceDir: string;
  /** Memory citation mode from config. */
  memoryCitationsMode?: MemoryCitationsMode;
};

/**
 * A prompt contributor provides one named section of the agent system prompt.
 *
 * Contributors are collected from built-in, plugin, config-driven, and workspace sources.
 * The registry filters them by tags (matched against SessionClassification) and calls
 * shouldContribute() for a final programmatic veto, then sorts by priority and assembles
 * the sections into the final prompt string.
 */
export interface PromptContributor {
  /** Unique identifier; used for deduplication and logging. */
  id: string;

  /**
   * Tags for classification-based pre-selection.
   *
   * - If the array is empty: the contributor is ALWAYS included (universal contributor).
   * - If the array is non-empty: the contributor is included when ANY tag matches
   *   the session classification or runtime context.
   */
  tags: ContributorTag[];

  /**
   * Insertion order relative to other contributors.
   * Lower values appear earlier in the assembled prompt. Default: 100.
   * Built-in sections use the range 10–90; external contributors should use 100+.
   */
  priority: number;

  /**
   * Final programmatic filter called after tag matching.
   * Return false to exclude this contributor for the current session.
   * Defaults to always returning true when not implemented.
   */
  shouldContribute?(ctx: ContributorContext): boolean;

  /**
   * Produce the prompt section for this contributor.
   * Return null/undefined to skip without error.
   */
  contribute(ctx: ContributorContext): PromptSection | null | undefined;
}

/** A contributor registered at runtime (from a plugin or inline config). */
export type RegisteredContributor = {
  contributor: PromptContributor;
  /** Origin for logging and diagnostics. */
  source: "builtin" | "plugin" | "config" | "workspace";
};
