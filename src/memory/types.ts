export type MemorySource = "memory" | "sessions";

export type MemoryContentKind =
  | "message"
  | "document"
  | "fact"
  | "artifact"
  | "summary"
  | "event"
  | (string & {});

export type MemoryTemporalMetadata = {
  createdAt?: string;
  updatedAt?: string;
  observedAt?: string;
  validFrom?: string;
  validTo?: string;
  expiresAt?: string;
  timezone?: string;
};

export type MemoryProvenance = {
  source: string;
  sourceId?: string;
  channel?: string;
  actorId?: string;
  sessionKey?: string;
  runId?: string;
  traceId?: string;
  citations?: string[];
  temporal?: MemoryTemporalMetadata;
};

export type MemoryArtifact = {
  id: string;
  kind: "file" | "image" | "audio" | "video" | "link" | (string & {});
  uri?: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  provenance?: MemoryProvenance;
};

export type MemoryContentObject = {
  id: string;
  kind: MemoryContentKind;
  text?: string;
  title?: string;
  language?: string;
  tags?: string[];
  artifacts?: MemoryArtifact[];
  metadata?: Record<string, unknown>;
  provenance?: MemoryProvenance;
  temporal?: MemoryTemporalMetadata;
};

export type MemorySearchResult = {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: MemorySource;
  citation?: string;
  sourceBackend?: string;
};

export type MemoryEmbeddingProbeResult = {
  ok: boolean;
  error?: string;
};

export type MemorySyncProgressUpdate = {
  completed: number;
  total: number;
  label?: string;
};

export type MemoryProviderStatus = {
  backend: "builtin" | "qmd";
  provider: string;
  model?: string;
  requestedProvider?: string;
  files?: number;
  chunks?: number;
  dirty?: boolean;
  workspaceDir?: string;
  dbPath?: string;
  extraPaths?: string[];
  sources?: MemorySource[];
  sourceCounts?: Array<{ source: MemorySource; files: number; chunks: number }>;
  cache?: { enabled: boolean; entries?: number; maxEntries?: number };
  fts?: { enabled: boolean; available: boolean; error?: string };
  fallback?: { from: string; reason?: string };
  vector?: {
    enabled: boolean;
    available?: boolean;
    extensionPath?: string;
    loadError?: string;
    dims?: number;
  };
  batch?: {
    enabled: boolean;
    failures: number;
    limit: number;
    wait: boolean;
    concurrency: number;
    pollIntervalMs: number;
    timeoutMs: number;
    lastError?: string;
    lastProvider?: string;
  };
  custom?: Record<string, unknown>;
};

export interface MemorySearchManager {
  search(
    query: string,
    opts?: { maxResults?: number; minScore?: number; sessionKey?: string },
  ): Promise<MemorySearchResult[]>;
  readFile(params: {
    relPath: string;
    from?: number;
    lines?: number;
  }): Promise<{ text: string; path: string }>;
  status(): MemoryProviderStatus;
  sync?(params?: {
    reason?: string;
    force?: boolean;
    progress?: (update: MemorySyncProgressUpdate) => void;
  }): Promise<void>;
  probeEmbeddingAvailability(): Promise<MemoryEmbeddingProbeResult>;
  probeVectorAvailability(): Promise<boolean>;
  close?(): Promise<void>;
}
