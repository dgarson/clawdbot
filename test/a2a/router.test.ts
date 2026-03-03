/**
 * Agent-to-Agent (A2A) Communication Protocol — Router Tests
 *
 * Tests for the message router, rate limiter, and circuit breaker.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { A2AMessage } from "../../src/gateway/a2a/types.js";
import { A2ACircuitBreaker } from "../../src/gateway/a2a/circuit-breaker.js";
import { A2ARateLimiter } from "../../src/gateway/a2a/rate-limiter.js";
import {
  A2ARouter,
  type DeliverFn,
  type AuditFn,
  type ValidateFn,
} from "../../src/gateway/a2a/router.js";

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeMessage(overrides: Partial<A2AMessage> = {}): A2AMessage {
  return {
    protocol: "openclaw.a2a.v1",
    messageId: `msg-${Math.random().toString(36).slice(2)}`,
    timestamp: "2026-02-21T18:30:00.000Z",
    from: { agentId: "alice", role: "Engineer" },
    to: { agentId: "bob", role: "Reviewer" },
    type: "task_request",
    priority: "normal",
    payload: { taskId: "task-001" },
    ...overrides,
  };
}

function successDeliver(): DeliverFn {
  return vi.fn(async () => ({ delivered: true }));
}

function failDeliver(error?: string): DeliverFn {
  return vi.fn(async () => ({ delivered: false, error }));
}

function throwDeliver(error: string): DeliverFn {
  return vi.fn(async () => {
    throw new Error(error);
  });
}

function mockAudit(): AuditFn & { mock: { calls: unknown[][] } } {
  return vi.fn(async () => {}) as AuditFn & { mock: { calls: unknown[][] } };
}

function passThroughValidator(): ValidateFn {
  return (input: unknown) => ({ valid: true as const, message: input as A2AMessage });
}

function failingValidator(): ValidateFn {
  return () => ({
    valid: false as const,
    errors: [{ path: "/type", message: "Invalid type", rule: "enum" }],
  });
}

// ─── Rate Limiter Tests ──────────────────────────────────────────────────────

describe("A2ARateLimiter", () => {
  let limiter: A2ARateLimiter;

  beforeEach(() => {
    limiter = new A2ARateLimiter({ maxPerWindow: 5, windowMs: 1000 });
  });

  it("allows messages within the limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = limiter.check("alice");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it("blocks messages exceeding the limit", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("alice");
    }
    const result = limiter.check("alice");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks agents independently", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("alice");
    }
    const aliceResult = limiter.check("alice");
    const bobResult = limiter.check("bob");
    expect(aliceResult.allowed).toBe(false);
    expect(bobResult.allowed).toBe(true);
  });

  it("resets after window expires", () => {
    const now = 1000;
    for (let i = 0; i < 5; i++) {
      limiter.check("alice", now);
    }
    expect(limiter.check("alice", now).allowed).toBe(false);
    // After window expires
    expect(limiter.check("alice", now + 1001).allowed).toBe(true);
  });

  it("reset() clears a specific agent", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("alice");
    }
    expect(limiter.check("alice").allowed).toBe(false);
    limiter.reset("alice");
    expect(limiter.check("alice").allowed).toBe(true);
  });

  it("clear() clears all agents", () => {
    limiter.check("alice");
    limiter.check("bob");
    expect(limiter.size).toBe(2);
    limiter.clear();
    expect(limiter.size).toBe(0);
  });

  it("prune() removes expired windows", () => {
    const now = 1000;
    limiter.check("alice", now);
    limiter.check("bob", now);
    expect(limiter.size).toBe(2);
    limiter.prune(now + 2000);
    expect(limiter.size).toBe(0);
  });
});

// ─── Circuit Breaker Tests ───────────────────────────────────────────────────

describe("A2ACircuitBreaker", () => {
  let breaker: A2ACircuitBreaker;

  beforeEach(() => {
    breaker = new A2ACircuitBreaker({
      maxCorrelationDepth: 5,
      maxPairMessagesPerWindow: 10,
      windowMs: 1000,
      cooldownMs: 5000,
    });
  });

  it("allows messages under limits", () => {
    const result = breaker.check("alice", "bob", "corr-1");
    expect(result.allowed).toBe(true);
    expect(result.state).toBe("closed");
  });

  it("trips when correlation depth exceeds max", () => {
    for (let i = 0; i < 5; i++) {
      expect(breaker.check("alice", "bob", "corr-deep").allowed).toBe(true);
    }
    const result = breaker.check("alice", "bob", "corr-deep");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeded max depth");
    expect(result.state).toBe("open");
  });

  it("trips when pair message rate exceeds max", () => {
    const now = 1000;
    for (let i = 0; i < 10; i++) {
      expect(breaker.check("alice", "bob", null, now).allowed).toBe(true);
    }
    const result = breaker.check("alice", "bob", null, now);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeded");
    expect(result.state).toBe("open");
  });

  it("pair detection is order-independent (A→B same as B→A)", () => {
    const now = 1000;
    for (let i = 0; i < 5; i++) {
      breaker.check("alice", "bob", null, now);
    }
    for (let i = 0; i < 5; i++) {
      breaker.check("bob", "alice", null, now);
    }
    // 10 total — should trip on 11th
    const result = breaker.check("alice", "bob", null, now);
    expect(result.allowed).toBe(false);
  });

  it("blocks all messages while circuit is open (cooldown)", () => {
    const now = 1000;
    // Trip the circuit
    for (let i = 0; i <= 10; i++) {
      breaker.check("alice", "bob", null, now);
    }
    // Should be blocked during cooldown
    expect(breaker.check("alice", "bob", null, now + 1000).allowed).toBe(false);
    expect(breaker.check("alice", "bob", null, now + 4999).allowed).toBe(false);
    // After cooldown, should work again
    expect(breaker.check("alice", "bob", null, now + 5001).allowed).toBe(true);
  });

  it("getState returns circuit state", () => {
    expect(breaker.getState("alice", "bob")).toBe("closed");
    // Trip it
    for (let i = 0; i <= 10; i++) {
      breaker.check("alice", "bob");
    }
    expect(breaker.getState("alice", "bob")).toBe("open");
  });

  it("resetCircuit manually closes the circuit", () => {
    for (let i = 0; i <= 10; i++) {
      breaker.check("alice", "bob");
    }
    expect(breaker.getState("alice", "bob")).toBe("open");
    breaker.resetCircuit("alice", "bob");
    expect(breaker.getState("alice", "bob")).toBe("closed");
  });

  it("different agent pairs are independent", () => {
    for (let i = 0; i <= 10; i++) {
      breaker.check("alice", "bob");
    }
    expect(breaker.check("alice", "bob").allowed).toBe(false);
    expect(breaker.check("alice", "charlie").allowed).toBe(true);
  });
});

// ─── Router Tests ────────────────────────────────────────────────────────────

describe("A2ARouter", () => {
  it("routes a valid message successfully", async () => {
    const deliver = successDeliver();
    const router = new A2ARouter({ deliver });
    const msg = makeMessage();

    const result = await router.route(msg);

    expect(result.status).toBe("delivered");
    expect(result.messageId).toBe(msg.messageId);
    expect(deliver).toHaveBeenCalledWith("bob", msg);
  });

  it("applies validation when validator is provided", async () => {
    const deliver = successDeliver();
    const validate = failingValidator();
    const router = new A2ARouter({ deliver, validate });

    const result = await router.route({ bad: "message" });

    expect(result.status).toBe("validation_failed");
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("passes validation result through to delivery", async () => {
    const deliver = successDeliver();
    const validate = passThroughValidator();
    const router = new A2ARouter({ deliver, validate });
    const msg = makeMessage();

    const result = await router.route(msg);
    expect(result.status).toBe("delivered");
  });

  it("rejects self-send by default", async () => {
    const deliver = successDeliver();
    const router = new A2ARouter({ deliver });
    const msg = makeMessage({
      from: { agentId: "alice", role: "Engineer" },
      to: { agentId: "alice", role: "Engineer" },
    });

    const result = await router.route(msg);

    expect(result.status).toBe("self_send_rejected");
    expect(deliver).not.toHaveBeenCalled();
  });

  it("allows self-send when configured", async () => {
    const deliver = successDeliver();
    const router = new A2ARouter({ deliver, allowSelfSend: true });
    const msg = makeMessage({
      from: { agentId: "alice", role: "Engineer" },
      to: { agentId: "alice", role: "Engineer" },
    });

    const result = await router.route(msg);
    expect(result.status).toBe("delivered");
  });

  it("rate limits after exceeding max messages", async () => {
    const deliver = successDeliver();
    const router = new A2ARouter({
      deliver,
      rateLimiter: { maxPerWindow: 3, windowMs: 60000 },
    });

    for (let i = 0; i < 3; i++) {
      const result = await router.route(makeMessage());
      expect(result.status).toBe("delivered");
    }

    const result = await router.route(makeMessage());
    expect(result.status).toBe("rate_limited");
    expect(result.error).toContain("rate limit");
  });

  it("trips circuit breaker on pair message flood", async () => {
    const deliver = successDeliver();
    const router = new A2ARouter({
      deliver,
      circuitBreaker: {
        maxPairMessagesPerWindow: 3,
        windowMs: 60000,
        cooldownMs: 30000,
        maxCorrelationDepth: 50,
      },
    });

    for (let i = 0; i < 3; i++) {
      await router.route(makeMessage());
    }

    const result = await router.route(makeMessage());
    expect(result.status).toBe("circuit_open");
    expect(result.error).toContain("exceeded");
  });

  it("handles delivery failure", async () => {
    const deliver = failDeliver("Agent not found");
    const router = new A2ARouter({ deliver });

    const result = await router.route(makeMessage());

    expect(result.status).toBe("delivery_failed");
    expect(result.error).toContain("Agent not found");
  });

  it("handles delivery exception", async () => {
    const deliver = throwDeliver("Connection timeout");
    const router = new A2ARouter({ deliver });

    const result = await router.route(makeMessage());

    expect(result.status).toBe("delivery_failed");
    expect(result.error).toContain("Connection timeout");
  });

  it("calls audit function on successful delivery", async () => {
    const deliver = successDeliver();
    const audit = mockAudit();
    const router = new A2ARouter({ deliver, audit });
    const msg = makeMessage();

    await router.route(msg);

    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][0]).toBe(msg);
    expect(audit.mock.calls[0][1]).toMatchObject({ status: "delivered" });
  });

  it("calls audit function on rate limit", async () => {
    const deliver = successDeliver();
    const audit = mockAudit();
    const router = new A2ARouter({
      deliver,
      audit,
      rateLimiter: { maxPerWindow: 1, windowMs: 60000 },
    });

    await router.route(makeMessage());
    await router.route(makeMessage());

    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls[1][1]).toMatchObject({ status: "rate_limited" });
  });

  it("does not break routing if audit throws", async () => {
    const deliver = successDeliver();
    const audit = vi.fn(async () => {
      throw new Error("Audit DB down");
    }) as AuditFn;
    const router = new A2ARouter({ deliver, audit });

    const result = await router.route(makeMessage());
    expect(result.status).toBe("delivered");
  });

  it("tracks metrics correctly", async () => {
    const deliver = successDeliver();
    const router = new A2ARouter({
      deliver,
      rateLimiter: { maxPerWindow: 2, windowMs: 60000 },
    });

    await router.route(makeMessage());
    await router.route(makeMessage());
    await router.route(makeMessage()); // rate limited

    expect(router.metrics.totalRouted).toBe(3);
    expect(router.metrics.totalDelivered).toBe(2);
    expect(router.metrics.totalRateLimited).toBe(1);
  });

  it("reset() clears all state and metrics", async () => {
    const deliver = successDeliver();
    const router = new A2ARouter({ deliver });

    await router.route(makeMessage());
    expect(router.metrics.totalRouted).toBe(1);

    router.reset();
    expect(router.metrics.totalRouted).toBe(0);
    expect(router.metrics.totalDelivered).toBe(0);
  });

  it("provides rate limit info in successful response", async () => {
    const deliver = successDeliver();
    const router = new A2ARouter({
      deliver,
      rateLimiter: { maxPerWindow: 10, windowMs: 60000 },
    });

    const result = await router.route(makeMessage());
    expect(result.rateLimitRemaining).toBeDefined();
    expect(result.rateLimitRemaining).toBe(9);
  });
});
