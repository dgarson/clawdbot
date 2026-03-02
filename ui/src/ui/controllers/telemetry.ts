import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  TelemetryCostBreakdown,
  TelemetryCostGroupBy,
  TelemetryErrorEntry,
  TelemetryLeaderboardEntry,
  TelemetryReplayState,
  TelemetrySessionSummary,
  TelemetrySubagentNode,
  TelemetryTimelineEvent,
  TelemetryUsageSummary,
  TelemetryView,
} from "../views/telemetry-types.ts";

export type TelemetryState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  telemetryView: TelemetryView;
  telemetryLoading: boolean;
  telemetryError: string | null;
  telemetryUsage: TelemetryUsageSummary | null;
  telemetrySessions: TelemetrySessionSummary[];
  telemetrySessionsLoading: boolean;
  telemetryCosts: TelemetryCostBreakdown[];
  telemetryCostsLoading: boolean;
  telemetryCostGroupBy: TelemetryCostGroupBy;
  telemetryTopModels: TelemetryLeaderboardEntry[];
  telemetryTopTools: TelemetryLeaderboardEntry[];
  telemetryErrors: TelemetryErrorEntry[];
  telemetryErrorsExpanded: boolean;
  // Session detail state
  telemetrySelectedSessionKey: string | null;
  telemetryTimeline: TelemetryTimelineEvent[];
  telemetryTimelineLoading: boolean;
  telemetryReplay: TelemetryReplayState;
  telemetryTree: TelemetrySubagentNode[];
  telemetryTreeLoading: boolean;
  // Active sessions monitoring
  telemetryActiveMonitor: boolean;
  telemetryActiveInterval: number | null;
};

function toErrorMessage(err: unknown): string {
  if (typeof err === "string") {
    return err;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "request failed";
}

export async function loadTelemetryDashboard(state: TelemetryState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.telemetryLoading = true;
  state.telemetryError = null;
  try {
    await Promise.all([
      loadTelemetryUsage(state),
      loadTelemetrySessions(state),
      loadTelemetryCosts(state),
      loadTelemetryTopModels(state),
      loadTelemetryTopTools(state),
      loadTelemetryErrors(state),
    ]);
  } catch (err) {
    state.telemetryError = toErrorMessage(err);
  } finally {
    state.telemetryLoading = false;
  }
}

export async function loadTelemetryUsage(state: TelemetryState) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request("telemetry.usage", {});
    if (res) {
      const data = res as { usage: TelemetryUsageSummary };
      state.telemetryUsage = data.usage ?? (res as TelemetryUsageSummary);
    }
  } catch {
    // Usage is optional; silently fail
  }
}

export async function loadTelemetrySessions(state: TelemetryState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.telemetrySessionsLoading = true;
  try {
    const res = await state.client.request("telemetry.sessions", { limit: 50 });
    if (res) {
      const data = res as { sessions: TelemetrySessionSummary[] };
      state.telemetrySessions = data.sessions ?? [];
    }
  } catch {
    state.telemetrySessions = [];
  } finally {
    state.telemetrySessionsLoading = false;
  }
}

export async function loadTelemetryCosts(state: TelemetryState) {
  if (!state.client || !state.connected) {
    return;
  }
  state.telemetryCostsLoading = true;
  try {
    const res = await state.client.request("telemetry.costs", {
      groupBy: state.telemetryCostGroupBy,
    });
    if (res) {
      const data = res as { costs: TelemetryCostBreakdown[] };
      state.telemetryCosts = data.costs ?? [];
    }
  } catch {
    state.telemetryCosts = [];
  } finally {
    state.telemetryCostsLoading = false;
  }
}

export async function loadTelemetryTopModels(state: TelemetryState) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request("telemetry.top", { dimension: "models" });
    if (res) {
      const data = res as { leaderboard: TelemetryLeaderboardEntry[] };
      state.telemetryTopModels = data.leaderboard ?? [];
    }
  } catch {
    state.telemetryTopModels = [];
  }
}

export async function loadTelemetryTopTools(state: TelemetryState) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request("telemetry.top", { dimension: "tools" });
    if (res) {
      const data = res as { leaderboard: TelemetryLeaderboardEntry[] };
      state.telemetryTopTools = data.leaderboard ?? [];
    }
  } catch {
    state.telemetryTopTools = [];
  }
}

export async function loadTelemetryErrors(state: TelemetryState) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request("telemetry.errors", {});
    if (res) {
      const data = res as { errors: TelemetryErrorEntry[] };
      state.telemetryErrors = data.errors ?? [];
    }
  } catch {
    state.telemetryErrors = [];
  }
}

export async function loadTelemetryTimeline(state: TelemetryState, sessionKey: string) {
  if (!state.client || !state.connected) {
    return;
  }
  state.telemetryTimelineLoading = true;
  try {
    const res = await state.client.request("telemetry.timeline", { sessionKey });
    if (res) {
      const data = res as { events: TelemetryTimelineEvent[] };
      state.telemetryTimeline = data.events ?? [];
    }
  } catch {
    state.telemetryTimeline = [];
  } finally {
    state.telemetryTimelineLoading = false;
  }
}

export async function loadTelemetryTree(state: TelemetryState, sessionKey: string) {
  if (!state.client || !state.connected) {
    return;
  }
  state.telemetryTreeLoading = true;
  try {
    const res = await state.client.request("telemetry.tree", { sessionKey });
    if (res) {
      const data = res as { tree: TelemetrySubagentNode[] };
      state.telemetryTree = data.tree ?? [];
    }
  } catch {
    state.telemetryTree = [];
  } finally {
    state.telemetryTreeLoading = false;
  }
}

export async function loadTelemetrySessionDetail(state: TelemetryState, sessionKey: string) {
  state.telemetrySelectedSessionKey = sessionKey;
  state.telemetryView = "session-detail";
  state.telemetryReplay = { playing: false, speed: 1, currentIndex: 0 };
  await Promise.all([
    loadTelemetryTimeline(state, sessionKey),
    loadTelemetryTree(state, sessionKey),
  ]);
}

export function startActiveMonitor(state: TelemetryState) {
  if (state.telemetryActiveInterval != null) {
    return;
  }
  state.telemetryActiveMonitor = true;
  const refresh = () => void loadTelemetrySessions(state);
  state.telemetryActiveInterval = globalThis.setInterval(refresh, 5000) as unknown as number;
}

export function stopActiveMonitor(state: TelemetryState) {
  state.telemetryActiveMonitor = false;
  if (state.telemetryActiveInterval != null) {
    globalThis.clearInterval(state.telemetryActiveInterval);
    state.telemetryActiveInterval = null;
  }
}
