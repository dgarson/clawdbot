import type { GatewayBrowserClient } from "../gateway.ts";
import type { SessionsListResult, GatewaySessionRow } from "../types.ts";
import { showDangerConfirmDialog } from "../components/confirm-dialog.ts";
import { toNumber } from "../format.ts";
import { optimistic, snapshot } from "../utils/optimistic.ts";

export type SessionsState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  sessionsLoading: boolean;
  sessionsResult: SessionsListResult | null;
  sessionsError: string | null;
  sessionsFilterActive: string;
  sessionsFilterLimit: string;
  sessionsIncludeGlobal: boolean;
  sessionsIncludeUnknown: boolean;
};

export async function loadSessions(
  state: SessionsState,
  overrides?: {
    activeMinutes?: number;
    limit?: number;
    includeGlobal?: boolean;
    includeUnknown?: boolean;
  },
) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.sessionsLoading) {
    return;
  }
  state.sessionsLoading = true;
  state.sessionsError = null;
  try {
    const includeGlobal = overrides?.includeGlobal ?? state.sessionsIncludeGlobal;
    const includeUnknown = overrides?.includeUnknown ?? state.sessionsIncludeUnknown;
    const activeMinutes = overrides?.activeMinutes ?? toNumber(state.sessionsFilterActive, 0);
    const limit = overrides?.limit ?? toNumber(state.sessionsFilterLimit, 0);
    const params: Record<string, unknown> = {
      includeGlobal,
      includeUnknown,
    };
    if (activeMinutes > 0) {
      params.activeMinutes = activeMinutes;
    }
    if (limit > 0) {
      params.limit = limit;
    }
    const res = await state.client.request<SessionsListResult | undefined>("sessions.list", params);
    if (res) {
      state.sessionsResult = res;
    }
  } catch (err) {
    state.sessionsError = String(err);
  } finally {
    state.sessionsLoading = false;
  }
}

export async function patchSession(
  state: SessionsState,
  key: string,
  patch: {
    label?: string | null;
    thinkingLevel?: string | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
  },
) {
  if (!state.client || !state.connected) {
    return;
  }
  const params: Record<string, unknown> = { key };
  if ("label" in patch) {
    params.label = patch.label;
  }
  if ("thinkingLevel" in patch) {
    params.thinkingLevel = patch.thinkingLevel;
  }
  if ("verboseLevel" in patch) {
    params.verboseLevel = patch.verboseLevel;
  }
  if ("reasoningLevel" in patch) {
    params.reasoningLevel = patch.reasoningLevel;
  }
  try {
    await state.client.request("sessions.patch", params);
    await loadSessions(state);
  } catch (err) {
    state.sessionsError = String(err);
  }
}

export async function abortSession(state: SessionsState, key: string) {
  if (!state.client || !state.connected) {
    return;
  }
  const confirmed = await showDangerConfirmDialog(
    "Abort Session",
    `Abort session "${key}"?\n\nThis will stop any active agent run for this session. The session itself will be preserved.`,
    "Abort",
  );
  if (!confirmed) {
    return;
  }

  // Snapshot for rollback
  const prevResult = state.sessionsResult ? snapshot(state.sessionsResult) : null;
  const prevSessions = state.sessionsResult?.sessions
    ? snapshot(state.sessionsResult.sessions)
    : null;

  await optimistic({
    apply() {
      // Optimistically mark the session as aborting
      if (state.sessionsResult?.sessions) {
        state.sessionsResult = {
          ...state.sessionsResult,
          sessions: state.sessionsResult.sessions.map((s) =>
            s.key === key ? { ...s, abortedLastRun: true } : s,
          ),
        };
      }
      state.sessionsLoading = true;
      state.sessionsError = null;
    },
    rollback() {
      if (prevResult && prevSessions) {
        state.sessionsResult = { ...prevResult, sessions: prevSessions };
      }
      state.sessionsLoading = false;
    },
    mutate: () => state.client!.request("chat.abort", { sessionKey: key }),
    async refresh() {
      state.sessionsLoading = false;
      await loadSessions(state);
    },
    errorTitle: "Abort failed",
  });

  state.sessionsLoading = false;
}

/** Get active sessions (updated within the last 5 minutes, excluding global). */
function getActiveSessions(sessions: GatewaySessionRow[]): GatewaySessionRow[] {
  const now = Date.now();
  const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
  return sessions.filter(
    (s) => s.updatedAt && now - s.updatedAt < ACTIVE_THRESHOLD_MS && s.kind !== "global",
  );
}

