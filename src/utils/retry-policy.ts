export interface RetryPolicyOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  isRetriableError?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 5_000;
const DEFAULT_JITTER_RATIO = 0.2;

const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const clampToNonNegativeInt = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return Math.floor(value);
};

const clampToPositiveInt = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
};

export class RetryPolicy {
  private readonly maxRetries: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly isRetriableError: (error: unknown) => boolean;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(options: RetryPolicyOptions = {}) {
    this.maxRetries = clampToNonNegativeInt(
      options.maxRetries ?? DEFAULT_MAX_RETRIES,
      DEFAULT_MAX_RETRIES,
    );
    this.initialDelayMs = clampToPositiveInt(
      options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS,
      DEFAULT_INITIAL_DELAY_MS,
    );
    this.maxDelayMs = Math.max(
      this.initialDelayMs,
      clampToPositiveInt(options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS, DEFAULT_MAX_DELAY_MS),
    );
    this.isRetriableError = options.isRetriableError ?? (() => true);
    this.sleep = options.sleep ?? sleepMs;
    this.random = options.random ?? Math.random;
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const shouldRetry = attempt < this.maxRetries && this.isRetriableError(error);
        if (!shouldRetry) {
          throw error;
        }

        const delayMs = this.computeDelayMs(attempt);
        await this.sleep(delayMs);
      }
    }

    throw lastError ?? new Error("RetryPolicy exhausted");
  }

  private computeDelayMs(attempt: number): number {
    const exponential = this.initialDelayMs * 2 ** attempt;
    const capped = Math.min(this.maxDelayMs, exponential);
    const jitterOffset = (this.random() * 2 - 1) * DEFAULT_JITTER_RATIO * capped;
    return Math.max(0, Math.round(capped + jitterOffset));
  }
}
