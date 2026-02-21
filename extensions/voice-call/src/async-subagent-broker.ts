import crypto from "node:crypto";
import fs from "node:fs";
import type { VoiceCallConfig } from "./config.js";
import { loadCoreAgentDeps, type CoreConfig } from "./core-bridge.js";
import {
  type DelegationRequest,
  normalizeSubagentResult,
  SPECIALIST_PROMPTS,
  type SpecialistType,
  type SubagentResult,
} from "./subagent-normalization.js";

export type SubagentJobState = "queued" | "running" | "done" | "failed" | "expired" | "canceled";

export type SubagentJob = {
  jobId: string;
  callId: string;
  from: string;
  userMessage: string;
  transcript: Array<{ speaker: "user" | "bot"; text: string }>;
  delegation: DelegationRequest;
  state: SubagentJobState;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  attempts: number;
  lastError?: string;
};

export interface SubagentJobStore {
  enqueue(job: SubagentJob): void;
  claimNext(params: {
    now: number;
    runningByCall: Map<string, number>;
    maxPerCall: number;
  }): SubagentJob | null;
  markDone(jobId: string): void;
  markFailed(jobId: string, reason?: string): void;
  markExpired(jobId: string, reason?: string): void;
  cancelByCall(callId: string): void;
  listByCall(callId: string): SubagentJob[];
}

const TERMINAL_STATES = new Set<SubagentJobState>(["done", "failed", "expired", "canceled"]);

export class InMemorySubagentJobStore implements SubagentJobStore {
  private jobsById = new Map<string, SubagentJob>();
  private queue: string[] = [];
  private terminalCount = 0;
  private static readonly PRUNE_THRESHOLD = 16;

  enqueue(job: SubagentJob): void {
    this.jobsById.set(job.jobId, job);
    this.queue.push(job.jobId);
  }

  claimNext(params: {
    now: number;
    runningByCall: Map<string, number>;
    maxPerCall: number;
  }): SubagentJob | null {
    for (const jobId of this.queue) {
      const job = this.jobsById.get(jobId);
      if (!job || job.state !== "queued") {
        continue;
      }
      if (job.expiresAt <= params.now) {
        this.markExpired(job.jobId, "expired before execution");
        continue;
      }
      const currentForCall = params.runningByCall.get(job.callId) ?? 0;
      if (currentForCall >= params.maxPerCall) {
        continue;
      }

      job.state = "running";
      job.updatedAt = params.now;
      job.attempts += 1;
      return job;
    }
    return null;
  }

  markDone(jobId: string): void {
    const job = this.jobsById.get(jobId);
    if (!job) return;
    job.state = "done";
    job.updatedAt = Date.now();
    this.terminalCount += 1;
    this.maybePrune();
  }

  markFailed(jobId: string, reason?: string): void {
    const job = this.jobsById.get(jobId);
    if (!job) return;
    job.state = "failed";
    job.updatedAt = Date.now();
    job.lastError = reason;
    this.terminalCount += 1;
    this.maybePrune();
  }

  markExpired(jobId: string, reason?: string): void {
    const job = this.jobsById.get(jobId);
    if (!job) return;
    job.state = "expired";
    job.updatedAt = Date.now();
    job.lastError = reason;
    this.terminalCount += 1;
    this.maybePrune();
  }

  cancelByCall(callId: string): void {
    const now = Date.now();
    for (const job of this.jobsById.values()) {
      if (job.callId !== callId) continue;
      if (job.state === "queued") {
        job.state = "canceled";
        job.updatedAt = now;
        this.terminalCount += 1;
      }
    }
    this.maybePrune();
  }

  listByCall(callId: string): SubagentJob[] {
    return Array.from(this.jobsById.values()).filter((job) => job.callId === callId);
  }

  /** Only prune when enough terminal jobs accumulate to amortize the O(n) scan. */
  private maybePrune(): void {
    if (this.terminalCount < InMemorySubagentJobStore.PRUNE_THRESHOLD) {
      return;
    }
    this.queue = this.queue.filter((id) => {
      const job = this.jobsById.get(id);
      if (!job) return false;
      if (TERMINAL_STATES.has(job.state)) {
        this.jobsById.delete(id);
        return false;
      }
      return true;
    });
    this.terminalCount = 0;
  }
}

type EnqueueParams = {
  callId: string;
  from: string;
  userMessage: string;
  transcript: Array<{ speaker: "user" | "bot"; text: string }>;
  delegation: DelegationRequest;
};

// ---------------------------------------------------------------------------
// Metrics / observability
// ---------------------------------------------------------------------------