export async function abortAllSessions(state: SessionsState) {
  if (!state.client || !state.connected) {
    return;
  }
  const sessions = state.sessionsResult?.sessions ?? [];
  const activeSessions = getActiveSessions(sessions);
  if (activeSessions.length === 0) {
    state.sessionsError = "No active sessions to abort.";
    return;
  }
  const confirmed = await showDangerConfirmDialog(
    "⛔ Emergency Stop — All Agents",
    `Abort all ${activeSessions.length} active session(s)?\n\nThis will immediately stop all running agent tasks across every agent. Sessions themselves will be preserved.`,
    `Stop All (${activeSessions.length})`,
  );
  if (!confirmed) {
    return;
  }

  // Snapshot for rollback
  const prevResult = state.sessionsResult ? snapshot(state.sessionsResult) : null;
  const prevSessions = state.sessionsResult?.sessions
    ? snapshot(state.sessionsResult.sessions)
    : null;
  const activeKeys = new Set(activeSessions.map((s) => s.key));

  await optimistic({
    apply() {
      // Optimistically mark all active sessions as aborting
      if (state.sessionsResult?.sessions) {
        state.sessionsResult = {
          ...state.sessionsResult,
          sessions: state.sessionsResult.sessions.map((s) =>
            activeKeys.has(s.key) ? { ...s, abortedLastRun: true } : s,
          ),
        };
      }
      state.sessionsLoading = true;
      state.sessionsError = null;
    },
    rollback() {
      if (prevResult && prevSessions) {
        state.sessionsResult = { ...prevResult, sessions: prevSessions };
      }
      state.sessionsLoading = false;
    },
    async mutate() {
      const errors: string[] = [];
      for (const session of activeSessions) {
        try {
          await state.client!.request("chat.abort", { sessionKey: session.key });
        } catch (err) {
          errors.push(`${session.key}: ${String(err)}`);
        }
      }
      if (errors.length > 0) {
        throw new Error(`Some aborts failed:\n${errors.join("\n")}`);
      }
    },
    async refresh() {
      await loadSessions(state);
      state.sessionsLoading = false;
    },
    errorTitle: "Abort all failed",
  });

  state.sessionsLoading = false;
}

/**
 * Abort all active sessions for a specific agent.
 * Used by the Agent Dashboard to stop one agent without affecting others.
 */
export async function abortSessionsForAgent(state: SessionsState, agentId: string) {
  if (!state.client || !state.connected) {
    return;
  }
  const sessions = state.sessionsResult?.sessions ?? [];
  const agentSessions = getActiveSessions(sessions).filter((s) => {
    const parts = s.key.split(":");
    return parts.length >= 2 && parts[0] === "agent" && parts[1] === agentId;
  });
  if (agentSessions.length === 0) {
    state.sessionsError = `No active sessions for agent "${agentId}".`;
    return;
  }
  const confirmed = await showDangerConfirmDialog(
    `Stop Agent: ${agentId}`,
    `Abort all ${agentSessions.length} active session(s) for agent "${agentId}"?\n\nThis will stop all running tasks for this agent. Other agents will not be affected.`,
    `Stop ${agentSessions.length} Session${agentSessions.length > 1 ? "s" : ""}`,
  );
  if (!confirmed) {
    return;
  }

  // Snapshot for rollback
  const prevResult = state.sessionsResult ? snapshot(state.sessionsResult) : null;
  const prevSessions = state.sessionsResult?.sessions
    ? snapshot(state.sessionsResult.sessions)
    : null;
  const agentKeys = new Set(agentSessions.map((s) => s.key));

  await optimistic({
    apply() {
      // Optimistically mark agent sessions as aborting
      if (state.sessionsResult?.sessions) {
        state.sessionsResult = {
          ...state.sessionsResult,
          sessions: state.sessionsResult.sessions.map((s) =>
            agentKeys.has(s.key) ? { ...s, abortedLastRun: true } : s,
          ),
        };
      }
      state.sessionsLoading = true;
      state.sessionsError = null;
    },
    rollback() {
      if (prevResult && prevSessions) {
        state.sessionsResult = { ...prevResult, sessions: prevSessions };
      }
      state.sessionsLoading = false;
    },
    async mutate() {
      const errors: string[] = [];
      for (const session of agentSessions) {
        try {
          await state.client!.request("chat.abort", { sessionKey: session.key });
        } catch (err) {
          errors.push(`${session.key}: ${String(err)}`);
        }
      }
      if (errors.length > 0) {
        throw new Error(`Some aborts failed:\n${errors.join("\n")}`);
      }
    },
    async refresh() {
      await loadSessions(state);
      state.sessionsLoading = false;
    },
    errorTitle: `Agent abort failed`,
  });

  state.sessionsLoading = false;
}

export async function deleteSession(state: SessionsState, key: string) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.sessionsLoading) {
    return;
  }
  const confirmed = await showDangerConfirmDialog(
    "Delete Session",
    `Delete session "${key}"?\n\nThis deletes the session entry and archives its transcript.`,
    "Delete",
  );
  if (!confirmed) {
    return;
  }

  // Snapshot for rollback
  const prevResult = state.sessionsResult ? snapshot(state.sessionsResult) : null;
  const prevSessions = state.sessionsResult?.sessions
    ? snapshot(state.sessionsResult.sessions)
    : null;

  await optimistic({
    apply() {
      // Optimistically remove the session from the list
      if (state.sessionsResult?.sessions) {
        const filtered = state.sessionsResult.sessions.filter((s) => s.key !== key);
        state.sessionsResult = {
          ...state.sessionsResult,
          sessions: filtered,
          count: filtered.length,
        };
      }
      state.sessionsLoading = true;
      state.sessionsError = null;
    },
    rollback() {
      if (prevResult && prevSessions) {
        state.sessionsResult = { ...prevResult, sessions: prevSessions };
      }
      state.sessionsLoading = false;
    },
    mutate: () => state.client!.request("sessions.delete", { key, deleteTranscript: true }),
    async refresh() {
      state.sessionsLoading = false;
      await loadSessions(state);
    },
    errorTitle: "Delete failed",
  });

  state.sessionsLoading = false;
}
