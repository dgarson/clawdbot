import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadTelemetryDashboard,
  loadTelemetrySessions,
  loadTelemetryCosts,
  loadTelemetryTimeline,
  loadTelemetryTree,
  loadTelemetrySessionDetail,
  startActiveMonitor,
  stopActiveMonitor,
  type TelemetryState,
} from "./telemetry.ts";

type RequestFn = (method: string, params?: unknown) => Promise<unknown>;

function createState(request: RequestFn, overrides: Partial<TelemetryState> = {}): TelemetryState {
  return {
    client: { request } as unknown as TelemetryState["client"],
    connected: true,
    telemetryView: "dashboard",
    telemetryLoading: false,
    telemetryError: null,
    telemetryUsage: null,
    telemetrySessions: [],
    telemetrySessionsLoading: false,
    telemetryCosts: [],
    telemetryCostsLoading: false,
    telemetryCostGroupBy: "model",
    telemetryTopModels: [],
    telemetryTopTools: [],
    telemetryErrors: [],
    telemetryErrorsExpanded: false,
    telemetrySelectedSessionKey: null,
    telemetryTimeline: [],
    telemetryTimelineLoading: false,
    telemetryReplay: { playing: false, speed: 1, currentIndex: 0 },
    telemetryTree: [],
    telemetryTreeLoading: false,
    telemetryActiveMonitor: false,
    telemetryActiveInterval: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("telemetry controller", () => {
  it("loadTelemetryDashboard sets loading and fetches all data", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "telemetry.usage") {
        return {
          usage: {
            totalSessions: 5,
            totalRuns: 10,
            totalTokens: 5000,
            estimatedCost: 1.5,
            errorCount: 1,
          },
        };
      }
      if (method === "telemetry.sessions") {
        return {
          sessions: [{ key: "s1", runCount: 2, totalTokens: 1000, totalCost: 0.5, errorCount: 0 }],
        };
      }
      if (method === "telemetry.costs") {
        return {
          costs: [
            {
              label: "gpt-4",
              inputCost: 0.3,
              outputCost: 0.2,
              cacheCost: 0,
              totalCost: 0.5,
              inputTokens: 100,
              outputTokens: 50,
              cacheTokens: 0,
            },
          ],
        };
      }
      if (method === "telemetry.top") {
        return { leaderboard: [{ label: "gpt-4", value: 10 }] };
      }
      if (method === "telemetry.errors") {
        return { errors: [] };
      }
      return {};
    });
    const state = createState(request);

    await loadTelemetryDashboard(state);

    expect(state.telemetryLoading).toBe(false);
    expect(state.telemetryError).toBeNull();
    expect(state.telemetryUsage?.totalSessions).toBe(5);
    expect(state.telemetrySessions.length).toBe(1);
    expect(state.telemetryCosts.length).toBe(1);
    expect(request).toHaveBeenCalledWith("telemetry.usage", {});
    expect(request).toHaveBeenCalledWith("telemetry.sessions", { limit: 50 });
    expect(request).toHaveBeenCalledWith("telemetry.costs", { groupBy: "model" });
  });

  it("loadTelemetrySessions updates sessions list", async () => {
    const sessions = [
      { key: "session-a", runCount: 3, totalTokens: 2000, totalCost: 0.8, errorCount: 1 },
      { key: "session-b", runCount: 1, totalTokens: 500, totalCost: 0.1, errorCount: 0 },
    ];
    const request = vi.fn(async () => ({ sessions }));
    const state = createState(request);

    await loadTelemetrySessions(state);

    expect(state.telemetrySessions).toEqual(sessions);
    expect(state.telemetrySessionsLoading).toBe(false);
  });

  it("loadTelemetryCosts sends groupBy parameter", async () => {
    const request = vi.fn(async () => ({ costs: [] }));
    const state = createState(request, { telemetryCostGroupBy: "provider" });

    await loadTelemetryCosts(state);

    expect(request).toHaveBeenCalledWith("telemetry.costs", { groupBy: "provider" });
    expect(state.telemetryCostsLoading).toBe(false);
  });

  it("loadTelemetryTimeline fetches events for a session", async () => {
    const events = [
      { id: "1", timestamp: "2026-01-01T00:00:00Z", kind: "run.start" },
      { id: "2", timestamp: "2026-01-01T00:00:01Z", kind: "llm.call" },
    ];
    const request = vi.fn(async () => ({ events }));
    const state = createState(request);

    await loadTelemetryTimeline(state, "session-1");

    expect(request).toHaveBeenCalledWith("telemetry.timeline", { sessionKey: "session-1" });
    expect(state.telemetryTimeline).toEqual(events);
    expect(state.telemetryTimelineLoading).toBe(false);
  });

  it("loadTelemetryTree fetches subagent hierarchy", async () => {
    const tree = [{ agentId: "main", children: [{ agentId: "sub-1", children: [] }] }];
    const request = vi.fn(async () => ({ tree }));
    const state = createState(request);

    await loadTelemetryTree(state, "session-1");

    expect(request).toHaveBeenCalledWith("telemetry.tree", { sessionKey: "session-1" });
    expect(state.telemetryTree).toEqual(tree);
    expect(state.telemetryTreeLoading).toBe(false);
  });

  it("loadTelemetrySessionDetail sets view and loads timeline + tree", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "telemetry.timeline") {
        return { events: [{ id: "1", timestamp: "2026-01-01T00:00:00Z", kind: "run.start" }] };
      }
      if (method === "telemetry.tree") {
        return { tree: [] };
      }
      return {};
    });
    const state = createState(request);

    await loadTelemetrySessionDetail(state, "test-session");

    expect(state.telemetryView).toBe("session-detail");
    expect(state.telemetrySelectedSessionKey).toBe("test-session");
    expect(state.telemetryTimeline.length).toBe(1);
    expect(state.telemetryReplay.playing).toBe(false);
    expect(state.telemetryReplay.currentIndex).toBe(0);
  });

  it("silently handles request failures without crashing", async () => {
    const request = vi.fn(async () => {
      throw new Error("network error");
    });
    const state = createState(request);

    await loadTelemetrySessions(state);
    expect(state.telemetrySessions).toEqual([]);

    await loadTelemetryCosts(state);
    expect(state.telemetryCosts).toEqual([]);
  });

  it("does nothing when not connected", async () => {
    const request = vi.fn(async () => ({}));
    const state = createState(request, { connected: false });

    await loadTelemetrySessions(state);
    expect(request).not.toHaveBeenCalled();
  });

  it("does nothing when client is null", async () => {
    const request = vi.fn(async () => ({}));
    const state = createState(request, { client: null });

    await loadTelemetrySessions(state);
    expect(request).not.toHaveBeenCalled();
  });

  it("startActiveMonitor sets interval and flag", () => {
    const request = vi.fn(async () => ({ sessions: [] }));
    const state = createState(request);

    vi.useFakeTimers();
    startActiveMonitor(state);

    expect(state.telemetryActiveMonitor).toBe(true);
    expect(state.telemetryActiveInterval).not.toBeNull();

    stopActiveMonitor(state);
    expect(state.telemetryActiveMonitor).toBe(false);
    expect(state.telemetryActiveInterval).toBeNull();

    vi.useRealTimers();
  });
});
