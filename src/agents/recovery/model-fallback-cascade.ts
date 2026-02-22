export type RecoveryModelRef = {
  provider: string;
  model: string;
};

export type ModelPriorityConfig = {
  primary: RecoveryModelRef;
  fallbacks: readonly RecoveryModelRef[];
  priorityByModelKey?: Readonly<Record<string, number>>;
};

export type ModelCascadeCandidate = RecoveryModelRef & {
  key: string;
  priority: number;
  source: "primary" | "fallback";
};

export type ModelCascadeFailure = {
  candidate: ModelCascadeCandidate;
  attempt: number;
  reason: "execution_error" | "invalid_response";
  message: string;
  error?: unknown;
};

export type ModelFallbackCascadeResult<T> = {
  value: T;
  selected: ModelCascadeCandidate;
  failures: ModelCascadeFailure[];
};

export type ModelFallbackCascadeOptions<T> = {
  config: ModelPriorityConfig;
  runModel: (
    candidate: ModelCascadeCandidate,
    context: { attempt: number; total: number },
  ) => Promise<T>;
  isValidResponse?: (value: T, candidate: ModelCascadeCandidate) => boolean;
  onModelFailure?: (failure: ModelCascadeFailure) => void | Promise<void>;
};

export class ModelFallbackCascadeError extends Error {
  readonly failures: readonly ModelCascadeFailure[];

  constructor(message: string, failures: readonly ModelCascadeFailure[], cause?: unknown) {
    super(message, {
      cause: cause instanceof Error ? cause : undefined,
    });
    this.name = "ModelFallbackCascadeError";
    this.failures = failures;
  }
}

export function modelKey(ref: RecoveryModelRef): string {
  return `${ref.provider.trim().toLowerCase()}/${ref.model.trim().toLowerCase()}`;
}

function normalizeCandidate(
  ref: RecoveryModelRef,
  source: "primary" | "fallback",
  fallbackPriority: number,
  priorityByModelKey: Readonly<Record<string, number>>,
): ModelCascadeCandidate {
  const provider = ref.provider.trim();
  const model = ref.model.trim();
  const key = `${provider.toLowerCase()}/${model.toLowerCase()}`;
  const explicitPriority = priorityByModelKey[key];
  const priority =
    typeof explicitPriority === "number" && Number.isFinite(explicitPriority)
      ? explicitPriority
      : fallbackPriority;

  return {
    provider,
    model,
    key,
    priority,
    source,
  };
}

export function buildModelFallbackCascade(config: ModelPriorityConfig): ModelCascadeCandidate[] {
  const priorityByModelKey = config.priorityByModelKey ?? {};
  const primaryCandidate = normalizeCandidate(
    config.primary,
    "primary",
    Number.NEGATIVE_INFINITY,
    priorityByModelKey,
  );

  const fallbackSeen = new Set<string>();
  const fallbackCandidates = config.fallbacks
    .map((ref, index) => normalizeCandidate(ref, "fallback", index, priorityByModelKey))
    .filter((candidate) => {
      if (candidate.provider.length === 0 || candidate.model.length === 0) {
        return false;
      }
      if (fallbackSeen.has(candidate.key)) {
        return false;
      }
      fallbackSeen.add(candidate.key);
      return true;
    })
    .toSorted((a, b) => {
      if (a.priority === b.priority) {
        return a.key.localeCompare(b.key);
      }
      return a.priority - b.priority;
    });

  const cascade: ModelCascadeCandidate[] = [];
  const cascadeSeen = new Set<string>();

  if (primaryCandidate.provider.length > 0 && primaryCandidate.model.length > 0) {
    cascade.push(primaryCandidate);
    cascadeSeen.add(primaryCandidate.key);
  }

  for (const candidate of fallbackCandidates) {
    if (cascadeSeen.has(candidate.key)) {
      continue;
    }
    cascade.push(candidate);
    cascadeSeen.add(candidate.key);
  }

  return cascade;
}

export async function runModelFallbackCascade<T>(
  options: ModelFallbackCascadeOptions<T>,
): Promise<ModelFallbackCascadeResult<T>> {
  const cascade = buildModelFallbackCascade(options.config);
  if (cascade.length === 0) {
    throw new ModelFallbackCascadeError("No models configured for fallback cascade", []);
  }

  const failures: ModelCascadeFailure[] = [];
  let lastError: unknown;

  for (let index = 0; index < cascade.length; index += 1) {
    const candidate = cascade[index];
    if (!candidate) {
      continue;
    }
    const attempt = index + 1;

    try {
      const value = await options.runModel(candidate, { attempt, total: cascade.length });
      const isValid = options.isValidResponse?.(value, candidate) ?? true;
      if (!isValid) {
        const failure: ModelCascadeFailure = {
          candidate,
          attempt,
          reason: "invalid_response",
          message: `Model ${candidate.key} returned an invalid response`,
        };
        failures.push(failure);
        await options.onModelFailure?.(failure);
        continue;
      }

      return {
        value,
        selected: candidate,
        failures,
      };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const failure: ModelCascadeFailure = {
        candidate,
        attempt,
        reason: "execution_error",
        message,
        error,
      };
      failures.push(failure);
      await options.onModelFailure?.(failure);
    }
  }

  const summary = failures
    .map((failure) => `${failure.candidate.key}: ${failure.reason}`)
    .join(" | ");
  throw new ModelFallbackCascadeError(
    `All fallback models failed (${failures.length}/${cascade.length})${summary ? `: ${summary}` : ""}`,
    failures,
    lastError,
  );
}
