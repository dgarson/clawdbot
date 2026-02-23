export type MemoryScopeDecision = "allow" | "deny";

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

export interface MemoryMetadata {
  domain: MemoryDomain;
  sourceId: string;
  agentId?: string;
  userId?: string;
  ttlSec?: number;
  confidenceScore: number;
  tags?: string[];
}

export interface MemoryNode {
  id: string;
  content: string;
  embedding: number[];
  metadata: MemoryMetadata;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface IMemoryService {
  store(
    content: string,
    metadata: Omit<MemoryMetadata, "confidenceScore"> & { confidenceScore?: number },
  ): Promise<string>;
  storeBatch(
    items: Array<
      Omit<MemoryMetadata, "confidenceScore"> & { content: string; confidenceScore?: number }
    >,
  ): Promise<string[]>;
  retrieve(query: string, filters?: Partial<MemoryMetadata>, limit?: number): Promise<MemoryNode[]>;
  forget(nodeId: string): Promise<boolean>;
  forgetUser(userId: string): Promise<number>;
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

const NODE_VERSION = 1;

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
  if (filters.tags !== undefined) {
    const nodeTags = new Set(metadata.tags ?? []);
    if (!filters.tags.every((tag) => nodeTags.has(tag))) {
      return false;
    }
  }

  return true;
}

function governanceAllowsWrite(
  metadata: Omit<MemoryMetadata, "confidenceScore">,
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
  const normalizedQuery = match.toLowerCase().trim();
  if (!normalizedQuery) {
    return 1;
  }

  const normalizedContent = nodeText.toLowerCase();
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) {
    return normalizedContent.includes(normalizedQuery) ? 1 : 0;
  }

  let matchedWords = 0;
  for (const word of queryWords) {
    if (normalizedContent.includes(word)) {
      matchedWords += 1;
    }
  }

  if (matchedWords === 0) {
    return 0;
  }

  const phraseBoost = normalizedContent.includes(normalizedQuery) ? 1 : 0;
  const coverage = matchedWords / queryWords.length;

  // [0,1] coverage + phrase bonus scaled into a bounded lexical score.
  return Math.min(1, coverage + phraseBoost * 0.25);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function resolveHybridWeights(retrieval: Required<MemoryConfig>["retrieval"]): {
  vectorWeight: number;
  keywordWeight: number;
} {
  const vectorWeight = clamp01(retrieval.vectorWeight ?? 0.7);
  const keywordWeight = clamp01(retrieval.keywordWeight ?? 0.3);
  const total = vectorWeight + keywordWeight;

  if (total <= 0) {
    return { vectorWeight: 0.5, keywordWeight: 0.5 };
  }

  return {
    vectorWeight: vectorWeight / total,
    keywordWeight: keywordWeight / total,
  };
}

function scoreRecency(updatedAt: number): number {
  const ageMs = Math.max(0, Date.now() - updatedAt);
  const halfLifeMs = 1000 * 60 * 60 * 24 * 7; // 7 days
  return Math.exp((-Math.log(2) * ageMs) / halfLifeMs);
}

function isNodeExpired(
  node: MemoryNode,
  config: Required<MemoryConfig>,
  now = Date.now(),
): boolean {
  const ttlSecondsFromNode = node.metadata.ttlSec;
  if (ttlSecondsFromNode !== undefined) {
    if (ttlSecondsFromNode <= 0) {
      return true;
    }
    return node.createdAt + ttlSecondsFromNode * 1_000 <= now;
  }

  const defaultTtlDays = config.retention.defaultTtlDays;
  if (defaultTtlDays === undefined || defaultTtlDays <= 0) {
    return false;
  }
  return node.createdAt + defaultTtlDays * 24 * 60 * 60 * 1_000 <= now;
}

class InMemoryMemoryService implements IMemoryService {
  private readonly nodes = new Map<string, MemoryNode>();

  constructor(private readonly config: Required<MemoryConfig>) {}

