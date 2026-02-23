export type MemoryScopeDecision = "allow" | "deny";

export type MemoryScopeLevel = "session" | "project" | "role" | "org";

export interface MemoryScopePath {
  session?: string;
  project?: string;
  role?: string;
  org?: string;
}

export type MemoryDomain =
  | "user_pref"
  | "system_fact"
  | "session_summary"
  | "agent_eval"
  | "code_context";

export type MemoryGovernanceMatch = {
  agentId?: string;
  userId?: string;
  sourceId?: string;
  domain?: MemoryDomain;
  tag?: string;
};

export type MemoryGovernanceRule = {
  action: MemoryScopeDecision;
  match?: MemoryGovernanceMatch;
};

export type MemoryGovernanceConfig = {
  default?: MemoryScopeDecision;
  rules?: MemoryGovernanceRule[];
};

export type MemoryServiceVectorConfig = {
  provider?: "qdrant" | "pinecone" | "pgvector";
  endpoint?: string;
  apiKey?: string;
  collection?: string;
};

export type MemoryServiceEmbeddingConfig = {
  model?: "text-embedding-3-small";
  dimensions?: number;
  batchSize?: number;
};

export type MemoryServiceRetrievalConfig = {
  defaultLimit?: number;
  maxTokensBudget?: number;
  vectorWeight?: number;
  keywordWeight?: number;
};

export type MemoryServiceRetentionConfig = {
  defaultTtlDays?: number;
  compactionCron?: string;
};

export interface MemoryProvenance {
  source: string;
  timestamp: number;
  confidence: number;
}

export interface MemoryAccessControl {
  read?: {
    agentIds?: string[];
    userIds?: string[];
  };
}

export interface MemoryRetentionMetadata {
  ttlSec?: number;
  expiresAt?: number;
}

export interface MemoryMetadata {
  domain: MemoryDomain;
  sourceId: string;
  agentId?: string;
  userId?: string;
  tags?: string[];
  scope?: MemoryScopePath;
  scopeLevel?: MemoryScopeLevel;
  access?: MemoryAccessControl;
  retention?: MemoryRetentionMetadata;
  ttlSec?: number;
  confidenceScore: number;
  provenance: MemoryProvenance;
}

export type MemoryStoreMetadata = Omit<MemoryMetadata, "provenance" | "confidenceScore"> & {
  confidenceScore?: number;
  provenance?: Partial<MemoryProvenance>;
};

export interface MemoryNode {
  id: string;
  content: string;
  embedding: number[];
  metadata: MemoryMetadata;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type LegacyMemoryNode = Omit<MemoryNode, "metadata" | "version"> & {
  version?: number;
  metadata: MemoryStoreMetadata;
};

export type MemoryScopedRetrieveOptions = {
  limit?: number;
  filters?: Partial<MemoryMetadata>;
  requester?: {
    agentId?: string;
    userId?: string;
  };
};

export type MemoryDeleteByScopeOptions = {
  cascade?: boolean;
};

export interface IMemoryService {
  store(content: string, metadata: MemoryStoreMetadata): Promise<string>;
  storeBatch(items: Array<MemoryStoreMetadata & { content: string }>): Promise<string[]>;
  retrieve(query: string, filters?: Partial<MemoryMetadata>, limit?: number): Promise<MemoryNode[]>;
  retrieveScoped(
    query: string,
    scope: MemoryScopePath,
    options?: MemoryScopedRetrieveOptions,
  ): Promise<MemoryNode[]>;
  forget(nodeId: string): Promise<boolean>;
  forgetUser(userId: string): Promise<number>;
  deleteByScope(scope: MemoryScopePath, options?: MemoryDeleteByScopeOptions): Promise<number>;
  compact(userId?: string): Promise<number>;
  searchKeywords(
    keywords: string[],
    filters?: Partial<MemoryMetadata>,
    limit?: number,
  ): Promise<MemoryNode[]>;
}

export interface MemoryConfig {
  enabled?: boolean;
  vectorDb?: MemoryServiceVectorConfig;
  embedding?: MemoryServiceEmbeddingConfig;
  retrieval?: MemoryServiceRetrievalConfig;
  retention?: MemoryServiceRetentionConfig;
  governance?: MemoryGovernanceConfig;
  shadowWrite?: {
    enabled?: boolean;
  };
}

export type MemoryServiceOptions = Partial<MemoryConfig>;

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  vectorDb: {
    provider: "qdrant",
    endpoint: process.env.QDRANT_ENDPOINT ?? "http://localhost:6333",
    collection: "openclaw-memory",
  },
  embedding: {
    model: "text-embedding-3-small",
    dimensions: 512,
    batchSize: 10,
  },
  retrieval: {
    defaultLimit: 5,
    maxTokensBudget: 4_000,
    vectorWeight: 0.7,
    keywordWeight: 0.3,
  },
  retention: {
    defaultTtlDays: 90,
    compactionCron: "0 2 * * *",
  },
};

