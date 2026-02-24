import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("agents/tool-reliability");

export interface CircuitBreakerConfig {
  maxFailures: number;
  resetTimeoutMs: number;
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private failures = 0;
  private state: CircuitState = "CLOSED";
  private nextAttemptMs = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly name: string;

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name;
    this.config = config;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error(`CircuitBreaker [${this.name}] is OPEN. Call blocked.`);
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private isOpen(): boolean {
    if (this.state === "OPEN") {
      if (Date.now() > this.nextAttemptMs) {
        this.state = "HALF_OPEN";
        return false;
      }
      return true;
    }
    return false;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.failures++;
    if (this.failures >= this.config.maxFailures) {
      this.state = "OPEN";
      this.nextAttemptMs = Date.now() + this.config.resetTimeoutMs;
      log.warn({ circuit: this.name, failures: this.failures }, "Circuit breaker opened");
    }
  }
}

export interface IdempotencyConfig {
  ttlMs: number;
}

export class IdempotencyGuard {
  private cache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly config: IdempotencyConfig;

  constructor(config: IdempotencyConfig) {
    this.config = config;
  }

  public async execute<T>(key: string, action: () => Promise<T>): Promise<T> {
    this.cleanup();
    const cached = this.cache.get(key);
    if (cached) {
      log.debug({ key }, "Idempotency cache hit");
      return cached.value as T;
    }

    const result = await action();
    this.cache.set(key, {
      value: result,
      expiresAt: Date.now() + this.config.ttlMs,
    });
    return result;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
