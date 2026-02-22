export type RetryFailureType = "rate_limit" | "network" | "timeout" | "server" | "unknown";

export type RetryAttemptContext = {
  attempt: number;
  maxAttempts: number;
};

export type RetryDelayContext = RetryAttemptContext & {
  baseDelayMs: number;
  jitterRatio: number;
};

export type RetryWithBackoffOptions<T> = {
  execute: (context: RetryAttemptContext) => Promise<T>;
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitterRatio?: number;
  classifyError?: (error: unknown) => RetryFailureType;
  shouldRetry?: (
    error: unknown,
    context: RetryAttemptContext,
    failureType: RetryFailureType,
  ) => boolean;
  onRetry?: (event: RetryRetryEvent) => void | Promise<void>;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
};

export type RetryRetryEvent = RetryAttemptContext & {
  delayMs: number;
  error: unknown;
  failureType: RetryFailureType;
};

export type RetryWithBackoffResult<T> = {
  value: T;
  attempts: number;
  totalDelayMs: number;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_JITTER_RATIO = 0.2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readErrorField(error: unknown, key: string): unknown {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  return record[key];
}

function resolveNumericErrorField(error: unknown, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const candidate = readErrorField(error, key);
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function resolveStringErrorField(error: unknown, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const candidate = readErrorField(error, key);
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return undefined;
}

export function classifyRetryFailure(error: unknown): RetryFailureType {
  const status = resolveNumericErrorField(error, ["status", "statusCode", "httpStatus"]);
  if (status === 429) {
    return "rate_limit";
  }
  if (status === 408) {
    return "timeout";
  }
  if (typeof status === "number" && status >= 500 && status <= 599) {
    return "server";
  }

  const code = (resolveStringErrorField(error, ["code", "errno"]) ?? "").toUpperCase();
  if (
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT" ||
    code === "ECONNABORTED" ||
    code === "UND_ERR_CONNECT_TIMEOUT"
  ) {
    return "timeout";
  }
  if (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ENETUNREACH" ||
    code === "EHOSTUNREACH" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN"
  ) {
    return "network";
  }

  const name = (resolveStringErrorField(error, ["name"]) ?? "").toLowerCase();
  if (name.includes("timeout") || name === "aborterror") {
    return "timeout";
  }

  const message = (
    error instanceof Error ? error.message : (resolveStringErrorField(error, ["message"]) ?? "")
  )
    .toLowerCase()
    .trim();

  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "rate_limit";
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  if (
    message.includes("network") ||
    message.includes("connection reset") ||
    message.includes("failed to fetch")
  ) {
    return "network";
  }

  return "unknown";
}

export function isTransientRetryFailure(error: unknown): boolean {
  const kind = classifyRetryFailure(error);
  return kind === "rate_limit" || kind === "network" || kind === "timeout" || kind === "server";
}

export function computeExponentialBackoffDelayMs(context: RetryDelayContext): number {
  const jitterRatio = clamp(context.jitterRatio, 0, 1);
  const delay = Math.max(0, context.baseDelayMs);
  const randomOffset = (Math.random() * 2 - 1) * jitterRatio;
  return Math.max(0, Math.round(delay * (1 + randomOffset)));
}

export async function retryWithBackoff<T>(
  options: RetryWithBackoffOptions<T>,
): Promise<RetryWithBackoffResult<T>> {
  const maxRetries = Math.max(
    0,
    Math.round(normalizeFiniteNumber(options.maxRetries, DEFAULT_MAX_RETRIES)),
  );
  const maxAttempts = maxRetries + 1;
  const initialDelayMs = Math.max(
    0,
    Math.round(normalizeFiniteNumber(options.initialDelayMs, DEFAULT_INITIAL_DELAY_MS)),
  );
  const maxDelayMs = Math.max(
    initialDelayMs,
    Math.round(normalizeFiniteNumber(options.maxDelayMs, DEFAULT_MAX_DELAY_MS)),
  );
  const backoffMultiplier = Math.max(
    1,
    normalizeFiniteNumber(options.backoffMultiplier, DEFAULT_BACKOFF_MULTIPLIER),
  );
  const jitterRatio = clamp(normalizeFiniteNumber(options.jitterRatio, DEFAULT_JITTER_RATIO), 0, 1);
  const random = options.random ?? Math.random;
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, Math.max(0, delayMs));
      }));
  const classifyError = options.classifyError ?? classifyRetryFailure;
  const shouldRetry =
    options.shouldRetry ??
    ((error: unknown, _context: RetryAttemptContext, failureType: RetryFailureType) => {
      if (failureType !== "unknown") {
        return true;
      }
      return isTransientRetryFailure(error);
    });

  let totalDelayMs = 0;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await options.execute({ attempt, maxAttempts });
      return {
        value,
        attempts: attempt,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error;
      const failureType = classifyError(error);
      const context: RetryAttemptContext = { attempt, maxAttempts };

      if (attempt >= maxAttempts || !shouldRetry(error, context, failureType)) {
        break;
      }

      const uncappedDelay = initialDelayMs * backoffMultiplier ** (attempt - 1);
      const baseDelayMs = Math.min(maxDelayMs, Math.round(uncappedDelay));
      const randomOffset = (random() * 2 - 1) * jitterRatio;
      const delayMs = Math.max(0, Math.round(baseDelayMs * (1 + randomOffset)));

      await options.onRetry?.({
        attempt,
        maxAttempts,
        delayMs,
        error,
        failureType,
      });
      totalDelayMs += delayMs;
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error("retryWithBackoff failed without an error");
}
