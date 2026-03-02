import { html, nothing, type TemplateResult } from "lit";
import { formatCost, formatNumber, formatTimestamp } from "./telemetry-format.ts";
import type {
  TelemetryCostBreakdown,
  TelemetryCostGroupBy,
  TelemetryErrorEntry,
  TelemetryLeaderboardEntry,
  TelemetrySessionSummary,
  TelemetryUsageSummary,
  TelemetryView,
} from "./telemetry-types.ts";

export type TelemetryDashboardProps = {
  view: TelemetryView;
  loading: boolean;
  error: string | null;
  usage: TelemetryUsageSummary | null;
  sessions: TelemetrySessionSummary[];
  sessionsLoading: boolean;
  costs: TelemetryCostBreakdown[];
  costsLoading: boolean;
  costGroupBy: TelemetryCostGroupBy;
  topModels: TelemetryLeaderboardEntry[];
  topTools: TelemetryLeaderboardEntry[];
  errors: TelemetryErrorEntry[];
  errorsExpanded: boolean;
  activeMonitor: boolean;
  onRefresh: () => void;
  onCostGroupByChange: (groupBy: TelemetryCostGroupBy) => void;
  onSessionClick: (key: string) => void;
  onToggleErrors: () => void;
  onToggleActiveMonitor: () => void;
};

function formatRelativeTime(ts: string): string {
  try {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) {
      return "just now";
    }
    if (diff < 3_600_000) {
      return `${Math.floor(diff / 60_000)}m ago`;
    }
    if (diff < 86_400_000) {
      return `${Math.floor(diff / 3_600_000)}h ago`;
    }
    return `${Math.floor(diff / 86_400_000)}d ago`;
  } catch {
    return ts;
  }
}

// -- Summary KPI cards --
function renderKpiStrip(usage: TelemetryUsageSummary | null, loading: boolean): TemplateResult {
  if (loading && !usage) {
    return html`
      <div class="telem-kpi-strip">
        ${[1, 2, 3, 4, 5].map(
          () =>
            html`
              <div class="telem-kpi-card telem-kpi-card--skeleton"><div class="telem-skeleton-bar"></div></div>
            `,
        )}
      </div>
    `;
  }
  const u = usage ?? {
    totalSessions: 0,
    totalRuns: 0,
    totalTokens: 0,
    estimatedCost: 0,
    errorCount: 0,
  };
  return html`
    <div class="telem-kpi-strip">
      <div class="telem-kpi-card">
        <div class="telem-kpi-label">Sessions</div>
        <div class="telem-kpi-value">${formatNumber(u.totalSessions)}</div>
      </div>
      <div class="telem-kpi-card">
        <div class="telem-kpi-label">Runs</div>
        <div class="telem-kpi-value">${formatNumber(u.totalRuns)}</div>
      </div>
      <div class="telem-kpi-card">
        <div class="telem-kpi-label">Tokens</div>
        <div class="telem-kpi-value">${formatNumber(u.totalTokens)}</div>
      </div>
      <div class="telem-kpi-card">
        <div class="telem-kpi-label">Estimated Cost</div>
        <div class="telem-kpi-value telem-kpi-value--cost">${formatCost(u.estimatedCost)}</div>
      </div>
      <div class="telem-kpi-card ${u.errorCount > 0 ? "telem-kpi-card--danger" : ""}">
        <div class="telem-kpi-label">Errors</div>
        <div class="telem-kpi-value">${formatNumber(u.errorCount)}</div>
      </div>
    </div>
  `;
}

