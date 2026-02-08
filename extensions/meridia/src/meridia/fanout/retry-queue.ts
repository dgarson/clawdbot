export type RetryQueueRunResult = {
  success: boolean;
  retryable?: boolean;
  error?: string;
};

export type RetryQueueEnqueueResult = {
  enqueued: boolean;
  duplicate?: boolean;
  reason?: "queue_full";
};

export type RetryQueueOptions = {
  concurrency?: number;
  maxQueueSize?: number;
  maxAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  jitterFactor?: number;
};

type QueueItem<T> = {
  key: string;
  payload: T;
  attempt: number;
};

const DEFAULT_OPTIONS: Required<RetryQueueOptions> = {
  concurrency: 2,
  maxQueueSize: 256,
  maxAttempts: 3,
  baseBackoffMs: 300,
  maxBackoffMs: 5_000,
  jitterFactor: 0.2,
};

function backoffDelayMs(attempt: number, opts: Required<RetryQueueOptions>): number {
  const exponential = Math.min(
    opts.maxBackoffMs,
    opts.baseBackoffMs * 2 ** Math.max(0, attempt - 1),
  );
  const jitter = 1 + (Math.random() * 2 - 1) * opts.jitterFactor;
  return Math.max(0, Math.round(exponential * jitter));
}

export class RetryQueue<T> {
  private readonly options: Required<RetryQueueOptions>;
  private readonly queue: QueueItem<T>[] = [];
  private readonly pendingKeys = new Set<string>();
  private activeWorkers = 0;

  constructor(
    private readonly runner: (payload: T) => Promise<RetryQueueRunResult>,
    options?: RetryQueueOptions,
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
  }

  enqueue(key: string, payload: T): RetryQueueEnqueueResult {
    if (this.pendingKeys.has(key)) {
      return { enqueued: true, duplicate: true };
    }

    if (this.queue.length >= this.options.maxQueueSize) {
      return { enqueued: false, reason: "queue_full" };
    }

    this.pendingKeys.add(key);
    this.queue.push({ key, payload, attempt: 1 });
    this.drain();
    return { enqueued: true, duplicate: false };
  }

  getState(): {
    queued: number;
    inFlight: number;
    pendingKeys: number;
  } {
    return {
      queued: this.queue.length,
      inFlight: this.activeWorkers,
      pendingKeys: this.pendingKeys.size,
    };
  }

  private drain(): void {
    while (this.activeWorkers < this.options.concurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) {
        break;
      }
      this.activeWorkers += 1;
      void this.runItem(next);
    }
  }

  private async runItem(item: QueueItem<T>): Promise<void> {
    try {
      const outcome = await this.runner(item.payload);
      if (outcome.success) {
        this.pendingKeys.delete(item.key);
        return;
      }

      const canRetry = outcome.retryable !== false && item.attempt < this.options.maxAttempts;
      if (!canRetry) {
        this.pendingKeys.delete(item.key);
        return;
      }

      const delayMs = backoffDelayMs(item.attempt, this.options);
      setTimeout(() => {
        this.queue.push({
          key: item.key,
          payload: item.payload,
          attempt: item.attempt + 1,
        });
        this.drain();
      }, delayMs);
    } catch {
      const canRetry = item.attempt < this.options.maxAttempts;
      if (!canRetry) {
        this.pendingKeys.delete(item.key);
        return;
      }
      const delayMs = backoffDelayMs(item.attempt, this.options);
      setTimeout(() => {
        this.queue.push({
          key: item.key,
          payload: item.payload,
          attempt: item.attempt + 1,
        });
        this.drain();
      }, delayMs);
    } finally {
      this.activeWorkers = Math.max(0, this.activeWorkers - 1);
      this.drain();
    }
  }
}
