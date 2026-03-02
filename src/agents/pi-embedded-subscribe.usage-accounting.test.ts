import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import type { AgentRuntimeHints } from "./agent-runtime.js";
import { createSubscribedSessionHarness } from "./pi-embedded-subscribe.e2e-harness.js";

function makeRuntimeHints(managesOwnHistory: boolean): AgentRuntimeHints {
  return {
    allowSyntheticToolResults: false,
    enforceFinalTag: false,
    managesOwnHistory,
    supportsStreamFnWrapping: false,
  };
}

function emitAssistantMessageEnd(
  emit: (evt: unknown) => void,
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  },
) {
  const message = {
    role: "assistant",
    content: [{ type: "text", text: "ok" }],
    usage,
  } as AssistantMessage;
  emit({ type: "message_end", message });
}

describe("subscribeEmbeddedPiSession usage accounting", () => {
  it("converts cumulative usage snapshots into deltas for managed-history runtimes", () => {
    const { emit, subscription } = createSubscribedSessionHarness({
      runId: "run-cumulative",
      sessionExtras: { runtimeHints: makeRuntimeHints(true) },
    });

    emitAssistantMessageEnd(emit, {
      input: 8,
      output: 16,
      cacheRead: 100,
      cacheWrite: 20,
    });
    emitAssistantMessageEnd(emit, {
      input: 12,
      output: 30,
      cacheRead: 150,
      cacheWrite: 35,
    });
    // Duplicate latest snapshot should not be re-added.
    emitAssistantMessageEnd(emit, {
      input: 12,
      output: 30,
      cacheRead: 150,
      cacheWrite: 35,
    });

    expect(subscription.getUsageTotals()).toEqual({
      input: 12,
      output: 30,
      cacheRead: 150,
      cacheWrite: 35,
      total: 227,
    });
  });

  it("keeps additive usage for non-managed-history runtimes", () => {
    const { emit, subscription } = createSubscribedSessionHarness({
      runId: "run-additive",
      sessionExtras: { runtimeHints: makeRuntimeHints(false) },
    });

    emitAssistantMessageEnd(emit, {
      input: 8,
      output: 16,
      cacheRead: 100,
      cacheWrite: 20,
    });
    emitAssistantMessageEnd(emit, {
      input: 12,
      output: 30,
      cacheRead: 150,
      cacheWrite: 35,
    });

    expect(subscription.getUsageTotals()).toEqual({
      input: 20,
      output: 46,
      cacheRead: 250,
      cacheWrite: 55,
      total: 371,
    });
  });
});
