export enum ToolCircuitState {
  Closed = "closed",
  Open = "open",
  HalfOpen = "half-open",
}

export type ToolCircuitBreakerConfig = {
  name: string;
  windowMs: number;
  minimumCalls: number;
  failureRateThreshold: number;
  consecutiveFailureThreshold: number;
  openDurationMs: number;
  halfOpenProbeCount: number;
  halfOpenSuccessThreshold: number;
};

type CallOutcome = {
  timestamp: number;
  success: boolean;
  latencyMs: number;
};

export class ToolCircuitBreaker {
  private state: ToolCircuitState = ToolCircuitState.Closed;
  private outcomes: CallOutcome[] = [];
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenProbeResults: boolean[] = [];

  constructor(private readonly config: ToolCircuitBreakerConfig) {}

  get currentState(): ToolCircuitState {
    return this.state;
  }

  allowCall(now: number = Date.now()): boolean {
    this.pruneWindow(now);

    switch (this.state) {
      case ToolCircuitState.Closed:
        return true;
      case ToolCircuitState.Open: {
        const elapsed = now - this.openedAt;
        if (elapsed >= this.config.openDurationMs) {
          this.transitionTo(ToolCircuitState.HalfOpen, now);
          return true;
        }
        return false;
      }
      case ToolCircuitState.HalfOpen:
        return this.halfOpenProbeResults.length < this.config.halfOpenProbeCount;
    }
  }

  recordOutcome(success: boolean, latencyMs: number, now: number = Date.now()): void {
    this.outcomes.push({ timestamp: now, success, latencyMs });

    if (success) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures += 1;
    }

    switch (this.state) {
      case ToolCircuitState.Closed:
        this.evaluateTrip(now);
        break;
      case ToolCircuitState.HalfOpen:
        this.halfOpenProbeResults.push(success);
        this.evaluateProbes(now);
        break;
      case ToolCircuitState.Open:
        break;
    }
  }

  private evaluateTrip(now: number): void {
    if (this.consecutiveFailures >= this.config.consecutiveFailureThreshold) {
      this.transitionTo(ToolCircuitState.Open, now);
      return;
    }

    const windowOutcomes = this.getWindowOutcomes(now);
    if (windowOutcomes.length < this.config.minimumCalls) {
      return;
    }

    const failures = windowOutcomes.filter((outcome) => !outcome.success).length;
    const failureRate = failures / windowOutcomes.length;

    if (failureRate >= this.config.failureRateThreshold) {
      this.transitionTo(ToolCircuitState.Open, now);
    }
  }

  private evaluateProbes(now: number): void {
    if (this.halfOpenProbeResults.length < this.config.halfOpenProbeCount) {
      return;
    }

    const successes = this.halfOpenProbeResults.filter(Boolean).length;
    const successRate = successes / this.halfOpenProbeResults.length;

    if (successRate >= this.config.halfOpenSuccessThreshold) {
      this.transitionTo(ToolCircuitState.Closed, now);
      return;
    }

    this.transitionTo(ToolCircuitState.Open, now);
  }

  private transitionTo(next: ToolCircuitState, now: number): void {
    this.state = next;

    if (next === ToolCircuitState.Open) {
      this.openedAt = now;
      return;
    }

    if (next === ToolCircuitState.HalfOpen) {
      this.halfOpenProbeResults = [];
      return;
    }

    this.consecutiveFailures = 0;
    this.outcomes = [];
    this.halfOpenProbeResults = [];
  }

  private pruneWindow(now: number): void {
    const cutoff = now - this.config.windowMs;
    this.outcomes = this.outcomes.filter((outcome) => outcome.timestamp >= cutoff);
  }

  private getWindowOutcomes(now: number): CallOutcome[] {
    const cutoff = now - this.config.windowMs;
    return this.outcomes.filter((outcome) => outcome.timestamp >= cutoff);
  }
}

const DEFAULT_HTTP_TOOL_BREAKER_CONFIG: Omit<ToolCircuitBreakerConfig, "name"> = {
  windowMs: 60_000,
  minimumCalls: 10,
  failureRateThreshold: 0.5,
  consecutiveFailureThreshold: 5,
  openDurationMs: 30_000,
  halfOpenProbeCount: 3,
  halfOpenSuccessThreshold: 1,
};

const BREAKERS = new Map<string, ToolCircuitBreaker>();

function envBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function isGatewayHttpToolCircuitBreakerEnabled(): boolean {
  return envBoolean("OPENCLAW_TOOL_RELIABILITY_CB_ENABLED", false);
}

export function getGatewayHttpToolCircuitBreaker(toolName: string): ToolCircuitBreaker {
  const existing = BREAKERS.get(toolName);
  if (existing) {
    return existing;
  }

  const config: ToolCircuitBreakerConfig = {
    name: `gateway-http-tool:${toolName}`,
    windowMs: envNumber(
      "OPENCLAW_TOOL_RELIABILITY_CB_WINDOW_MS",
      DEFAULT_HTTP_TOOL_BREAKER_CONFIG.windowMs,
    ),
    minimumCalls: envNumber(
      "OPENCLAW_TOOL_RELIABILITY_CB_MIN_CALLS",
      DEFAULT_HTTP_TOOL_BREAKER_CONFIG.minimumCalls,
    ),
    failureRateThreshold: envNumber(
      "OPENCLAW_TOOL_RELIABILITY_CB_FAILURE_RATE",
      DEFAULT_HTTP_TOOL_BREAKER_CONFIG.failureRateThreshold,
    ),
    consecutiveFailureThreshold: envNumber(
      "OPENCLAW_TOOL_RELIABILITY_CB_CONSECUTIVE_FAILURES",
      DEFAULT_HTTP_TOOL_BREAKER_CONFIG.consecutiveFailureThreshold,
    ),
    openDurationMs: envNumber(
      "OPENCLAW_TOOL_RELIABILITY_CB_OPEN_MS",
      DEFAULT_HTTP_TOOL_BREAKER_CONFIG.openDurationMs,
    ),
    halfOpenProbeCount: envNumber(
      "OPENCLAW_TOOL_RELIABILITY_CB_HALF_OPEN_PROBES",
      DEFAULT_HTTP_TOOL_BREAKER_CONFIG.halfOpenProbeCount,
    ),
    halfOpenSuccessThreshold: envNumber(
      "OPENCLAW_TOOL_RELIABILITY_CB_HALF_OPEN_SUCCESS_RATE",
      DEFAULT_HTTP_TOOL_BREAKER_CONFIG.halfOpenSuccessThreshold,
    ),
  };

  const breaker = new ToolCircuitBreaker(config);
  BREAKERS.set(toolName, breaker);
  return breaker;
}

export function resetGatewayHttpToolCircuitBreakers(): void {
  BREAKERS.clear();
}
