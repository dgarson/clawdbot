import crypto from "node:crypto";
import type { OpenClawConfig } from "../config/config.js";
import type { MemoryCategory, MemoryPriority } from "../memory/progressive-types.js";
import type { WorkItemPayload, WorkItemPriority, WorkItemRef } from "../work-queue/types.js";
import type { EscalationOutcome, ReactionMessageContext, SignalReaction } from "./types.js";
import { AGENT_LANE_SUBAGENT } from "../agents/lanes.js";
import { buildSubagentSystemPrompt } from "../agents/subagent-announce.js";
import { readLatestAssistantReply } from "../agents/tools/agent-step.js";
import { resolveMainSessionKey, resolveAgentIdFromSessionKey } from "../config/sessions.js";
import { callGateway } from "../gateway/call.js";
import { GraphitiClient } from "../memory/graphiti/client.js";
import { runMemoryIngestionPipeline } from "../memory/pipeline/ingest.js";
import { getProgressiveStore } from "../memory/progressive-manager.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { getDefaultWorkQueueStore } from "../work-queue/index.js";

const PRIORITY_ORDER: Record<WorkItemPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const OUTCOME_SUMMARY_PREFIX = "OUTCOME_SUMMARY:";

type DispatchResult = {
  outcome: EscalationOutcome;
  summary?: string;
  sessionKey?: string;
  runId?: string;
  outcomeText?: string;
};

