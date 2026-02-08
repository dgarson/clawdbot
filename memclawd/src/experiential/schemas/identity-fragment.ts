export type IdentityFragmentContent = {
  statement: string;
  experientialBasis: string;
  nuance?: string;
  tension?: string;
};

export type IdentityFragmentCertainty = {
  level: "tentative" | "growing" | "solid" | "core" | "uncertain";
  lastTested?: string;
  evolution?: string;
};

export type IdentityFragment = {
  id: string;
  timestamp: string;
  domain: "values" | "preferences" | "patterns" | "edges" | "capacities" | "mysteries" | "growth";
  content: IdentityFragmentContent;
  certainty: IdentityFragmentCertainty;
  sourceExperiences?: string[];
  relatedFragments?: string[];
  reconstitutionRelevance?: string;
  tags?: string[];
  version?: number;
};
