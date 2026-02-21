import crypto from "node:crypto";
import type { VoiceCallConfig } from "./config.js";
import { loadCoreAgentDeps, type CoreConfig } from "./core-bridge.js";
import {
  type DelegationRequest,
  normalizeSubagentResult,
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

export class InMemorySubagentJobStore implements SubagentJobStore {
  private jobsById = new Map<string, SubagentJob>();
  private queue: string[] = [];

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
    this.pruneTerminalJobs();
  }

  markFailed(jobId: string, reason?: string): void {
    const job = this.jobsById.get(jobId);
    if (!job) return;
    job.state = "failed";
    job.updatedAt = Date.now();
    job.lastError = reason;
    this.pruneTerminalJobs();
  }

  markExpired(jobId: string, reason?: string): void {
    const job = this.jobsById.get(jobId);
    if (!job) return;
    job.state = "expired";
    job.updatedAt = Date.now();
    job.lastError = reason;
    this.pruneTerminalJobs();
  }

  cancelByCall(callId: string): void {
    const now = Date.now();
    for (const job of this.jobsById.values()) {
      if (job.callId !== callId) continue;
      if (job.state === "queued") {
        job.state = "canceled";
        job.updatedAt = now;
      }
    }
    this.pruneTerminalJobs();
  }

  listByCall(callId: string): SubagentJob[] {
    return Array.from(this.jobsById.values()).filter((job) => job.callId === callId);
  }

  private pruneTerminalJobs(): void {
    this.queue = this.queue.filter((id) => {
      const job = this.jobsById.get(id);
      if (!job) return false;
      if (["done", "failed", "expired", "canceled"].includes(job.state)) {
        this.jobsById.delete(id);
        return false;
      }
      return true;
    });
  }
}

type EnqueueParams = {
  callId: string;
  from: string;
  userMessage: string;
  transcript: Array<{ speaker: "user" | "bot"; text: string }>;
  delegation: DelegationRequest;
};

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

const MAX_REPAIR_ATTEMPTS = 1;
const FALLBACK_SPOKEN_SUMMARY = "I am still checking that and will update you shortly.";

export class AsyncSubagentBroker {
  private readonly store: SubagentJobStore;
  private runningCount = 0;
  private readonly maxConcurrency: number;
  private readonly maxPerCall: number;
  private readonly runningByCall = new Map<string, number>();
  private isShuttingDown = false;

  constructor(private readonly opts: AsyncSubagentBrokerOptions) {
    this.store = opts.store ?? new InMemorySubagentJobStore();
    this.maxConcurrency = Math.max(1, this.opts.voiceConfig.subagents?.maxConcurrency ?? 2);
    this.maxPerCall = Math.max(1, this.opts.voiceConfig.subagents?.maxConcurrency ?? 2);
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
    this.pump();
  }

  cancelCallJobs(callId: string): void {
    this.store.cancelByCall(callId);
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
    if (!this.opts.isCallActive(job.callId)) {
      this.store.cancelByCall(job.callId);
      return;
    }

    if (job.expiresAt <= Date.now()) {
      this.store.markExpired(job.jobId, "expired before execution");
      return;
    }

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

      const prompt = [
        "You are a voice-call async specialist worker. Return JSON only.",
        "Output keys: summary, confidence, needs_followup, followup_question, artifacts.",
        `Specialist: ${job.delegation.specialist}`,
        `Task: ${job.delegation.goal}`,
        `Caller number: ${job.from}`,
        `Latest user message: ${job.userMessage}`,
        `Structured input: ${JSON.stringify(job.delegation.input ?? {})}`,
        `Recent transcript:\n${job.transcript
          .slice(-6)
          .map((t) => `${t.speaker}: ${t.text}`)
          .join("\n")}`,
      ].join("\n\n");

      const timeoutMs = Math.max(1000, Math.min(job.expiresAt - Date.now(), 20_000));
      if (timeoutMs <= 0) {
        this.store.markExpired(job.jobId, "expired before run call");
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

      const normalized = await this.normalizeWithRepair(raw);
      console.log(
        `[voice-call] sub-agent raw payload (${job.jobId}): ${raw.slice(0, 300)}${raw.length > 300 ? "..." : ""}`,
      );

      if (!normalized) {
        this.store.markFailed(job.jobId, "failed_normalization");
        await this.speakFallbackIfActive(job.callId);
        return;
      }

      const safeSummary = toSafeSpokenSummary(normalized.summary);
      console.log(
        `[voice-call] sub-agent normalized (${job.jobId}): ${JSON.stringify(normalized)}`,
      );

      if (!safeSummary) {
        this.store.markFailed(job.jobId, "unsafe_or_empty_summary");
        await this.speakFallbackIfActive(job.callId);
        return;
      }

      if (!this.opts.isCallActive(job.callId)) {
        this.store.cancelByCall(job.callId);
        return;
      }

      await this.opts.onSummaryReady({
        callId: job.callId,
        summary: safeSummary,
        result: normalized,
      });
      this.store.markDone(job.jobId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn("[voice-call] Sub-agent job failed:", err);
      this.store.markFailed(job.jobId, reason);
      await this.speakFallbackIfActive(job.callId);
    }
  }

  private async normalizeWithRepair(raw: string): Promise<SubagentResult | null> {
    const direct = normalizeSubagentResult(raw);
    if (direct) {
      return direct;
    }

    for (let attempt = 0; attempt < MAX_REPAIR_ATTEMPTS; attempt += 1) {
      const repaired = await this.repairPayload(raw);
      const normalized = normalizeSubagentResult(repaired);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private async repairPayload(raw: string): Promise<string> {
    const deps = await loadCoreAgentDeps();
    const modelRef =
      this.opts.voiceConfig.responseModel || `${deps.DEFAULT_PROVIDER}/${deps.DEFAULT_MODEL}`;
    const slashIndex = modelRef.indexOf("/");
    const provider = slashIndex === -1 ? deps.DEFAULT_PROVIDER : modelRef.slice(0, slashIndex);
    const model = slashIndex === -1 ? modelRef : modelRef.slice(slashIndex + 1);
    const agentId = "main";
    const workspaceDir = deps.resolveAgentWorkspaceDir(this.opts.coreConfig, agentId);
    const runId = `voice-subagent-repair:${Date.now()}`;
    const response = await deps.runEmbeddedPiAgent({
      sessionId: crypto.randomUUID(),
      sessionFile: `${workspaceDir}/.voice-subagent-repair-${runId}.json`,
      workspaceDir,
      config: this.opts.coreConfig,
      prompt: [
        "Rewrite the following payload as strict JSON with keys:",
        "summary (string), confidence (0..1 number), needs_followup (boolean), followup_question (string|null), artifacts (array).",
        "Return JSON only.",
        raw,
      ].join("\n"),
      provider,
      model,
      thinkLevel: "low",
      verboseLevel: "off",
      timeoutMs: 5000,
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
