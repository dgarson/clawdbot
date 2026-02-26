import { type Api, complete, type Context, type Model } from "@mariozechner/pi-ai";
import { resolveOpenClawAgentDir } from "../agents/agent-paths.js";
import { getApiKeyForModel, requireApiKey } from "../agents/model-auth.js";
import { ensureOpenClawModelsJson } from "../agents/models-config.js";
import { discoverAuthStorage, discoverModels } from "../agents/pi-model-discovery.js";
import { loadConfig } from "../config/config.js";
import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
import { updateSessionStoreEntry } from "../config/sessions/store.js";
import type { SessionClassification } from "../config/sessions/types.js";
import type { AgentEventPayload } from "../infra/agent-events.js";
import { emitAgentEvent, onAgentEvent } from "../infra/agent-events.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveAgentIdFromSessionKey } from "../routing/session-key.js";
import {
  isCronRunSessionKey,
  isCronSessionKey,
  isSubagentSessionKey,
} from "./session-key-utils.js";

const log = createSubsystemLogger("session-auto-label");

/** Increased from 50 to accommodate JSON classification output. */
const LABEL_MAX_TOKENS = 120;
const PROMPT_TRUNCATE_CHARS = 500;
const DEFAULT_MAX_LENGTH = 79;

const DEFAULT_CLASSIFICATION_PROMPT = `Analyze this conversation opener. Return a JSON object with:
- "label": concise title (max 79 chars, no quotes/trailing punctuation)
- "topic": one of coding|research|ops|conversation|creative|debugging|config|other
- "complexity": one of trivial|simple|moderate|hard|complex
- "domain": array of 0-3 short tags (e.g. ["frontend","react"] or ["devops","k8s"])
- "flags": array of 0-2 notable attributes (e.g. ["security-sensitive","multi-file"])

Reply with ONLY the JSON object, no markdown fences.`;

/** In-flight guard: prevents duplicate concurrent label calls for the same session. */
const inFlight = new Set<string>();

function shouldSkip(sessionKey: string | undefined): boolean {
  if (!sessionKey) {
    return true;
  }
  if (isCronRunSessionKey(sessionKey)) {
    return true;
  }
  if (isCronSessionKey(sessionKey)) {
    return true;
  }
  if (isSubagentSessionKey(sessionKey)) {
    return true;
  }
  return false;
}