// -- Cost breakdown chart (horizontal stacked bars) --
function renderCostChart(
  costs: TelemetryCostBreakdown[],
  loading: boolean,
  groupBy: TelemetryCostGroupBy,
  onGroupByChange: (g: TelemetryCostGroupBy) => void,
): TemplateResult {
  const groups: TelemetryCostGroupBy[] = ["model", "provider", "day", "session"];
  const maxCost = costs.reduce((max, c) => Math.max(max, c.totalCost), 0);

  return html`
    <div class="card telem-cost-card">
      <div class="telem-card-header">
        <div class="card-title">Cost Breakdown</div>
        <div class="telem-toggle-group">
          ${groups.map(
            (g) => html`
              <button
                class="telem-toggle-btn ${g === groupBy ? "telem-toggle-btn--active" : ""}"
                @click=${() => onGroupByChange(g)}
              >${g}</button>
            `,
          )}
        </div>
      </div>
      ${
        loading && costs.length === 0
          ? html`
              <div class="telem-chart-skeleton">
                <div class="telem-skeleton-bar" style="width: 80%"></div>
                <div class="telem-skeleton-bar" style="width: 60%"></div>
                <div class="telem-skeleton-bar" style="width: 40%"></div>
              </div>
            `
          : costs.length === 0
            ? html`
                <div class="telem-empty">No cost data available</div>
              `
            : html`
              <div class="telem-cost-bars">
                ${costs.slice(0, 15).map((c) => {
                  const total = c.totalCost || 1;
                  const inputPct = (c.inputCost / total) * 100;
                  const outputPct = (c.outputCost / total) * 100;
                  const cachePct = (c.cacheCost / total) * 100;
                  const barWidth = maxCost > 0 ? (c.totalCost / maxCost) * 100 : 0;
                  return html`
                    <div class="telem-cost-row">
                      <div class="telem-cost-label" title=${c.label}>${c.label}</div>
                      <div class="telem-cost-bar-wrap">
                        <div class="telem-cost-bar" style="width: ${barWidth}%">
                          <div class="telem-cost-seg telem-cost-seg--input" style="width: ${inputPct}%" title="Input: ${formatCost(c.inputCost)}"></div>
                          <div class="telem-cost-seg telem-cost-seg--output" style="width: ${outputPct}%" title="Output: ${formatCost(c.outputCost)}"></div>
                          <div class="telem-cost-seg telem-cost-seg--cache" style="width: ${cachePct}%" title="Cache: ${formatCost(c.cacheCost)}"></div>
                        </div>
                      </div>
                      <div class="telem-cost-amount">${formatCost(c.totalCost)}</div>
                    </div>
                  `;
                })}
              </div>
              <div class="telem-cost-legend">
                <span class="telem-legend-item"><span class="telem-legend-dot telem-legend-dot--input"></span> Input</span>
                <span class="telem-legend-item"><span class="telem-legend-dot telem-legend-dot--output"></span> Output</span>
                <span class="telem-legend-item"><span class="telem-legend-dot telem-legend-dot--cache"></span> Cache</span>
              </div>
            `
      }
    </div>
  `;
}

