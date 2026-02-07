/**
 * Decision Audit Log — Timestamped log of every Overseer decision/event.
 *
 * Features:
 * - Filterable by event type, goal, time range
 * - Searchable across event data
 * - Shows reasoning chain and dispatched actions
 * - Paginated with "load more"
 */

import { html, nothing } from "lit";
import type { OverseerEventsResultEvent } from "../types/overseer";
import { clampText, formatAgo } from "../format";
import { icon, type IconName } from "../icons";

// --- Types ---

export type AuditLogFilter = {
  goalId?: string | null;
  eventType?: string | null;
  search?: string;
  timeRange?: "1h" | "24h" | "7d" | "30d" | "all";
};

export type AuditLogState = {
  loading: boolean;
  error: string | null;
  events: OverseerEventsResultEvent[];
  total: number;
  hasMore: boolean;
  filter: AuditLogFilter;
  expandedEventIndex: number | null;
};

export type AuditLogProps = {
  state: AuditLogState;
  goals: Array<{ goalId: string; title: string }>;
  onFilterChange: (filter: Partial<AuditLogFilter>) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  onToggleExpand: (index: number) => void;
};

// --- Constants ---

const EVENT_TYPE_LABELS: Record<string, string> = {
  "goal.created": "Goal Created",
  "goal.paused": "Goal Paused",
  "goal.resumed": "Goal Resumed",
  "goal.updated": "Goal Updated",
  "goal.cancelled": "Goal Cancelled",
  "plan.generated": "Plan Generated",
  "work.updated": "Work Updated",
  "crystallization.created": "Progress Crystallized",
  "assignment.dispatched": "Assignment Dispatched",
  "assignment.stalled": "Assignment Stalled",
  "assignment.completed": "Assignment Completed",
  "simulator.tick_triggered": "Simulator Tick",
  "simulator.assignment_stalled": "Simulated Stall",
  "simulator.assignment_active": "Simulated Activity",
  "simulator.goal_completed": "Simulated Completion",
};

const EVENT_TYPE_ICONS: Record<string, IconName> = {
  "goal.created": "plus-circle",
  "goal.paused": "pause-circle",
  "goal.resumed": "play-circle",
  "goal.updated": "edit-3",
  "goal.cancelled": "x-circle",
  "plan.generated": "git-branch",
  "work.updated": "check-circle",
  "crystallization.created": "database",
  "assignment.dispatched": "send",
  "assignment.stalled": "alert-triangle",
  "assignment.completed": "check-circle",
};

const EVENT_STATUS_COLORS: Record<string, string> = {
  "goal.created": "accent",
  "goal.paused": "warn",
  "goal.resumed": "success",
  "goal.updated": "info",
  "goal.cancelled": "error",
  "plan.generated": "accent",
  "work.updated": "success",
  "crystallization.created": "info",
  "assignment.dispatched": "accent",
  "assignment.stalled": "warn",
  "assignment.completed": "success",
};

const TIME_RANGES: Array<{ label: string; value: AuditLogFilter["timeRange"] }> = [
  { label: "1h", value: "1h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "All", value: "all" },
];

const UNIQUE_EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS);

// --- Helpers ---

function getEventLabel(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type.replace(/\./g, " › ");
}

function getEventIcon(type: string): IconName {
  // Try exact match first, then prefix match
  if (EVENT_TYPE_ICONS[type]) return EVENT_TYPE_ICONS[type];
  const prefix = type.split(".")[0];
  if (prefix === "goal") return "target";
  if (prefix === "work") return "check-square";
  if (prefix === "assignment") return "user-check";
  if (prefix === "simulator") return "cpu";
  if (prefix === "crystallization") return "database";
  return "activity";
}

function getEventColor(type: string): string {
  if (EVENT_STATUS_COLORS[type]) return EVENT_STATUS_COLORS[type];
  if (type.startsWith("simulator.")) return "info";
  if (type.includes("error") || type.includes("fail")) return "error";
  if (type.includes("stall") || type.includes("block")) return "warn";
  return "info";
}

