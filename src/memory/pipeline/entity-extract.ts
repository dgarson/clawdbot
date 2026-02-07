import type { GraphitiNodeDTO, GraphitiEdgeDTO } from "../graphiti/adapter.js";
import type { GraphitiClient } from "../graphiti/client.js";
import type { MemoryContentObject } from "../types.js";

// ───────────────────── Types ─────────────────────

export type EntityType =
  | "Person"
  | "Project"
  | "Technology"
  | "Organization"
  | "Location"
  | "Concept"
  | "Tool"
  | "Event";

export type ExtractedEntity = {
  /** Canonical name of the entity. */
  name: string;
  /** Entity type. */
  type: EntityType;
  /** Source episode id. */
  sourceEpisodeId: string;
  /** Text span where entity was found. */
  span?: string;
  /** Additional properties (e.g. url, version). */
  properties?: Record<string, unknown>;
};

export type ExtractedRelation = {
  sourceName: string;
  targetName: string;
  relation: string;
  sourceEpisodeId: string;
  properties?: Record<string, unknown>;
};

export type EntityExtractionResult = {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  warnings: EntityExtractionWarning[];
};

export type EntityExtractionWarning = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type EntityExtractorConfig = {
  /** Enable/disable entity extraction. Default: true. */
  enabled?: boolean;
  /** Minimum text length to attempt extraction. Default: 20. */
  minTextLength?: number;
  /** Maximum entities per episode. Default: 50. */
  maxEntitiesPerEpisode?: number;
  /** Custom patterns to add. */
  customPatterns?: EntityPattern[];
};

export type EntityPattern = {
  type: EntityType;
  pattern: RegExp;
  nameGroup?: number;
};

// ───────────────────── Patterns ─────────────────────

/**
 * Common technology names and patterns.
 * We use word-boundary matching for accuracy.
 */
const TECHNOLOGY_NAMES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Rust",
  "Go",
  "Java",
  "C\\+\\+",
  "React",
  "Vue",
  "Angular",
  "Node\\.js",
  "Deno",
  "Bun",
  "Docker",
  "Kubernetes",
  "PostgreSQL",
  "MySQL",
  "SQLite",
  "Redis",
  "MongoDB",
  "GraphQL",
  "REST",
  "gRPC",
  "Kafka",
  "RabbitMQ",
  "Terraform",
  "AWS",
  "GCP",
  "Azure",
  "Vercel",
  "Cloudflare",
  "Nginx",
  "Git",
  "GitHub",
  "GitLab",
  "Slack",
  "Discord",
  "Telegram",
  "OpenAI",
  "Anthropic",
  "Claude",
  "GPT-4",
  "Gemini",
  "LangChain",
  "LlamaIndex",
  "Graphiti",
  "Neo4j",
  "Pinecone",
  "Weaviate",
  "Qdrant",
  "ChromaDB",
  "Vite",
  "Webpack",
  "esbuild",
  "pnpm",
  "npm",
  "yarn",
  "Vitest",
  "Jest",
  "Playwright",
  "Cypress",
  "Lit",
  "Web Components",
  "Tailwind",
  "CSS",
  "HTML",
  "WASM",
  "WebSocket",
  "HTTP",
  "HTTPS",
  "SSH",
  "TLS",
  "OAuth",
  "JWT",
  "SAML",
];

const TECHNOLOGY_PATTERN = new RegExp(`\\b(${TECHNOLOGY_NAMES.join("|")})\\b`, "gi");

/**
 * Person patterns — matches common conversational references to people:
 * - @mentions (e.g. @john, @dgarson)
 * - "talked to NAME", "meeting with NAME"
 * - Proper names in possessive context ("Dave's PR", "Sarah's idea")
 */
const PERSON_PATTERNS: EntityPattern[] = [
  {
    type: "Person",
    pattern: /@([a-zA-Z][a-zA-Z0-9_-]{1,30})\b/g,
    nameGroup: 1,
  },
  {
    type: "Person",
    pattern:
      /\b(?:[Tt]alked?\s+(?:to|with)|[Mm]eeting\s+with|[Aa]sked|[Tt]old|[Ff]rom|[Bb]y)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
    nameGroup: 1,
  },
];

/**
 * Organization patterns — matches org references.
 */
const ORG_PATTERNS: EntityPattern[] = [
  {
    type: "Organization",
    pattern:
      /\b([A-Z][a-zA-Z]+(?:\s+(?:Inc|Corp|LLC|Ltd|Co|Labs|AI|Technologies|Systems|Group)\.?))\b/g,
    nameGroup: 1,
  },
];

/**
 * Project patterns — matches references to repos, PRs, branches.
 */
