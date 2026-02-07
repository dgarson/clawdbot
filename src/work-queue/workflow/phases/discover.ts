import crypto from "node:crypto";
import type {
  DiscoveryResult,
  GatewayCallFn,
  JoinBarrierEntry,
  WorkflowLogger,
  WorkflowPlan,
} from "../types.js";
import { AGENT_LANE_SUBAGENT } from "../../../agents/lanes.js";
import { awaitJoinBarrier } from "../join-barrier.js";
import { parseSubagentReport } from "../report.js";

const DEFAULT_MAX_PARALLEL = 3;
const DEFAULT_TIMEOUT_SECONDS = 120;

function buildDiscoveryPrompt(question: string): string {
  return [
    "You are a DiscoveryAgent. Investigate the following question and report your findings.",
    "",
    `## Question`,
    question,
    "",
    "## Requirements",
    "1. Investigate thoroughly using available tools (file search, code analysis, etc.)",
    "2. End your reply with a structured JSON block in a fenced code block:",
    "",
    "```json",
    "{",
    '  "summary": "Brief summary of findings",',
    '  "findings": ["Finding 1", "Finding 2"],',
    '  "decisions": ["Decision or recommendation 1"],',
    '  "blockers": ["Any blockers found"],',
    '  "artifacts": ["Relevant file paths or references"]',
    "}",
    "```",
    "",
    "If you cannot produce structured JSON, provide a clear text summary instead.",
  ].join("\n");
}

function buildDiscoverySystemPrompt(question: string, sessionKey: string): string {
  return [
    "# Discovery Subagent Context",
    "",
    "You are a **discovery subagent** spawned to investigate a specific question.",
    "",
    "## Your Role",
    `- Investigate: ${question}`,
    "- Complete your investigation and report findings",
    "",
    "## Rules",
    "1. Stay focused on the assigned question",
    "2. Use available tools to gather information",
    "3. Report findings in your final message with structured JSON",
    "4. Be thorough but concise",
    "",
    "## Session Context",
    `- Your session: ${sessionKey}`,
    "",
  ].join("\n");
}

export async function runDiscoveryPhase(opts: {
  plan: WorkflowPlan;
  agentId: string;
  maxParallel?: number;
  timeoutSeconds?: number;
  model?: string;
  thinking?: string;
  callGateway: GatewayCallFn;
  log: WorkflowLogger;
}): Promise<DiscoveryResult[]> {
  const { plan, agentId, log } = opts;
  const maxParallel = opts.maxParallel ?? DEFAULT_MAX_PARALLEL;
  const timeoutSeconds = opts.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  const timeoutMs = timeoutSeconds * 1000;

  const questions = plan.discoveryQuestions;
  if (questions.length === 0) {
    log.info(`workflow[${agentId}]: no discovery questions — skipping discovery phase`);
    return [];
  }

  const results: DiscoveryResult[] = [];

  // Process questions in batches of maxParallel.
  for (let batchStart = 0; batchStart < questions.length; batchStart += maxParallel) {
    const batch = questions.slice(batchStart, batchStart + maxParallel);
    const entries: JoinBarrierEntry[] = [];
    // Track which question each entry corresponds to, since failed spawns
    // are pushed directly to results and don't get an entry.
    const entryQuestions: string[] = [];

    // Spawn discovery subagents.
    for (const question of batch) {
      const runId = crypto.randomUUID();
      const sessionKey = `agent:${agentId}:workflow:discover:${runId.slice(0, 8)}`;

      try {
        const response = await opts.callGateway<{ runId: string }>({
          method: "agent",
          params: {
            message: buildDiscoveryPrompt(question),
            sessionKey,
            idempotencyKey: runId,
            deliver: false,
            lane: AGENT_LANE_SUBAGENT,
            extraSystemPrompt: buildDiscoverySystemPrompt(question, sessionKey),
            thinking: opts.thinking,
            model: opts.model,
            timeout: timeoutSeconds,
            label: `Discovery: ${question.slice(0, 50)}`,
            spawnedBy: `workflow:${agentId}`,
          },
          timeoutMs: 10_000,
        });

        const actualRunId = response?.runId ?? runId;
        entries.push({
          runId: actualRunId,
          sessionKey,
          label: question.slice(0, 80),
        });
        entryQuestions.push(question);

        log.debug(`workflow[${agentId}]: spawned discovery agent for "${question.slice(0, 50)}"`);
      } catch (err) {
        log.error(`workflow[${agentId}]: failed to spawn discovery agent: ${String(err)}`);
        results.push({
          question,
          runId,
          sessionKey,
          status: "error",
          findings: `Failed to spawn: ${String(err)}`,
          keyInsights: [],
        });
      }
    }

    if (entries.length === 0) {
      continue;
    }

    // Wait for all subagents in this batch.
    log.info(`workflow[${agentId}]: waiting for ${entries.length} discovery agent(s)`);
    const barrierResults = await awaitJoinBarrier({
      entries,
      timeoutMs,
      callGateway: opts.callGateway,
      log,
    });

    // Process barrier results — use entryQuestions (aligned with entries) not batch.
    for (let i = 0; i < barrierResults.length; i++) {
      const barrierResult = barrierResults[i];
      const question = entryQuestions[i];

      const report = parseSubagentReport(barrierResult.reply, {
        question,
        label: barrierResult.entry.label,
      });

      results.push({
        question,
        runId: barrierResult.entry.runId,
        sessionKey: barrierResult.entry.sessionKey,
        status: barrierResult.status,
        findings: report.summary,
        keyInsights: report.findings.slice(0, 10),
      });
    }

    // Clean up discovery sessions (best-effort).
    for (const entry of entries) {
      opts
        .callGateway({
          method: "sessions.delete",
          params: { key: entry.sessionKey, deleteTranscript: true },
          timeoutMs: 10_000,
        })
        .catch((err: unknown) => {
          log.debug(`workflow[${agentId}]: discovery session cleanup failed: ${String(err)}`);
        });
    }
  }

  log.info(`workflow[${agentId}]: discovery phase completed with ${results.length} result(s)`);
  return results;
}
