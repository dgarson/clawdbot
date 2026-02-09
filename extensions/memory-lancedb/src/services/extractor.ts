import type { ClawdbrainPluginApi } from "clawdbrain/plugin-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { lookup as dnsLookup } from "node:dns/promises";
import { appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { completeTextWithModelRef } from "openclaw/plugin-sdk";
import type { Extractor } from "../types.js";
import { MEMORY_CATEGORIES, type MemoryCategory } from "../../config.js";

/** Max time to wait for the HTTP response (headers), in ms. */
const FETCH_TIMEOUT_MS = 15_000;

/** Max response body size to read, in bytes (1 MB). */
const MAX_RESPONSE_BYTES = 1_048_576;

/**
 * Ports commonly used by local LLM inference servers (vLLM, llama-cpp, Ollama,
 * text-generation-inference, LocalAI). Private-network fetches are ONLY
 * allowed when the destination port is in this set.
 */
const ALLOWED_LOCAL_LLM_PORTS = new Set([
  8000, // vLLM default
  8080, // llama-cpp-python / LocalAI / TGI
  11434, // Ollama
  5000, // common Flask / custom servers
  3000, // common dev server
]);

const BLOCKED_HOSTNAMES = new Set(["metadata.google.internal"]);

// ---------------------------------------------------------------------------
// IP / hostname helpers (mirrors logic from src/infra/net/ssrf.ts)
// ---------------------------------------------------------------------------

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isPrivateIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateAddress(address: string): boolean {
  let norm = address.trim().toLowerCase();
  if (norm.startsWith("[") && norm.endsWith("]")) norm = norm.slice(1, -1);
  if (!norm) return false;

  // IPv4-mapped IPv6
  if (norm.startsWith("::ffff:")) {
    const mapped = norm.slice("::ffff:".length);
    const v4 = parseIpv4(mapped);
    if (v4) return isPrivateIpv4(v4);
  }

  // IPv6 loopback / link-local / ULA
  if (norm.includes(":")) {
    if (norm === "::" || norm === "::1") return true;
    return ["fe80:", "fec0:", "fc", "fd"].some((p) => norm.startsWith(p));
  }

  const v4 = parseIpv4(norm);
  return v4 ? isPrivateIpv4(v4) : false;
}

function isBlockedHostname(hostname: string): boolean {
  const norm = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(norm)) return true;
  return (
    norm === "localhost" ||
    norm.endsWith(".localhost") ||
    norm.endsWith(".local") ||
    norm.endsWith(".internal")
  );
}

/**
 * Validate a URL for safe server-side fetching.
 *
 * - Only http/https schemes
 * - Blocked hostnames (metadata endpoints, .local, .internal)
 * - DNS resolution → reject private IPs unless targeting an allowed LLM port
 */
