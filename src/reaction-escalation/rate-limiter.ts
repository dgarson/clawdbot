type RateLimiterOptions = {
  maxPerMinute?: number;
  maxPerHour?: number;
  cooldownPerMessageMs?: number;
};

type RateLimiterCheck = {
  userId: string;
  messageKey: string;
  intent: string;
};

export class ReactionRateLimiter {
  private byUserMinute = new Map<string, number[]>();
  private byUserHour = new Map<string, number[]>();
  private cooldowns = new Map<string, number>();

  constructor(private options: RateLimiterOptions) {}

  allow(params: RateLimiterCheck): { ok: boolean; reason?: string } {
    const now = Date.now();
    const userKey = params.userId || "unknown";
    const cooldownKey = `${userKey}:${params.messageKey}:${params.intent}`;
    const cooldownMs = this.options.cooldownPerMessageMs ?? 0;
    if (cooldownMs > 0) {
      const lastSeen = this.cooldowns.get(cooldownKey);
      if (lastSeen && now - lastSeen < cooldownMs) {
        return { ok: false, reason: "cooldown" };
      }
      this.cooldowns.set(cooldownKey, now);
    }

    const maxPerMinute = this.options.maxPerMinute ?? 0;
    if (maxPerMinute > 0) {
      const windowStart = now - 60_000;
      const bucket = this.trim(this.byUserMinute.get(userKey), windowStart);
      if (bucket.length >= maxPerMinute) {
        return { ok: false, reason: "rate-limit-minute" };
      }
      bucket.push(now);
      this.byUserMinute.set(userKey, bucket);
    }

    const maxPerHour = this.options.maxPerHour ?? 0;
    if (maxPerHour > 0) {
      const windowStart = now - 3_600_000;
      const bucket = this.trim(this.byUserHour.get(userKey), windowStart);
      if (bucket.length >= maxPerHour) {
        return { ok: false, reason: "rate-limit-hour" };
      }
      bucket.push(now);
      this.byUserHour.set(userKey, bucket);
    }

    return { ok: true };
  }

  private trim(existing: number[] | undefined, windowStart: number): number[] {
    if (!existing || existing.length === 0) {
      return [];
    }
    const trimmed = existing.filter((value) => value >= windowStart);
    return trimmed.length === existing.length ? existing : trimmed;
  }
}