/** Parse the raw JSON string returned by the model. Returns null on parse failure. */
function parseClassificationResponse(
  raw: string,
  maxLength: number,
): { label: string; classification: SessionClassification } | null {
  const trimmed = raw.trim();
  // Strip markdown fences if the model included them despite instructions.
  const cleaned = trimmed
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    log.warn(`sessionLabels: failed to parse classification JSON: ${cleaned.slice(0, 200)}`);
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  const rawLabel = typeof obj["label"] === "string" ? obj["label"].trim() : "";
  const label = rawLabel.slice(0, maxLength);
  if (!label) {
    log.warn("sessionLabels: empty label in classification response");
    return null;
  }

  const VALID_TOPICS = new Set([
    "coding",
    "research",
    "ops",
    "conversation",
    "creative",
    "debugging",
    "config",
    "other",
  ]);
  const VALID_COMPLEXITIES = new Set(["trivial", "simple", "moderate", "hard", "complex"]);

  const topic =
    typeof obj["topic"] === "string" && VALID_TOPICS.has(obj["topic"])
      ? (obj["topic"] as SessionClassification["topic"])
      : "other";

  const complexity =
    typeof obj["complexity"] === "string" && VALID_COMPLEXITIES.has(obj["complexity"])
      ? (obj["complexity"] as SessionClassification["complexity"])
      : "moderate";

  const domain = Array.isArray(obj["domain"])
    ? obj["domain"]
        .filter((d): d is string => typeof d === "string")
        .map((d) => d.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const flags = Array.isArray(obj["flags"])
    ? obj["flags"]
        .filter((f): f is string => typeof f === "string")
        .map((f) => f.trim())
        .filter(Boolean)
        .slice(0, 2)
    : [];

  const classification: SessionClassification = {
    topic,
    complexity,
    domain,
    flags,
    classifiedAt: Date.now(),
  };

  return { label, classification };
}

async function generateClassification(params: {
  sessionKey: string;
  runId: string;
  prompt: string;
  cfg: ReturnType<typeof loadConfig>;
}): Promise<void> {
  const { sessionKey, runId, prompt, cfg } = params;
  const labelsCfg = cfg.agents?.defaults?.sessionLabels;
  const maxLength = labelsCfg?.maxLength ?? DEFAULT_MAX_LENGTH;

  // Load session entry to check if classification already done.
  const agentId = resolveAgentIdFromSessionKey(sessionKey);
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  const store = loadSessionStore(storePath);
  const entry = store[sessionKey];
  if (!entry) {
    return;
  }
  // Idempotency: skip if label already set from a prior run.
  if (entry.label?.trim()) {
    return;
  }

  // Require a dedicated model — do NOT fall back to the agent's default.
  // Classification is a cheap task; using the agent model would be wasteful.
  if (!labelsCfg?.model?.trim()) {
    log.warn(
      "sessionLabels: skipping classification — agents.defaults.sessionLabels.model is not configured. " +
        'Set a lightweight model (e.g. "openai/gpt-4o-mini") to enable session classification.',
    );
    return;
  }

  const parts = labelsCfg.model.trim().split("/");
  if (parts.length < 2) {
    log.warn(`sessionLabels: model "${labelsCfg.model}" must be in "provider/model" format`);
    return;
  }
  const provider = parts[0];
  const modelId = parts.slice(1).join("/");

  // Resolve model from registry.
  const agentDir = resolveOpenClawAgentDir();
  await ensureOpenClawModelsJson(cfg, agentDir);
  const authStorage = discoverAuthStorage(agentDir);
  const modelRegistry = discoverModels(authStorage, agentDir);

  const model = modelRegistry.find(provider, modelId) as Model<Api> | null;
  if (!model) {
    log.warn(`sessionLabels: model not found: ${provider}/${modelId}`);
    return;
  }

  const apiKeyInfo = await getApiKeyForModel({ model, cfg, agentDir });
  const apiKey = requireApiKey(apiKeyInfo, model.provider);
  authStorage.setRuntimeApiKey(model.provider, apiKey);

  // Build the single-turn classification request.
  const truncatedPrompt =
    prompt.length > PROMPT_TRUNCATE_CHARS ? prompt.slice(0, PROMPT_TRUNCATE_CHARS) + "…" : prompt;

  const systemPrompt = labelsCfg?.prompt?.trim() || DEFAULT_CLASSIFICATION_PROMPT;
  const context: Context = {
    messages: [
      {
        role: "user",
        content: `${systemPrompt}\n\nConversation:\n${truncatedPrompt}`,
        timestamp: Date.now(),
      },
    ],
  };

  const message = await complete(model, context, { apiKey, maxTokens: LABEL_MAX_TOKENS });

  // Extract raw text from response.
  const raw = Array.isArray(message.content)
    ? message.content
        .filter((b) => b.type === "text")
        .map((b) => ("text" in b ? (b.text ?? "") : ""))
        .join("")
    : "";

  const parsed = parseClassificationResponse(raw, maxLength);
  if (!parsed) {
    return;
  }
  const { label, classification } = parsed;

  await updateSessionStoreEntry({
    storePath,
    sessionKey,
    update: async (existing) => {
      // Final idempotency check inside the lock.
      if (existing.label?.trim()) {
        return null;
      }
      log.info(
        `sessionLabels: classified "${label}" [${classification.topic}/${classification.complexity}] for ${sessionKey}`,
      );
      return { label, classification };
    },
  });

  // Emit a classification event so consumers (prompt contributors, plugins, UIs) can react.
  emitAgentEvent({
    runId,
    stream: "classification",
    data: {
      label,
      classification,
    },
    sessionKey,
  });
}

async function handleInputEvent(evt: AgentEventPayload): Promise<void> {
  if (evt.stream !== "input") {
    return;
  }

  const sessionKey = evt.sessionKey;
  const prompt = typeof evt.data?.prompt === "string" ? evt.data.prompt.trim() : "";
  if (!prompt || shouldSkip(sessionKey)) {
    return;
  }

  const cfg = loadConfig();
  if (cfg.agents?.defaults?.sessionLabels?.enabled !== true) {
    return;
  }

  if (inFlight.has(sessionKey!)) {
    return;
  }
  inFlight.add(sessionKey!);

  generateClassification({ sessionKey: sessionKey!, runId: evt.runId, prompt, cfg })
    .catch((err) => {
      log.warn(`sessionLabels: classification failed for ${sessionKey}: ${String(err)}`);
    })
    .finally(() => {
      inFlight.delete(sessionKey!);
    });
}

/** Call once at gateway startup to activate session auto-labeling and classification. */
export function registerSessionAutoLabel(): () => void {
  const cfg = loadConfig();
  if (cfg.agents?.defaults?.sessionLabels?.enabled !== true) {
    return () => {};
  }
  return onAgentEvent((evt) => {
    void handleInputEvent(evt);
  });
}
