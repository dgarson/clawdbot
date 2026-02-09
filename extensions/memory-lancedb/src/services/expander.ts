import type { ClawdbrainPluginApi } from "clawdbrain/plugin-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { completeTextWithModelRef } from "openclaw/plugin-sdk";
import type { Expander } from "../types.js";

async function logTrace(api: ClawdbrainPluginApi, type: string, data: unknown) {
  const logDir = join(homedir(), ".openclaw", "logs");
  const logPath = join(logDir, "memory-trace.jsonl");
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    ...(data as Record<string, unknown>),
  };
  try {
    await appendFile(logPath, JSON.stringify(entry) + "\n");
  } catch (err) {
    api.logger.warn(`memory-lancedb: trace logging failed: ${String(err)}`);
  }
}

export class SdkExpander implements Expander {
  constructor(
    private readonly cfg: OpenClawConfig,
    private readonly modelRef: string,
  ) {}

  async expand(
    history: { role: string; content: string }[],
    currentPrompt: string,
    api: ClawdbrainPluginApi,
  ): Promise<string> {
    if (history.length === 0) {
      return currentPrompt;
    }

    const context = history
      .slice(-5)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const prompt = `You are an expert query rewriting engine for a semantic search system.
Your goal is to rewrite the user's latest message into a standalone search query that resolves all pronouns and implicit references based on the conversation history.

Rules:
1. Resolve pronouns (it, he, she, they, that) to their specific entities from the history.
2. If the user's message is already specific and standalone, return it unchanged.
3. Do NOT answer the question. Only rewrite it.
4. Do NOT add external information or hallucinate details not present in the history.
5. Keep the query concise.

Return ONLY the rewritten query text. No quotes, no explanations.

HISTORY:
${context}

USER MESSAGE:
${currentPrompt}`;

    const start = Date.now();
    try {
      const response = await completeTextWithModelRef({
        cfg: this.cfg,
        modelRef: this.modelRef,
        prompt,
        maxTokens: 200,
      });

      const latency = Date.now() - start;
      const expanded = response.text.trim() || currentPrompt;

      await logTrace(api, "query_expansion", {
        original: currentPrompt,
        expanded,
        latency,
        model: this.modelRef,
      });

      return expanded;
    } catch (err) {
      api.logger.warn(`memory-lancedb: query expansion failed: ${String(err)}`);
      return currentPrompt;
    }
  }
}
