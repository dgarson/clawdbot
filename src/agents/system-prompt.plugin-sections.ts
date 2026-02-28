/**
 * Plugin prompt section collection and injection helpers (P8).
 * Extracted from system-prompt.ts to keep that file focused on the core
 * prompt builder. system-prompt.ts re-exports PluginPromptSection and
 * collectPluginPromptSections from here.
 */

import type {
  PromptSectionContext,
  PromptSectionRegistration,
  PromptSectionSlot,
} from "../plugins/types.prompt-sections.js";

/** A resolved prompt section produced by collectPluginPromptSections(). */
export type PluginPromptSection = {
  name: string;
  content: string;
  slot: PromptSectionSlot;
};

/**
 * Collects plugin-contributed prompt sections from the registry (P8).
 * Call this before buildAgentSystemPrompt() and pass the result as pluginSections.
 *
 * Sections are sorted by priority (lower = earlier) within each slot,
 * filtered by their condition predicate, and built in priority order.
 */
export async function collectPluginPromptSections(
  ctx: PromptSectionContext,
  sections: PromptSectionRegistration[],
): Promise<PluginPromptSection[]> {
  if (!sections || sections.length === 0) {
    return [];
  }

  const sorted = [...sections].toSorted((a, b) => a.priority - b.priority);
  const results: PluginPromptSection[] = [];

  // Track replace:* slots to detect collisions — first (highest-priority) wins.
  const seenReplaceSlots = new Map<PromptSectionSlot, string>();

  for (const section of sorted) {
    // Skip if condition returns false.
    if (section.condition && !section.condition(ctx)) {
      continue;
    }
    try {
      const raw = await section.builder(ctx);
      if (!raw || typeof raw !== "string" || !raw.trim()) {
        continue;
      }
      // Warn on duplicate replace:* slots — first registration (highest priority) wins.
      if (section.slot.startsWith("replace:")) {
        const existing = seenReplaceSlots.get(section.slot);
        if (existing) {
          console.warn(
            `[plugins] prompt section collision: "${section.name}" (${section.pluginId}) ` +
              `and "${existing}" both target slot "${section.slot}". ` +
              `Only the higher-priority section is used.`,
          );
          continue;
        }
        seenReplaceSlots.set(section.slot, section.name);
      }

      const content = section.addHeading ? `## ${section.name}\n\n${raw.trim()}` : raw.trim();
      results.push({ name: section.name, content, slot: section.slot });
    } catch {
      // Skip failed sections — a broken plugin should not block the agent run.
    }
  }

  return results;
}

/** Extracts content strings for sections in a specific slot, for inline injection. */
export function getSlotContent(
  pluginSections: PluginPromptSection[] | undefined,
  slot: PromptSectionSlot,
): string[] {
  if (!pluginSections) {
    return [];
  }
  return pluginSections.filter((s) => s.slot === slot).map((s) => s.content);
}

/**
 * Returns true if any plugin has registered a "replace:" section for this slot.
 * When true, the core section should be suppressed.
 */
export function isCoreSlotReplaced(
  pluginSections: PluginPromptSection[] | undefined,
  replaceSlot: PromptSectionSlot,
): boolean {
  if (!pluginSections) {
    return false;
  }
  return pluginSections.some((s) => s.slot === replaceSlot);
}
