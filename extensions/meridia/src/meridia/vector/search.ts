import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { MeridiaDbBackend } from "../db/backend.js";
import type { MeridiaExperienceRecord } from "../types.js";
import { resolveMemorySearchConfig } from "../../../../../src/agents/memory-search.js";
import {
  createEmbeddingProvider,
  type EmbeddingProvider,
} from "../../../../../src/memory/embeddings.js";
import { resolveMeridiaDir } from "../paths.js";

type CoreOpenClawConfig = import("../../../../../src/config/config.js").OpenClawConfig;

type VectorBackend = MeridiaDbBackend & {
  vecAvailable?: boolean;
  loadVectorExtension?: (
    extensionPath?: string,
    dims?: number,
  ) => Promise<{ ok: boolean; error?: string }>;
  insertEmbedding?: (recordId: string, embedding: Float32Array) => Promise<boolean>;
  searchByVector?: (
    embedding: Float32Array,
    limit?: number,
  ) => Promise<Array<{ recordId: string; distance: number }>>;
};

type EmbeddingSettings = {
  provider: "openai" | "local" | "gemini" | "voyage" | "auto";
  model: string;
  fallback: "openai" | "gemini" | "local" | "voyage" | "none";
  remote?: {
    baseUrl?: string;
    apiKey?: string;
    headers?: Record<string, string>;
  };
  local?: {
    modelPath?: string;
    modelCacheDir?: string;
  };
  vectorExtensionPath?: string;
};

type EmbeddingProviderCache = {
  key: string;
  provider: EmbeddingProvider;
};

let embeddingProviderCache: EmbeddingProviderCache | undefined;

function asCoreConfig(cfg: OpenClawConfig): CoreOpenClawConfig {
  return cfg as unknown as CoreOpenClawConfig;
}

function asVectorBackend(backend: MeridiaDbBackend): VectorBackend | null {
  const candidate = backend as VectorBackend;
  if (
    typeof candidate.loadVectorExtension !== "function" ||
    typeof candidate.insertEmbedding !== "function" ||
    typeof candidate.searchByVector !== "function"
  ) {
    return null;
  }
  return candidate;
}

function resolveEmbeddingSettings(cfg: OpenClawConfig): EmbeddingSettings {
  const resolved = resolveMemorySearchConfig(asCoreConfig(cfg), "meridia");
  if (!resolved) {
    return {
      provider: "auto",
      model: "",
      fallback: "none",
    };
  }

  return {
    provider: resolved.provider,
    model: resolved.model,
    fallback: resolved.fallback,
    remote: resolved.remote
      ? {
          baseUrl: resolved.remote.baseUrl,
          apiKey: resolved.remote.apiKey,
          headers: resolved.remote.headers,
        }
      : undefined,
    local: resolved.local,
    vectorExtensionPath: resolved.store.vector.extensionPath,
  };
}

async function getEmbeddingProvider(cfg: OpenClawConfig): Promise<EmbeddingProvider | null> {
  const settings = resolveEmbeddingSettings(cfg);
  const key = JSON.stringify({
    provider: settings.provider,
    model: settings.model,
    fallback: settings.fallback,
    remote: settings.remote,
    local: settings.local,
  });

  if (embeddingProviderCache?.key === key) {
    return embeddingProviderCache.provider;
  }

  try {
    const result = await createEmbeddingProvider({
      config: asCoreConfig(cfg),
      agentDir: resolveMeridiaDir(cfg),
      provider: settings.provider,
      model: settings.model,
      fallback: settings.fallback,
      remote: settings.remote,
      local: settings.local,
    });

    embeddingProviderCache = {
      key,
      provider: result.provider,
    };
    return result.provider;
  } catch {
    return null;
  }
}

export async function probeEmbeddingProviderAvailability(
  cfg?: OpenClawConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!cfg) {
    return { ok: false, error: "missing_config" };
  }
  const provider = await getEmbeddingProvider(cfg);
  if (!provider) {
    return { ok: false, error: "embedding_provider_unavailable" };
  }
  return { ok: true };
}

async function embedQueryText(cfg: OpenClawConfig, text: string): Promise<Float32Array | null> {
  const provider = await getEmbeddingProvider(cfg);
  if (!provider) {
    return null;
  }

  try {
    const values = await provider.embedQuery(text);
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }
    return Float32Array.from(values);
  } catch {
    return null;
  }
}

function vectorDistanceToSimilarity(distance: number): number {
  if (!Number.isFinite(distance)) return 0;
  return 1 / (1 + Math.max(0, distance));
}

