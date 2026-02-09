import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type {
  EscalationOutcome,
  ReactionEscalationAdapter,
  ReactionMessageContext,
} from "./types.js";

// ---------- mocks ----------

const mockDispatchEscalation = vi.fn();
vi.mock("./dispatcher.js", () => ({
  dispatchEscalation: (...args: unknown[]) => mockDispatchEscalation(...args),
  fetchOutcomeSummaryFromSession: vi.fn().mockResolvedValue("Done."),
}));

const mockDeliverOutcome = vi.fn().mockResolvedValue({ messageId: "m1" });
vi.mock("./outcome-delivery.js", () => ({
  deliverOutcome: (...args: unknown[]) => mockDeliverOutcome(...args),
}));

vi.mock("../gateway/call.js", () => ({
  callGateway: vi.fn().mockResolvedValue({ status: "ok" }),
}));

const { ReactionEscalationService } = await import("./service.js");

// ---------- helpers ----------

function fakeAdapter(overrides?: Partial<ReactionEscalationAdapter>): ReactionEscalationAdapter {
  return {
    fetchReactedMessage: vi.fn().mockResolvedValue(fakeContext()),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    buildPermalink: vi.fn().mockResolvedValue("https://example.com/msg"),
    ...overrides,
  };
}

function fakeContext(overrides?: Partial<ReactionMessageContext>): ReactionMessageContext {
  return {
    text: "hello world",
    channelId: "C123",
    channelName: "general",
    messageTs: "1700000000.000001",
    ...overrides,
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
    workRef: { kind: "inline", result: "" },
    status: "completed",
    ...overrides,
  };
}

function buildService(adapter: ReactionEscalationAdapter) {
  return new ReactionEscalationService({
    cfg: {
      reactionEscalation: {
        enabled: true,
        channels: ["general"],
      },
    } as unknown,
    channelId: "general",
    adapter,
  });
}

// ---------- tests ----------

describe("ReactionEscalationService.dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds SUCCESS_REACTION immediately for a non-session dispatch", async () => {
    const adapter = fakeAdapter();
    const service = buildService(adapter);

    mockDispatchEscalation.mockResolvedValue({
      outcome: fakeOutcome({ status: "completed" }),
      summary: "Prioritized in work queue.",
    });

    const result = await service.dispatch({
      reaction: "star",
      channelId: "C123",
      messageTs: "1700000000.000001",
      reactorUserId: "U999",
    });

    expect(result.handled).toBe(true);
    expect(adapter.removeReaction).toHaveBeenCalledWith(
      expect.objectContaining({ reaction: "eyes" }),
    );
    expect(adapter.addReaction).toHaveBeenCalledWith(
      expect.objectContaining({ reaction: "white_check_mark" }),
    );
  });

  it("adds FAILURE_REACTION immediately for a non-session dispatch that fails", async () => {
    const adapter = fakeAdapter();
    const service = buildService(adapter);

    mockDispatchEscalation.mockResolvedValue({
      outcome: fakeOutcome({ status: "failed" }),
      summary: "Ingestion failed.",
    });

    await service.dispatch({
      reaction: "inbox_tray",
      channelId: "C123",
      messageTs: "1700000000.000001",
      reactorUserId: "U999",
    });

    expect(adapter.addReaction).toHaveBeenCalledWith(expect.objectContaining({ reaction: "x" }));
  });

  it("does NOT add FAILURE_REACTION for a session-spawning dispatch (status: processing)", async () => {
    const adapter = fakeAdapter();
    const service = buildService(adapter);

    mockDispatchEscalation.mockResolvedValue({
      outcome: fakeOutcome({ status: "processing" }),
      sessionKey: "agent:main:subagent:abc",
      runId: "run-1",
    });

    await service.dispatch({
      reaction: "brain",
      channelId: "C123",
      messageTs: "1700000000.000001",
      reactorUserId: "U999",
    });

    // The processing emoji should NOT be removed
    expect(adapter.removeReaction).not.toHaveBeenCalledWith(
      expect.objectContaining({ reaction: "eyes" }),
    );
    // No success or failure reaction should be added beyond the initial processing emoji
    const addCalls = (adapter.addReaction as Mock).mock.calls;
    const nonProcessingAdds = addCalls.filter(
      ([params]: [{ reaction: string }]) => params.reaction !== "eyes",
    );
    expect(nonProcessingAdds).toHaveLength(0);
  });

  it("keeps the processing emoji visible while session is tracked", async () => {
    const adapter = fakeAdapter();
    const service = buildService(adapter);

    mockDispatchEscalation.mockResolvedValue({
      outcome: fakeOutcome({ status: "processing" }),
      sessionKey: "agent:main:subagent:abc",
      runId: "run-1",
    });

    await service.dispatch({
      reaction: "fire",
      channelId: "C123",
      messageTs: "1700000000.000001",
      reactorUserId: "U999",
    });

    // Processing emoji was added
    expect(adapter.addReaction).toHaveBeenCalledWith(expect.objectContaining({ reaction: "eyes" }));
    // But never removed — tracker will handle that
    expect(adapter.removeReaction).not.toHaveBeenCalled();
  });
});
