export type MemoryProvenance = {
  source: "agent" | "user" | "system" | "import" | (string & {});
  sourceId?: string;
  channel?: string;
  tags?: string[];
};

export type MemoryTemporalMetadata = {
  capturedAt?: string;
  validFrom?: string;
  validTo?: string;
  ttlSeconds?: number;
  confidence?: number;
};

export type MemoryContentObject = {
  id: string;
  text: string;
  type?: "message" | "summary" | "fact" | "event" | "entity" | (string & {});
  createdAt?: string;
  metadata?: Record<string, unknown>;
  provenance?: MemoryProvenance;
  temporal?: MemoryTemporalMetadata;
};