const NODE_VERSION = 2;

function normalizeMemoryConfig(config?: MemoryServiceOptions): Required<MemoryConfig> {
  return {
    ...DEFAULT_MEMORY_CONFIG,
    ...config,
    vectorDb: {
      ...DEFAULT_MEMORY_CONFIG.vectorDb,
      ...config?.vectorDb,
    },
    embedding: {
      ...DEFAULT_MEMORY_CONFIG.embedding,
      ...config?.embedding,
    },
    retrieval: {
      ...DEFAULT_MEMORY_CONFIG.retrieval,
      ...config?.retrieval,
    },
    retention: {
      ...DEFAULT_MEMORY_CONFIG.retention,
      ...config?.retention,
    },
    governance: {
      default: config?.governance?.default ?? "deny",
      rules: [...(config?.governance?.rules ?? [])],
    },
    shadowWrite: {
      enabled: config?.shadowWrite?.enabled ?? false,
    },
  } as Required<MemoryConfig>;
}

function defaultMemoryEmbedding(dimensions: number): number[] {
  return Array.from({ length: dimensions }, () => 0);
}

function clampConfidence(confidence: number): number {
  if (Number.isNaN(confidence)) {
    return 0;
  }
  return Math.max(0, Math.min(1, confidence));
}

function inferScopeLevel(scope?: MemoryScopePath): MemoryScopeLevel | undefined {
  if (!scope) {
    return undefined;
  }
  if (scope.session) {
    return "session";
  }
  if (scope.project) {
    return "project";
  }
  if (scope.role) {
    return "role";
  }
  if (scope.org) {
    return "org";
  }
  return undefined;
}

function resolveRetention(
  metadata: MemoryStoreMetadata,
  now: number,
  config: Required<MemoryConfig>,
): MemoryRetentionMetadata | undefined {
  const ttlSec =
    metadata.retention?.ttlSec ??
    metadata.ttlSec ??
    Math.max(0, (config.retention.defaultTtlDays ?? 0) * 24 * 60 * 60);

  const expiresAt =
    metadata.retention?.expiresAt ?? (ttlSec > 0 ? now + ttlSec * 1_000 : undefined);

  if (ttlSec <= 0 && expiresAt === undefined) {
    return undefined;
  }

  return {
    ttlSec,
    expiresAt,
  };
}

function toMemoryMetadata(
  metadata: MemoryStoreMetadata,
  now: number,
  config: Required<MemoryConfig>,
) {
  const provenanceSource = metadata.provenance?.source ?? metadata.sourceId ?? "unknown";
  const provenanceTimestamp = metadata.provenance?.timestamp ?? now;
  const confidence = clampConfidence(
    metadata.provenance?.confidence ?? metadata.confidenceScore ?? 1,
  );
  const scopeLevel = metadata.scopeLevel ?? inferScopeLevel(metadata.scope);
  const retention = resolveRetention(metadata, now, config);

  const normalized: MemoryMetadata = {
    ...metadata,
    sourceId: provenanceSource,
    confidenceScore: confidence,
    provenance: {
      source: provenanceSource,
      timestamp: provenanceTimestamp,
      confidence,
    },
    scopeLevel,
    retention,
    ttlSec: retention?.ttlSec,
  };

  return normalized;
}

export function migrateLegacyMemoryNode(
  node: LegacyMemoryNode,
  config?: MemoryServiceOptions,
): MemoryNode {
  const now = Date.now();
  const normalizedConfig = normalizeMemoryConfig(config);
  const updatedAt = Number.isFinite(node.updatedAt) ? node.updatedAt : now;
  const createdAt = Number.isFinite(node.createdAt) ? node.createdAt : updatedAt;

  return {
    id: node.id,
    content: node.content,
    embedding:
      node.embedding.length > 0
        ? node.embedding
        : defaultMemoryEmbedding(normalizedConfig.embedding.dimensions ?? 512),
    metadata: toMemoryMetadata(node.metadata, updatedAt, normalizedConfig),
    createdAt,
    updatedAt,
    version: NODE_VERSION,
  };
}