async function validateUrlForFetch(url: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Blocked URL scheme: ${parsed.protocol}`);
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error(`Blocked hostname: ${parsed.hostname}`);
  }

  // Resolve to check actual IPs (prevents DNS-rebinding to private ranges)
  const results = await dnsLookup(parsed.hostname, { all: true });
  for (const entry of results) {
    if (isPrivateAddress(entry.address)) {
      const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
      if (!ALLOWED_LOCAL_LLM_PORTS.has(port)) {
        throw new Error(`Blocked: resolves to private IP ${entry.address} on non-LLM port ${port}`);
      }
    }
  }

  return parsed;
}

/**
 * Fetch URL content with timeout and response-size limits.
 * Returns null if the fetch fails or exceeds limits.
 */
async function safeFetch(url: URL, api: ClawdbrainPluginApi): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "OpenClaw-Memory/1.0" },
    });

    if (!res.ok) {
      api.logger.warn(`memory-lancedb: fetch failed for ${url.href} (${res.status})`);
      return null;
    }

    // Enforce body size limit via streaming
    const reader = res.body?.getReader();
    if (!reader) return null;

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        api.logger.warn(
          `memory-lancedb: response body exceeded ${MAX_RESPONSE_BYTES} bytes for ${url.href}`,
        );
        return null;
      }
      chunks.push(value);
    }

    const decoder = new TextDecoder();
    return chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();
  } finally {
    clearTimeout(timeout);
  }
}

async function logTrace(api: ClawdbrainPluginApi, type: string, data: Record<string, unknown>) {
  const logDir = join(homedir(), ".openclaw", "logs");
  const logPath = join(logDir, "memory-trace.jsonl");
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    ...data,
  };
  try {
    await appendFile(logPath, JSON.stringify(entry) + "\n");
  } catch (err) {
    api.logger.warn(`memory-lancedb: trace logging failed: ${String(err)}`);
  }
}

/**
 * Extract JSON from an LLM response that may contain markdown fences or
 * surrounding prose. Handles both JSON arrays and objects.
 */
function extractJsonFromText(raw: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }

  // Try extracting from markdown code fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Try finding a JSON array
  const arrStart = raw.indexOf("[");
  const arrEnd = raw.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(raw.slice(arrStart, arrEnd + 1));
    } catch {
      // continue
    }
  }

  // Try finding a JSON object
  const objStart = raw.indexOf("{");
  const objEnd = raw.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(raw.slice(objStart, objEnd + 1));
    } catch {
      // continue
    }
  }

  return null;
}

/**
 * Normalize category to allowed MEMORY_CATEGORIES.
 * Maps "event" and "resource" to "other", and any unknown category to "other".
 */
function normalizeCategory(category: string): MemoryCategory {
  const allowed = new Set(MEMORY_CATEGORIES);
  if (allowed.has(category as MemoryCategory)) {
    return category as MemoryCategory;
  }
  // Map known unsupported categories + any unknown values to "other"
  return "other";
}

export class SdkExtractor implements Extractor {
  constructor(
    private readonly cfg: OpenClawConfig,
    private readonly modelRef: string,
  ) {}

  async extract(
    messages: { role: string; content: string }[],
    api: ClawdbrainPluginApi,
  ): Promise<
    {
      text: string;
      category: MemoryCategory;
      importance: number;
      confidence: number;
      tags: string[];
    }[]
  > {
    const conversation = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    const prompt = `You are an expert at extracting long-term knowledge from conversations.
Analyze the following conversation and extract any:
- User preferences (likes, dislikes, habits, workflow)
- Factual statements about the user or their environment
- Important decisions made during the conversation
- Recurrent entities or topics (people, places, organizations)

Return ONLY a JSON array of objects with this schema:
{
  "text": "The concise factual statement or preference",
  "category": "preference" | "fact" | "decision" | "event" | "resource" | "entity" | "other",
  "importance": 0.0 to 1.0,
  "confidence": 0.0 to 1.0,
  "tags": ["tag1", "tag2"]
}

Rules:
1. Be concise.
2. Only extract information that is worth remembering long-term.
3. If no valuable information is found, return an empty array [].
4. Return ONLY raw JSON.

CONVERSATION:
${conversation}`;

    const start = Date.now();
    try {
      const response = await completeTextWithModelRef({
        cfg: this.cfg,
        modelRef: this.modelRef,
        prompt,
        maxTokens: 1024,
      });

      const latency = Date.now() - start;
      const parsed = extractJsonFromText(response.text);
      const rawItems = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>).memories ||
            (parsed as Record<string, unknown>).items ||
            []
          : [];

      // Normalize categories to ensure they match MEMORY_CATEGORIES
      const items = (rawItems as unknown[]).map((item: any) => ({
        ...item,
        category: normalizeCategory(item.category || "other"),
      }));

      await logTrace(api, "extraction", {
        inputCount: messages.length,
        outputCount: items.length,
        latency,
        model: this.modelRef,
      });

      return items as {
        text: string;
        category: MemoryCategory;
        importance: number;
        confidence: number;
        tags: string[];
      }[];
    } catch (err) {
      api.logger.warn(`memory-lancedb: extraction failed: ${String(err)}`);
      return [];
    }
  }

  async summarizeUrl(url: string, api: ClawdbrainPluginApi): Promise<string | null> {
    try {
      // 1. Validate URL (scheme, hostname, private-IP checks)
      const validatedUrl = await validateUrlForFetch(url);

      // 2. Fetch content with timeout + size limits
      const fetchStart = Date.now();
      const text = await safeFetch(validatedUrl, api);
      if (!text) return null;

      // Truncate to avoid token limits (10k chars approx)
      const truncated = text.slice(0, 10_000);

      // 3. Summarize
      const aiStart = Date.now();
      const prompt = `Summarize the following web content in 3-5 concise bullet points for long-term storage.

URL: ${url}

CONTENT:
${truncated}`;

      const response = await completeTextWithModelRef({
        cfg: this.cfg,
        modelRef: this.modelRef,
        prompt,
      });

      const summary = response.text.trim();

      await logTrace(api, "summarization", {
        url,
        fetchLatency: aiStart - fetchStart,
        aiLatency: Date.now() - aiStart,
        model: this.modelRef,
      });

      return summary || null;
    } catch (err) {
      api.logger.warn(`memory-lancedb: summarization failed: ${String(err)}`);
      return null;
    }
  }
}
