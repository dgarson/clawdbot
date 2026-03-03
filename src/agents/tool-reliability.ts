import { createSubsystemLogger } from "../logging/subsystem.js";
import { CircuitBreaker as SharedCircuitBreaker } from "../utils/circuit-breaker.js";
import { InMemoryIdempotencyStore } from "../utils/idempotency.js";

const log = createSubsystemLogger("agents/tool-reliability");

export interface CircuitBreakerConfig {
  maxFailures: number;
  resetTimeoutMs: number;
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Agent-facing circuit breaker wrapper.
 *
 * Integration ownership: all core reliability behavior lives in src/utils.
 * This layer only adapts naming/logging for agent tool-call surfaces.
 */
export class CircuitBreaker {
  private readonly breaker: SharedCircuitBreaker;

  private readonly name: string;

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name;
    this.breaker = new SharedCircuitBreaker({
      failureThreshold: config.maxFailures,
      resetTimeoutMs: config.resetTimeoutMs,
    });
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const previousState = this.breaker.getState();

    try {
      const result = await this.breaker.execute(action);
      this.logStateTransition(previousState, this.breaker.getState());
      return result;
    } catch (error) {
      const nextState = this.breaker.getState();
      this.logStateTransition(previousState, nextState);

      if (error instanceof Error && error.message === "CircuitBreaker is OPEN") {
        throw new Error(`CircuitBreaker [${this.name}] is OPEN. Call blocked.`, { cause: error });
      }

      throw error;
    }
  }

  private logStateTransition(previousState: CircuitState, nextState: CircuitState): void {
    if (previousState === nextState) {
      return;
    }

    if (nextState === "OPEN") {
      log.warn({ circuit: this.name }, "Circuit breaker opened");
      return;
    }

    log.debug(
      { circuit: this.name, from: previousState, to: nextState },
      "Circuit breaker state transition",
    );
  }
}

export interface IdempotencyConfig {
  ttlMs: number;
}

/**
 * Agent-facing idempotency wrapper around shared primitives.
 */
export class IdempotencyGuard {
  private readonly store: InMemoryIdempotencyStore;

  constructor(config: IdempotencyConfig) {
    this.store = new InMemoryIdempotencyStore({
      pendingTtlMs: config.ttlMs,
      completedTtlMs: config.ttlMs,
      failedTtlMs: config.ttlMs,
    });
  }

  public async execute<T>(key: string, action: () => Promise<T>): Promise<T> {
    const result = await this.store.run(key, action);

    if (result.source !== "executed") {
      log.debug({ key, source: result.source }, "Idempotency cache hit");
    }

    return result.value as T;
  }
}