function metadataMatchesFilter(
  metadata: MemoryMetadata,
  filters?: Partial<MemoryMetadata>,
): boolean {
  if (!filters) {
    return true;
  }

  if (filters.agentId !== undefined && metadata.agentId !== filters.agentId) {
    return false;
  }
  if (filters.userId !== undefined && metadata.userId !== filters.userId) {
    return false;
  }
  if (filters.domain !== undefined && metadata.domain !== filters.domain) {
    return false;
  }
  if (filters.sourceId !== undefined && metadata.sourceId !== filters.sourceId) {
    return false;
  }
  if (filters.scopeLevel !== undefined && metadata.scopeLevel !== filters.scopeLevel) {
    return false;
  }
  if (filters.scope !== undefined && !scopeIncludes(metadata.scope, filters.scope)) {
    return false;
  }
  if (filters.tags !== undefined) {
    const nodeTags = new Set(metadata.tags ?? []);
    if (!filters.tags.every((tag) => nodeTags.has(tag))) {
      return false;
    }
  }

  return true;
}

function scopeIncludes(actual?: MemoryScopePath, expected?: MemoryScopePath): boolean {
  if (!expected) {
    return true;
  }
  if (!actual) {
    return false;
  }
  if (expected.session !== undefined && actual.session !== expected.session) {
    return false;
  }
  if (expected.project !== undefined && actual.project !== expected.project) {
    return false;
  }
  if (expected.role !== undefined && actual.role !== expected.role) {
    return false;
  }
  if (expected.org !== undefined && actual.org !== expected.org) {
    return false;
  }
  return true;
}

function governanceAllowsWrite(
  metadata: MemoryStoreMetadata,
  policy: MemoryGovernanceConfig,
): boolean {
  const defaultAction = policy.default ?? "deny";
  const rules = policy.rules ?? [];

  for (const rule of rules) {
    if (!rule || !rule.action) {
      continue;
    }
    const match = rule.match;
    if (!match) {
      return rule.action === "allow";
    }
    if (match.agentId !== undefined && match.agentId !== metadata.agentId) {
      continue;
    }
    if (match.userId !== undefined && match.userId !== metadata.userId) {
      continue;
    }
    if (match.sourceId !== undefined && match.sourceId !== metadata.sourceId) {
      continue;
    }
    if (match.domain !== undefined && match.domain !== metadata.domain) {
      continue;
    }
    if (match.tag !== undefined && !(metadata.tags ?? []).includes(match.tag)) {
      continue;
    }
    return rule.action === "allow";
  }

  return defaultAction === "allow";
}

function scoreByText(match: string, nodeText: string): number {
  if (!match) {
    return 1;
  }

  const normalizedQuery = match.toLowerCase();
  const normalizedContent = nodeText.toLowerCase();

  if (!normalizedContent.includes(normalizedQuery)) {
    return 0;
  }

  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const word of queryWords) {
    if (normalizedContent.includes(word)) {
      score += 1;
    }
  }

  return score + 1;
}

function isExpired(metadata: MemoryMetadata, now: number): boolean {
  const expiresAt = metadata.retention?.expiresAt;
  if (expiresAt === undefined) {
    return false;
  }
  return expiresAt <= now;
}

function canRead(
  metadata: MemoryMetadata,
  requester?: {
    agentId?: string;
    userId?: string;
  },
): boolean {
  const readAcl = metadata.access?.read;
  if (!readAcl) {
    return true;
  }

  if (readAcl.agentIds && readAcl.agentIds.length > 0) {
    if (!requester?.agentId || !readAcl.agentIds.includes(requester.agentId)) {
      return false;
    }
  }

  if (readAcl.userIds && readAcl.userIds.length > 0) {
    if (!requester?.userId || !readAcl.userIds.includes(requester.userId)) {
      return false;
    }
  }

  return true;
}