function formatEventData(data: Record<string, unknown> | undefined): string {
  if (!data || Object.keys(data).length === 0) return "";
  return JSON.stringify(data, null, 2);
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// --- Render ---

export function renderAuditLog(props: AuditLogProps) {
  const { state, goals } = props;

  return html`
    <div class="audit-log">
      ${renderAuditLogHeader(props)}
      ${renderAuditLogFilters(props, goals)}
      ${state.error ? html`<div class="audit-log__error">${state.error}</div>` : nothing}
      ${renderAuditLogBody(props)}
    </div>
  `;
}

function renderAuditLogHeader(props: AuditLogProps) {
  const { state } = props;
  return html`
    <div class="audit-log__header">
      <div class="audit-log__header-left">
        <div class="audit-log__icon">
          ${icon("file-text", { size: 20 })}
        </div>
        <div>
          <div class="audit-log__title">Decision Audit Log</div>
          <div class="audit-log__subtitle">
            ${state.total > 0 ? `${state.total} events recorded` : "No events yet"}
          </div>
        </div>
      </div>
      <div class="audit-log__header-actions">
        <button
          class="btn btn--sm btn--secondary"
          title="Refresh events"
          ?disabled=${state.loading}
          @click=${() => props.onRefresh()}
        >
          ${icon("refresh-cw", { size: 14 })}
          <span>Refresh</span>
        </button>
      </div>
    </div>
  `;
}

function renderAuditLogFilters(
  props: AuditLogProps,
  goals: Array<{ goalId: string; title: string }>,
) {
  const { state } = props;
  const filter = state.filter;

  return html`
    <div class="audit-log__filters">
      <div class="audit-log__filters-row">
        <!-- Time range buttons -->
        <div class="audit-log__filter-group">
          <label class="audit-log__filter-label">Time</label>
          <div class="audit-log__time-buttons">
            ${TIME_RANGES.map(
              (range) => html`
                <button
                  class="audit-log__time-btn ${(filter.timeRange ?? "all") === range.value ? "audit-log__time-btn--active" : ""}"
                  @click=${() => props.onFilterChange({ timeRange: range.value })}
                >
                  ${range.label}
                </button>
              `,
            )}
          </div>
        </div>

        <!-- Event type filter -->
        <div class="audit-log__filter-group">
          <label class="audit-log__filter-label">Type</label>
          <select
            class="audit-log__select"
            @change=${(e: Event) => {
              const val = (e.target as HTMLSelectElement).value;
              props.onFilterChange({ eventType: val || null });
            }}
          >
            <option value="" ?selected=${!filter.eventType}>All Types</option>
            ${UNIQUE_EVENT_TYPES.map(
              (type) => html`
                <option value=${type} ?selected=${filter.eventType === type}>
                  ${getEventLabel(type)}
                </option>
              `,
            )}
          </select>
        </div>

        <!-- Goal filter -->
        ${
          goals.length > 0
            ? html`
              <div class="audit-log__filter-group">
                <label class="audit-log__filter-label">Goal</label>
                <select
                  class="audit-log__select"
                  @change=${(e: Event) => {
                    const val = (e.target as HTMLSelectElement).value;
                    props.onFilterChange({ goalId: val || null });
                  }}
                >
                  <option value="" ?selected=${!filter.goalId}>All Goals</option>
                  ${goals.map(
                    (g) => html`
                      <option value=${g.goalId} ?selected=${filter.goalId === g.goalId}>
                        ${clampText(g.title, 30)}
                      </option>
                    `,
                  )}
                </select>
              </div>
            `
            : nothing
        }

        <!-- Search -->
        <div class="audit-log__filter-group audit-log__filter-group--search">
          <label class="audit-log__filter-label">Search</label>
          <div class="audit-log__search-wrapper">
            ${icon("search", { size: 14 })}
            <input
              class="audit-log__search"
              type="text"
              placeholder="Search events..."
              .value=${filter.search ?? ""}
              @input=${(e: Event) => {
                const val = (e.target as HTMLInputElement).value;
                props.onFilterChange({ search: val || undefined });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAuditLogBody(props: AuditLogProps) {
  const { state } = props;

  if (state.loading && state.events.length === 0) {
    return html`
      <div class="audit-log__loading">
        <div class="audit-log__loading-spinner"></div>
        <div>Loading events...</div>
      </div>
    `;
  }

  // Apply client-side search filter
  let displayedEvents = state.events;
  if (state.filter.search) {
    const searchLower = state.filter.search.toLowerCase();
    displayedEvents = displayedEvents.filter((e) => {
      const label = getEventLabel(e.type).toLowerCase();
      const goalTitle = (e.goalTitle ?? "").toLowerCase();
      const type = e.type.toLowerCase();
      const workNode = (e.workNodeId ?? "").toLowerCase();
      const dataStr = e.data ? JSON.stringify(e.data).toLowerCase() : "";
      return (
        label.includes(searchLower) ||
        goalTitle.includes(searchLower) ||
        type.includes(searchLower) ||
        workNode.includes(searchLower) ||
        dataStr.includes(searchLower)
      );
    });
  }

  if (displayedEvents.length === 0) {
    return html`
      <div class="audit-log__empty">
        <div class="audit-log__empty-icon">${icon("file-text", { size: 40 })}</div>
        <div class="audit-log__empty-title">No events found</div>
        <div class="audit-log__empty-text">
          ${
            state.filter.search || state.filter.eventType || state.filter.goalId
              ? "Try adjusting your filters"
              : "Events will appear here as the Overseer makes decisions"
          }
        </div>
      </div>
    `;
  }

  return html`
    <div class="audit-log__body">
      <div class="audit-log__timeline">
        ${displayedEvents.map((event, index) => renderAuditLogEvent(event, index, props))}
      </div>
      ${
        state.hasMore
          ? html`
            <div class="audit-log__load-more">
              <button
                class="btn btn--sm btn--secondary"
                ?disabled=${state.loading}
                @click=${() => props.onLoadMore()}
              >
                ${state.loading ? "Loading..." : `Load more (${state.total - state.events.length} remaining)`}
              </button>
            </div>
          `
          : nothing
      }
    </div>
  `;
}

function renderAuditLogEvent(
  event: OverseerEventsResultEvent,
  index: number,
  props: AuditLogProps,
) {
  const color = getEventColor(event.type);
  const eventIcon = getEventIcon(event.type);
  const label = getEventLabel(event.type);
  const isExpanded = props.state.expandedEventIndex === index;
  const hasData = event.data && Object.keys(event.data).length > 0;

  return html`
    <div
      class="audit-log__event ${isExpanded ? "audit-log__event--expanded" : ""}"
      style="animation-delay: ${Math.min(index * 30, 300)}ms;"
    >
      <div class="audit-log__event-timeline">
        <div class="audit-log__event-dot audit-log__event-dot--${color}">
          ${icon(eventIcon, { size: 12 })}
        </div>
        <div class="audit-log__event-line"></div>
      </div>
      <div
        class="audit-log__event-content ${hasData ? "audit-log__event-content--expandable" : ""}"
        @click=${() => hasData && props.onToggleExpand(index)}
        role=${hasData ? "button" : nothing}
        tabindex=${hasData ? "0" : nothing}
      >
        <div class="audit-log__event-header">
          <div class="audit-log__event-label">
            <span class="audit-log__event-badge audit-log__event-badge--${color}">
              ${label}
            </span>
            ${
              event.goalTitle
                ? html`<span class="audit-log__event-goal" title="${event.goalId ?? ""}">
                    ${icon("target", { size: 11 })}
                    ${clampText(event.goalTitle, 25)}
                  </span>`
                : nothing
            }
            ${
              event.workNodeId
                ? html`<span class="audit-log__event-work-node">
                    ${icon("git-commit", { size: 11 })}
                    ${clampText(event.workNodeId, 20)}
                  </span>`
                : nothing
            }
          </div>
          <div class="audit-log__event-time">
            <span class="audit-log__event-time-abs" title="${formatTimestamp(event.ts)}">
              ${formatAgo(event.ts)}
            </span>
            ${
              hasData
                ? html`<span class="audit-log__event-expand-icon ${isExpanded ? "audit-log__event-expand-icon--open" : ""}">
                    ${icon("chevron-down", { size: 14 })}
                  </span>`
                : nothing
            }
          </div>
        </div>
        ${
          isExpanded && event.data
            ? html`
              <div class="audit-log__event-data">
                <pre class="audit-log__event-json">${formatEventData(event.data)}</pre>
              </div>
            `
            : nothing
        }
      </div>
    </div>
  `;
}

// --- Initial State ---

export function createInitialAuditLogState(): AuditLogState {
  return {
    loading: false,
    error: null,
    events: [],
    total: 0,
    hasMore: false,
    filter: {
      timeRange: "all",
    },
    expandedEventIndex: null,
  };
}