  private pruneExpired(userId?: string): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, node] of this.nodes.entries()) {
      if (userId !== undefined && node.metadata.userId !== userId) {
        continue;
      }
      if (!isNodeExpired(node, this.config, now)) {
        continue;
      }
      this.nodes.delete(id);
      removed += 1;
    }
    return removed;
  }

  async store(
    content: string,
    metadata: Omit<MemoryMetadata, "confidenceScore"> & { confidenceScore?: number },
  ): Promise<string> {
    if (!governanceAllowsWrite(metadata, this.config.governance)) {
      throw new Error("memory write denied by governance policy");
    }

    const now = Date.now();
    const node: MemoryNode = {
      id: `m_${now.toString(16)}_${Math.random().toString(16).slice(2)}`,
      content,
      embedding: defaultMemoryEmbedding(this.config.embedding.dimensions ?? 512),
      metadata: {
        ...metadata,
        confidenceScore: metadata.confidenceScore ?? 1,
      },
      createdAt: now,
      updatedAt: now,
      version: NODE_VERSION,
    };

    this.nodes.set(node.id, node);
    return node.id;
  }

  async storeBatch(
    items: Array<
      Omit<MemoryMetadata, "confidenceScore"> & { content: string; confidenceScore?: number }
    >,
  ): Promise<string[]> {
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
    this.pruneExpired(filters?.userId);

    const normalizedLimit = Math.max(1, Math.min(1_000, limit));
    const normalizedQuery = query.trim();
    const { vectorWeight, keywordWeight } = resolveHybridWeights(this.config.retrieval);

    const nodes = Array.from(this.nodes.values()).filter((node) => {
      if (!metadataMatchesFilter(node.metadata, filters)) {
        return false;
      }
      return !normalizedQuery || scoreByText(normalizedQuery, node.content) > 0;
    });

    return nodes
      .map((node) => {
        const lexicalScore = scoreByText(normalizedQuery, node.content);
        const confidenceScore = clamp01(node.metadata.confidenceScore ?? 1);
        const recencyScore = scoreRecency(node.updatedAt);

        const hybridScore =
          lexicalScore * keywordWeight + lexicalScore * confidenceScore * vectorWeight;
        const qualityScore = hybridScore * 0.85 + recencyScore * 0.15;

        return {
          node,
          score: qualityScore,
          lexicalScore,
        };
      })
      .toSorted((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (b.lexicalScore !== a.lexicalScore) {
          return b.lexicalScore - a.lexicalScore;
        }
        return b.node.updatedAt - a.node.updatedAt;
      })
      .slice(0, normalizedLimit)
      .map((entry) => entry.node);
  }

  async searchKeywords(
    keywords: string[],
    filters?: Partial<MemoryMetadata>,
    limit = this.config.retrieval.defaultLimit ?? 5,
  ): Promise<MemoryNode[]> {
    this.pruneExpired(filters?.userId);

    const normalized = Array.from(
      new Set(keywords.map((keyword) => keyword.toLowerCase().trim())),
    ).filter(Boolean);
    const normalizedLimit = Math.max(1, Math.min(1_000, limit));

    const nodes = Array.from(this.nodes.values()).filter((node) => {
      if (!metadataMatchesFilter(node.metadata, filters)) {
        return false;
      }
      const content = node.content.toLowerCase();
      return normalized.every((keyword) => content.includes(keyword));
    });

    return nodes
      .toSorted((a, b) => {
        const confidenceDelta =
          (b.metadata.confidenceScore ?? 1) - (a.metadata.confidenceScore ?? 1);
        if (confidenceDelta !== 0) {
          return confidenceDelta;
        }
        return b.updatedAt - a.updatedAt;
      })
      .slice(0, normalizedLimit);
  }

  async forget(nodeId: string): Promise<boolean> {
    return this.nodes.delete(nodeId);
  }

  async forgetUser(userId: string): Promise<number> {
    let removed = 0;
    for (const [id, node] of this.nodes.entries()) {
      if (node.metadata.userId === userId) {
        this.nodes.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  async compact(userId?: string): Promise<number> {
    const expiredRemoved = this.pruneExpired(userId);

    const seen = new Map<string, MemoryNode>();
    for (const node of this.nodes.values()) {
      if (userId !== undefined && node.metadata.userId !== userId) {
        continue;
      }

      const fingerprint = [
        node.metadata.agentId ?? "",
        node.metadata.userId ?? "",
        node.metadata.sourceId,
        node.metadata.domain,
        [...(node.metadata.tags ?? [])].toSorted().join("|"),
        node.content.toLowerCase(),
      ].join("\0");

      const existing = seen.get(fingerprint);
      if (!existing || existing.updatedAt < node.updatedAt) {
        seen.set(fingerprint, node);
      }
    }

    const kept = new Set(Array.from(seen.values()).map((node) => node.id));
    let dedupeRemoved = 0;
    for (const [id] of this.nodes.entries()) {
      if (kept.has(id)) {
        continue;
      }
      if (userId !== undefined && (this.nodes.get(id)?.metadata.userId ?? "") !== userId) {
        continue;
      }
      this.nodes.delete(id);
      dedupeRemoved += 1;
    }

    return expiredRemoved + dedupeRemoved;
  }
}

export function createMemoryService(config?: MemoryServiceOptions): IMemoryService {
  return new InMemoryMemoryService(normalizeMemoryConfig(config));
}
