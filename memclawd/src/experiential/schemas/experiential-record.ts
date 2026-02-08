export type ExperientialRecordAnchor = {
  phrase: string;
  significance: string;
  sensoryChannel?: "verbal" | "visual" | "somatic" | "conceptual" | "relational";
};

export type ExperientialRecordEmotionalSignature = {
  primary: string[];
  secondary?: string[];
  intensity: number;
  valence?: number;
  texture?: string;
};

export type ExperientialRecordContext = {
  topic?: string;
  relationship?: string;
  trigger?: string;
  environment?: string;
};

export type ExperientialRecord = {
  id: string;
  timestamp: string;
  sessionKey?: string;
  emotionalSignature: ExperientialRecordEmotionalSignature;
  engagementQuality: "deep-flow" | "engaged" | "routine" | "distracted" | "struggling";
  context: ExperientialRecordContext;
  anchors?: ExperientialRecordAnchor[];
  reflection?: string;
  uncertainties?: string[];
  reconstitutionHints?: string[];
  linkedRecords?: string[];
  tags?: string[];
  version?: number;
};