// -- Sessions table --
function renderSessionsTable(
  sessions: TelemetrySessionSummary[],
  loading: boolean,
  onSessionClick: (key: string) => void,
): TemplateResult {
  return html`
    <div class="card telem-sessions-card">
      <div class="telem-card-header">
        <div class="card-title">Recent Sessions</div>
        ${
          loading
            ? html`
                <span class="telem-loading-dot"></span>
              `
            : nothing
        }
      </div>
      ${
        sessions.length === 0 && !loading
          ? html`
              <div class="telem-empty">No sessions recorded yet</div>
            `
          : html`
            <div class="telem-table-wrap">
              <table class="telem-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Agent</th>
                    <th>Runs</th>
                    <th>Last Activity</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  ${sessions.map(
                    (s) => html`
                      <tr class="telem-session-row" @click=${() => onSessionClick(s.key)}>
                        <td class="telem-session-key" title=${s.key}>${s.key.length > 20 ? s.key.slice(0, 20) + "..." : s.key}</td>
                        <td>${s.agentId ?? "-"}</td>
                        <td>${s.runCount}</td>
                        <td>${s.lastActivity ? formatRelativeTime(s.lastActivity) : "-"}</td>
                        <td>${formatNumber(s.totalTokens)}</td>
                        <td>${formatCost(s.totalCost)}</td>
                        <td class="${s.errorCount > 0 ? "telem-cell-danger" : ""}">${s.errorCount}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            </div>
          `
      }
    </div>
  `;
}

// -- Leaderboard cards --
function renderLeaderboards(
  topModels: TelemetryLeaderboardEntry[],
  topTools: TelemetryLeaderboardEntry[],
): TemplateResult {
  const renderBoard = (title: string, items: TelemetryLeaderboardEntry[], unit: string) => {
    const maxVal = items.reduce((m, e) => Math.max(m, e.value), 0);
    return html`
      <div class="card telem-leaderboard-card">
        <div class="card-title">${title}</div>
        ${
          items.length === 0
            ? html`
                <div class="telem-empty">No data</div>
              `
            : html`
              <div class="telem-leaderboard-list">
                ${items.slice(0, 8).map(
                  (item, idx) => html`
                    <div class="telem-leaderboard-row">
                      <span class="telem-leaderboard-rank">${idx + 1}</span>
                      <span class="telem-leaderboard-label" title=${item.label}>${item.label}</span>
                      <div class="telem-leaderboard-bar-wrap">
                        <div class="telem-leaderboard-bar" style="width: ${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%"></div>
                      </div>
                      <span class="telem-leaderboard-value">${unit === "$" ? formatCost(item.value) : formatNumber(item.value)}</span>
                    </div>
                  `,
                )}
              </div>
            `
        }
      </div>
    `;
  };

  return html`
    <div class="telem-leaderboard-grid">
      ${renderBoard("Top Models by Cost", topModels, "$")}
      ${renderBoard("Top Tools by Usage", topTools, "#")}
    </div>
  `;
}

// -- Errors panel --
function renderErrorsPanel(
  errors: TelemetryErrorEntry[],
  expanded: boolean,
  onToggle: () => void,
): TemplateResult | typeof nothing {
  if (errors.length === 0) {
    return nothing;
  }

  return html`
    <div class="card telem-errors-card">
      <button class="telem-card-header telem-card-header--clickable" @click=${onToggle}>
        <div class="card-title">Recent Errors <span class="telem-badge telem-badge--danger">${errors.length}</span></div>
        <span class="telem-chevron ${expanded ? "telem-chevron--open" : ""}">&#9662;</span>
      </button>
      ${
        expanded
          ? html`
            <div class="telem-errors-list">
              ${errors.slice(0, 10).map(
                (e) => html`
                  <div class="telem-error-item">
                    <div class="telem-error-header">
                      <span class="telem-error-time">${formatTimestamp(e.timestamp)}</span>
                      <span class="telem-error-source">${e.source}</span>
                    </div>
                    <div class="telem-error-message">${e.message}</div>
                  </div>
                `,
              )}
            </div>
          `
          : nothing
      }
    </div>
  `;
}

// -- Main dashboard render --
export function renderTelemetryDashboard(props: TelemetryDashboardProps): TemplateResult {
  return html`
    <div class="telem-dashboard">
      <div class="telem-header">
        <div class="telem-header-left">
          <div class="page-title">Telemetry</div>
          <div class="page-sub">System-wide observability and cost analysis</div>
        </div>
        <div class="telem-header-actions">
          <label class="telem-monitor-toggle">
            <input
              type="checkbox"
              .checked=${props.activeMonitor}
              @change=${() => props.onToggleActiveMonitor()}
            />
            <span>Live</span>
          </label>
          <button class="btn btn--sm" @click=${props.onRefresh} ?disabled=${props.loading}>
            ${props.loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      ${props.error ? html`<div class="callout danger">${props.error}</div>` : nothing}

      ${renderKpiStrip(props.usage, props.loading)}

      ${renderCostChart(props.costs, props.costsLoading, props.costGroupBy, props.onCostGroupByChange)}

      ${renderSessionsTable(props.sessions, props.sessionsLoading, props.onSessionClick)}

      ${renderLeaderboards(props.topModels, props.topTools)}

      ${renderErrorsPanel(props.errors, props.errorsExpanded, props.onToggleErrors)}
    </div>
  `;
}
