import type { PersonaTier } from "@/stores/usePersonaStore";

export interface FeatureConfig {
  id: string;
  minTier: PersonaTier;
  category: "overview" | "work" | "activity" | "chat" | "configure";
}

const TIER_ORDER: PersonaTier[] = ["casual", "engaged", "expert"];

export const FEATURE_VISIBILITY: FeatureConfig[] = [
  // Overview
  { id: "overview.stats", minTier: "casual", category: "overview" },
  { id: "overview.personality-summary", minTier: "casual", category: "overview" },
  { id: "overview.active-workstreams", minTier: "engaged", category: "overview" },
  { id: "overview.upcoming-rituals", minTier: "engaged", category: "overview" },
  // Work
  { id: "work.workstreams-list", minTier: "engaged", category: "work" },
  { id: "work.rituals-list", minTier: "engaged", category: "work" },
  { id: "work.create-workstream", minTier: "expert", category: "work" },
  { id: "work.create-ritual", minTier: "expert", category: "work" },
  // Configure
  { id: "configure.personality", minTier: "casual", category: "configure" },
  { id: "configure.tools", minTier: "engaged", category: "configure" },
  { id: "configure.advanced", minTier: "expert", category: "configure" },
  { id: "configure.raw-json", minTier: "expert", category: "configure" },
  // Activity
  { id: "activity.executions", minTier: "casual", category: "activity" },
  { id: "activity.detailed-logs", minTier: "engaged", category: "activity" },
  // Chat
  { id: "chat.sessions", minTier: "casual", category: "chat" },
];

export function getVisibleFeatures(tier: PersonaTier, category?: string): string[] {
  const tierIndex = TIER_ORDER.indexOf(tier);
  return FEATURE_VISIBILITY
    .filter((f) => {
      const featureTierIndex = TIER_ORDER.indexOf(f.minTier);
      const tierMatch = tierIndex >= featureTierIndex;
      const categoryMatch = !category || f.category === category;
      return tierMatch && categoryMatch;
    })
    .map((f) => f.id);
}
