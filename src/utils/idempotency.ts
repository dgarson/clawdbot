import { createHash, randomUUID } from "node:crypto";

export const IDEMPOTENCY_STATE = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type IdempotencyState = (typeof IDEMPOTENCY_STATE)[keyof typeof IDEMPOTENCY_STATE];

export type IdempotencyEntry<T = unknown> = {
  key: string;
  state: IdempotencyState;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  value?: T;
  error?: unknown;
  pending?: Promise<T>;
};

export type IdempotencyTtlHook<T = unknown> = (params: {
  state: IdempotencyState;
  entry: Readonly<IdempotencyEntry<T>>;
}) => number;

export type IdempotencyStoreOptions<T = unknown> = {
  pendingTtlMs?: number;
  completedTtlMs?: number;
  failedTtlMs?: number;
  now?: () => number;
  ttlHook?: IdempotencyTtlHook<T>;
  onEvict?: (entry: Readonly<IdempotencyEntry<T>>, reason: "expired" | "manual") => void;
};

const DEFAULT_PENDING_TTL_MS = 60_000;
const DEFAULT_COMPLETED_TTL_MS = 5 * 60_000;
const DEFAULT_FAILED_TTL_MS = 60_000;

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).toSorted((a, b) => a.localeCompare(b));
  const fields = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(obj[key])}`);
  return `{${fields.join(",")}}`;
}

export function createIdempotencyKey(params?: {
  prefix?: string;
  parts?: unknown[];
  randomSuffix?: boolean;
}): string {
  const prefix = params?.prefix?.trim() || "idem";
  const parts = params?.parts ?? [];
  const base =
    parts.length === 0
      ? randomUUID()
      : createHash("sha256").update(stableSerialize(parts)).digest("hex").slice(0, 24);

  if (params?.randomSuffix) {
    return `${prefix}:${base}:${randomUUID()}`;
  }

  return `${prefix}:${base}`;
}

export class InMemoryIdempotencyStore<T = unknown> {
  private readonly records = new Map<string, IdempotencyEntry<T>>();

  private readonly pendingTtlMs: number;

  private readonly completedTtlMs: number;

  private readonly failedTtlMs: number;

  private readonly now: () => number;

  private readonly ttlHook?: IdempotencyTtlHook<T>;

  private readonly onEvict?: (
    entry: Readonly<IdempotencyEntry<T>>,
    reason: "expired" | "manual",
  ) => void;

  public constructor(options?: IdempotencyStoreOptions<T>) {
    this.pendingTtlMs = options?.pendingTtlMs ?? DEFAULT_PENDING_TTL_MS;
    this.completedTtlMs = options?.completedTtlMs ?? DEFAULT_COMPLETED_TTL_MS;
    this.failedTtlMs = options?.failedTtlMs ?? DEFAULT_FAILED_TTL_MS;
    this.now = options?.now ?? (() => Date.now());
    this.ttlHook = options?.ttlHook;
    this.onEvict = options?.onEvict;
  }

  public get size(): number {
    this.pruneExpired();
    return this.records.size;
  }

  public get(key: string): IdempotencyEntry<T> | undefined {
    this.pruneExpired();
    return this.records.get(key);
  }

  public delete(key: string): boolean {
    const record = this.records.get(key);
    if (!record) {
      return false;
    }
    this.records.delete(key);
    this.onEvict?.(record, "manual");
    return true;
  }

  public pruneExpired(now = this.now()): number {
    let removed = 0;
    for (const [key, entry] of this.records) {
      if (entry.expiresAt <= now) {
        this.records.delete(key);
        this.onEvict?.(entry, "expired");
        removed += 1;
      }
    }
    return removed;
  }

  public async run(
    key: string,
    work: () => Promise<T> | T,
  ): Promise<{ value: T; source: "executed" | "pending" | "completed" | "failed" }> {
    const existing = this.get(key);
    if (existing?.state === IDEMPOTENCY_STATE.COMPLETED) {
      return { value: existing.value as T, source: "completed" };
    }

    if (existing?.state === IDEMPOTENCY_STATE.PENDING && existing.pending) {
      return { value: await existing.pending, source: "pending" };
    }

    if (existing?.state === IDEMPOTENCY_STATE.FAILED) {
      if (existing.error instanceof Error) {
        throw existing.error;
      }
      const fallbackMessage = "idempotent operation previously failed";
      const message =
        typeof existing.error === "string"
          ? existing.error
          : typeof existing.error === "object" &&
              existing.error !== null &&
              "message" in existing.error &&
              typeof existing.error.message === "string"
            ? existing.error.message
            : fallbackMessage;
      throw new Error(message);
    }

    const now = this.now();
    const pendingRecord: IdempotencyEntry<T> = {
      key,
      state: IDEMPOTENCY_STATE.PENDING,
      createdAt: now,
      updatedAt: now,
      expiresAt: now,
    };

    const pendingPromise = Promise.resolve()
      .then(work)
      .then((value) => {
        this.transition(pendingRecord, IDEMPOTENCY_STATE.COMPLETED, { value });
        return value;
      })
      .catch((error: unknown) => {
        this.transition(pendingRecord, IDEMPOTENCY_STATE.FAILED, { error });
        throw error;
      });

    pendingRecord.pending = pendingPromise;
    this.transition(pendingRecord, IDEMPOTENCY_STATE.PENDING);
    this.records.set(key, pendingRecord);

    return { value: await pendingPromise, source: "executed" };
  }

  private transition(
    entry: IdempotencyEntry<T>,
    state: IdempotencyState,
    extra?: { value?: T; error?: unknown },
  ): void {
    entry.state = state;
    entry.updatedAt = this.now();

    if (state !== IDEMPOTENCY_STATE.PENDING) {
      delete entry.pending;
    }

    if (state === IDEMPOTENCY_STATE.COMPLETED) {
      entry.value = extra?.value as T;
      delete entry.error;
    } else if (state === IDEMPOTENCY_STATE.FAILED) {
      entry.error = extra?.error;
      delete entry.value;
    }

    entry.expiresAt = entry.updatedAt + this.resolveTtlMs(entry, state);
  }

  private resolveTtlMs(entry: IdempotencyEntry<T>, state: IdempotencyState): number {
    const fallback =
      state === IDEMPOTENCY_STATE.PENDING
        ? this.pendingTtlMs
        : state === IDEMPOTENCY_STATE.COMPLETED
          ? this.completedTtlMs
          : this.failedTtlMs;

    const hookValue = this.ttlHook?.({ state, entry });
    return Number.isFinite(hookValue) && (hookValue as number) >= 0
      ? (hookValue as number)
      : fallback;
  }
}
