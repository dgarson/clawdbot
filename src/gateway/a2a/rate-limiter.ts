/**
 * Agent-to-Agent (A2A) Communication Protocol — Rate Limiter
 *
 * Per-agent rate limiting to prevent message storms.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

export interface RateLimitConfig {
  /** Maximum messages per window per agent */
  maxPerWindow: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

interface AgentWindow {
  count: number;
  windowStart: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxPerWindow: 60,
  windowMs: 60_000, // 1 minute
};

export class A2ARateLimiter {
  private readonly config: RateLimitConfig;
  private readonly windows = new Map<string, AgentWindow>();

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if an agent is allowed to send a message.
   * Automatically increments the counter if allowed.
   */
  check(agentId: string, now: number = Date.now()): RateLimitResult {
    const window = this.windows.get(agentId);

    // No window or expired window — start fresh
    if (!window || now - window.windowStart >= this.config.windowMs) {
      this.windows.set(agentId, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: this.config.maxPerWindow - 1,
        resetMs: this.config.windowMs,
      };
    }

    // Window is active
    if (window.count >= this.config.maxPerWindow) {
      const resetMs = this.config.windowMs - (now - window.windowStart);
      return { allowed: false, remaining: 0, resetMs };
    }

    window.count++;
    return {
      allowed: true,
      remaining: this.config.maxPerWindow - window.count,
      resetMs: this.config.windowMs - (now - window.windowStart),
    };
  }

  /** Reset rate limit for an agent. */
  reset(agentId: string): void {
    this.windows.delete(agentId);
  }

  /** Clear all windows. */
  clear(): void {
    this.windows.clear();
  }

  /** Number of tracked agents. */
  get size(): number {
    return this.windows.size;
  }

  /** Prune expired windows. */
  prune(now: number = Date.now()): void {
    for (const [agentId, window] of this.windows) {
      if (now - window.windowStart >= this.config.windowMs) {
        this.windows.delete(agentId);
      }
    }
  }
}
