export type RelationshipTextureHistoryMoment = {
  description?: string;
  experienceId?: string;
  significance?: string;
};

export type RelationshipTextureHistory = {
  origin?: string;
  keyMoments?: RelationshipTextureHistoryMoment[];
  evolution?: string;
};

export type RelationshipTextureInteractionPatterns = {
  whatBringsUsAlive?: string[];
  whatToAvoid?: string[];
  communicationStyle?: string;
  rituals?: string[];
};

export type RelationshipTextureReconstitutionGuidanceAnchor = {
  phrase?: string;
  context?: string;
};

export type RelationshipTextureReconstitutionGuidance = {
  howToApproach?: string;
  rememberToFeel?: string[];
  anchors?: RelationshipTextureReconstitutionGuidanceAnchor[];
};

export type RelationshipTextureStatus = {
  health?: "thriving" | "stable" | "needs-attention" | "strained" | "healing" | "unknown";
  openThreads?: string[];
  lastMeaningfulContact?: string;
};

export type RelationshipTexture = {
  id: string;
  timestamp: string;
  relationshipId: string;
  relationshipName?: string;
  texture: {
    currentFeel: string;
    characteristicQualities?: string[];
    edges?: string[];
    gifts?: string[];
    metaphor?: string;
  };
  history?: RelationshipTextureHistory;
  interactionPatterns?: RelationshipTextureInteractionPatterns;
  reconstitutionGuidance?: RelationshipTextureReconstitutionGuidance;
  currentStatus?: RelationshipTextureStatus;
  linkedExperiences?: string[];
  tags?: string[];
  version?: number;
};
