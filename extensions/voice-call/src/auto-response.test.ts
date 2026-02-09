import { describe, expect, it } from "vitest";
import { resolveAutoResponseDecision } from "./auto-response.js";

describe("resolveAutoResponseDecision", () => {
  it("responds for inbound calls", () => {
    const decision = resolveAutoResponseDecision({
      direction: "inbound",
      mode: "notify",
      transcript: "hello there",
      hasPendingTranscriptWaiter: false,
    });

    expect(decision.shouldRespond).toBe(true);
    expect(decision.reason).toBe("inbound-call");
  });

  it("responds for outbound calls only in conversation mode", () => {
    const yes = resolveAutoResponseDecision({
      direction: "outbound",
      mode: "conversation",
      transcript: "yes",
      hasPendingTranscriptWaiter: false,
    });
    const no = resolveAutoResponseDecision({
      direction: "outbound",
      mode: "notify",
      transcript: "yes",
      hasPendingTranscriptWaiter: false,
    });

    expect(yes.shouldRespond).toBe(true);
    expect(no.shouldRespond).toBe(false);
  });

  it("skips auto-response when an explicit transcript waiter is active", () => {
    const decision = resolveAutoResponseDecision({
      direction: "inbound",
      mode: "conversation",
      transcript: "testing",
      hasPendingTranscriptWaiter: true,
    });

    expect(decision.shouldRespond).toBe(false);
    expect(decision.reason).toBe("pending-transcript-waiter");
  });

  it("skips auto-response for empty transcripts", () => {
    const decision = resolveAutoResponseDecision({
      direction: "inbound",
      mode: "conversation",
      transcript: "   ",
      hasPendingTranscriptWaiter: false,
    });

    expect(decision.shouldRespond).toBe(false);
    expect(decision.reason).toBe("transcript-empty");
  });
});
