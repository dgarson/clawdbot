/**
 * Agent Status Dashboard — real-time view of all running agents,
 * their tasks, token usage, and health status.
 */
import { html, nothing, type TemplateResult } from "lit";
import type {
  AgentsListResult,
  GatewayAgentRow,
  GatewaySessionRow,
  SessionsListResult,
  AgentIdentityResult,
  CronJob,
  CronStatus,
} from "../types.ts";
import { formatAgo } from "../format.ts";

// ── Types ──────────────────────────────────────────────────────────────────

export type AgentHealthStatus = "active" | "idle" | "stalled" | "errored" | "unknown";

export type AgentDashboardEntry = {
  agentId: string;
  displayName: string;
  emoji: string;
  isDefault: boolean;
  health: AgentHealthStatus;
  sessions: GatewaySessionRow[];
  activeSessions: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  lastActivity: number | null;
  currentTask: string | null;
  cronJobs: CronJob[];
};

export type AgentDashboardProps = {
  agents: AgentsListResult | null;
  sessions: SessionsListResult | null;
  identityById: Record<string, AgentIdentityResult>;
  cronJobs: CronJob[];
  cronStatus: CronStatus | null;
  loading: boolean;
  sessionsLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onDrillDown: (agentId: string) => void;
  onAbortSession?: (sessionKey: string) => void;
  onAbortAllForAgent?: (agentId: string) => void;
  onEmergencyStopAll?: () => void;
};

// ── Data Processing ────────────────────────────────────────────────────────

/** Extract agent ID from a session key like "agent:main:slack:..." */
function extractAgentId(sessionKey: string): string {
  const parts = sessionKey.split(":");
  // Session keys follow the pattern "agent:<agentId>:..."
  if (parts.length >= 2 && parts[0] === "agent") {
    return parts[1];
  }
  return "unknown";
}

function resolveDisplayName(agent: GatewayAgentRow, identity?: AgentIdentityResult | null): string {
  return identity?.name?.trim() || agent.identity?.name?.trim() || agent.name?.trim() || agent.id;
}

function resolveEmoji(agent: GatewayAgentRow, identity?: AgentIdentityResult | null): string {
  const candidates = [
    identity?.emoji,
    agent.identity?.emoji,
    identity?.avatar,
    agent.identity?.avatar,
  ];
  for (const c of candidates) {
    if (c && c.trim() && !c.includes("://") && !c.includes("/") && !c.includes(".")) {
      // Likely an emoji
      let hasNonAscii = false;
      for (let i = 0; i < c.length; i++) {
        if (c.charCodeAt(i) > 127) {
          hasNonAscii = true;
          break;
        }
      }
      if (hasNonAscii) return c.trim();
    }
  }
  return "";
}

function deriveHealth(sessions: GatewaySessionRow[], now: number): AgentHealthStatus {
  if (sessions.length === 0) return "idle";

  const hasError = sessions.some((s) => s.abortedLastRun);
  if (hasError) return "errored";

  // Check if any session was active in the last 5 minutes
  const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
  const hasRecent = sessions.some((s) => s.updatedAt && now - s.updatedAt < ACTIVE_THRESHOLD_MS);
  if (hasRecent) return "active";

  // If sessions exist but none are recent, check for stalled (active in last 30 min)
  const STALE_THRESHOLD_MS = 30 * 60 * 1000;
  const hasStale = sessions.some((s) => s.updatedAt && now - s.updatedAt < STALE_THRESHOLD_MS);
  if (hasStale) return "idle";

  return "idle";
}

