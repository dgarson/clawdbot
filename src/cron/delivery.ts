import type {
  CronDeliveryDefaults,
  CronDeliveryMode,
  CronJob,
  CronMessageChannel,
} from "./types.js";

export type CronDeliveryPlan = {
  mode: CronDeliveryMode;
  channel: CronMessageChannel;
  to?: string;
  source: "delivery" | "payload";
  requested: boolean;
};

function normalizeChannel(value: unknown): CronMessageChannel | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  return trimmed as CronMessageChannel;
}

function normalizeTo(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeMode(value: unknown): CronDeliveryMode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "announce" || normalized === "deliver") {
    return "announce";
  }
  if (normalized === "none") {
    return "none";
  }
  return undefined;
}

function normalizeDefaultDelivery(defaults: CronDeliveryDefaults | undefined): {
  enabled: boolean;
  mode?: CronDeliveryMode;
  channel?: CronMessageChannel;
  to?: string;
} {
  if (!defaults || defaults.enabled !== true) {
    return { enabled: false };
  }
  return {
    enabled: true,
    mode: normalizeMode(defaults.mode),
    channel: normalizeChannel(defaults.channel),
    to: normalizeTo(defaults.to),
  };
}

export function resolveCronDeliveryPlan(
  job: CronJob,
  defaults?: CronDeliveryDefaults,
): CronDeliveryPlan {
  const payload = job.payload.kind === "agentTurn" ? job.payload : null;
  const defaultDelivery = normalizeDefaultDelivery(defaults);
  const delivery = job.delivery;
  const hasDelivery = delivery && typeof delivery === "object";
  const mode = hasDelivery ? normalizeMode((delivery as { mode?: unknown }).mode) : undefined;

  const payloadChannel = normalizeChannel(payload?.channel);
  const payloadTo = normalizeTo(payload?.to);
  const deliveryChannel = normalizeChannel(
    (delivery as { channel?: unknown } | undefined)?.channel,
  );
  const deliveryTo = normalizeTo((delivery as { to?: unknown } | undefined)?.to);

  const channelFallback = payloadChannel ?? defaultDelivery.channel ?? "last";
  const toFallback = payloadTo ?? defaultDelivery.to;
  const channel = deliveryChannel ?? channelFallback;
  const to = deliveryTo ?? toFallback;

  if (hasDelivery) {
    const resolvedMode = mode ?? defaultDelivery.mode ?? "announce";
    return {
      mode: resolvedMode,
      channel,
      to,
      source: "delivery",
      requested: resolvedMode === "announce",
    };
  }

  const legacyMode =
    payload?.deliver === true ? "explicit" : payload?.deliver === false ? "off" : "auto";

  if (legacyMode === "off") {
    return {
      mode: "none",
      channel,
      to,
      source: "payload",
      requested: false,
    };
  }

  if (legacyMode === "explicit") {
    return {
      mode: "announce",
      channel,
      to,
      source: "payload",
      requested: true,
    };
  }

  if (defaultDelivery.enabled) {
    const resolvedMode = defaultDelivery.mode ?? "announce";
    return {
      mode: resolvedMode,
      channel,
      to,
      source: "payload",
      requested: resolvedMode === "announce",
    };
  }

  const hasExplicitTarget = Boolean(to);
  const requested = hasExplicitTarget;

  return {
    mode: requested ? "announce" : "none",
    channel,
    to,
    source: "payload",
    requested,
  };
}
