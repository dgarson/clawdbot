/**
 * Ephemeral memory reflector — fires after agent_end.
 *
 * Makes a single Anthropic API call (not a full agent session) to collect
 * structured memory feedback, then writes to:
 *   1. {stateDir}/memory-feedback/{agentId}-{runId}.jsonl  (persistent queue)
 *   2. Session JSONL via SessionManager (shows in UI after run.end)
 */

import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import type { MemoryFeedbackConfig } from "../types.js";

export type ReflectorInput = {
  assistantTexts: string[];
  toolMetas: Array<{ toolName: string; meta?: string }>;
  messages: unknown[];
  sessionFile?: string;
  systemPromptText?: string;
};

export type ReflectorContext = {
  agentId: string;
  sessionKey: string;
  runId: string;
  stateDir: string;
};

export type MemoryFeedbackResult = {
  would_have_helped: Array<{ query: string; why: string; confidence: number }>;
  should_store: Array<{ name: string; body: string; group: string; confidence: number }>;
};

const MEMORY_FEEDBACK_TOOL = {
  name: "memory_feedback",
  description: "Report what persistent memory would have been useful in this session",
  input_schema: {
    type: "object" as const,
    properties: {
      would_have_helped: {
        type: "array",
        items: {
          type: "object",
          properties: {
            query: { type: "string" },
            why: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["query", "why", "confidence"],
        },
        description: "Information you would have wanted to retrieve from memory at the start",
      },
      should_store: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            body: { type: "string" },
            group: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["name", "body", "group", "confidence"],
        },
        description: "New facts that should be stored for future sessions",
      },
    },
    required: ["would_have_helped", "should_store"],
  },
};

function buildContextSummary(input: ReflectorInput, maxMessages: number): string {
  const parts: string[] = [];

  if (input.systemPromptText) {
    parts.push(`## Agent role/task\n${input.systemPromptText.slice(0, 500)}`);
  }

  if (input.assistantTexts.length > 0) {
    parts.push(`## What the agent did\n${input.assistantTexts.join("\n---\n")}`);
  }

  if (input.toolMetas.length > 0) {
    const toolSummary = input.toolMetas
      .map((t) => `- ${t.toolName}${t.meta ? `: ${t.meta}` : ""}`)
      .join("\n");
    parts.push(`## Tools called\n${toolSummary}`);
  }

  const recentMessages = (input.messages as Array<{ role?: string; content?: unknown }>)
    .slice(-maxMessages)
    .filter((m) => m.role === "user" || m.role === "assistant");

  if (recentMessages.length > 0) {
    const msgSummary = recentMessages
      .map((m) => {
        const content = typeof m.content === "string" ? m.content.slice(0, 300) : "[structured]";
        return `[${m.role}] ${content}`;
      })
      .join("\n");
    parts.push(`## Recent conversation\n${msgSummary}`);
  }

  return parts.join("\n\n");
}

/** Minimal Anthropic client interface used by the reflector (injectable for tests). */
export type AnthropicClientLike = {
  messages: {
    create: (params: Parameters<Anthropic["messages"]["create"]>[0]) => Promise<Anthropic.Message>;
  };
};

/**
 * Run the ephemeral memory reflector for a completed agent session.
 * Fire-and-forget: callers should not await or act on errors.
 *
 * @param _client - Optional Anthropic client override (for testing). Defaults to `new Anthropic()`.
 */
export async function runMemoryReflector(
  config: MemoryFeedbackConfig,
  ctx: ReflectorContext,
  input: ReflectorInput,
  _client?: AnthropicClientLike,
): Promise<MemoryFeedbackResult | undefined> {
  if (!config.enabled) return undefined;

  // Skip if no meaningful content to reflect on
  if (input.assistantTexts.length === 0 && input.toolMetas.length === 0) {
    return undefined;
  }

  const contextSummary = buildContextSummary(input, config.maxContextMessages);

  const client = _client ?? new Anthropic();
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    system:
      "You are reviewing a completed agent session. " +
      "Your only job is to call memory_feedback exactly once with: " +
      "(1) what information from persistent memory would have helped this agent, " +
      "and (2) what new facts from this session should be stored for future sessions. " +
      "Be specific and concise. Only include high-confidence entries.",
    tools: [MEMORY_FEEDBACK_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: contextSummary }],
  });

  // Extract the memory_feedback tool call result
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "memory_feedback",
  );
  if (!toolUse) return undefined;

  const result = toolUse.input as MemoryFeedbackResult;

  // Write to persistent feedback queue
  const feedbackDir = path.join(ctx.stateDir, "memory-feedback");
  await fs.mkdir(feedbackDir, { recursive: true });
  const queueEntry = JSON.stringify({
    agentId: ctx.agentId,
    sessionKey: ctx.sessionKey,
    runId: ctx.runId,
    timestamp: Date.now(),
    feedback: result,
  });
  await fs.appendFile(
    path.join(feedbackDir, `${ctx.agentId}-${ctx.runId}.jsonl`),
    queueEntry + "\n",
  );

  // Write to session transcript (shows in UI after run.end)
  if (input.sessionFile) {
    try {
      const sessionManager = SessionManager.open(input.sessionFile);
      sessionManager.appendCustomEntry("openclaw:memory-reflection", result);
    } catch {
      // Non-fatal — session file may be gone by now
    }
  }

  return result;
}