function deriveCurrentTask(sessions: GatewaySessionRow[]): string | null {
  // Find the most recently updated session with meaningful info
  const sorted = [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  for (const session of sorted) {
    if (session.derivedTitle) return session.derivedTitle;
    if (session.lastMessagePreview) return session.lastMessagePreview;
    if (session.displayName) return session.displayName;
    if (session.label) return session.label;
  }
  return null;
}

export function buildDashboardEntries(props: AgentDashboardProps): AgentDashboardEntry[] {
  const agents = props.agents?.agents ?? [];
  const defaultId = props.agents?.defaultId ?? null;
  const allSessions = props.sessions?.sessions ?? [];
  const now = Date.now();

  // Group sessions by agent ID
  const sessionsByAgent = new Map<string, GatewaySessionRow[]>();
  for (const session of allSessions) {
    const agentId = extractAgentId(session.key);
    const existing = sessionsByAgent.get(agentId) ?? [];
    existing.push(session);
    sessionsByAgent.set(agentId, existing);
  }

  // Group cron jobs by agent ID
  const cronByAgent = new Map<string, CronJob[]>();
  for (const job of props.cronJobs) {
    const agentId = job.agentId ?? defaultId ?? "main";
    const existing = cronByAgent.get(agentId) ?? [];
    existing.push(job);
    cronByAgent.set(agentId, existing);
  }

  return agents.map((agent) => {
    const sessions = sessionsByAgent.get(agent.id) ?? [];
    const identity = props.identityById[agent.id] ?? null;
    const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
    const activeSessions = sessions.filter(
      (s) => s.updatedAt && now - s.updatedAt < ACTIVE_THRESHOLD_MS,
    ).length;

    return {
      agentId: agent.id,
      displayName: resolveDisplayName(agent, identity),
      emoji: resolveEmoji(agent, identity),
      isDefault: Boolean(defaultId && agent.id === defaultId),
      health: deriveHealth(sessions, now),
      sessions,
      activeSessions,
      totalTokens: sessions.reduce((sum, s) => sum + (s.totalTokens ?? 0), 0),
      inputTokens: sessions.reduce((sum, s) => sum + (s.inputTokens ?? 0), 0),
      outputTokens: sessions.reduce((sum, s) => sum + (s.outputTokens ?? 0), 0),
      lastActivity: sessions.reduce<number | null>((latest, s) => {
        if (!s.updatedAt) return latest;
        return latest ? Math.max(latest, s.updatedAt) : s.updatedAt;
      }, null),
      currentTask: deriveCurrentTask(sessions),
      cronJobs: cronByAgent.get(agent.id) ?? [],
    };
  });
}

// ── Formatting Helpers ─────────────────────────────────────────────────────

function formatTokenCount(tokens: number): string {
  if (tokens === 0) return "0";
  if (tokens < 1000) return String(tokens);
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

function healthIcon(status: AgentHealthStatus): string {
  switch (status) {
    case "active":
      return "●";
    case "idle":
      return "○";
    case "stalled":
      return "◐";
    case "errored":
      return "✖";
    default:
      return "?";
  }
}

function healthLabel(status: AgentHealthStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "idle":
      return "Idle";
    case "stalled":
      return "Stalled";
    case "errored":
      return "Errored";
    default:
      return "Unknown";
  }
}

function healthClass(status: AgentHealthStatus): string {
  switch (status) {
    case "active":
      return "health--active";
    case "idle":
      return "health--idle";
    case "stalled":
      return "health--stalled";
    case "errored":
      return "health--errored";
    default:
      return "health--unknown";
  }
}

// ── Render Functions ───────────────────────────────────────────────────────

function renderSummaryCards(entries: AgentDashboardEntry[]) {
  const totalActive = entries.filter((e) => e.health === "active").length;
  const totalStalled = entries.filter((e) => e.health === "stalled").length;
  const totalErrored = entries.filter((e) => e.health === "errored").length;
  const totalTokens = entries.reduce((sum, e) => sum + e.totalTokens, 0);

  // Primary 4 cards in a responsive grid that wraps cleanly
  return html`
    <div class="dashboard-summary" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px;">
      <div class="summary-card">
        <div class="summary-value">${entries.length}</div>
        <div class="summary-label">Agents</div>
      </div>
      <div class="summary-card summary-card--active">
        <div class="summary-value">${totalActive}</div>
        <div class="summary-label">Active</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${formatTokenCount(totalTokens)}</div>
        <div class="summary-label">Total Tokens</div>
      </div>
      ${
        totalErrored > 0
          ? html`
              <div class="summary-card summary-card--error">
                <div class="summary-value">${totalErrored}</div>
                <div class="summary-label">Errored</div>
              </div>
            `
          : nothing
      }
      ${
        totalStalled > 0
          ? html`
              <div class="summary-card summary-card--stalled">
                <div class="summary-value">${totalStalled}</div>
                <div class="summary-label">Stalled</div>
              </div>
            `
          : nothing
      }
    </div>
  `;
}

function renderAgentCard(
  entry: AgentDashboardEntry,
  onDrillDown: (agentId: string) => void,
  onAbortSession?: (sessionKey: string) => void,
  onAbortAllForAgent?: (agentId: string) => void,
): TemplateResult {
  const avatar = entry.emoji || entry.displayName.slice(0, 1);
  const recentSessions = [...entry.sessions]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 5);

  return html`
    <div
      class="dashboard-agent-card ${healthClass(entry.health)}"
      @click=${() => onDrillDown(entry.agentId)}
      role="button"
      tabindex="0"
      @keydown=${(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDrillDown(entry.agentId);
        }
      }}
    >
      <div class="dashboard-agent-header">
        <div class="dashboard-agent-identity">
          <div class="agent-avatar">${avatar}</div>
          <div>
            <div class="dashboard-agent-name">
              ${entry.displayName}
              ${
                entry.isDefault
                  ? html`
                      <span class="agent-pill">default</span>
                    `
                  : nothing
              }
            </div>
            <div class="dashboard-agent-id mono">${entry.agentId}</div>
          </div>
        </div>
        <div class="dashboard-health-badge ${healthClass(entry.health)}">
          <span class="health-dot">${healthIcon(entry.health)}</span>
          <span>${healthLabel(entry.health)}</span>
        </div>
      </div>

      ${
        entry.currentTask
          ? html`
              <div class="dashboard-current-task">
                <div class="dashboard-task-label">Current activity</div>
                <div class="dashboard-task-text">${truncateText(entry.currentTask, 120)}</div>
              </div>
            `
          : nothing
      }

      <div class="dashboard-metrics" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px;">
        <div class="dashboard-metric">
          <span class="metric-value">${entry.activeSessions} / ${entry.sessions.length}</span>
          <span class="metric-label">Sessions (active)</span>
        </div>
        <div class="dashboard-metric">
          <span class="metric-value">${formatTokenCount(entry.totalTokens)}</span>
          <span class="metric-label">Tokens</span>
        </div>
        ${
          entry.cronJobs.filter((j) => j.enabled).length > 0
            ? html`
                <div class="dashboard-metric">
                  <span class="metric-value">${entry.cronJobs.filter((j) => j.enabled).length}</span>
                  <span class="metric-label">Cron</span>
                </div>
              `
            : nothing
        }
        <div class="dashboard-metric">
          <span class="metric-value">${entry.lastActivity ? formatAgo(entry.lastActivity) : "—"}</span>
          <span class="metric-label">Last Active</span>
        </div>
      </div>

      ${
        recentSessions.length > 0
          ? html`
              <div class="dashboard-sessions-list">
                <div class="dashboard-sessions-header" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Recent Sessions</span>
                  ${
                    onAbortAllForAgent && entry.activeSessions > 0
                      ? html`
                          <button
                            class="btn-small danger"
                            @click=${(e: Event) => {
                              e.stopPropagation();
                              onAbortAllForAgent(entry.agentId);
                            }}
                            title="Abort all active sessions for this agent"
                          >
                            ⏹ Stop Agent
                          </button>
                        `
                      : nothing
                  }
                </div>
                ${recentSessions.map((session) => {
                  const isActive = Boolean(
                    session.updatedAt && Date.now() - session.updatedAt < 5 * 60 * 1000,
                  );
                  return html`
                    <div class="dashboard-session-row" style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; transition: background-color 0.15s;" @mouseenter=${(e: Event) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-surface-hover, rgba(128,128,128,0.08))")} @mouseleave=${(e: Event) => ((e.currentTarget as HTMLElement).style.backgroundColor = "")}>
                      <div class="dashboard-session-status">
                        <span
                          class="statusDot ${isActive ? "ok" : ""}"
                        ></span>
                      </div>
                      <div class="dashboard-session-info" style="flex: 1; min-width: 0;">
                        <div class="dashboard-session-name" style="display: flex; align-items: center; gap: 6px;">
                          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${session.displayName || session.label || shortenSessionKey(session.key)}</span>
                          ${
                            session.channel
                              ? html`<span class="pill" style="font-size: 10px; padding: 1px 6px;">${session.channel}</span>`
                              : nothing
                          }
                        </div>
                        <div class="dashboard-session-meta mono" style="display: flex; align-items: center; gap: 4px;">
                          ${session.updatedAt ? html`<span>${formatAgo(session.updatedAt)}</span>` : nothing}
                        </div>
                      </div>
                      <div class="mono" style="flex-shrink: 0; font-size: 12px; color: var(--color-muted, #888);">
                        ${formatTokenCount(session.totalTokens ?? 0)}
                      </div>
                      ${
                        session.abortedLastRun
                          ? html`
                              <span class="pill pill--danger">aborted</span>
                            `
                          : isActive && onAbortSession
                            ? html`
                                <button
                                  class="btn-small warning"
                                  @click=${(e: Event) => {
                                    e.stopPropagation();
                                    onAbortSession(session.key);
                                  }}
                                  title="Abort this session's active run"
                                >
                                  ⏹
                                </button>
                              `
                            : nothing
                      }
                    </div>
                  `;
                })}
              </div>
            `
          : html`
              <div class="dashboard-sessions-empty muted">No active sessions</div>
            `
      }
    </div>
  `;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

function shortenSessionKey(key: string): string {
  // "agent:main:slack:channel:c0aap72r7l5" → "slack:channel:c0aap72r7l5"
  const parts = key.split(":");
  if (parts.length > 2 && parts[0] === "agent") {
    return parts.slice(2).join(":");
  }
  return key;
}

// ── Main Render ────────────────────────────────────────────────────────────

export function renderAgentDashboard(props: AgentDashboardProps): TemplateResult {
  const entries = buildDashboardEntries(props);

  // Sort: active first, then by last activity
  entries.sort((a, b) => {
    const healthOrder: Record<AgentHealthStatus, number> = {
      active: 0,
      errored: 1,
      stalled: 2,
      idle: 3,
      unknown: 4,
    };
    const hDiff = healthOrder[a.health] - healthOrder[b.health];
    if (hDiff !== 0) return hDiff;
    return (b.lastActivity ?? 0) - (a.lastActivity ?? 0);
  });

  const totalActiveSessions = entries.reduce((sum, e) => sum + e.activeSessions, 0);

  return html`
    <div class="dashboard-container">
      <div class="dashboard-header">
        <div>
          <div class="card-title">Agent Status Dashboard</div>
          <div class="card-sub">Real-time overview of all agents, sessions, and resource usage.</div>
        </div>
        <div class="row" style="gap: 8px;">
          ${
            props.onEmergencyStopAll && totalActiveSessions > 0
              ? html`
                  <button
                    class="btn danger"
                    ?disabled=${props.loading || props.sessionsLoading}
                    @click=${props.onEmergencyStopAll}
                    title="Emergency stop — abort ALL active sessions across all agents"
                  >
                    ⛔ Stop All (${totalActiveSessions})
                  </button>
                `
              : nothing
          }
          <button
            class="btn"
            ?disabled=${props.loading || props.sessionsLoading}
            @click=${props.onRefresh}
          >
            ${props.loading || props.sessionsLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      ${
        props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
          : nothing
      }

      ${renderSummaryCards(entries)}

      ${
        props.cronStatus
          ? html`
              <div class="dashboard-cron-status">
                <span class="statusDot ${props.cronStatus.enabled ? "ok" : ""}"></span>
                <span>Cron scheduler: ${props.cronStatus.enabled ? "enabled" : "disabled"}</span>
                <span class="muted">· ${props.cronStatus.jobs} jobs</span>
                ${
                  props.cronStatus.nextWakeAtMs
                    ? html`<span class="muted">· next: ${formatAgo(props.cronStatus.nextWakeAtMs)}</span>`
                    : nothing
                }
              </div>
            `
          : nothing
      }

      <div class="dashboard-grid">
        ${
          entries.length === 0
            ? html`
                <div class="card" style="padding: 32px; text-align: center">
                  <div class="muted">No agents configured.</div>
                </div>
              `
            : entries.map((entry) =>
                renderAgentCard(
                  entry,
                  props.onDrillDown,
                  props.onAbortSession,
                  props.onAbortAllForAgent,
                ),
              )
        }
      </div>
    </div>
  `;
}
