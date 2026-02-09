import type { ClawdbrainPluginApi } from "clawdbrain/plugin-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { completeTextWithModelRef } from "openclaw/plugin-sdk";
import type { Synthesizer, MemoryEntry } from "../types.js";

async function logLedger(api: ClawdbrainPluginApi, action: string, data: Record<string, unknown>) {
  const logDir = join(homedir(), ".openclaw", "logs");
  const logPath = join(logDir, "memory-ledger.jsonl");
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    ...data,
  };
  try {
    await appendFile(logPath, JSON.stringify(entry) + "\n");
  } catch (err) {
    api.logger.warn(`memory-lancedb: ledger logging failed: ${String(err)}`);
  }
}

/**
 * Extract JSON from an LLM response that may contain markdown fences or
 * surrounding prose.
 */
function extractJsonFromText(raw: string): Record<string, unknown> | null {
  // Try direct parse first
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // continue
  }

  // Try extracting from markdown code fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as Record<string, unknown>;
    } catch {
      // continue
    }
  }

  // Try finding a JSON object
  const objStart = raw.indexOf("{");
  const objEnd = raw.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(raw.slice(objStart, objEnd + 1)) as Record<string, unknown>;
    } catch {
      // continue
    }
  }

  return null;
}

export class SdkSynthesizer implements Synthesizer {
  constructor(
    private readonly cfg: OpenClawConfig,
    private readonly modelRef: string,
  ) {}

  async synthesize(
    memories: MemoryEntry[],
    api: ClawdbrainPluginApi,
  ): Promise<{
    merged: MemoryEntry[];
    archived: string[];
    summary: string;
  }> {
    if (memories.length === 0) {
      return { merged: [], archived: [], summary: "No memories to process." };
    }

    const memoryText = memories.map((m) => `[${m.id}] (${m.category}) ${m.text}`).join("\n");

    const prompt = `You are a memory maintenance engine.
Your goal is to review a list of memory entries and perform "Garbage Collection".

Rules:
1. Merge duplicate or highly similar entries into a single, comprehensive entry.
2. If two entries contradict, favor the one that seems more recent or specific (if discernible), or keep both if unsure.
3. Identify entries that are purely outdated "events" (e.g. "Meeting on Jan 12th") if today is much later, and mark them for archival.
4. Generate a brief "Morning Briefing" summary of the most important items.

Return JSON:
{
  "merged": [
    { "text": "...", "category": "...", "tags": ["..."], "sourceIds": ["id1", "id2"] }
  ],
  "archived": ["id3", "id4"],
  "summary": "Your briefing text..."
}

Return ONLY raw JSON.

MEMORIES:
${memoryText}`;

    const start = Date.now();
    try {
      const response = await completeTextWithModelRef({
        cfg: this.cfg,
        modelRef: this.modelRef,
        prompt,
        maxTokens: 2048,
      });

      const result = extractJsonFromText(response.text);
      if (!result) {
        api.logger.warn("memory-lancedb: synthesis returned unparseable response");
        return { merged: [], archived: [], summary: "Synthesis failed: unparseable response." };
      }

      const merged: MemoryEntry[] = ((result.merged as Record<string, unknown>[]) || []).map(
        (m) => ({
          id: "new-" + Math.random().toString(36).slice(2, 9), // Temp ID
          text: m.text as string,
          vector: [], // Will need re-embedding
          importance: 0.8, // Default high for merged items
          category: (m.category as MemoryEntry["category"]) || "other",
          createdAt: Date.now(),
          tags: (m.tags as string[]) || [],
          confidence: 1.0,
        }),
      );

      const archived: string[] = (result.archived as string[]) || [];
      const summary: string = (result.summary as string) || "Maintenance complete.";

      await logLedger(api, "synthesis", {
        inputCount: memories.length,
        mergedCount: merged.length,
        archivedCount: archived.length,
        latency: Date.now() - start,
        model: this.modelRef,
      });

      return { merged, archived, summary };
    } catch (err) {
      api.logger.warn(`memory-lancedb: synthesis failed: ${String(err)}`);
      return { merged: [], archived: [], summary: "Synthesis failed." };
    }
  }
}
