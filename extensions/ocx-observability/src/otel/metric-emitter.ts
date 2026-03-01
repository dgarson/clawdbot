/**
 * Map agent events to OTEL metrics.
 *
 * Metrics per plan:
 *   agent.run.duration_ms       Histogram  session.end events
 *   agent.run.tokens.input      Counter    budget.usage events
 *   agent.run.tokens.output     Counter    budget.usage events
 *   agent.run.cost_usd          Counter    budget.usage events
 *   agent.tool.calls            Counter    tool.invoked events
 *   agent.tool.failures         Counter    tool.completed (success=false)
 *   agent.tool.duration_ms      Histogram  tool.completed events
 *   agent.message.received      Counter    message.received events
 *   agent.message.sent          Counter    message.sent events
 *   agent.escalation.triggered  Counter    orchestration escalation events
 *   agent.budget.utilization_pct Gauge     budget usage calculations
 */

import type {
  Counter,
  Histogram,
  Meter,
  ObservableGauge,
  ObservableResult,
} from "@opentelemetry/api";

// =============================================================================
// Metric Emitter
// =============================================================================

export type MetricEmitter = {
  /** Record duration of an agent run. */
  recordRunDuration(agentId: string, durationMs: number): void;

  /** Record token usage (input/output). */
  recordTokens(agentId: string, inputTokens: number, outputTokens: number): void;

  /** Record cost in USD. */
  recordCost(agentId: string, costUsd: number): void;

  /** Record a tool call. */
  recordToolCall(agentId: string, toolName: string): void;

  /** Record a tool failure. */
  recordToolFailure(agentId: string, toolName: string): void;

  /** Record tool call duration. */
  recordToolDuration(agentId: string, toolName: string, durationMs: number): void;

  /** Record an inbound message. */
  recordMessageReceived(agentId: string, channel: string): void;

  /** Record an outbound message. */
  recordMessageSent(agentId: string, channel: string): void;

  /** Record an escalation trigger. */
  recordEscalation(agentId: string): void;

  /** Update budget utilization gauge for an agent. */
  updateBudgetUtilization(agentId: string, pct: number): void;
};

export function createMetricEmitter(meter: Meter): MetricEmitter {
  // Counters
  const runDuration: Histogram = meter.createHistogram("agent.run.duration_ms", {
    unit: "ms",
    description: "Agent run duration",
  });

  const tokensInput: Counter = meter.createCounter("agent.run.tokens.input", {
    unit: "1",
    description: "Input tokens consumed by agent runs",
  });

  const tokensOutput: Counter = meter.createCounter("agent.run.tokens.output", {
    unit: "1",
    description: "Output tokens produced by agent runs",
  });

  const costUsd: Counter = meter.createCounter("agent.run.cost_usd", {
    unit: "1",
    description: "Estimated cost in USD",
  });

  const toolCalls: Counter = meter.createCounter("agent.tool.calls", {
    unit: "1",
    description: "Total tool invocations",
  });

  const toolFailures: Counter = meter.createCounter("agent.tool.failures", {
    unit: "1",
    description: "Failed tool invocations",
  });

  const toolDuration: Histogram = meter.createHistogram("agent.tool.duration_ms", {
    unit: "ms",
    description: "Tool call duration",
  });

  const messageReceived: Counter = meter.createCounter("agent.message.received", {
    unit: "1",
    description: "Messages received by agents",
  });

  const messageSent: Counter = meter.createCounter("agent.message.sent", {
    unit: "1",
    description: "Messages sent by agents",
  });

  const escalationTriggered: Counter = meter.createCounter("agent.escalation.triggered", {
    unit: "1",
    description: "Escalation events triggered",
  });

  // Budget utilization gauge — stores latest value per agent
  const budgetValues = new Map<string, number>();
  const _budgetGauge: ObservableGauge = meter.createObservableGauge(
    "agent.budget.utilization_pct",
    {
      unit: "1",
      description: "Budget utilization percentage",
    },
  );
  _budgetGauge.addCallback((result: ObservableResult) => {
    for (const [agentId, pct] of budgetValues) {
      result.observe(pct, { "agent.id": agentId });
    }
  });

  return {
    recordRunDuration(agentId, durationMs) {
      runDuration.record(durationMs, { "agent.id": agentId });
    },

    recordTokens(agentId, input, output) {
      const attrs = { "agent.id": agentId };
      if (input > 0) tokensInput.add(input, attrs);
      if (output > 0) tokensOutput.add(output, attrs);
    },

    recordCost(agentId, cost) {
      if (cost > 0) costUsd.add(cost, { "agent.id": agentId });
    },

    recordToolCall(agentId, toolName) {
      toolCalls.add(1, { "agent.id": agentId, "tool.name": toolName });
    },

    recordToolFailure(agentId, toolName) {
      toolFailures.add(1, { "agent.id": agentId, "tool.name": toolName });
    },

    recordToolDuration(agentId, toolName, durationMs) {
      toolDuration.record(durationMs, { "agent.id": agentId, "tool.name": toolName });
    },

    recordMessageReceived(agentId, channel) {
      messageReceived.add(1, { "agent.id": agentId, "message.channel": channel });
    },

    recordMessageSent(agentId, channel) {
      messageSent.add(1, { "agent.id": agentId, "message.channel": channel });
    },

    recordEscalation(agentId) {
      escalationTriggered.add(1, { "agent.id": agentId });
    },

    updateBudgetUtilization(agentId, pct) {
      budgetValues.set(agentId, pct);
    },
  };
}
