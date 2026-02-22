import { type Api, complete, type Context, type Model } from "@mariozechner/pi-ai";
import type { AgentEventPayload } from "../infra/agent-events.js";
import { resolveOpenClawAgentDir } from "../agents/agent-paths.js";
import { getApiKeyForModel, requireApiKey } from "../agents/model-auth.js";
import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import { ensureOpenClawModelsJson } from "../agents/models-config.js";
import { discoverAuthStorage, discoverModels } from "../agents/pi-model-discovery.js";
import { loadConfig } from "../config/config.js";
import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
import { updateSessionStoreEntry } from "../config/sessions/store.js";
import { onAgentEvent } from "../infra/agent-events.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveAgentIdFromSessionKey } from "../routing/session-key.js";
import {
  isCronRunSessionKey,
  isCronSessionKey,
  isSubagentSessionKey,
} from "./session-key-utils.js";

const log = createSubsystemLogger("session-auto-label");

const LABEL_MAX_TOKENS = 50;
const PROMPT_TRUNCATE_CHARS = 500;
const DEFAULT_MAX_LENGTH = 79;

const DEFAULT_LABEL_PROMPT =
  "Generate a concise title for the conversation below. Reply with ONLY the title text — no quotes, no trailing punctuation.";

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

async function generateLabel(params: {
  sessionKey: string;
  prompt: string;
  cfg: ReturnType<typeof loadConfig>;
}): Promise<void> {
  const { sessionKey, prompt, cfg } = params;
  const labelsCfg = cfg.agents?.defaults?.sessionLabels;
  const maxLength = labelsCfg?.maxLength ?? DEFAULT_MAX_LENGTH;

  // Load session entry to check if label already set
  const agentId = resolveAgentIdFromSessionKey(sessionKey);
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  const store = loadSessionStore(storePath);
  const entry = store[sessionKey];
  if (!entry) {
    return;
  }
  if (entry.label?.trim()) {
    return;
  }

  // Resolve model
  const agentDir = resolveOpenClawAgentDir();
  await ensureOpenClawModelsJson(cfg, agentDir);
  const authStorage = discoverAuthStorage(agentDir);
  const modelRegistry = discoverModels(authStorage, agentDir);

  let provider: string;
  let modelId: string;
  if (labelsCfg?.model?.trim()) {
    const parts = labelsCfg.model.trim().split("/");
    if (parts.length < 2) {
      log.warn(`sessionLabels.model "${labelsCfg.model}" must be "provider/model" format`);
      return;
    }
    provider = parts[0];
    modelId = parts.slice(1).join("/");
  } else {
    const resolved = resolveDefaultModelForAgent({ cfg, agentId });
    provider = resolved.provider;
    modelId = resolved.model;
  }

  const model = modelRegistry.find(provider, modelId) as Model<Api> | null;
  if (!model) {
    log.warn(`sessionLabels: model not found: ${provider}/${modelId}`);
    return;
  }

  const apiKeyInfo = await getApiKeyForModel({ model, cfg, agentDir });
  const apiKey = requireApiKey(apiKeyInfo, model.provider);
  authStorage.setRuntimeApiKey(model.provider, apiKey);

  // Build the single-turn completion request
  const truncatedPrompt =
    prompt.length > PROMPT_TRUNCATE_CHARS ? prompt.slice(0, PROMPT_TRUNCATE_CHARS) + "…" : prompt;
  const systemPrompt = labelsCfg?.prompt?.trim() || DEFAULT_LABEL_PROMPT;
  const context: Context = {
    messages: [
      {
        role: "user",
        content: `${systemPrompt}\n\nMax length: ${maxLength} characters.\n\nConversation:\n${truncatedPrompt}`,
        timestamp: Date.now(),
      },
    ],
  };

  const message = await complete(model, context, { apiKey, maxTokens: LABEL_MAX_TOKENS });

  // Extract text from response
  const raw = Array.isArray(message.content)
    ? message.content
        .filter((b) => b.type === "text")
        .map((b) => ("text" in b ? (b.text ?? "") : ""))
        .join("")
    : "";

  const label = raw.trim().slice(0, maxLength);
  if (!label) {
    log.warn(`sessionLabels: empty label returned for session ${sessionKey}`);
    return;
  }

  await updateSessionStoreEntry({
    storePath,
    sessionKey,
    update: async (existing) => {
      // Final idempotency check inside the lock
      if (existing.label?.trim()) {
        return null;
      }
      log.info(`sessionLabels: set label "${label}" for ${sessionKey}`);
      return { label };
    },
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

  generateLabel({ sessionKey: sessionKey!, prompt, cfg })
    .catch((err) => {
      log.warn(`sessionLabels: label generation failed for ${sessionKey}: ${String(err)}`);
    })
    .finally(() => {
      inFlight.delete(sessionKey!);
    });
}

/** Call once at gateway startup to activate session auto-labeling. */
export function registerSessionAutoLabel(): () => void {
  const cfg = loadConfig();
  if (cfg.agents?.defaults?.sessionLabels?.enabled !== true) {
    return () => {};
  }
  return onAgentEvent((evt) => {
    void handleInputEvent(evt);
  });
}