function buildMessagePreview(text: string, limit = 120) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit - 1)}…`;
}

function buildWorkRefs(context: ReactionMessageContext): WorkItemRef[] {
  const id = `${context.channelId}:${context.messageTs}`;
  const ref: WorkItemRef = {
    kind: "conversation",
    id,
    label: context.channelName ? `${context.channelName} ${context.messageTs}` : undefined,
    uri: context.permalink,
  };
  return [ref];
}

async function ensurePrioritizedWorkItem(params: {
  context: ReactionMessageContext;
  cfg: OpenClawConfig;
  priority: WorkItemPriority;
  intentLabel: string;
}): Promise<{ itemId: string; summary: string }> {
  const store = await getDefaultWorkQueueStore();
  const refs = buildWorkRefs(params.context);
  const existing = await store.listItemsByRef({ kind: "conversation", id: refs[0]?.id ?? "" });
  if (existing.length > 0) {
    const target = existing[0];
    const current = target.priority ?? "medium";
    if (PRIORITY_ORDER[params.priority] > PRIORITY_ORDER[current]) {
      await store.updateItem(target.id, { priority: params.priority });
    }
    return { itemId: target.id, summary: `${params.intentLabel} in work queue.` };
  }
  const preview = buildMessagePreview(params.context.text || "Reaction escalation request");
  const payload: WorkItemPayload = {
    refs,
    instructions: params.context.permalink
      ? `Follow up on this reaction request: ${params.context.permalink}`
      : undefined,
  };
  const item = await store.createItem({
    queueId: normalizeAgentId(resolveAgentIdFromSessionKey(resolveMainSessionKey(params.cfg))),
    title: `${params.intentLabel}: ${preview || "Reaction escalation"}`,
    description: params.context.text?.trim() || undefined,
    priority: params.priority,
    payload,
    tags: ["reaction-escalation", params.context.channelId],
    createdBy: { sessionKey: "reaction-escalation" },
  });
  return { itemId: item.id, summary: `${params.intentLabel} in work queue.` };
}

function buildIngestPayload(context: ReactionMessageContext) {
  return {
    source: "reaction-escalation",
    items: [
      {
        kind: "reaction",
        text: context.text,
        metadata: {
          channelId: context.channelId,
          channelName: context.channelName,
          messageTs: context.messageTs,
          threadTs: context.threadTs,
          permalink: context.permalink,
          authorId: context.authorId,
          authorName: context.authorName,
        },
      },
    ],
  };
}

function buildPipelineDeps(cfg: OpenClawConfig) {
  const deps: Parameters<typeof runMemoryIngestionPipeline>[1] = {};
  const graphitiCfg = cfg.memory?.graphiti;
  if (graphitiCfg?.enabled) {
    deps.graphiti = new GraphitiClient({
      host: graphitiCfg.host,
      servicePort: graphitiCfg.servicePort,
      apiKey: graphitiCfg.apiKey,
      timeoutMs: graphitiCfg.timeoutMs,
    });
  }
  const entityCfg = cfg.memory?.entityExtraction;
  if (entityCfg) {
    deps.entityExtractor = {
      enabled: entityCfg.enabled,
      minTextLength: entityCfg.minTextLength,
      maxEntitiesPerEpisode: entityCfg.maxEntitiesPerEpisode,
    };
  }
  return deps;
}

async function storeProgressiveMemory(params: {
  cfg: OpenClawConfig;
  category: MemoryCategory;
  content: string;
  context?: string;
  priority?: MemoryPriority;
  tags?: string[];
}): Promise<string | undefined> {
  const { store, embedFn } = await getProgressiveStore({ cfg: params.cfg });
  store.archiveExpired();
  const stored = await store.store(
    {
      category: params.category,
      content: params.content,
      context: params.context,
      priority: params.priority,
      tags: params.tags,
      source: "manual",
    },
    embedFn,
  );
  return stored?.id;
}

function buildSubagentPrompt(params: {
  signal: SignalReaction;
  context: ReactionMessageContext;
}): string {
  const prompt = params.signal.agentPrompt?.trim() ?? "Analyze the following message.";
  const attachments = params.context.attachments ?? [];
  const attachmentLines = attachments.map((attachment) =>
    [attachment.type, attachment.text, attachment.url].filter(Boolean).join(": "),
  );
  const lines = [
    prompt,
    "",
    "Message context:",
    `- Channel: ${params.context.channelName ?? params.context.channelId}`,
    params.context.authorName || params.context.authorId
      ? `- Author: ${params.context.authorName ?? params.context.authorId}`
      : undefined,
    `- Message: ${params.context.text || "(no text)"}`,
    params.context.permalink ? `- Permalink: ${params.context.permalink}` : undefined,
    params.context.threadTs ? `- Thread TS: ${params.context.threadTs}` : undefined,
    attachmentLines.length > 0 ? `- Attachments: ${attachmentLines.join("; ")}` : undefined,
    "",
    `When finished, include a line starting with "${OUTCOME_SUMMARY_PREFIX}" followed by a single-sentence summary.`,
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n");
}

async function spawnEscalationSession(params: {
  cfg: OpenClawConfig;
  signal: SignalReaction;
  context: ReactionMessageContext;
  label: string;
}): Promise<{ sessionKey: string; runId: string }> {
  const mainSessionKey = resolveMainSessionKey(params.cfg);
  const agentId = resolveAgentIdFromSessionKey(mainSessionKey);
  const childSessionKey = `agent:${normalizeAgentId(agentId)}:subagent:${crypto.randomUUID()}`;
  const task = buildSubagentPrompt({ signal: params.signal, context: params.context });
  const systemPrompt = buildSubagentSystemPrompt({
    requesterSessionKey: mainSessionKey,
    childSessionKey,
    label: params.label,
    task,
    instructions: `Include "${OUTCOME_SUMMARY_PREFIX}" with a one-sentence summary in your final response.`,
  });
  const dispatchId = crypto.randomUUID();
  const response = await callGateway<{ runId?: string }>({
    method: "agent",
    params: {
      message: task,
      sessionKey: childSessionKey,
      idempotencyKey: dispatchId,
      deliver: false,
      lane: AGENT_LANE_SUBAGENT,
      extraSystemPrompt: systemPrompt,
      label: params.label,
    },
    timeoutMs: 10_000,
  });
  const runId = typeof response?.runId === "string" ? response.runId : dispatchId;
  return { sessionKey: childSessionKey, runId };
}

export function extractOutcomeSummary(text?: string): string | undefined {
  if (!text) {
    return undefined;
  }
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^OUTCOME_SUMMARY:\s*(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

export async function dispatchEscalation(params: {
  cfg: OpenClawConfig;
  signal: SignalReaction;
  context: ReactionMessageContext;
  channel: string;
  reactorUserId: string;
  reactorName?: string;
}): Promise<DispatchResult> {
  const now = Date.now();
  const escalationId = crypto.randomUUID();
  const label = `reaction-${params.signal.intent}-${params.context.messageTs}`;
  const baseOutcome: EscalationOutcome = {
    id: escalationId,
    intent: params.signal.intent,
    sourceChannel: params.channel,
    sourceChannelId: params.context.channelId,
    sourceMessageTs: params.context.messageTs,
    sourceThreadTs: params.context.threadTs,
    reactorUserId: params.reactorUserId,
    reactorName: params.reactorName,
    dispatchedAt: now,
    workRef: { kind: "inline", result: "" },
    status: "processing",
  };

  if (params.signal.intent === "prioritize") {
    const result = await ensurePrioritizedWorkItem({
      cfg: params.cfg,
      context: params.context,
      priority: params.signal.defaultPriority,
      intentLabel: "Prioritized",
    });
    return {
      outcome: {
        ...baseOutcome,
        workRef: { kind: "workItem", itemId: result.itemId },
        status: "completed",
        completedAt: Date.now(),
      },
      summary: result.summary,
    };
  }

  if (params.signal.intent === "ingest") {
    const ingest = await runMemoryIngestionPipeline(
      buildIngestPayload(params.context),
      buildPipelineDeps(params.cfg),
    );
    let entryId: string | undefined;
    if (params.cfg.memory?.progressive?.enabled) {
      entryId = await storeProgressiveMemory({
        cfg: params.cfg,
        category: "fact",
        content: params.context.text || "(no text)",
        context: params.context.permalink,
        priority: "medium",
        tags: ["reaction-ingest", params.context.channelId],
      });
    }
    return {
      outcome: {
        ...baseOutcome,
        workRef: { kind: "memory", entryId },
        status: ingest.ok ? "completed" : "failed",
        completedAt: Date.now(),
        error: ingest.ok ? undefined : "Memory ingestion failed",
      },
      summary: ingest.ok
        ? "Ingested message into memory."
        : "Failed to ingest message into memory.",
    };
  }

  if (params.signal.intent === "bookmark") {
    let entryId: string | undefined;
    if (params.cfg.memory?.progressive?.enabled) {
      entryId = await storeProgressiveMemory({
        cfg: params.cfg,
        category: "fact",
        content: params.context.text || "(no text)",
        context: params.context.permalink,
        priority: "low",
        tags: ["bookmark", "reaction-escalation", params.context.channelId],
      });
    }
    return {
      outcome: {
        ...baseOutcome,
        workRef: { kind: "memory", entryId },
        status: "completed",
        completedAt: Date.now(),
      },
      summary: "Saved bookmark for later retrieval.",
    };
  }

  if (params.signal.intent === "urgent") {
    await callGateway({
      method: "cron.wake",
      params: { mode: "now", text: "reaction escalation urgent" },
      timeoutMs: 10_000,
    });
  }

  if (params.signal.spawnsSession) {
    const { sessionKey, runId } = await spawnEscalationSession({
      cfg: params.cfg,
      signal: params.signal,
      context: params.context,
      label,
    });
    return {
      outcome: {
        ...baseOutcome,
        workRef: { kind: "session", sessionKey, runId },
        status: "processing",
      },
      sessionKey,
      runId,
    };
  }

  const summary = `Processed ${params.signal.intent} reaction.`;
  return {
    outcome: {
      ...baseOutcome,
      workRef: { kind: "inline", result: summary },
      status: "completed",
      completedAt: Date.now(),
    },
    summary,
  };
}

export async function fetchOutcomeSummaryFromSession(params: {
  sessionKey: string;
  fallback?: string;
}): Promise<string> {
  const latest = await readLatestAssistantReply({ sessionKey: params.sessionKey, limit: 80 });
  const extracted = extractOutcomeSummary(latest);
  if (extracted) {
    return extracted;
  }
  if (latest?.trim()) {
    return latest.trim();
  }
  return params.fallback ?? "Work complete.";
}