function orderedScopeLevels(scope: MemoryScopePath): MemoryScopeLevel[] {
  const levels: MemoryScopeLevel[] = [];
  if (scope.session) {
    levels.push("session");
  }
  if (scope.project) {
    levels.push("project");
  }
  if (scope.role) {
    levels.push("role");
  }
  if (scope.org) {
    levels.push("org");
  }
  return levels;
}

function matchesScopedLevel(
  node: MemoryNode,
  level: MemoryScopeLevel,
  requested: MemoryScopePath,
): boolean {
  const scope = node.metadata.scope;
  if (!scope) {
    return false;
  }

  if (level === "session") {
    if (!requested.session || scope.session !== requested.session) {
      return false;
    }
    if (requested.project && scope.project !== requested.project) {
      return false;
    }
    if (requested.role && scope.role !== requested.role) {
      return false;
    }
    if (requested.org && scope.org !== requested.org) {
      return false;
    }
    return true;
  }

  if (level === "project") {
    if (!requested.project || scope.project !== requested.project) {
      return false;
    }
    if (requested.role && scope.role !== requested.role) {
      return false;
    }
    if (requested.org && scope.org !== requested.org) {
      return false;
    }
    return true;
  }

  if (level === "role") {
    if (!requested.role || scope.role !== requested.role) {
      return false;
    }
    if (requested.org && scope.org !== requested.org) {
      return false;
    }
    return true;
  }

  if (!requested.org || scope.org !== requested.org) {
    return false;
  }
  return true;
}

function mostSpecificRequestedLevel(scope: MemoryScopePath): MemoryScopeLevel | undefined {
  if (scope.session) {
    return "session";
  }
  if (scope.project) {
    return "project";
  }
  if (scope.role) {
    return "role";
  }
  if (scope.org) {
    return "org";
  }
  return undefined;
}

function shouldDeleteNodeByScope(
  node: MemoryNode,
  requestedScope: MemoryScopePath,
  targetLevel: MemoryScopeLevel,
  cascade: boolean,
): boolean {
  const scope = node.metadata.scope;
  if (!scope) {
    return false;
  }

  const nodeLevel = node.metadata.scopeLevel ?? inferScopeLevel(scope);

  if (targetLevel === "session") {
    if (requestedScope.session === undefined || scope.session !== requestedScope.session) {
      return false;
    }
    if (requestedScope.project !== undefined && scope.project !== requestedScope.project) {
      return false;
    }
    if (requestedScope.role !== undefined && scope.role !== requestedScope.role) {
      return false;
    }
    if (requestedScope.org !== undefined && scope.org !== requestedScope.org) {
      return false;
    }
    return true;
  }

  if (targetLevel === "project") {
    if (requestedScope.project === undefined || scope.project !== requestedScope.project) {
      return false;
    }
    if (requestedScope.role !== undefined && scope.role !== requestedScope.role) {
      return false;
    }
    if (requestedScope.org !== undefined && scope.org !== requestedScope.org) {
      return false;
    }
    if (cascade) {
      return true;
    }
    return nodeLevel === "project";
  }

  if (targetLevel === "role") {
    if (requestedScope.role === undefined || scope.role !== requestedScope.role) {
      return false;
    }
    if (cascade) {
      return true;
    }
    return nodeLevel === "role";
  }

  if (requestedScope.org === undefined || scope.org !== requestedScope.org) {
    return false;
  }
  if (cascade) {
    return true;
  }
  return nodeLevel === "org";
}

type ScopeIndex = {
  session: Map<string, Set<string>>;
  project: Map<string, Set<string>>;
  role: Map<string, Set<string>>;
  org: Map<string, Set<string>>;
};

function createScopeIndex(): ScopeIndex {
  return {
    session: new Map(),
    project: new Map(),
    role: new Map(),
    org: new Map(),
  };
}

function scopeKeyForLevel(
  scope: MemoryScopePath | undefined,
  level: MemoryScopeLevel,
): string | undefined {
  if (!scope) {
    return undefined;
  }

  if (level === "session") {
    return scope.session;
  }
  if (level === "project") {
    return scope.project;
  }
  if (level === "role") {
    return scope.role;
  }
  return scope.org;
}

class InMemoryMemoryService implements IMemoryService {
  private readonly nodes = new Map<string, MemoryNode>();
  private readonly scopeIndex: ScopeIndex = createScopeIndex();

