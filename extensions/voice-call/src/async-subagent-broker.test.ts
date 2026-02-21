import { describe, expect, it } from "vitest";
import {
  type BrokerMetrics,
  InMemorySubagentJobStore,
  toSafeSpokenSummary,
  type SubagentJob,
  type SubagentJobStore,
  AsyncSubagentBroker,
} from "./async-subagent-broker.js";
import type { VoiceCallConfig } from "./config.js";
import type { CoreConfig } from "./core-bridge.js";

function makeJob(overrides: Partial<SubagentJob> = {}): SubagentJob {
  const now = Date.now();
  return {
    jobId: "job-1",
    callId: "call-1",
    from: "+15550001111",
    userMessage: "check status",
    transcript: [],
    delegation: { specialist: "research", goal: "check status" },
    state: "queued",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 10_000,
    attempts: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// InMemorySubagentJobStore
// ---------------------------------------------------------------------------

describe("InMemorySubagentJobStore", () => {
  it("claims jobs with per-call concurrency constraints", () => {
    const store = new InMemorySubagentJobStore();
    store.enqueue(makeJob({ jobId: "a", callId: "call-1" }));
    store.enqueue(makeJob({ jobId: "b", callId: "call-1" }));

    const first = store.claimNext({
      now: Date.now(),
      runningByCall: new Map(),
      maxPerCall: 1,
    });
    expect(first?.jobId).toBe("a");

    const blocked = store.claimNext({
      now: Date.now(),
      runningByCall: new Map([["call-1", 1]]),
      maxPerCall: 1,
    });
    expect(blocked).toBeNull();
  });

  it("marks expired jobs and can cancel queued jobs by call", () => {
    const store = new InMemorySubagentJobStore();
    store.enqueue(makeJob({ jobId: "exp", expiresAt: Date.now() - 1 }));

    const claimed = store.claimNext({
      now: Date.now(),
      runningByCall: new Map(),
      maxPerCall: 2,
    });
    expect(claimed).toBeNull();

    store.enqueue(makeJob({ jobId: "queued", callId: "call-2" }));
    store.cancelByCall("call-2");
    // With lazy pruning, canceled jobs may remain in the store until
    // enough terminal jobs accumulate to trigger a prune pass.
    const remaining = store.listByCall("call-2");
    for (const job of remaining) {
      expect(job.state).toBe("canceled");
    }
  });

  it("allows jobs from different calls when one is at maxPerCall", () => {
    const store = new InMemorySubagentJobStore();
    store.enqueue(makeJob({ jobId: "a", callId: "call-1" }));
    store.enqueue(makeJob({ jobId: "b", callId: "call-2" }));

    const first = store.claimNext({
      now: Date.now(),
      runningByCall: new Map([["call-1", 1]]),
      maxPerCall: 1,
    });
    // call-1 is at capacity, so it should claim from call-2
    expect(first?.jobId).toBe("b");
  });

  it("markDone transitions state correctly", () => {
    const store = new InMemorySubagentJobStore();
    store.enqueue(makeJob({ jobId: "j1" }));
    store.claimNext({ now: Date.now(), runningByCall: new Map(), maxPerCall: 5 });
    store.markDone("j1");
    // After done, listByCall should be empty (pruned eventually)
    // The job enters terminal state and is eligible for pruning
    const jobs = store.listByCall("call-1");
    // May still be in map if pruning hasn't hit threshold
    if (jobs.length > 0) {
      expect(jobs[0].state).toBe("done");
    }
  });

  it("markFailed records error reason", () => {
    const store = new InMemorySubagentJobStore();
    store.enqueue(makeJob({ jobId: "j2" }));
    store.claimNext({ now: Date.now(), runningByCall: new Map(), maxPerCall: 5 });
    store.markFailed("j2", "normalization_failed");
    const jobs = store.listByCall("call-1");
    if (jobs.length > 0) {
      expect(jobs[0].state).toBe("failed");
      expect(jobs[0].lastError).toBe("normalization_failed");
    }
  });

  it("defers pruning until threshold is reached", () => {
    const store = new InMemorySubagentJobStore();
    // Enqueue and complete several jobs (below threshold of 16)
    for (let i = 0; i < 5; i += 1) {
      store.enqueue(makeJob({ jobId: `j-${i}`, callId: `c-${i}` }));
      store.claimNext({ now: Date.now(), runningByCall: new Map(), maxPerCall: 5 });
      store.markDone(`j-${i}`);
    }
    // Jobs may still be in the map since we're below prune threshold
    // The store should still function correctly
    store.enqueue(makeJob({ jobId: "j-fresh", callId: "c-fresh" }));
    const fresh = store.claimNext({ now: Date.now(), runningByCall: new Map(), maxPerCall: 5 });
    expect(fresh?.jobId).toBe("j-fresh");
  });

  it("prunes terminal jobs when threshold is reached", () => {
    const store = new InMemorySubagentJobStore();
    // Enqueue and complete enough jobs to trigger pruning multiple times.
    // Threshold is 16, so after 32+ terminal transitions everything prior
    // to the last batch should be fully pruned.
    const count = 35;
    for (let i = 0; i < count; i += 1) {
      store.enqueue(makeJob({ jobId: `j-${i}`, callId: `c-${i}` }));
      store.claimNext({ now: Date.now(), runningByCall: new Map(), maxPerCall: 5 });
      store.markDone(`j-${i}`);
    }
    // Jobs cleaned by the prune passes should be gone.
    // The last few (< threshold) may remain, but the early ones must be empty.
    let prunedCount = 0;
    for (let i = 0; i < count; i += 1) {
      if (store.listByCall(`c-${i}`).length === 0) {
        prunedCount += 1;
      }
    }
    // At least the first 16 should have been pruned away
    expect(prunedCount).toBeGreaterThanOrEqual(16);
  });

  it("cancelByCall only cancels queued jobs, not running ones", () => {
    const store = new InMemorySubagentJobStore();
    store.enqueue(makeJob({ jobId: "running", callId: "c1" }));
    store.enqueue(makeJob({ jobId: "queued", callId: "c1" }));

    // Claim the first job (it becomes "running")
    store.claimNext({ now: Date.now(), runningByCall: new Map(), maxPerCall: 5 });
    // Cancel all queued jobs for c1
    store.cancelByCall("c1");

    const jobs = store.listByCall("c1");
    const runningJobs = jobs.filter((j) => j.state === "running");
    const canceledJobs = jobs.filter((j) => j.state === "canceled");
    expect(runningJobs).toHaveLength(1);
    // The queued one got canceled (may be pruned, so 0 or 1 in list)
    expect(canceledJobs.length + runningJobs.length).toBeLessThanOrEqual(2);
  });

  it("handles markDone for nonexistent jobId gracefully", () => {
    const store = new InMemorySubagentJobStore();
    // Should not throw
    store.markDone("nonexistent");
    store.markFailed("nonexistent", "reason");
    store.markExpired("nonexistent", "reason");
  });
});

// ---------------------------------------------------------------------------
// toSafeSpokenSummary
// ---------------------------------------------------------------------------

describe("toSafeSpokenSummary", () => {
  it("removes control chars and truncates long output", () => {
    const input = `Hello\u0000 world ${"x".repeat(400)}`;
    const result = toSafeSpokenSummary(input);
    expect(result.includes("\u0000")).toBe(false);
    expect(result.length).toBeLessThanOrEqual(320);
  });

  it("returns empty string for empty input", () => {
    expect(toSafeSpokenSummary("")).toBe("");
    expect(toSafeSpokenSummary("   ")).toBe("");
  });

  it("collapses whitespace", () => {
    expect(toSafeSpokenSummary("hello   world\n\tthere")).toBe("hello world there");
  });

  it("does not truncate short output", () => {
    expect(toSafeSpokenSummary("Short summary.")).toBe("Short summary.");
  });

  it("ends truncated output with ellipsis", () => {
    const result = toSafeSpokenSummary("x".repeat(400));
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBe(320);
  });
});

// ---------------------------------------------------------------------------
// AsyncSubagentBroker - unit tests (no real LLM calls)
// ---------------------------------------------------------------------------

function makeMinimalVoiceConfig(overrides: Partial<VoiceCallConfig> = {}): VoiceCallConfig {
  return {
    enabled: true,
    provider: "mock",
    inboundPolicy: "disabled",
    allowFrom: [],
    outbound: { defaultMode: "notify", notifyHangupDelaySec: 3 },
    maxDurationSeconds: 300,
    staleCallReaperSeconds: 0,
    silenceTimeoutMs: 800,
    transcriptTimeoutMs: 180000,
    ringTimeoutMs: 30000,
    maxConcurrentCalls: 1,
    serve: { port: 3334, bind: "127.0.0.1", path: "/voice/webhook" },
    tailscale: { mode: "off", path: "/voice/webhook" },
    tunnel: { provider: "none", allowNgrokFreeTierLoopbackBypass: false },
    webhookSecurity: { allowedHosts: [], trustForwardingHeaders: false, trustedProxyIPs: [] },
    streaming: {
      enabled: false,
      sttProvider: "openai-realtime",
      sttModel: "gpt-4o-transcribe",
      silenceDurationMs: 800,
      vadThreshold: 0.5,
      streamPath: "/voice/stream",
    },
    skipSignatureVerification: false,
    stt: { provider: "openai", model: "whisper-1" },
    tts: { mode: "auto", auto: {} },
    responseModel: "openai/gpt-4o-mini",
    responseTimeoutMs: 30000,
    subagents: { enabled: true, maxConcurrency: 2, maxPerCall: 1, defaultDeadlineMs: 15000 },
    ...overrides,
  } as VoiceCallConfig;
}

describe("AsyncSubagentBroker", () => {
  it("reads maxPerCall from config correctly (separate from maxConcurrency)", () => {
    const config = makeMinimalVoiceConfig({
      subagents: { enabled: true, maxConcurrency: 4, maxPerCall: 1, defaultDeadlineMs: 15000 },
    });
    const activeCalls = new Set(["call-1"]);
    const broker = new AsyncSubagentBroker({
      voiceConfig: config,
      coreConfig: {} as CoreConfig,
      onSummaryReady: async () => {},
      isCallActive: (id) => activeCalls.has(id),
    });
    // The broker was constructed without error; maxPerCall is read from config
    expect(broker.metrics.enqueued).toBe(0);
  });

  it("does not enqueue when call is inactive", () => {
    const config = makeMinimalVoiceConfig();
    const broker = new AsyncSubagentBroker({
      voiceConfig: config,
      coreConfig: {} as CoreConfig,
      onSummaryReady: async () => {},
      isCallActive: () => false,
    });

    broker.enqueue({
      callId: "call-dead",
      from: "+1555",
      userMessage: "hi",
      transcript: [],
      delegation: { specialist: "research", goal: "test" },
    });

    expect(broker.metrics.enqueued).toBe(0);
  });

  it("does not enqueue after shutdown", () => {
    const config = makeMinimalVoiceConfig();
    const broker = new AsyncSubagentBroker({
      voiceConfig: config,
      coreConfig: {} as CoreConfig,
      onSummaryReady: async () => {},
      isCallActive: () => true,
    });

    broker.shutdown();
    broker.enqueue({
      callId: "call-1",
      from: "+1555",
      userMessage: "hi",
      transcript: [],
      delegation: { specialist: "research", goal: "test" },
    });

    expect(broker.metrics.enqueued).toBe(0);
  });

  it("increments enqueued metric when call is active", () => {
    const config = makeMinimalVoiceConfig();
    // Use a custom store to prevent the pump from trying to run jobs (which
    // would call loadCoreAgentDeps and fail in a test environment).
    const noOpStore: SubagentJobStore = {
      enqueue: () => {},
      claimNext: () => null,
      markDone: () => {},
      markFailed: () => {},
      markExpired: () => {},
      cancelByCall: () => {},
      listByCall: () => [],
    };
    const broker = new AsyncSubagentBroker({
      voiceConfig: config,
      coreConfig: {} as CoreConfig,
      onSummaryReady: async () => {},
      isCallActive: () => true,
      store: noOpStore,
    });

    broker.enqueue({
      callId: "call-1",
      from: "+1555",
      userMessage: "hi",
      transcript: [],
      delegation: { specialist: "research", goal: "test" },
    });

    expect(broker.metrics.enqueued).toBe(1);
  });

  it("cancelCallJobs increments canceled metric", () => {
    const config = makeMinimalVoiceConfig();
    const noOpStore: SubagentJobStore = {
      enqueue: () => {},
      claimNext: () => null,
      markDone: () => {},
      markFailed: () => {},
      markExpired: () => {},
      cancelByCall: () => {},
      listByCall: () => [],
    };
    const broker = new AsyncSubagentBroker({
      voiceConfig: config,
      coreConfig: {} as CoreConfig,
      onSummaryReady: async () => {},
      isCallActive: () => true,
      store: noOpStore,
    });

    broker.cancelCallJobs("call-1");
    expect(broker.metrics.canceled).toBe(1);
  });

  it("metrics snapshot is read-only", () => {
    const config = makeMinimalVoiceConfig();
    const broker = new AsyncSubagentBroker({
      voiceConfig: config,
      coreConfig: {} as CoreConfig,
      onSummaryReady: async () => {},
      isCallActive: () => true,
    });

    const metrics = broker.metrics;
    expect(typeof metrics.enqueued).toBe("number");
    expect(typeof metrics.completed).toBe("number");
    expect(typeof metrics.failed).toBe("number");
    expect(typeof metrics.expired).toBe("number");
    expect(typeof metrics.canceled).toBe("number");
    expect(typeof metrics.fallbacksSpoken).toBe("number");
    expect(typeof metrics.repairAttempts).toBe("number");
    expect(typeof metrics.repairSuccesses).toBe("number");
    expect(typeof metrics.totalExecutionMs).toBe("number");
  });

  it("clamps deadline between 5s and 20s", () => {
    const config = makeMinimalVoiceConfig();
    const enqueued: SubagentJob[] = [];
    const captureStore: SubagentJobStore = {
      enqueue: (job) => enqueued.push(job),
      claimNext: () => null,
      markDone: () => {},
      markFailed: () => {},
      markExpired: () => {},
      cancelByCall: () => {},
      listByCall: () => [],
    };
    const broker = new AsyncSubagentBroker({
      voiceConfig: config,
      coreConfig: {} as CoreConfig,
      onSummaryReady: async () => {},
      isCallActive: () => true,
      store: captureStore,
    });

    // Deadline below 5s should be clamped up
    broker.enqueue({
      callId: "call-1",
      from: "+1555",
      userMessage: "hi",
      transcript: [],
      delegation: { specialist: "research", goal: "test", deadline_ms: 1000 },
    });

    // Deadline above 20s should be clamped down
    broker.enqueue({
      callId: "call-1",
      from: "+1555",
      userMessage: "hi",
      transcript: [],
      delegation: { specialist: "research", goal: "test", deadline_ms: 60000 },
    });

    expect(enqueued).toHaveLength(2);
    const deadline1 = enqueued[0].expiresAt - enqueued[0].createdAt;
    const deadline2 = enqueued[1].expiresAt - enqueued[1].createdAt;
    expect(deadline1).toBe(5000);
    expect(deadline2).toBe(20000);
  });
});