export type BrokerMetrics = {
  /** Total delegation requests enqueued. */
  enqueued: number;
  /** Jobs completed successfully. */
  completed: number;
  /** Jobs that failed (normalization, timeout, error). */
  failed: number;
  /** Jobs expired before execution. */
  expired: number;
  /** Jobs canceled (call ended). */
  canceled: number;
  /** Times the fallback spoken summary was delivered. */
  fallbacksSpoken: number;
  /** Times the LLM repair path was invoked. */
  repairAttempts: number;
  /** Times the LLM repair path succeeded. */
  repairSuccesses: number;
  /** Cumulative sub-agent execution time in ms (from runJob start to result). */
  totalExecutionMs: number;
};

function createEmptyMetrics(): BrokerMetrics {
  return {
    enqueued: 0,
    completed: 0,
    failed: 0,
    expired: 0,
    canceled: 0,
    fallbacksSpoken: 0,
    repairAttempts: 0,
    repairSuccesses: 0,
    totalExecutionMs: 0,
  };
}

// ---------------------------------------------------------------------------
// Broker
// ---------------------------------------------------------------------------

export type AsyncSubagentBrokerOptions = {
  voiceConfig: VoiceCallConfig;
  coreConfig: CoreConfig;
  onSummaryReady: (params: {
    callId: string;
    summary: string;
    result: SubagentResult;
  }) => Promise<void>;
  isCallActive: (callId: string) => boolean;
  store?: SubagentJobStore;
};

const FALLBACK_SPOKEN_SUMMARY = "I am still checking that and will update you shortly.";

export class AsyncSubagentBroker {
  private readonly store: SubagentJobStore;
  private runningCount = 0;
  private readonly maxConcurrency: number;
  private readonly maxPerCall: number;
  private readonly runningByCall = new Map<string, number>();
  private isShuttingDown = false;
  private readonly _metrics: BrokerMetrics = createEmptyMetrics();

  constructor(private readonly opts: AsyncSubagentBrokerOptions) {
    this.store = opts.store ?? new InMemorySubagentJobStore();
    this.maxConcurrency = Math.max(1, this.opts.voiceConfig.subagents?.maxConcurrency ?? 2);
    this.maxPerCall = Math.max(1, this.opts.voiceConfig.subagents?.maxPerCall ?? 2);
  }

  /** Read-only snapshot of broker metrics for observability. */
  get metrics(): Readonly<BrokerMetrics> {
    return this._metrics;
  }

  enqueue(params: EnqueueParams): void {
    if (!this.opts.isCallActive(params.callId) || this.isShuttingDown) {
      return;
    }

    const now = Date.now();
    const defaultDeadlineMs = this.opts.voiceConfig.subagents?.defaultDeadlineMs ?? 15_000;
    const deadlineMs = Math.max(
      5_000,
      Math.min(params.delegation.deadline_ms ?? defaultDeadlineMs, 20_000),
    );
    const job: SubagentJob = {
      ...params,
      jobId: crypto.randomUUID(),
      state: "queued",
      createdAt: now,
      updatedAt: now,
      expiresAt: now + deadlineMs,
      attempts: 0,
    };

    this.store.enqueue(job);
    this._metrics.enqueued += 1;
    console.log(
      `[voice-call] sub-agent enqueued (${job.jobId}): specialist=${job.delegation.specialist} goal="${job.delegation.goal}" deadline=${deadlineMs}ms`,
    );
    this.pump();
  }

  cancelCallJobs(callId: string): void {
    this.store.cancelByCall(callId);
    this._metrics.canceled += 1;
  }

  shutdown(): void {
    this.isShuttingDown = true;
  }

  private pump(): void {
    if (this.isShuttingDown) {
      return;
    }

    while (this.runningCount < this.maxConcurrency) {
      const job = this.store.claimNext({
        now: Date.now(),
        runningByCall: this.runningByCall,
        maxPerCall: this.maxPerCall,
      });
      if (!job) {
        return;
      }

      this.runningCount += 1;
      this.runningByCall.set(job.callId, (this.runningByCall.get(job.callId) ?? 0) + 1);

      void this.runJob(job).finally(() => {
        this.runningCount = Math.max(0, this.runningCount - 1);
        const next = Math.max(0, (this.runningByCall.get(job.callId) ?? 1) - 1);
        if (next === 0) {
          this.runningByCall.delete(job.callId);
        } else {
          this.runningByCall.set(job.callId, next);
        }
        this.pump();
      });
    }
  }

