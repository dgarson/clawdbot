import { nothing } from "lit";
import type { AppViewState } from "./app-view-state.ts";
import type { TelemetryState } from "./controllers/telemetry.ts";
import {
  loadTelemetryDashboard,
  loadTelemetrySessionDetail,
  loadTelemetryCosts,
  startActiveMonitor,
  stopActiveMonitor,
} from "./controllers/telemetry.ts";
import { TelemetryReplayController } from "./views/telemetry-replay.ts";
import { renderTelemetrySessionDetail } from "./views/telemetry-session.ts";
import { renderTelemetryDashboard } from "./views/telemetry.ts";

// Module-scope replay controller to persist across re-renders
let replayController: TelemetryReplayController | null = null;

function getReplayController(state: TelemetryState): TelemetryReplayController {
  const onUpdate = (nextReplay: import("./views/telemetry-types.ts").TelemetryReplayState) => {
    state.telemetryReplay = nextReplay;
  };
  if (!replayController) {
    replayController = new TelemetryReplayController(onUpdate);
  } else {
    // Refresh the callback so it always writes to the current state reference
    replayController.setOnUpdate(onUpdate);
  }
  return replayController;
}

export function renderTelemetryTab(state: AppViewState) {
  if (state.tab !== "telemetry") {
    return nothing;
  }

  const telState = state as unknown as TelemetryState;

  if (telState.telemetryView === "session-detail" && telState.telemetrySelectedSessionKey) {
    const ctrl = getReplayController(telState);

    // Derive context token count from the latest llm.call event in the timeline
    const latestLlmCall = [...telState.telemetryTimeline]
      .toReversed()
      .find((e) => e.kind === "llm.call");
    const contextTokens =
      (latestLlmCall?.data?.context as { totalTokens?: number } | undefined)?.totalTokens ?? 0;
    const contextMax = 200000;

    // Count compaction.start events
    const compactionCount = telState.telemetryTimeline.filter(
      (e) => e.kind === "compaction.start",
    ).length;

    return renderTelemetrySessionDetail({
      sessionKey: telState.telemetrySelectedSessionKey,
      sessions: telState.telemetrySessions,
      timeline: telState.telemetryTimeline,
      timelineLoading: telState.telemetryTimelineLoading,
      replay: telState.telemetryReplay,
      tree: telState.telemetryTree,
      treeLoading: telState.telemetryTreeLoading,
      selectedEvent: telState.telemetrySelectedEvent,
      onEventSelect: (e) => {
        telState.telemetrySelectedEvent = e;
      },
      contextTokens,
      contextMax,
      compactionCount,
      onBack: () => {
        ctrl.stop();
        telState.telemetryView = "dashboard";
        telState.telemetrySelectedSessionKey = null;
        telState.telemetrySelectedEvent = null;
        telState.telemetryTimeline = [];
        telState.telemetryTree = [];
        telState.telemetryReplay = { playing: false, speed: 1, currentIndex: 0 };
      },
      onPlayPause: () => {
        telState.telemetryReplay = ctrl.togglePlayPause(
          telState.telemetryTimeline,
          telState.telemetryReplay,
        );
      },
      onSpeedChange: (speed) => {
        telState.telemetryReplay = ctrl.setSpeed(
          speed,
          telState.telemetryTimeline,
          telState.telemetryReplay,
        );
      },
      onSeek: (index) => {
        telState.telemetryReplay = ctrl.seek(index, telState.telemetryReplay);
      },
    });
  }

  return renderTelemetryDashboard({
    view: telState.telemetryView,
    loading: telState.telemetryLoading,
    error: telState.telemetryError,
    usage: telState.telemetryUsage,
    sessions: telState.telemetrySessions,
    sessionsLoading: telState.telemetrySessionsLoading,
    sessionGroupBy: telState.telemetrySessionGroupBy,
    costs: telState.telemetryCosts,
    costsLoading: telState.telemetryCostsLoading,
    costGroupBy: telState.telemetryCostGroupBy,
    topModels: telState.telemetryTopModels,
    topTools: telState.telemetryTopTools,
    errors: telState.telemetryErrors,
    errorsExpanded: telState.telemetryErrorsExpanded,
    activeMonitor: telState.telemetryActiveMonitor,
    onRefresh: () => void loadTelemetryDashboard(telState),
    onCostGroupByChange: (groupBy) => {
      telState.telemetryCostGroupBy = groupBy;
      void loadTelemetryCosts(telState);
    },
    onSessionGroupByChange: (groupBy) => {
      telState.telemetrySessionGroupBy = groupBy;
    },
    onSessionClick: (key) => {
      void loadTelemetrySessionDetail(telState, key);
    },
    onToggleErrors: () => {
      telState.telemetryErrorsExpanded = !telState.telemetryErrorsExpanded;
    },
    onToggleActiveMonitor: () => {
      if (telState.telemetryActiveMonitor) {
        stopActiveMonitor(telState);
      } else {
        startActiveMonitor(telState);
      }
    },
  });
}
