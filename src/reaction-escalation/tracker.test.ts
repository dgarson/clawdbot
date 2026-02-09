import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ResolvedReactionEscalationConfig } from "./config.js";
import type { EscalationOutcome, ReactionEscalationAdapter } from "./types.js";

// ---------- mocks ----------

const mockCallGateway = vi.fn().mockResolvedValue({ status: "ok" });
vi.mock("../gateway/call.js", () => ({
  callGateway: (...args: unknown[]) => mockCallGateway(...args),
}));

const mockFetchOutcomeSummary = vi.fn().mockResolvedValue("Session complete.");
vi.mock("./dispatcher.js", () => ({
  fetchOutcomeSummaryFromSession: (...args: unknown[]) => mockFetchOutcomeSummary(...args),
}));

const mockDeliverOutcome = vi.fn().mockResolvedValue({ messageId: "m1" });
vi.mock("./outcome-delivery.js", () => ({
  deliverOutcome: (...args: unknown[]) => mockDeliverOutcome(...args),
}));

const { ReactionEscalationTracker } = await import("./tracker.js");

// ---------- helpers ----------

function fakeConfig(): ResolvedReactionEscalationConfig {
  return {
    enabled: true,
    outcome: {
      postReply: true,
      digestChannel: undefined,
      includePermalink: true,
    },
    rateLimit: {
      maxPerMinute: 5,
      maxPerHour: 30,
      cooldownPerMessageMs: 5000,
    },
  };
}

function fakeAdapter(): ReactionEscalationAdapter {
  return {
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    buildPermalink: vi.fn().mockResolvedValue("https://example.com/msg"),
    postOutcome: vi.fn().mockResolvedValue({ messageId: "m1" }),
  };
}

function fakeOutcome(overrides?: Partial<EscalationOutcome>): EscalationOutcome {
  return {
    id: "esc-1",
    intent: "deep-dive",
    sourceChannel: "general",
    sourceChannelId: "C123",
    sourceMessageTs: "1700000000.000001",
    reactorUserId: "U999",
    dispatchedAt: Date.now(),
    workRef: { kind: "session", sessionKey: "agent:main:subagent:abc", runId: "run-1" },
    status: "processing",
    ...overrides,
  };
}

// ---------- tests ----------

describe("ReactionEscalationTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates reactions to SUCCESS when session completes ok", async () => {
    const adapter = fakeAdapter();
    const tracker = new ReactionEscalationTracker({
      config: fakeConfig(),
      adapter,
    });

    mockCallGateway.mockResolvedValue({ status: "ok" });
    mockFetchOutcomeSummary.mockResolvedValue("Analysis complete.");

    // trackSession fires waitForCompletion asynchronously; we wait for it
    const trackPromise = new Promise<void>((resolve) => {
      const origAdd = adapter.addReaction!;
      adapter.addReaction = vi.fn(async (params) => {
        await origAdd(params);
        resolve();
      });
    });

    tracker.trackSession({
      outcome: fakeOutcome(),
      sessionKey: "agent:main:subagent:abc",
      runId: "run-1",
      reactionTarget: { channelId: "C123", messageTs: "1700000000.000001" },
    });

    await trackPromise;

    expect(adapter.removeReaction).toHaveBeenCalledWith({
      channelId: "C123",
      messageTs: "1700000000.000001",
      reaction: "eyes",
    });
    expect(adapter.addReaction).toHaveBeenCalledWith({
      channelId: "C123",
      messageTs: "1700000000.000001",
      reaction: "white_check_mark",
    });
  });

  it("updates reactions to FAILURE when session errors", async () => {
    const adapter = fakeAdapter();
    const tracker = new ReactionEscalationTracker({
      config: fakeConfig(),
      adapter,
    });

    mockCallGateway.mockResolvedValue({ status: "error" });
    mockFetchOutcomeSummary.mockResolvedValue("Work did not complete.");

    const trackPromise = new Promise<void>((resolve) => {
      const origAdd = adapter.addReaction!;
      adapter.addReaction = vi.fn(async (params) => {
        await origAdd(params);
        resolve();
      });
    });

    tracker.trackSession({
      outcome: fakeOutcome(),
      sessionKey: "agent:main:subagent:abc",
      runId: "run-2",
      reactionTarget: { channelId: "C123", messageTs: "1700000000.000001" },
    });

    await trackPromise;

    expect(adapter.removeReaction).toHaveBeenCalledWith({
      channelId: "C123",
      messageTs: "1700000000.000001",
      reaction: "eyes",
    });
    expect(adapter.addReaction).toHaveBeenCalledWith({
      channelId: "C123",
      messageTs: "1700000000.000001",
      reaction: "x",
    });
  });

  it("does not update reactions when no reactionTarget is provided", async () => {
    const adapter = fakeAdapter();
    const tracker = new ReactionEscalationTracker({
      config: fakeConfig(),
      adapter,
    });

    mockCallGateway.mockResolvedValue({ status: "ok" });

    // Wait for deliverOutcome to be called — signals completion
    const trackPromise = new Promise<void>((resolve) => {
      mockDeliverOutcome.mockImplementation(async (..._args: unknown[]) => {
        resolve();
        return { messageId: "m1" };
      });
    });

    tracker.trackSession({
      outcome: fakeOutcome(),
      sessionKey: "agent:main:subagent:abc",
      runId: "run-3",
    });

    await trackPromise;

    expect(adapter.removeReaction).not.toHaveBeenCalled();
    expect(adapter.addReaction).not.toHaveBeenCalled();
  });
});