  private async runJob(job: SubagentJob): Promise<void> {
    const jobStartMs = Date.now();

    if (!this.opts.isCallActive(job.callId)) {
      this.store.cancelByCall(job.callId);
      this._metrics.canceled += 1;
      return;
    }

    if (job.expiresAt <= Date.now()) {
      this.store.markExpired(job.jobId, "expired before execution");
      this._metrics.expired += 1;
      return;
    }

    // Track files created during this job so we can clean them up.
    const tempFiles: string[] = [];

    try {
      const deps = await loadCoreAgentDeps();
      const agentId = "main";
      const storePath = deps.resolveStorePath(this.opts.coreConfig.session?.store, { agentId });
      const agentDir = deps.resolveAgentDir(this.opts.coreConfig, agentId);
      const workspaceDir = deps.resolveAgentWorkspaceDir(this.opts.coreConfig, agentId);
      await deps.ensureAgentWorkspace({ dir: workspaceDir });

      const sessionStore = deps.loadSessionStore(storePath);
      const sessionKey = `voice-subagent:${job.callId}:${job.jobId}`;
      const sessionEntry = {
        sessionId: crypto.randomUUID(),
        updatedAt: Date.now(),
      };
      sessionStore[sessionKey] = sessionEntry;
      await deps.saveSessionStore(storePath, sessionStore);
      const sessionFile = deps.resolveSessionFilePath(sessionEntry.sessionId, sessionEntry, {
        agentId,
      });
      tempFiles.push(sessionFile);

      const modelRef =
        this.opts.voiceConfig.responseModel || `${deps.DEFAULT_PROVIDER}/${deps.DEFAULT_MODEL}`;
      const slashIndex = modelRef.indexOf("/");
      const provider = slashIndex === -1 ? deps.DEFAULT_PROVIDER : modelRef.slice(0, slashIndex);
      const model = slashIndex === -1 ? modelRef : modelRef.slice(slashIndex + 1);
      const thinkLevel = deps.resolveThinkingDefault({
        cfg: this.opts.coreConfig,
        provider,
        model,
      });

      const specialist = job.delegation.specialist as SpecialistType;
      const specialistInstruction = SPECIALIST_PROMPTS[specialist] ?? SPECIALIST_PROMPTS.research;

      const prompt = [
        `You are a voice-call async specialist worker. ${specialistInstruction}`,
        "Return ONLY a JSON object (no markdown, no explanation) with these keys:",
        "  summary (string) — caller-safe spoken summary of your finding",
        "  confidence (number 0-1) — how confident you are in the result",
        "  needs_followup (boolean) — whether the caller should be asked a follow-up",
        "  followup_question (string|null) — the follow-up question if needed",
        "  artifacts (array) — any supporting data or sources",
        "",
        `Task: ${job.delegation.goal}`,
        `Caller number: ${job.from}`,
        `Latest user message: ${job.userMessage}`,
        job.delegation.input && Object.keys(job.delegation.input).length > 0
          ? `Structured input: ${JSON.stringify(job.delegation.input)}`
          : null,
        job.transcript.length > 0
          ? `Recent transcript:\n${job.transcript
              .slice(-6)
              .map((t) => `${t.speaker}: ${t.text}`)
              .join("\n")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      const timeoutMs = Math.max(1000, Math.min(job.expiresAt - Date.now(), 20_000));
      if (timeoutMs <= 0) {
        this.store.markExpired(job.jobId, "expired before run call");
        this._metrics.expired += 1;
        await this.speakFallbackIfActive(job.callId);
        return;
      }

      const result = await deps.runEmbeddedPiAgent({
        sessionId: sessionEntry.sessionId,
        sessionKey,
        messageProvider: "voice",
        sessionFile,
        workspaceDir,
        config: this.opts.coreConfig,
        prompt,
        provider,
        model,
        thinkLevel,
        verboseLevel: "off",
        timeoutMs,
        runId: `voice-subagent:${job.callId}:${job.jobId}`,
        lane: "async-voice",
        agentDir,
      });

      const raw = (result.payloads ?? [])
        .filter((p) => p.text && !p.isError)
        .map((p) => p.text?.trim())
        .filter(Boolean)
        .join("\n");

      console.log(
        `[voice-call] sub-agent raw payload (${job.jobId}): ${raw.slice(0, 300)}${raw.length > 300 ? "..." : ""}`,
      );

      // Try local normalization first (handles fences, aliases, trailing commas, etc.)
      let normalized = normalizeSubagentResult(raw);

      // If local normalization failed, attempt a lightweight LLM repair.
      if (!normalized && raw.trim()) {
        this._metrics.repairAttempts += 1;
        const repaired = await this.repairPayload(raw, {
          deps,
          provider,
          model,
          workspaceDir,
          tempFiles,
        });
        normalized = normalizeSubagentResult(repaired);
        if (normalized) {
          this._metrics.repairSuccesses += 1;
        }
      }

      if (!normalized) {
        this.store.markFailed(job.jobId, "failed_normalization");
        this._metrics.failed += 1;
        await this.speakFallbackIfActive(job.callId);
        return;
      }

      const safeSummary = toSafeSpokenSummary(normalized.summary);
      console.log(
        `[voice-call] sub-agent normalized (${job.jobId}): ${JSON.stringify(normalized)}`,
      );

      if (!safeSummary) {
        this.store.markFailed(job.jobId, "unsafe_or_empty_summary");
        this._metrics.failed += 1;
        await this.speakFallbackIfActive(job.callId);
        return;
      }

      if (!this.opts.isCallActive(job.callId)) {
        this.store.cancelByCall(job.callId);
        this._metrics.canceled += 1;
        return;
      }

      await this.opts.onSummaryReady({
        callId: job.callId,
        summary: safeSummary,
        result: normalized,
      });
      this.store.markDone(job.jobId);
      this._metrics.completed += 1;
      this._metrics.totalExecutionMs += Date.now() - jobStartMs;

      // Clean up the session store entry now that the job is complete.
      try {
        const currentStore = deps.loadSessionStore(storePath);
        delete currentStore[sessionKey];
        await deps.saveSessionStore(storePath, currentStore);
      } catch {
        // Best-effort cleanup; ignore failures.
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn("[voice-call] Sub-agent job failed:", err);
      this.store.markFailed(job.jobId, reason);
      this._metrics.failed += 1;
      this._metrics.totalExecutionMs += Date.now() - jobStartMs;
      await this.speakFallbackIfActive(job.callId);
    } finally {
      // Clean up temp session files.
      for (const filePath of tempFiles) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // Ignore: file may not exist or already deleted.
        }
      }
    }
  }

  /**
   * Lightweight LLM repair: send ONLY the raw output and the target schema.
   * Uses minimal context (no transcript, no conversation history) and short timeout
   * to keep overhead low. Session file is cleaned up in the caller's finally block.
   */
  private async repairPayload(
    raw: string,
    ctx: {
      deps: Awaited<ReturnType<typeof loadCoreAgentDeps>>;
      provider: string;
      model: string;
      workspaceDir: string;
      tempFiles: string[];
    },
  ): Promise<string> {
    const runId = `voice-repair:${Date.now()}`;
    const sessionFile = `${ctx.workspaceDir}/.voice-repair-${runId}.json`;
    ctx.tempFiles.push(sessionFile);

    // Cap input to avoid sending huge payloads to the repair model.
    const truncatedRaw = raw.length > 1000 ? raw.slice(0, 1000) : raw;

    const response = await ctx.deps.runEmbeddedPiAgent({
      sessionId: crypto.randomUUID(),
      sessionFile,
      workspaceDir: ctx.workspaceDir,
      config: this.opts.coreConfig,
      prompt: [
        "Convert this text into a JSON object with exactly these keys:",
        "summary (string), confidence (number 0-1), needs_followup (boolean), followup_question (string|null), artifacts (array).",
        "Return ONLY the JSON object, nothing else.",
        "",
        truncatedRaw,
      ].join("\n"),
      provider: ctx.provider,
      model: ctx.model,
      thinkLevel: "off",
      verboseLevel: "off",
      timeoutMs: 4000,
      runId,
      lane: "async-voice",
    });

    return (response.payloads ?? [])
      .filter((p) => p.text && !p.isError)
      .map((p) => p.text?.trim())
      .filter(Boolean)
      .join("\n");
  }

  private async speakFallbackIfActive(callId: string): Promise<void> {
    if (!this.opts.isCallActive(callId)) {
      return;
    }
    this._metrics.fallbacksSpoken += 1;
    await this.opts.onSummaryReady({
      callId,
      summary: FALLBACK_SPOKEN_SUMMARY,
      result: {
        summary: FALLBACK_SPOKEN_SUMMARY,
        confidence: 0,
        needs_followup: true,
        followup_question: null,
        artifacts: [],
      },
    });
  }
}

export function toSafeSpokenSummary(value: string): string {
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }
  // Keep voice output short and avoid prompt/tool leakage blobs.
  const truncated = cleaned.length > 320 ? `${cleaned.slice(0, 317)}...` : cleaned;
  return truncated;
}
