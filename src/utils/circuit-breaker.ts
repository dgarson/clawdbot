export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  now?: () => number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private failures = 0;
  private openedAt = 0;
  private halfOpenTrialInFlight = false;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly now: () => number;

  constructor(options: CircuitBreakerOptions) {
    if (!Number.isFinite(options.failureThreshold) || options.failureThreshold < 1) {
      throw new Error("CircuitBreaker failureThreshold must be >= 1");
    }
    if (!Number.isFinite(options.resetTimeoutMs) || options.resetTimeoutMs < 1) {
      throw new Error("CircuitBreaker resetTimeoutMs must be >= 1");
    }

    this.failureThreshold = Math.floor(options.failureThreshold);
    this.resetTimeoutMs = Math.floor(options.resetTimeoutMs);
    this.now = options.now ?? Date.now;
  }

  public getState(): CircuitBreakerState {
    return this.state;
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.transitionOpenToHalfOpenIfReady();

    if (this.state === "OPEN") {
      throw new Error("CircuitBreaker is OPEN");
    }

    if (this.state === "HALF_OPEN") {
      if (this.halfOpenTrialInFlight) {
        throw new Error("CircuitBreaker is HALF_OPEN (trial in progress)");
      }

      this.halfOpenTrialInFlight = true;
      try {
        const result = await operation();
        this.close();
        return result;
      } catch (error) {
        this.open();
        throw error;
      } finally {
        if (this.state === "HALF_OPEN") {
          this.halfOpenTrialInFlight = false;
        }
      }
    }

    try {
      const result = await operation();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.failureThreshold) {
        this.open();
      }
      throw error;
    }
  }

  private transitionOpenToHalfOpenIfReady(): void {
    if (this.state !== "OPEN") {
      return;
    }

    if (this.now() - this.openedAt >= this.resetTimeoutMs) {
      this.state = "HALF_OPEN";
      this.halfOpenTrialInFlight = false;
    }
  }

  private open(): void {
    this.state = "OPEN";
    this.openedAt = this.now();
    this.failures = 0;
    this.halfOpenTrialInFlight = false;
  }

  private close(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.halfOpenTrialInFlight = false;
  }
}
