/**
 * Agent-to-Agent (A2A) Communication Protocol — Circuit Breaker
 *
 * Detects and breaks infinite message loops between agents.
 * Tracks message patterns by correlationId and agent pairs.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

export interface CircuitBreakerConfig {
  /** Max messages in a single correlation chain before tripping */
  maxCorrelationDepth: number;
  /** Max messages between the same agent pair per window */
  maxPairMessagesPerWindow: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** How long a tripped circuit stays open (ms) */
  cooldownMs: number;
}

export type CircuitState = "closed" | "open";

export interface CircuitCheckResult {
  allowed: boolean;
  reason?: string;
  state: CircuitState;
}

interface CorrelationTracker {
  count: number;
  firstSeen: number;
}

interface PairTracker {
  count: number;
  windowStart: number;
}

interface OpenCircuit {
  openedAt: number;
  reason: string;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxCorrelationDepth: 50,
  maxPairMessagesPerWindow: 30,
  windowMs: 60_000,
  cooldownMs: 300_000, // 5 minutes
};

export class A2ACircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly correlations = new Map<string, CorrelationTracker>();
  private readonly pairs = new Map<string, PairTracker>();
  private readonly openCircuits = new Map<string, OpenCircuit>();

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private pairKey(fromAgent: string, toAgent: string): string {
    // Order-independent to catch A→B and B→A loops
    const sorted = [fromAgent, toAgent].toSorted();
    return `${sorted[0]}:${sorted[1]}`;
  }

  /**
   * Check if a message should be allowed through.
   */
  check(
    fromAgent: string,
    toAgent: string,
    correlationId?: string | null,
    now: number = Date.now(),
  ): CircuitCheckResult {
    // Check if circuit is open (tripped)
    const circuitKey = this.pairKey(fromAgent, toAgent);
    const openCircuit = this.openCircuits.get(circuitKey);
    if (openCircuit) {
      if (now - openCircuit.openedAt < this.config.cooldownMs) {
        return {
          allowed: false,
          reason: `Circuit open: ${openCircuit.reason}. Cooldown expires in ${Math.ceil((this.config.cooldownMs - (now - openCircuit.openedAt)) / 1000)}s.`,
          state: "open",
        };
      }
      // Cooldown expired — close the circuit
      this.openCircuits.delete(circuitKey);
    }

    // Check correlation depth
    if (correlationId) {
      const tracker = this.correlations.get(correlationId);
      if (tracker) {
        tracker.count++;
        if (tracker.count > this.config.maxCorrelationDepth) {
          const reason = `Correlation chain "${correlationId}" exceeded max depth of ${this.config.maxCorrelationDepth} messages`;
          this.openCircuits.set(circuitKey, { openedAt: now, reason });
          return { allowed: false, reason, state: "open" };
        }
      } else {
        this.correlations.set(correlationId, { count: 1, firstSeen: now });
      }
    }

    // Check pair message rate
    const pairTracker = this.pairs.get(circuitKey);
    if (pairTracker) {
      if (now - pairTracker.windowStart >= this.config.windowMs) {
        // Window expired — reset
        pairTracker.count = 1;
        pairTracker.windowStart = now;
      } else {
        pairTracker.count++;
        if (pairTracker.count > this.config.maxPairMessagesPerWindow) {
          const reason = `Agent pair ${fromAgent}↔${toAgent} exceeded ${this.config.maxPairMessagesPerWindow} messages in ${this.config.windowMs / 1000}s`;
          this.openCircuits.set(circuitKey, { openedAt: now, reason });
          return { allowed: false, reason, state: "open" };
        }
      }
    } else {
      this.pairs.set(circuitKey, { count: 1, windowStart: now });
    }

    return { allowed: true, state: "closed" };
  }

  /** Get the state of a circuit between two agents. */
  getState(fromAgent: string, toAgent: string, now: number = Date.now()): CircuitState {
    const key = this.pairKey(fromAgent, toAgent);
    const open = this.openCircuits.get(key);
    if (open && now - open.openedAt < this.config.cooldownMs) {
      return "open";
    }
    return "closed";
  }

  /** Manually reset a circuit. */
  resetCircuit(fromAgent: string, toAgent: string): void {
    const key = this.pairKey(fromAgent, toAgent);
    this.openCircuits.delete(key);
    this.pairs.delete(key);
  }

  /** Clear all state. */
  clear(): void {
    this.correlations.clear();
    this.pairs.clear();
    this.openCircuits.clear();
  }

  /** Prune expired tracking data. */
  prune(now: number = Date.now()): void {
    // Prune expired open circuits
    for (const [key, circuit] of this.openCircuits) {
      if (now - circuit.openedAt >= this.config.cooldownMs) {
        this.openCircuits.delete(key);
      }
    }
    // Prune expired pair windows
    for (const [key, tracker] of this.pairs) {
      if (now - tracker.windowStart >= this.config.windowMs) {
        this.pairs.delete(key);
      }
    }
    // Prune old correlations (using window as heuristic)
    for (const [id, tracker] of this.correlations) {
      if (now - tracker.firstSeen >= this.config.windowMs * 10) {
        this.correlations.delete(id);
      }
    }
  }
}