const PROJECT_PATTERNS: EntityPattern[] = [
  {
    type: "Project",
    pattern:
      /\b(?:repo|repository|project|branch|PR)\s+(?:#?\d+|["`']?([a-zA-Z][a-zA-Z0-9_/-]+)["`']?)/gi,
    nameGroup: 1,
  },
];

/**
 * URL patterns for extracting tool/project references.
 */
const URL_PATTERN: EntityPattern = {
  type: "Tool",
  pattern: /https?:\/\/(?:github\.com|gitlab\.com)\/([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)/g,
  nameGroup: 1,
};

// ───────────────────── Core Extractor ─────────────────────

function dedupeEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();
  for (const entity of entities) {
    const key = `${entity.type}:${entity.name.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, entity);
    }
  }
  return Array.from(seen.values());
}

function extractEntitiesFromText(
  text: string,
  episodeId: string,
  config: EntityExtractorConfig = {},
): { entities: ExtractedEntity[]; warnings: EntityExtractionWarning[] } {
  const warnings: EntityExtractionWarning[] = [];
  const entities: ExtractedEntity[] = [];
  const maxEntities = config.maxEntitiesPerEpisode ?? 50;

  // Technology extraction
  const techMatches = text.matchAll(TECHNOLOGY_PATTERN);
  for (const match of techMatches) {
    if (entities.length >= maxEntities) break;
    entities.push({
      name: match[1],
      type: "Technology",
      sourceEpisodeId: episodeId,
      span: match[0],
    });
  }

  // Person extraction
  for (const pattern of PERSON_PATTERNS) {
    const matches = text.matchAll(pattern.pattern);
    for (const match of matches) {
      if (entities.length >= maxEntities) break;
      const name = match[pattern.nameGroup ?? 0]?.trim();
      if (name && name.length > 1) {
        entities.push({
          name,
          type: "Person",
          sourceEpisodeId: episodeId,
          span: match[0],
        });
      }
    }
  }

  // Organization extraction
  for (const pattern of ORG_PATTERNS) {
    const matches = text.matchAll(pattern.pattern);
    for (const match of matches) {
      if (entities.length >= maxEntities) break;
      const name = match[pattern.nameGroup ?? 0]?.trim();
      if (name && name.length > 2) {
        entities.push({
          name,
          type: "Organization",
          sourceEpisodeId: episodeId,
          span: match[0],
        });
      }
    }
  }

  // Project extraction
  for (const pattern of PROJECT_PATTERNS) {
    const matches = text.matchAll(pattern.pattern);
    for (const match of matches) {
      if (entities.length >= maxEntities) break;
      const name = match[pattern.nameGroup ?? 0]?.trim();
      if (name && name.length > 1) {
        entities.push({
          name,
          type: "Project",
          sourceEpisodeId: episodeId,
          span: match[0],
        });
      }
    }
  }

  // URL/repo extraction
  {
    const matches = text.matchAll(URL_PATTERN.pattern);
    for (const match of matches) {
      if (entities.length >= maxEntities) break;
      const name = match[URL_PATTERN.nameGroup ?? 0]?.trim();
      if (name) {
        entities.push({
          name,
          type: "Project",
          sourceEpisodeId: episodeId,
          span: match[0],
          properties: { url: match[0] },
        });
      }
    }
  }

  // Custom patterns
  if (config.customPatterns) {
    for (const pattern of config.customPatterns) {
      const matches = text.matchAll(pattern.pattern);
      for (const match of matches) {
        if (entities.length >= maxEntities) break;
        const name = match[pattern.nameGroup ?? 0]?.trim();
        if (name && name.length > 1) {
          entities.push({
            name,
            type: pattern.type,
            sourceEpisodeId: episodeId,
            span: match[0],
          });
        }
      }
    }
  }

  return { entities: dedupeEntities(entities), warnings };
}

// ───────────────────── Relation Inference ─────────────────────

/**
 * Infers simple relations from co-occurring entities in the same episode.
 * E.g. if "TypeScript" and "clawdbrain" appear in the same episode,
 * we infer "clawdbrain USES TypeScript".
 */
function inferRelations(entities: ExtractedEntity[], episodeId: string): ExtractedRelation[] {
  const relations: ExtractedRelation[] = [];

  // Group by episode
  const techEntities = entities.filter((e) => e.type === "Technology");
  const projectEntities = entities.filter((e) => e.type === "Project");
  const personEntities = entities.filter((e) => e.type === "Person");
  const orgEntities = entities.filter((e) => e.type === "Organization");

  // Project → Technology (USES)
  for (const project of projectEntities) {
    for (const tech of techEntities) {
      relations.push({
        sourceName: project.name,
        targetName: tech.name,
        relation: "USES",
        sourceEpisodeId: episodeId,
      });
    }
  }

  // Person → Project (WORKS_ON)
  for (const person of personEntities) {
    for (const project of projectEntities) {
      relations.push({
        sourceName: person.name,
        targetName: project.name,
        relation: "WORKS_ON",
        sourceEpisodeId: episodeId,
      });
    }
  }

  // Person → Organization (MEMBER_OF)
  for (const person of personEntities) {
    for (const org of orgEntities) {
      relations.push({
        sourceName: person.name,
        targetName: org.name,
        relation: "MEMBER_OF",
        sourceEpisodeId: episodeId,
      });
    }
  }

  return relations;
}

// ───────────────────── Pipeline Stage ─────────────────────

/**
 * Extract entities from a batch of episodes.
 * Returns extracted entities and inferred relations.
 */
export function extractEntitiesFromEpisodes(
  episodes: MemoryContentObject[],
  config: EntityExtractorConfig = {},
): EntityExtractionResult {
  const allEntities: ExtractedEntity[] = [];
  const allRelations: ExtractedRelation[] = [];
  const warnings: EntityExtractionWarning[] = [];

  if (config.enabled === false) {
    warnings.push({
      code: "entity_extract.disabled",
      message: "Entity extraction is disabled by config.",
    });
    return { entities: [], relations: [], warnings };
  }

  const minTextLength = config.minTextLength ?? 20;

  for (const episode of episodes) {
    const text = episode.text ?? "";
    if (text.length < minTextLength) continue;

    const { entities, warnings: extractWarnings } = extractEntitiesFromText(
      text,
      episode.id,
      config,
    );
    allEntities.push(...entities);
    warnings.push(...extractWarnings);

    // Infer relations from co-occurring entities
    const relations = inferRelations(entities, episode.id);
    allRelations.push(...relations);
  }

  // Global dedup
  const uniqueEntities = dedupeEntities(allEntities);

  return { entities: uniqueEntities, relations: allRelations, warnings };
}

// ───────────────────── Graph Write ─────────────────────

/**
 * Convert extracted entities and relations to Graphiti DTOs
 * and write them to the graph.
 */
export async function writeEntitiesToGraph(params: {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  client?: GraphitiClient;
}): Promise<{ warnings: EntityExtractionWarning[] }> {
  const warnings: EntityExtractionWarning[] = [];
  const { entities, relations, client } = params;

  if (!client) {
    if (entities.length > 0) {
      warnings.push({
        code: "entity_extract.no_client",
        message: `Extracted ${entities.length} entities but Graphiti client is not configured; skipping graph write.`,
      });
    }
    return { warnings };
  }

  if (entities.length === 0) {
    return { warnings };
  }

  // Build Graphiti nodes
  const nodeMap = new Map<string, GraphitiNodeDTO>();
  for (const entity of entities) {
    const key = `${entity.type}:${entity.name.toLowerCase()}`;
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        id: key,
        label: entity.name,
        properties: {
          type: entity.type,
          sourceEpisodeId: entity.sourceEpisodeId,
          ...entity.properties,
        },
      });
    }
  }

  // Build Graphiti edges
  const edges: GraphitiEdgeDTO[] = relations.map((rel, idx) => ({
    id: `rel:${rel.sourceName.toLowerCase()}:${rel.relation}:${rel.targetName.toLowerCase()}:${idx}`,
    sourceId: `${lookupEntityType(rel.sourceName, entities)}:${rel.sourceName.toLowerCase()}`,
    targetId: `${lookupEntityType(rel.targetName, entities)}:${rel.targetName.toLowerCase()}`,
    relation: rel.relation,
    properties: {
      sourceEpisodeId: rel.sourceEpisodeId,
      ...rel.properties,
    },
  }));

  const nodes = Array.from(nodeMap.values());

  try {
    const response = await client.ingestEpisodes({
      episodes: entities.map((e) => ({
        id: `entity:${e.type}:${e.name}`,
        kind: "entity" as const,
        text: `[${e.type}] ${e.name}`,
        metadata: {
          entityType: e.type,
          entityName: e.name,
          sourceEpisodeId: e.sourceEpisodeId,
          ...e.properties,
        },
      })),
    });

    if (!response.ok) {
      warnings.push({
        code: "entity_extract.graph_write_failed",
        message: `Failed to write ${nodes.length} entity nodes and ${edges.length} edges to graph.`,
        details: { error: response.error },
      });
    }
  } catch (err) {
    warnings.push({
      code: "entity_extract.graph_write_error",
      message: `Error writing entities to graph: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return { warnings };
}

function lookupEntityType(name: string, entities: ExtractedEntity[]): string {
  const entity = entities.find((e) => e.name.toLowerCase() === name.toLowerCase());
  return entity?.type ?? "Concept";
}
