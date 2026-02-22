#!/usr/bin/env bun
/**
 * generate-scorecard.ts
 *
 * Weekly Reliability Scorecard Generator
 * Computes SLO metrics from OpenClaw session JSONL files and renders
 * a filled-in Markdown scorecard based on the template in
 * docs/ops/weekly-reliability-scorecard-template.md
 *
 * Usage:
 *   bun scripts/generate-scorecard.ts [options]
 *
 * Options:
 *   --week <YYYY-MM-DD>   Start date of the week to score (default: last Monday)
 *   --agents-dir <path>   Path to agent sessions dir (default: ~/.openclaw/agents)
 *   --out <path>          Output file path (default: stdout)
 *   --format <md|json>    Output format (default: md)
 *   --dry-run             Print metrics without writing output file
 *   --verbose             Print debug info to stderr
 *
 * Owner: Julia (CAO)
 * Established: 2026-02-22
 * See: docs/ops/slo-baselines.md
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import { parseArgs } from "util";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionEvent {
  type: string;
  timestamp: string; // ISO8601
  toolName?: string;
  toolStatus?: "success" | "error" | "pending";
  durationMs?: number;
  modelLatencyMs?: number;
  agentId?: string;
  sessionId?: string;
  error?: string;
  hitlApprovalRequestedAt?: string;
  hitlApprovalGrantedAt?: string;
}

interface AgentSession {
  agentId: string;
  sessionId: string;
  events: SessionEvent[];
  startTime: Date;
  endTime: Date | null;
  isComplete: boolean;
  isStalled: boolean;
  stallDurationMs: number;
  terminalEvent: SessionEvent | null;
}

interface ToolCallRecord {
  category: ToolCategory;
  toolName: string;
  success: boolean;
  durationMs: number;
  agentId: string;
  timestamp: Date;
}

interface HitlRecord {
  requestedAt: Date;
  grantedAt: Date | null;
  approvalLatencyMs: number | null;
  rejected: boolean;
  autoApproved: boolean;
}

type ToolCategory = "exec" | "fs" | "browser" | "message" | "other";

interface WeekMetrics {
  weekStart: Date;
  weekEnd: Date;

  // Raw data
  sessions: AgentSession[];
  toolCalls: ToolCallRecord[];
  hitlRecords: HitlRecord[];

  // Computed SLOs
  tcr: number; // Task Completion Rate %
  tcrByAgent: Map<string, { started: number; completed: number; failed: number; timedOut: number }>;
  tcsr: number; // Tool Call Success Rate %
  tcsrByCategory: Map<ToolCategory, { calls: number; success: number; fail: number }>;
  asr: number; // Agent Stall Rate %
  asrByAgent: Map<string, { sessions: number; stalls: number; avgStallDurationMs: number }>;
  mttft: { p50: number; p95: number; p99: number } | null;
  mttftByTier: {
    interactive: { p50: number; p95: number; p99: number } | null;
    standard: { p50: number; p95: number; p99: number } | null;
    background: { p50: number; p95: number; p99: number } | null;
  };
  eal: {
    p50: number;
    p95: number;
    p99: number;
    max: number;
    total: number;
    rejected: number;
    autoApproved: number;
  } | null;

  // WRS
  wrs: number;
  wrsGrade: "A" | "B" | "C" | "D" | "F";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STALL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

const AGENT_TIERS: Record<string, "interactive" | "standard" | "background"> = {
  voice: "interactive",
  hitl: "interactive",
  "main:cron": "background",
  discovery: "background",
};

function getAgentTier(agentId: string): "interactive" | "standard" | "background" {
  for (const [pattern, tier] of Object.entries(AGENT_TIERS)) {
    if (agentId.includes(pattern)) {
      return tier;
    }
  }
  return "standard";
}

const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  exec: "exec",
  process: "exec",
  read: "fs",
  write: "fs",
  edit: "fs",
  browser: "browser",
  message: "message",
  tts: "message",
  nodes: "message",
};

function categorize(toolName: string): ToolCategory {
  const lower = toolName.toLowerCase().replace(/^mcp__[^_]+__/, "");
  for (const [prefix, cat] of Object.entries(TOOL_CATEGORIES)) {
    if (lower.startsWith(prefix)) {
      return cat;
    }
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function computePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
  const sorted = [...values].toSorted((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

// ---------------------------------------------------------------------------
// Session JSONL parser
// ---------------------------------------------------------------------------

function parseSessionFile(filePath: string): SessionEvent[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const events: SessionEvent[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        events.push(JSON.parse(trimmed) as SessionEvent);
      } catch {
        // skip malformed lines
      }
    }
    return events;
  } catch {
    return [];
  }
}

function isTerminalEvent(event: SessionEvent): boolean {
  return ["complete", "error", "timeout", "cancelled", "done"].includes(event.type);
}

function isSuccessTerminal(event: SessionEvent): boolean {
  return ["complete", "done"].includes(event.type);
}

function detectStall(events: SessionEvent[]): { stalled: boolean; stallDurationMs: number } {
  if (events.length < 2) {
    return { stalled: false, stallDurationMs: 0 };
  }

  // Find the last non-terminal event before any terminal
  let maxGapMs = 0;
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1].timestamp).getTime();
    const curr = new Date(events[i].timestamp).getTime();
    const gap = curr - prev;
    if (gap > maxGapMs) {
      maxGapMs = gap;
    }
  }

  // Check gap after last event (open sessions)
  const lastEvent = events[events.length - 1];
  const isTerminal = isTerminalEvent(lastEvent);
  if (!isTerminal) {
    const sinceLastMs = Date.now() - new Date(lastEvent.timestamp).getTime();
    if (sinceLastMs > maxGapMs) {
      maxGapMs = sinceLastMs;
    }
  }

  return {
    stalled: maxGapMs >= STALL_THRESHOLD_MS,
    stallDurationMs: maxGapMs,
  };
}

// ---------------------------------------------------------------------------
// Session loader
// ---------------------------------------------------------------------------

function loadSessions(agentsDir: string, weekStart: Date, weekEnd: Date): AgentSession[] {
  const sessions: AgentSession[] = [];

  if (!existsSync(agentsDir)) {
    return sessions;
  }

  const agentDirs = readdirSync(agentsDir).filter((d) => {
    try {
      return statSync(join(agentsDir, d)).isDirectory();
    } catch {
      return false;
    }
  });

  for (const agentId of agentDirs) {
    const sessionsDir = join(agentsDir, agentId, "sessions");
    if (!existsSync(sessionsDir)) {
      continue;
    }

    const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));

    for (const file of files) {
      const filePath = join(sessionsDir, file);
      const events = parseSessionFile(filePath);
      if (events.length === 0) {
        continue;
      }

      // Filter to events within the week window
      const weekEvents = events.filter((e) => {
        const ts = new Date(e.timestamp);
        return ts >= weekStart && ts < weekEnd;
      });

      if (weekEvents.length === 0) {
        continue;
      }

      const startTime = new Date(weekEvents[0].timestamp);
      const terminalEvent = weekEvents.find(isTerminalEvent) ?? null;
      const endTime = terminalEvent ? new Date(terminalEvent.timestamp) : null;
      const { stalled, stallDurationMs } = detectStall(weekEvents);

      const sessionId = file.replace(".jsonl", "");

      sessions.push({
        agentId,
        sessionId,
        events: weekEvents,
        startTime,
        endTime,
        isComplete: terminalEvent !== null && isSuccessTerminal(terminalEvent),
        isStalled: stalled,
        stallDurationMs,
        terminalEvent,
      });
    }
  }

  return sessions;
}

// ---------------------------------------------------------------------------
// Tool call extractor
// ---------------------------------------------------------------------------

function extractToolCalls(sessions: AgentSession[]): ToolCallRecord[] {
  const records: ToolCallRecord[] = [];

  for (const session of sessions) {
    for (const event of session.events) {
      if (event.type !== "tool_call" && event.type !== "tool_result") {
        continue;
      }
      if (!event.toolName) {
        continue;
      }

      records.push({
        category: categorize(event.toolName),
        toolName: event.toolName,
        success: event.toolStatus === "success",
        durationMs: event.durationMs ?? 0,
        agentId: session.agentId,
        timestamp: new Date(event.timestamp),
      });
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// HITL record extractor
// ---------------------------------------------------------------------------

function extractHitlRecords(sessions: AgentSession[]): HitlRecord[] {
  const records: HitlRecord[] = [];

  for (const session of sessions) {
    for (const event of session.events) {
      if (event.type !== "hitl_approval_requested" && event.type !== "exec_approval_requested") {
        continue;
      }

      const requestedAt = new Date(event.timestamp);
      const granted = event.hitlApprovalGrantedAt ? new Date(event.hitlApprovalGrantedAt) : null;
      const latencyMs = granted ? granted.getTime() - requestedAt.getTime() : null;

      records.push({
        requestedAt,
        grantedAt: granted,
        approvalLatencyMs: latencyMs,
        rejected: event.toolStatus === "error" && !granted,
        autoApproved: !!event.toolName?.includes("auto"),
      });
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// Metric computation
// ---------------------------------------------------------------------------

function computeMetrics(
  sessions: AgentSession[],
  toolCalls: ToolCallRecord[],
  hitlRecords: HitlRecord[],
  weekStart: Date,
  weekEnd: Date,
): WeekMetrics {
  // --- Task Completion Rate ---
  const tcrByAgent = new Map<
    string,
    { started: number; completed: number; failed: number; timedOut: number }
  >();

  for (const s of sessions) {
    if (!tcrByAgent.has(s.agentId)) {
      tcrByAgent.set(s.agentId, { started: 0, completed: 0, failed: 0, timedOut: 0 });
    }
    const row = tcrByAgent.get(s.agentId)!;
    row.started++;
    if (s.isComplete) {
      row.completed++;
    } else if (s.terminalEvent?.type === "timeout") {
      row.timedOut++;
    } else if (s.terminalEvent?.type === "error") {
      row.failed++;
    }
  }

  const totalStarted = sessions.length;
  const totalCompleted = sessions.filter((s) => s.isComplete).length;
  const tcr = totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 100;

  // --- Tool Call Success Rate ---
  const tcsrByCategory = new Map<ToolCategory, { calls: number; success: number; fail: number }>();
  for (const cat of ["exec", "fs", "browser", "message", "other"] as ToolCategory[]) {
    tcsrByCategory.set(cat, { calls: 0, success: 0, fail: 0 });
  }

  for (const tc of toolCalls) {
    const row = tcsrByCategory.get(tc.category)!;
    row.calls++;
    if (tc.success) {
      row.success++;
    } else {
      row.fail++;
    }
  }

  const totalCalls = toolCalls.length;
  const totalSuccess = toolCalls.filter((tc) => tc.success).length;
  const tcsr = totalCalls > 0 ? (totalSuccess / totalCalls) * 100 : 100;

  // --- Agent Stall Rate ---
  const asrByAgent = new Map<
    string,
    { sessions: number; stalls: number; avgStallDurationMs: number }
  >();

  for (const s of sessions) {
    if (!asrByAgent.has(s.agentId)) {
      asrByAgent.set(s.agentId, { sessions: 0, stalls: 0, avgStallDurationMs: 0 });
    }
    const row = asrByAgent.get(s.agentId)!;
    row.sessions++;
    if (s.isStalled) {
      const prevAvg = row.avgStallDurationMs;
      row.stalls++;
      row.avgStallDurationMs = (prevAvg * (row.stalls - 1) + s.stallDurationMs) / row.stalls;
    }
  }

  const totalSessions = sessions.length;
  const totalStalls = sessions.filter((s) => s.isStalled).length;
  const asr = totalSessions > 0 ? (totalStalls / totalSessions) * 100 : 0;

  // --- MTTFT ---
  const latencies = sessions
    .flatMap((s) =>
      s.events
        .filter((e) => e.type === "first_token" && typeof e.modelLatencyMs === "number")
        .map((e) => e.modelLatencyMs as number),
    )
    .toSorted((a, b) => a - b);

  const mttft = latencies.length > 0 ? computePercentiles(latencies) : null;

  const latenciesByTier = {
    interactive: [] as number[],
    standard: [] as number[],
    background: [] as number[],
  };

  for (const s of sessions) {
    const tier = getAgentTier(s.agentId);
    for (const e of s.events) {
      if (e.type === "first_token" && typeof e.modelLatencyMs === "number") {
        latenciesByTier[tier].push(e.modelLatencyMs);
      }
    }
  }

  const mttftByTier = {
    interactive:
      latenciesByTier.interactive.length > 0
        ? computePercentiles(latenciesByTier.interactive)
        : null,
    standard:
      latenciesByTier.standard.length > 0 ? computePercentiles(latenciesByTier.standard) : null,
    background:
      latenciesByTier.background.length > 0 ? computePercentiles(latenciesByTier.background) : null,
  };

  // --- EAL ---
  const approvedRecords = hitlRecords.filter((r) => r.approvalLatencyMs !== null && !r.rejected);
  const ealLatenciesMin = approvedRecords
    .map((r) => (r.approvalLatencyMs ?? 0) / 60000)
    .toSorted((a, b) => a - b);

  const eal =
    ealLatenciesMin.length > 0
      ? {
          ...computePercentiles(ealLatenciesMin),
          max: ealLatenciesMin[ealLatenciesMin.length - 1],
          total: hitlRecords.length,
          rejected: hitlRecords.filter((r) => r.rejected).length,
          autoApproved: hitlRecords.filter((r) => r.autoApproved).length,
        }
      : null;

  // --- WRS ---
  const { wrs, wrsGrade } = computeWRS({ tcr, tcsr, asr, mttft, eal });

  return {
    weekStart,
    weekEnd,
    sessions,
    toolCalls,
    hitlRecords,
    tcr,
    tcrByAgent,
    tcsr,
    tcsrByCategory,
    asr,
    asrByAgent,
    mttft,
    mttftByTier,
    eal,
    wrs,
    wrsGrade,
  };
}

// ---------------------------------------------------------------------------
// WRS scorer
// ---------------------------------------------------------------------------

function computeWRS(params: {
  tcr: number;
  tcsr: number;
  asr: number;
  mttft: { p50: number; p95: number; p99: number } | null;
  eal: { p50: number; p95: number; p99: number; max: number } | null;
}): { wrs: number; wrsGrade: "A" | "B" | "C" | "D" | "F" } {
  // TCR score (target ≥ 90, alert < 85)
  const tcrScore = Math.min(100, Math.max(0, ((params.tcr - 70) / 30) * 100));

  // TCSR score (target ≥ 90, alert < 82)
  const tcsrScore = Math.min(100, Math.max(0, ((params.tcsr - 70) / 30) * 100));

  // ASR score (target ≤ 5%, alert > 10%) — inverted
  const asrScore = Math.min(100, Math.max(0, ((20 - params.asr) / 20) * 100));

  // MTTFT score (p95 ≤ 8000ms for standard) — if no data, neutral 75
  let mttftScore = 75;
  if (params.mttft) {
    const p95ms = params.mttft.p95;
    if (p95ms <= 8000) {
      mttftScore = 100;
    } else if (p95ms <= 15000) {
      mttftScore = 75;
    } else if (p95ms <= 30000) {
      mttftScore = 50;
    } else {
      mttftScore = 20;
    }
  }

  // EAL score (p95 ≤ 10 min) — if no data, neutral 75
  let ealScore = 75;
  if (params.eal) {
    const p95min = params.eal.p95;
    if (p95min <= 10) {
      ealScore = 100;
    } else if (p95min <= 20) {
      ealScore = 75;
    } else if (p95min <= 30) {
      ealScore = 50;
    } else {
      ealScore = 20;
    }
  }

  const wrs =
    tcrScore * 0.3 + tcsrScore * 0.25 + asrScore * 0.2 + mttftScore * 0.15 + ealScore * 0.1;

  const rounded = Math.round(wrs);

  let wrsGrade: "A" | "B" | "C" | "D" | "F";
  if (rounded >= 90) {
    wrsGrade = "A";
  } else if (rounded >= 75) {
    wrsGrade = "B";
  } else if (rounded >= 60) {
    wrsGrade = "C";
  } else if (rounded >= 40) {
    wrsGrade = "D";
  } else {
    wrsGrade = "F";
  }

  return { wrs: rounded, wrsGrade };
}

// ---------------------------------------------------------------------------
// Template renderer
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function fmtMs(ms: number): string {
  return ms > 0 ? String(Math.round(ms)) : "—";
}

function fmtMin(min: number): string {
  return min > 0 ? fmt(min, 1) : "—";
}

function statusEmoji(met: boolean): string {
  return met ? "✅" : "⚠️";
}

function wrsNarrative(grade: string, _wrs: number): string {
  if (grade === "A") {
    return "All SLOs met — system is healthy.";
  }
  if (grade === "B") {
    return "Minor degradation detected — monitor closely.";
  }
  if (grade === "C") {
    return "Visible reliability issues — investigation recommended.";
  }
  if (grade === "D") {
    return "Multiple SLOs breached — escalate to Xavier / Tim.";
  }
  return "Critical failure — incident response required immediately.";
}

function renderMarkdown(m: WeekMetrics, templatePath: string): string {
  const template = existsSync(templatePath)
    ? readFileSync(templatePath, "utf-8")
    : "{{TEMPLATE_NOT_FOUND}}";

  const weekStartStr = m.weekStart.toISOString().slice(0, 10);

  // TCR agent rows
  const tcrRows = Array.from(m.tcrByAgent.entries())
    .map(([agent, row]) => {
      const rate = row.started > 0 ? ((row.completed / row.started) * 100).toFixed(1) : "—";
      return `| ${agent} | ${row.started} | ${row.completed} | ${row.failed} | ${row.timedOut} | ${rate}% |`;
    })
    .join("\n");

  const totalStarted = m.sessions.length;
  const totalCompleted = m.sessions.filter((s) => s.isComplete).length;
  const totalFailed = m.sessions.filter(
    (s) => !s.isComplete && s.terminalEvent?.type === "error",
  ).length;
  const totalTimedOut = m.sessions.filter(
    (s) => !s.isComplete && s.terminalEvent?.type === "timeout",
  ).length;

  // TCSR by category
  const tcsrCats = (cat: ToolCategory) => {
    const row = m.tcsrByCategory.get(cat) ?? { calls: 0, success: 0, fail: 0 };
    return { calls: row.calls, success: row.success, fail: row.fail };
  };
  const exec = tcsrCats("exec");
  const fs = tcsrCats("fs");
  const browser = tcsrCats("browser");
  const msg = tcsrCats("message");
  const other = tcsrCats("other");
  const allCalls = m.toolCalls.length;
  const allSuccess = m.toolCalls.filter((tc) => tc.success).length;

  const tcsrFmt = (row: { calls: number; success: number; fail: number }) =>
    row.calls > 0 ? ((row.success / row.calls) * 100).toFixed(1) : "—";

  // ASR agent rows
  const asrRows = Array.from(m.asrByAgent.entries())
    .map(([agent, row]) => {
      const rate = row.sessions > 0 ? ((row.stalls / row.sessions) * 100).toFixed(1) : "0.0";
      const avgMin = row.stalls > 0 ? (row.avgStallDurationMs / 60000).toFixed(1) : "0.0";
      return `| ${agent} | ${row.sessions} | ${row.stalls} | ${rate}% | ${avgMin} |`;
    })
    .join("\n");

  // WRS breakdown
  const tcrRaw = Math.min(100, Math.max(0, ((m.tcr - 70) / 30) * 100));
  const tcsrRaw = Math.min(100, Math.max(0, ((m.tcsr - 70) / 30) * 100));
  const asrRaw = Math.min(100, Math.max(0, ((20 - m.asr) / 20) * 100));
  const mttftRaw = m.mttft ? (m.mttft.p95 <= 8000 ? 100 : m.mttft.p95 <= 15000 ? 75 : 50) : 75;
  const ealRaw = m.eal ? (m.eal.p95 <= 10 ? 100 : m.eal.p95 <= 20 ? 75 : 50) : 75;

  const replacements: Record<string, string> = {
    WEEK_START: weekStartStr,
    GENERATED_AT: new Date().toISOString(),
    WRS_SCORE: String(m.wrs),
    LAST_WRS: "—",
    WRS_DELTA: "—",
    WRS_STATUS: statusEmoji(m.wrs >= 75),
    WRS_GRADE: m.wrsGrade,
    WRS_NARRATIVE: wrsNarrative(m.wrsGrade, m.wrs),
    TCR: fmt(m.tcr),
    LAST_TCR: "—",
    TCR_DELTA: "—",
    TCR_STATUS: statusEmoji(m.tcr >= 90),
    TCSR: fmt(m.tcsr),
    LAST_TCSR: "—",
    TCSR_DELTA: "—",
    TCSR_STATUS: statusEmoji(m.tcsr >= 90),
    ASR: fmt(m.asr),
    LAST_ASR: "—",
    ASR_DELTA: "—",
    ASR_STATUS: statusEmoji(m.asr <= 5),
    MTTFT_P95: fmtMs(m.mttft?.p95 ?? 0),
    LAST_MTTFT_P95: "—",
    MTTFT_DELTA: "—",
    MTTFT_STATUS: statusEmoji(!m.mttft || m.mttft.p95 <= 8000),
    EAL_P95: fmtMin(m.eal?.p95 ?? 0),
    LAST_EAL_P95: "—",
    EAL_DELTA: "—",
    EAL_STATUS: statusEmoji(!m.eal || m.eal.p95 <= 10),

    // TCR detail
    TCR_AGENT_ROWS: tcrRows || "| (no agent data) | — | — | — | — | — |",
    TCR_TOTAL_STARTED: String(totalStarted),
    TCR_TOTAL_COMPLETED: String(totalCompleted),
    TCR_TOTAL_FAILURES: String(totalFailed),
    TCR_TOTAL_TIMEOUTS: String(totalTimedOut),
    TCR_NOTABLE_FAILURES: "_No data available during observation window._",

    // TCSR detail
    TCSR_EXEC_CALLS: String(exec.calls),
    TCSR_EXEC_SUCCESS: String(exec.success),
    TCSR_EXEC_FAIL: String(exec.fail),
    TCSR_EXEC: tcsrFmt(exec),
    TCSR_FS_CALLS: String(fs.calls),
    TCSR_FS_SUCCESS: String(fs.success),
    TCSR_FS_FAIL: String(fs.fail),
    TCSR_FS: tcsrFmt(fs),
    TCSR_BROWSER_CALLS: String(browser.calls),
    TCSR_BROWSER_SUCCESS: String(browser.success),
    TCSR_BROWSER_FAIL: String(browser.fail),
    TCSR_BROWSER: tcsrFmt(browser),
    TCSR_MSG_CALLS: String(msg.calls),
    TCSR_MSG_SUCCESS: String(msg.success),
    TCSR_MSG_FAIL: String(msg.fail),
    TCSR_MSG: tcsrFmt(msg),
    TCSR_OTHER_CALLS: String(other.calls),
    TCSR_OTHER_SUCCESS: String(other.success),
    TCSR_OTHER_FAIL: String(other.fail),
    TCSR_OTHER: tcsrFmt(other),
    TCSR_TOTAL_CALLS: String(allCalls),
    TCSR_TOTAL_SUCCESS: String(allSuccess),
    TCSR_TOTAL_FAIL: String(allCalls - allSuccess),
    TCSR_TOP_FAILURES: "_Insufficient data during observation window._",

    // ASR detail
    ASR_AGENT_ROWS: asrRows || "| (no agent data) | — | — | — | — |",
    ASR_TOTAL_SESSIONS: String(m.sessions.length),
    ASR_TOTAL_STALLS: String(m.sessions.filter((s) => s.isStalled).length),
    ASR_AVG_DURATION: m.sessions.some((s) => s.isStalled)
      ? fmt(
          m.sessions.filter((s) => s.isStalled).reduce((a, s) => a + s.stallDurationMs, 0) /
            m.sessions.filter((s) => s.isStalled).length /
            60000,
        )
      : "0.0",
    ASR_STALL_CAUSES: "_Stall cause attribution requires Phase 2 instrumentation._",

    // MTTFT
    MTTFT_INTERACTIVE_P50: fmtMs(m.mttftByTier.interactive?.p50 ?? 0),
    MTTFT_INTERACTIVE_P95: fmtMs(m.mttftByTier.interactive?.p95 ?? 0),
    MTTFT_INTERACTIVE_P99: fmtMs(m.mttftByTier.interactive?.p99 ?? 0),
    MTTFT_INTERACTIVE_STATUS: statusEmoji(
      !m.mttftByTier.interactive || m.mttftByTier.interactive.p95 <= 2000,
    ),
    MTTFT_STANDARD_P50: fmtMs(m.mttftByTier.standard?.p50 ?? 0),
    MTTFT_STANDARD_P95: fmtMs(m.mttftByTier.standard?.p95 ?? 0),
    MTTFT_STANDARD_P99: fmtMs(m.mttftByTier.standard?.p99 ?? 0),
    MTTFT_STANDARD_STATUS: statusEmoji(
      !m.mttftByTier.standard || m.mttftByTier.standard.p95 <= 8000,
    ),
    MTTFT_BG_P50: fmtMs(m.mttftByTier.background?.p50 ?? 0),
    MTTFT_BG_P95: fmtMs(m.mttftByTier.background?.p95 ?? 0),
    MTTFT_BG_P99: fmtMs(m.mttftByTier.background?.p99 ?? 0),
    MTTFT_BG_STATUS: statusEmoji(
      !m.mttftByTier.background || m.mttftByTier.background.p95 <= 30000,
    ),

    // EAL
    EAL_P50: fmtMin(m.eal?.p50 ?? 0),
    EAL_P99: fmtMin(m.eal?.p99 ?? 0),
    EAL_MAX: fmtMin(m.eal?.max ?? 0),
    EAL_TOTAL: String(m.eal?.total ?? 0),
    EAL_REJECTED: String(m.eal?.rejected ?? 0),
    EAL_AUTO: String(m.eal?.autoApproved ?? 0),
    EAL_NOTE: m.eal
      ? "HITL data collected from bs-tim-2 gateway."
      : "No HITL records found — HITL may not be active or events not instrumented yet.",

    // WRS breakdown
    TCR_RAW: fmt(tcrRaw),
    TCR_WEIGHTED: fmt(tcrRaw * 0.3),
    TCSR_RAW: fmt(tcsrRaw),
    TCSR_WEIGHTED: fmt(tcsrRaw * 0.25),
    ASR_RAW: fmt(asrRaw),
    ASR_WEIGHTED: fmt(asrRaw * 0.2),
    MTTFT_RAW: fmt(mttftRaw),
    MTTFT_WEIGHTED: fmt(mttftRaw * 0.15),
    EAL_RAW: fmt(ealRaw),
    EAL_WEIGHTED: fmt(ealRaw * 0.1),

    // Incidents
    INCIDENTS_THIS_WEEK: "",

    // Actions
    ACTION_ITEMS: "| 1 | Review initial observation window data | Julia | 2026-03-08 | P0 |",

    // Trend (no historical data yet)
    WEEK_MINUS_3: "—",
    WRS_W3: "—",
    GRADE_W3: "—",
    TCR_W3: "—",
    TCSR_W3: "—",
    ASR_W3: "—",
    WEEK_MINUS_2: "—",
    WRS_W2: "—",
    GRADE_W2: "—",
    TCR_W2: "—",
    TCSR_W2: "—",
    ASR_W2: "—",
    WEEK_MINUS_1: "—",
    WRS_W1: "—",
    GRADE_W1: "—",
    TCR_W1: "—",
    TCSR_W1: "—",
    ASR_W1: "—",

    // Notes
    SCORECARD_NOTES:
      "⚠️ **Observation window active (Phase 1).** Metrics are being collected but SLOs are not enforced. " +
      "Phase 2 auto-alerting starts 2026-03-08 after 2 weeks of baseline data.",
  };

  let rendered = template;
  for (const [key, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }

  return rendered;
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

function renderJson(m: WeekMetrics): string {
  return JSON.stringify(
    {
      weekStart: m.weekStart.toISOString(),
      weekEnd: m.weekEnd.toISOString(),
      wrs: m.wrs,
      wrsGrade: m.wrsGrade,
      tcr: m.tcr,
      tcsr: m.tcsr,
      asr: m.asr,
      mttft: m.mttft,
      eal: m.eal,
      sessionCount: m.sessions.length,
      toolCallCount: m.toolCalls.length,
      hitlCount: m.hitlRecords.length,
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Week helpers
// ---------------------------------------------------------------------------

function lastMonday(from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    week: { type: "string" },
    "agents-dir": { type: "string" },
    out: { type: "string" },
    format: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
  },
  strict: false,
});

const verbose = args["verbose"] as boolean;
const dryRun = args["dry-run"] as boolean;
const format = (args["format"] as string | undefined) ?? "md";

const weekStart = args["week"] ? new Date(args["week"] as string) : lastMonday();
const weekEnd = addDays(weekStart, 7);

const agentsDir = resolve(
  (args["agents-dir"] as string | undefined) ?? join(homedir(), ".openclaw", "agents"),
);

const repoRoot = resolve(join(import.meta.dir, ".."));
const templatePath = join(repoRoot, "docs", "ops", "weekly-reliability-scorecard-template.md");

if (verbose) {
  console.error(`[generate-scorecard] week: ${weekStart.toISOString().slice(0, 10)}`);
  console.error(`[generate-scorecard] agents-dir: ${agentsDir}`);
  console.error(`[generate-scorecard] template: ${templatePath}`);
}

const sessions = loadSessions(agentsDir, weekStart, weekEnd);
if (verbose) {
  console.error(`[generate-scorecard] loaded ${sessions.length} sessions`);
}

const toolCalls = extractToolCalls(sessions);
if (verbose) {
  console.error(`[generate-scorecard] extracted ${toolCalls.length} tool calls`);
}

const hitlRecords = extractHitlRecords(sessions);
if (verbose) {
  console.error(`[generate-scorecard] found ${hitlRecords.length} HITL records`);
}

const metrics = computeMetrics(sessions, toolCalls, hitlRecords, weekStart, weekEnd);

if (verbose) {
  console.error(`[generate-scorecard] WRS=${metrics.wrs} (${metrics.wrsGrade})`);
  console.error(`[generate-scorecard] TCR=${metrics.tcr.toFixed(1)}%`);
  console.error(`[generate-scorecard] TCSR=${metrics.tcsr.toFixed(1)}%`);
  console.error(`[generate-scorecard] ASR=${metrics.asr.toFixed(1)}%`);
}

const output = format === "json" ? renderJson(metrics) : renderMarkdown(metrics, templatePath);

if (dryRun) {
  console.log("[dry-run] would write output:");
  console.log(output.slice(0, 500) + (output.length > 500 ? "\n... (truncated)" : ""));
} else if (args["out"]) {
  const outPath = resolve(args["out"] as string);
  writeFileSync(outPath, output, "utf-8");
  console.log(`Scorecard written to: ${outPath}`);
} else {
  process.stdout.write(output);
}
