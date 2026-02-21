/**
 * Agent-to-Agent (A2A) Communication Protocol — Message Router
 *
 * Receives A2A messages, validates them, applies rate limiting and
 * circuit breaker protection, routes to target agent, and logs to audit.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

import type { A2AMessage } from "./types.js";
import { A2ACircuitBreaker, type CircuitBreakerConfig } from "./circuit-breaker.js";
import { A2ARateLimiter, type RateLimitConfig } from "./rate-limiter.js";

// ─── Delivery Interface ──────────────────────────────────────────────────────

/**
 * Pluggable delivery function. The router calls this to actually deliver
 * the message to the target agent. In production, this hooks into the
 * existing sessions_send infrastructure.
 */
export type DeliverFn = (targetAgentId: string, message: A2AMessage) => Promise<DeliveryResult>;

export interface DeliveryResult {
  delivered: boolean;
  error?: string;
}

/**
 * Pluggable audit function. Called after every routing attempt.
 */
export type AuditFn = (message: A2AMessage, result: RouteResult) => Promise<void>;

/**
 * Pluggable validation function. Returns null if valid, or error string.
 */
export type ValidateFn = (
  message: unknown,
) =>
  | { valid: true; message: A2AMessage }
  | { valid: false; errors: Array<{ path: string; message: string; rule: string }> };

// ─── Route Result ────────────────────────────────────────────────────────────

export type RouteStatus =
  | "delivered"
  | "validation_failed"
  | "rate_limited"
  | "circuit_open"
  | "delivery_failed"
  | "self_send_rejected";

export interface RouteResult {
  status: RouteStatus;
  messageId?: string;
  error?: string;
  errors?: Array<{ path: string; message: string; rule: string }>;
  rateLimitRemaining?: number;
  rateLimitResetMs?: number;
}

// ─── Router Config ───────────────────────────────────────────────────────────

export interface A2ARouterConfig {
  /** Custom rate limiter config */
  rateLimiter?: Partial<RateLimitConfig>;
  /** Custom circuit breaker config */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Message delivery function */
  deliver: DeliverFn;
  /** Optional audit logging function */
  audit?: AuditFn;
  /** Optional message validation function (from Workstream A) */
  validate?: ValidateFn;
  /** Allow agents to send messages to themselves? (default: false) */
  allowSelfSend?: boolean;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export class A2ARouter {
  private readonly rateLimiter: A2ARateLimiter;
  private readonly circuitBreaker: A2ACircuitBreaker;
  private readonly deliver: DeliverFn;
  private readonly audit?: AuditFn;
  private readonly validate?: ValidateFn;
  private readonly allowSelfSend: boolean;

  /** Metrics counters */
  readonly metrics = {
    totalRouted: 0,
    totalDelivered: 0,
    totalFailed: 0,
    totalRateLimited: 0,
    totalCircuitOpen: 0,
    totalValidationFailed: 0,
  };

  constructor(config: A2ARouterConfig) {
    this.rateLimiter = new A2ARateLimiter(config.rateLimiter);
    this.circuitBreaker = new A2ACircuitBreaker(config.circuitBreaker);
    this.deliver = config.deliver;
    this.audit = config.audit;
    this.validate = config.validate;
    this.allowSelfSend = config.allowSelfSend ?? false;
  }

  /**
   * Route an A2A message from sender to recipient.
   *
   * Pipeline:
   * 1. Validate message schema (if validator provided)
   * 2. Check self-send
   * 3. Check rate limit (sender)
   * 4. Check circuit breaker (sender↔recipient pair)
   * 5. Deliver to target agent
   * 6. Audit log the result
   */
  async route(input: unknown): Promise<RouteResult> {
    this.metrics.totalRouted++;

    // Step 1: Validate
    let message: A2AMessage;
    if (this.validate) {
      const validationResult = this.validate(input);
      if (!validationResult.valid) {
        this.metrics.totalValidationFailed++;
        const result: RouteResult = {
          status: "validation_failed",
          error: "Message validation failed",
          errors: validationResult.errors,
        };
        return result;
      }
      message = validationResult.message;
    } else {
      // No validator — trust the input (dangerous, but allows incremental integration)
      message = input as A2AMessage;
    }

    const fromAgent = message.from.agentId;
    const toAgent = message.to.agentId;

    // Step 2: Self-send check
    if (!this.allowSelfSend && fromAgent === toAgent) {
      this.metrics.totalFailed++;
      const result: RouteResult = {
        status: "self_send_rejected",
        messageId: message.messageId,
        error: `Agent "${fromAgent}" cannot send messages to itself`,
      };
      await this.auditResult(message, result);
      return result;
    }

    // Step 3: Rate limit
    const rateCheck = this.rateLimiter.check(fromAgent);
    if (!rateCheck.allowed) {
      this.metrics.totalRateLimited++;
      const result: RouteResult = {
        status: "rate_limited",
        messageId: message.messageId,
        error: `Agent "${fromAgent}" has exceeded the message rate limit. Reset in ${Math.ceil(rateCheck.resetMs / 1000)}s.`,
        rateLimitRemaining: rateCheck.remaining,
        rateLimitResetMs: rateCheck.resetMs,
      };
      await this.auditResult(message, result);
      return result;
    }

    // Step 4: Circuit breaker
    const circuitCheck = this.circuitBreaker.check(fromAgent, toAgent, message.correlationId);
    if (!circuitCheck.allowed) {
      this.metrics.totalCircuitOpen++;
      const result: RouteResult = {
        status: "circuit_open",
        messageId: message.messageId,
        error: circuitCheck.reason,
      };
      await this.auditResult(message, result);
      return result;
    }

    // Step 5: Deliver
    try {
      const deliveryResult = await this.deliver(toAgent, message);
      if (deliveryResult.delivered) {
        this.metrics.totalDelivered++;
        const result: RouteResult = {
          status: "delivered",
          messageId: message.messageId,
          rateLimitRemaining: rateCheck.remaining,
          rateLimitResetMs: rateCheck.resetMs,
        };
        await this.auditResult(message, result);
        return result;
      } else {
        this.metrics.totalFailed++;
        const result: RouteResult = {
          status: "delivery_failed",
          messageId: message.messageId,
          error: deliveryResult.error ?? "Delivery failed (unknown reason)",
        };
        await this.auditResult(message, result);
        return result;
      }
    } catch (err) {
      this.metrics.totalFailed++;
      const result: RouteResult = {
        status: "delivery_failed",
        messageId: message.messageId,
        error: `Delivery error: ${err instanceof Error ? err.message : String(err)}`,
      };
      await this.auditResult(message, result);
      return result;
    }
  }

  private async auditResult(message: A2AMessage, result: RouteResult): Promise<void> {
    if (this.audit) {
      try {
        await this.audit(message, result);
      } catch {
        // Audit failure should not break routing
      }
    }
  }

  /** Get the rate limiter instance (for testing/admin). */
  getRateLimiter(): A2ARateLimiter {
    return this.rateLimiter;
  }

  /** Get the circuit breaker instance (for testing/admin). */
  getCircuitBreaker(): A2ACircuitBreaker {
    return this.circuitBreaker;
  }

  /** Reset all state (rate limits, circuit breakers, metrics). */
  reset(): void {
    this.rateLimiter.clear();
    this.circuitBreaker.clear();
    this.metrics.totalRouted = 0;
    this.metrics.totalDelivered = 0;
    this.metrics.totalFailed = 0;
    this.metrics.totalRateLimited = 0;
    this.metrics.totalCircuitOpen = 0;
    this.metrics.totalValidationFailed = 0;
  }
}