  constructor(private readonly config: Required<MemoryConfig>) {}

  private indexNode(node: MemoryNode): void {
    for (const level of ["session", "project", "role", "org"] as const) {
      const key = scopeKeyForLevel(node.metadata.scope, level);
      if (!key) {
        continue;
      }

      let nodeIds = this.scopeIndex[level].get(key);
      if (!nodeIds) {
        nodeIds = new Set<string>();
        this.scopeIndex[level].set(key, nodeIds);
      }
      nodeIds.add(node.id);
    }
  }

  private unindexNode(node: MemoryNode): void {
    for (const level of ["session", "project", "role", "org"] as const) {
      const key = scopeKeyForLevel(node.metadata.scope, level);
      if (!key) {
        continue;
      }

      const nodeIds = this.scopeIndex[level].get(key);
      if (!nodeIds) {
        continue;
      }

      nodeIds.delete(node.id);
      if (nodeIds.size === 0) {
        this.scopeIndex[level].delete(key);
      }
    }
  }

  private deleteNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }
    this.unindexNode(node);
    this.nodes.delete(nodeId);
    return true;
  }

  private getCandidatesByScopeLevel(
    level: MemoryScopeLevel,
    requested: MemoryScopePath,
  ): MemoryNode[] {
    const key = scopeKeyForLevel(requested, level);
    if (!key) {
      return [];
    }

    const ids = this.scopeIndex[level].get(key);
    if (!ids || ids.size === 0) {
      return [];
    }

    const nodes: MemoryNode[] = [];
    for (const id of ids) {
      const node = this.nodes.get(id);
      if (node) {
        nodes.push(node);
      }
    }
    return nodes;
  }

  async store(content: string, metadata: MemoryStoreMetadata): Promise<string> {
    if (!governanceAllowsWrite(metadata, this.config.governance)) {
      throw new Error("memory write denied by governance policy");
    }

    const now = Date.now();
    const node: MemoryNode = {
      id: `m_${now.toString(16)}_${Math.random().toString(16).slice(2)}`,
      content,
      embedding: defaultMemoryEmbedding(this.config.embedding.dimensions ?? 512),
      metadata: toMemoryMetadata(metadata, now, this.config),
      createdAt: now,
      updatedAt: now,
      version: NODE_VERSION,
    };

    this.nodes.set(node.id, node);
    this.indexNode(node);
    return node.id;
  }

  async storeBatch(items: Array<MemoryStoreMetadata & { content: string }>): Promise<string[]> {
    const ids: string[] = [];
    for (const item of items) {
      const id = await this.store(item.content, item);
      ids.push(id);
    }
    return ids;
  }

  async retrieve(
    query: string,
    filters?: Partial<MemoryMetadata>,
    limit = this.config.retrieval.defaultLimit ?? 5,
  ): Promise<MemoryNode[]> {
    const normalizedLimit = Math.max(1, Math.min(1_000, limit));
    const normalizedQuery = query.trim();
    const now = Date.now();

    const nodes = Array.from(this.nodes.values()).filter((node) => {
      if (isExpired(node.metadata, now)) {
        return false;
      }
      if (!metadataMatchesFilter(node.metadata, filters)) {
        return false;
      }
      return !normalizedQuery || scoreByText(normalizedQuery, node.content) > 0;
    });

    return nodes
      .map((node) => ({
        node,
        score: scoreByText(normalizedQuery, node.content),
      }))
      .toSorted((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.node.updatedAt - a.node.updatedAt;
      })
      .slice(0, normalizedLimit)
      .map((entry) => entry.node);
  }

  async retrieveScoped(
    query: string,
    scope: MemoryScopePath,
    options?: MemoryScopedRetrieveOptions,
  ): Promise<MemoryNode[]> {
    const normalizedLimit = Math.max(
      1,
      Math.min(1_000, options?.limit ?? this.config.retrieval.defaultLimit ?? 5),
    );
    const levels = orderedScopeLevels(scope);
    const normalizedQuery = query.trim();
    const now = Date.now();
    const seen = new Set<string>();
    const out: MemoryNode[] = [];

    for (const level of levels) {
      const candidates = this.getCandidatesByScopeLevel(level, scope)
        .filter((node) => {
          if (seen.has(node.id)) {
            return false;
          }
          if (isExpired(node.metadata, now)) {
            return false;
          }
          if (!canRead(node.metadata, options?.requester)) {
            return false;
          }
          if (!metadataMatchesFilter(node.metadata, options?.filters)) {
            return false;
          }
          if (!matchesScopedLevel(node, level, scope)) {
            return false;
          }
          return !normalizedQuery || scoreByText(normalizedQuery, node.content) > 0;
        })
        .map((node) => ({
          node,
          score: scoreByText(normalizedQuery, node.content),
        }))
        .toSorted((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return b.node.updatedAt - a.node.updatedAt;
        });

      for (const candidate of candidates) {
        if (out.length >= normalizedLimit) {
          return out;
        }
        seen.add(candidate.node.id);
        out.push(candidate.node);
      }
    }

    return out;
  }

  async searchKeywords(
    keywords: string[],
    filters?: Partial<MemoryMetadata>,
    limit = this.config.retrieval.defaultLimit ?? 5,
  ): Promise<MemoryNode[]> {
    const normalized = Array.from(
      new Set(keywords.map((keyword) => keyword.toLowerCase().trim())),
    ).filter(Boolean);
    const normalizedLimit = Math.max(1, Math.min(1_000, limit));
    const now = Date.now();

    const nodes = Array.from(this.nodes.values()).filter((node) => {
      if (isExpired(node.metadata, now)) {
        return false;
      }
      if (!metadataMatchesFilter(node.metadata, filters)) {
        return false;
      }
      const content = node.content.toLowerCase();
      return normalized.every((keyword) => content.includes(keyword));
    });

    return nodes.toSorted((a, b) => b.updatedAt - a.updatedAt).slice(0, normalizedLimit);
  }

  async forget(nodeId: string): Promise<boolean> {
    return this.deleteNode(nodeId);
  }

  async forgetUser(userId: string): Promise<number> {
    let removed = 0;
    for (const [id, node] of this.nodes.entries()) {
      if (node.metadata.userId === userId && this.deleteNode(id)) {
        removed += 1;
      }
    }
    return removed;
  }

  async deleteByScope(
    scope: MemoryScopePath,
    options?: MemoryDeleteByScopeOptions,
  ): Promise<number> {
    const targetLevel = mostSpecificRequestedLevel(scope);
    if (!targetLevel) {
      return 0;
    }

    const cascade = options?.cascade ?? true;
    let removed = 0;
    const candidates = this.getCandidatesByScopeLevel(targetLevel, scope);

    for (const node of candidates) {
      if (!shouldDeleteNodeByScope(node, scope, targetLevel, cascade)) {
        continue;
      }
      if (this.deleteNode(node.id)) {
        removed += 1;
      }
    }

    return removed;
  }

  async compact(userId?: string): Promise<number> {
    const seen = new Map<string, MemoryNode>();
    const now = Date.now();

    for (const node of this.nodes.values()) {
      if (isExpired(node.metadata, now)) {
        continue;
      }
      if (userId !== undefined && node.metadata.userId !== userId) {
        continue;
      }

      const fingerprint = [
        node.metadata.agentId ?? "",
        node.metadata.userId ?? "",
        node.metadata.sourceId,
        node.metadata.domain,
        node.metadata.scope?.session ?? "",
        node.metadata.scope?.project ?? "",
        node.metadata.scope?.role ?? "",
        node.metadata.scope?.org ?? "",
        [...(node.metadata.tags ?? [])].toSorted().join("|"),
        node.content.toLowerCase(),
      ].join("\0");

      const existing = seen.get(fingerprint);
      if (!existing || existing.updatedAt < node.updatedAt) {
        seen.set(fingerprint, node);
      }
    }

    const kept = new Set(Array.from(seen.values()).map((node) => node.id));
    let removed = 0;
    for (const [id, node] of this.nodes.entries()) {
      if (userId !== undefined && node.metadata.userId !== userId) {
        continue;
      }

      if (isExpired(node.metadata, now)) {
        if (this.deleteNode(id)) {
          removed += 1;
        }
        continue;
      }

      if (kept.has(id)) {
        continue;
      }

      if (this.deleteNode(id)) {
        removed += 1;
      }
    }

    return removed;
  }
}

export function createMemoryService(config?: MemoryServiceOptions): IMemoryService {
  return new InMemoryMemoryService(normalizeMemoryConfig(config));
}
