import { createSubsystemLogger } from "../../logging/subsystem.js";
import type {
  ContributorContext,
  ContributorTag,
  PromptContributor,
  PromptSection,
  RegisteredContributor,
} from "./types.js";

const log = createSubsystemLogger("prompt-contributors");

// =============================================================================
// Tag matching
// =============================================================================

/**
 * Returns true if the given tag matches the session classification or runtime context.
 * Wildcard value "*" matches any non-empty value in a dimension.
 */
function tagMatches(tag: ContributorTag, ctx: ContributorContext): boolean {
  const { classification, channel } = ctx;
  const { dimension, value } = tag;

  if (dimension === "channel") {
    const runtimeChannel = channel?.toLowerCase().trim() ?? "";
    return value === "*" ? runtimeChannel.length > 0 : runtimeChannel === value;
  }

  if (dimension === "custom") {
    // Custom tags are never matched automatically; rely on shouldContribute().
    return false;
  }

  if (!classification) {
    // No classification yet (first-turn cold start) — skip tagged contributors.
    return false;
  }

  if (dimension === "topic") {
    return value === "*" ? true : classification.topic === value;
  }

  if (dimension === "complexity") {
    return value === "*" ? true : classification.complexity === value;
  }

  if (dimension === "domain") {
    if (value === "*") {
      return classification.domain.length > 0;
    }
    return classification.domain.includes(value);
  }

  if (dimension === "flag") {
    if (value === "*") {
      return classification.flags.length > 0;
    }
    return classification.flags.includes(value);
  }

  return false;
}

/**
 * Returns true if the contributor should be included for this context.
 * - Contributors with no tags are always included (universal).
 * - Contributors with tags are included when ANY tag matches.
 * - shouldContribute() is called as a final filter.
 */
function shouldIncludeContributor(
  contributor: PromptContributor,
  ctx: ContributorContext,
): boolean {
  const { tags } = contributor;

  // Universal contributors (no tags) are always included.
  if (tags.length === 0) {
    const veto = contributor.shouldContribute?.(ctx);
    return veto !== false;
  }

  // Tagged contributors: include if ANY tag matches.
  const anyTagMatches = tags.some((tag) => tagMatches(tag, ctx));
  if (!anyTagMatches) {
    return false;
  }

  // Final programmatic filter.
  const veto = contributor.shouldContribute?.(ctx);
  return veto !== false;
}

// =============================================================================
// Section assembly
// =============================================================================

function applyMaxChars(section: PromptSection): PromptSection {
  if (section.maxChars === undefined || section.content.length <= section.maxChars) {
    return section;
  }
  return { ...section, content: section.content.slice(0, section.maxChars) };
}

function sectionToLines(section: PromptSection): string[] {
  const lines: string[] = [];
  if (section.heading?.trim()) {
    lines.push(section.heading.trim());
  }
  if (section.content.trim()) {
    lines.push(section.content.trim());
  }
  lines.push("");
  return lines;
}

// =============================================================================
// Registry
// =============================================================================

export class PromptContributorRegistry {
  private readonly _contributors: RegisteredContributor[] = [];

  register(contributor: PromptContributor, source: RegisteredContributor["source"]): void {
    const existing = this._contributors.find((r) => r.contributor.id === contributor.id);
    if (existing) {
      log.warn(`Duplicate contributor id "${contributor.id}" from ${source}; overwriting.`);
      this._contributors.splice(this._contributors.indexOf(existing), 1);
    }
    this._contributors.push({ contributor, source });
  }

  registerAll(contributors: PromptContributor[], source: RegisteredContributor["source"]): void {
    for (const c of contributors) {
      this.register(c, source);
    }
  }

  /** Resolve the ordered list of contributors that should be active for this context. */
  resolve(ctx: ContributorContext): PromptContributor[] {
    return this._contributors
      .filter((r) => {
        try {
          return shouldIncludeContributor(r.contributor, ctx);
        } catch (err) {
          log.warn(`contributor "${r.contributor.id}" shouldContribute threw: ${String(err)}`);
          return false;
        }
      })
      .map((r) => r.contributor)
      .toSorted((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  /**
   * Assemble all matching contributor sections into a single prompt string.
   * Sections are separated by blank lines; empty sections are omitted.
   */
  assemble(ctx: ContributorContext): string {
    const contributors = this.resolve(ctx);
    const lines: string[] = [];

    for (const contributor of contributors) {
      let section: PromptSection | null | undefined;
      try {
        section = contributor.contribute(ctx);
      } catch (err) {
        log.warn(`contributor "${contributor.id}" contribute() threw: ${String(err)}`);
        continue;
      }
      if (!section || (!section.content.trim() && !section.heading?.trim())) {
        continue;
      }
      const bounded = applyMaxChars(section);
      lines.push(...sectionToLines(bounded));
    }

    return lines.join("\n").trimEnd();
  }

  get size(): number {
    return this._contributors.length;
  }

  ids(): string[] {
    return this._contributors.map((r) => r.contributor.id);
  }
}

// =============================================================================
// Global singleton (used by buildAgentSystemPrompt)
// =============================================================================

let _globalRegistry: PromptContributorRegistry | undefined;

export function getGlobalPromptContributorRegistry(): PromptContributorRegistry {
  if (!_globalRegistry) {
    _globalRegistry = new PromptContributorRegistry();
  }
  return _globalRegistry;
}

/** Reset the global registry (for testing). */
export function resetGlobalPromptContributorRegistry(): void {
  _globalRegistry = undefined;
}

/** Convenience helper: register a contributor in the global registry. */
export function registerPromptContributor(
  contributor: PromptContributor,
  source: RegisteredContributor["source"] = "plugin",
): void {
  getGlobalPromptContributorRegistry().register(contributor, source);
}