function buildEmbeddingText(record: MeridiaExperienceRecord): string {
  const parts: string[] = [];
  if (record.content?.topic) parts.push(record.content.topic);
  if (record.content?.summary) parts.push(record.content.summary);
  if (record.content?.context) parts.push(record.content.context);
  if (record.capture?.evaluation?.reason) parts.push(record.capture.evaluation.reason);
  if (record.content?.tags?.length) parts.push(record.content.tags.join(" "));
  if (record.tool?.name) parts.push(`tool:${record.tool.name}`);
  if (record.phenomenology?.emotionalSignature?.primary?.length) {
    parts.push(record.phenomenology.emotionalSignature.primary.join(" "));
  }
  if (record.phenomenology?.anchors?.length) {
    parts.push(record.phenomenology.anchors.map((a) => a.phrase).join(" "));
  }
  return parts.join("\n").slice(0, 4000);
}

async function ensureVectorBackendReady(params: {
  backend: MeridiaDbBackend;
  cfg?: OpenClawConfig;
  dims?: number;
}): Promise<boolean> {
  const vectorBackend = asVectorBackend(params.backend);
  if (!vectorBackend || typeof vectorBackend.loadVectorExtension !== "function") {
    return false;
  }

  if (!params.cfg && vectorBackend.vecAvailable === true && !params.dims) {
    return true;
  }

  const settings = params.cfg ? resolveEmbeddingSettings(params.cfg) : undefined;
  const loadResult = await vectorBackend.loadVectorExtension(
    settings?.vectorExtensionPath,
    params.dims,
  );
  return loadResult.ok;
}

export async function probeVectorBackendAvailability(params: {
  backend: MeridiaDbBackend;
  cfg?: OpenClawConfig;
}): Promise<boolean> {
  const backendReady = await ensureVectorBackendReady(params);
  if (!backendReady) {
    return false;
  }
  const embeddingProbe = await probeEmbeddingProviderAvailability(params.cfg);
  return embeddingProbe.ok;
}

export async function indexRecordVector(params: {
  backend: MeridiaDbBackend;
  cfg?: OpenClawConfig;
  record: MeridiaExperienceRecord;
}): Promise<{ indexed: boolean; error?: string }> {
  const vectorBackend = asVectorBackend(params.backend);
  if (!vectorBackend || typeof vectorBackend.insertEmbedding !== "function") {
    return { indexed: false, error: "backend_no_vector_support" };
  }
  if (!params.cfg) {
    return { indexed: false, error: "missing_config" };
  }

  const text = buildEmbeddingText(params.record);
  if (!text.trim()) {
    return { indexed: false, error: "empty_embedding_text" };
  }

  const embedding = await embedQueryText(params.cfg, text);
  if (!embedding) {
    return { indexed: false, error: "embedding_unavailable" };
  }

  const ready = await ensureVectorBackendReady({
    backend: params.backend,
    cfg: params.cfg,
    dims: embedding.length,
  });
  if (!ready) {
    return { indexed: false, error: "vector_backend_unavailable" };
  }

  try {
    const indexed = await vectorBackend.insertEmbedding(params.record.id, embedding);
    return indexed ? { indexed: true } : { indexed: false, error: "vector_insert_failed" };
  } catch (err) {
    return { indexed: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function searchRecordsByVector(params: {
  backend: MeridiaDbBackend;
  cfg?: OpenClawConfig;
  query: string;
  limit?: number;
  minSimilarity?: number;
  minScore?: number;
}): Promise<Array<{ record: MeridiaExperienceRecord; similarity: number }>> {
  const vectorBackend = asVectorBackend(params.backend);
  if (!vectorBackend || typeof vectorBackend.searchByVector !== "function") {
    return [];
  }
  if (!params.cfg) {
    return [];
  }

  const queryEmbedding = await embedQueryText(params.cfg, params.query);
  if (!queryEmbedding) {
    return [];
  }

  const ready = await ensureVectorBackendReady({
    backend: params.backend,
    cfg: params.cfg,
    dims: queryEmbedding.length,
  });
  if (!ready) {
    return [];
  }

  const minSimilarity = params.minSimilarity ?? 0;
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);

  const rawMatches = await vectorBackend.searchByVector(queryEmbedding, limit);
  if (rawMatches.length === 0) {
    return [];
  }

  const hydrated = await Promise.all(
    rawMatches.map(async (match) => {
      const recordResult = await params.backend.getRecordById(match.recordId);
      if (!recordResult) return null;
      const similarity = vectorDistanceToSimilarity(match.distance);
      if (similarity < minSimilarity) return null;
      if (
        params.minScore !== undefined &&
        Number.isFinite(params.minScore) &&
        recordResult.record.capture.score < params.minScore
      ) {
        return null;
      }
      return {
        record: recordResult.record,
        similarity,
      };
    }),
  );

  return hydrated.filter(
    (entry): entry is { record: MeridiaExperienceRecord; similarity: number } => Boolean(entry),
  );
}
