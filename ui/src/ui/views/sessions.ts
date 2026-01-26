import { html, nothing } from "lit";

import { toast } from "../components/toast";
import { skeleton } from "../components/design-utils";
import { formatAgo } from "../format";
import { formatSessionTokens } from "../presenter";
import { pathForTab } from "../navigation";
import { icon } from "../icons";
import type { AgentsListResult, GatewayAgentRow, GatewaySessionRow, SessionsListResult } from "../types";

export type SessionActiveTask = {
  taskId: string;
  taskName: string;
  status: "in-progress" | "pending";
  startedAt?: number;
};

export type SessionStatus = "active" | "idle" | "completed";
export type SessionSortColumn = "name" | "updated" | "tokens" | "status" | "kind";
export type SessionSortDir = "asc" | "desc";
export type SessionKindFilter = "all" | "direct" | "group" | "global" | "unknown";
export type SessionStatusFilter = "all" | "active" | "idle" | "completed";

export type SessionActiveTask = {
  taskId: string;
  taskName: string;
  status: "in-progress" | "pending";
  startedAt?: number;
};

export type SessionsProps = {
  loading: boolean;
  result: SessionsListResult | null;
  error: string | null;
  activeMinutes: string;
  limit: string;
  includeGlobal: boolean;
  includeUnknown: boolean;
  basePath: string;
  agents: AgentsListResult | null;
  // Active tasks per session (for showing task indicators)
  activeTasks?: Map<string, SessionActiveTask[]>;
  search: string;
  sort: SessionSortColumn;
  sortDir: SessionSortDir;
  kindFilter: SessionKindFilter;
  statusFilter: SessionStatusFilter;
  // Active tasks per session (for showing task indicators)
  activeTasks?: Map<string, SessionActiveTask[]>;
  onSessionOpen?: (key: string) => void;
  onFiltersChange: (next: {
    activeMinutes: string;
    limit: string;
    includeGlobal: boolean;
    includeUnknown: boolean;
  }) => void;
  onSearchChange: (search: string) => void;
  onSortChange: (column: SessionSortColumn) => void;
  onKindFilterChange: (kind: SessionKindFilter) => void;
  onStatusFilterChange: (status: SessionStatusFilter) => void;
  onRefresh: () => void;
  onPatch: (
    key: string,
    patch: {
      label?: string | null;
      thinkingLevel?: string | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    },
  ) => void;
  onDelete: (key: string) => void;
  onAgentSessionOpen: (agentId: string) => void;
  onViewSessionLogs?: (key: string) => void;
};

const THINK_LEVELS = ["", "off", "minimal", "low", "medium", "high"] as const;
const BINARY_THINK_LEVELS = ["", "off", "on"] as const;
const VERBOSE_LEVELS = [
  { value: "", label: "inherit" },
  { value: "off", label: "off (explicit)" },
  { value: "on", label: "on" },
] as const;
const REASONING_LEVELS = ["", "off", "on", "stream"] as const;

function normalizeProviderId(provider?: string | null): string {
  if (!provider) return "";
  const normalized = provider.trim().toLowerCase();
  if (normalized === "z.ai" || normalized === "z-ai") return "zai";
  return normalized;
}

function isBinaryThinkingProvider(provider?: string | null): boolean {
  return normalizeProviderId(provider) === "zai";
}

function resolveThinkLevelOptions(provider?: string | null): readonly string[] {
  return isBinaryThinkingProvider(provider) ? BINARY_THINK_LEVELS : THINK_LEVELS;
}

function resolveThinkLevelDisplay(value: string, isBinary: boolean): string {
  if (!isBinary) return value;
  if (!value || value === "off") return value;
  return "on";
}

function resolveThinkLevelPatchValue(value: string, isBinary: boolean): string | null {
  if (!value) return null;
  if (!isBinary) return value;
  if (value === "on") return "low";
  return value;
}

function truncateKey(key: string, maxLen = 28): string {
  if (key.length <= maxLen) return key;
  return key.slice(0, maxLen - 3) + "...";
}

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

function deriveSessionStatus(row: GatewaySessionRow): SessionStatus {
  if (!row.updatedAt) return "completed";
  const age = Date.now() - row.updatedAt;
  if (age < ACTIVE_THRESHOLD_MS) return "active";
  if (age < IDLE_THRESHOLD_MS) return "idle";
  return "completed";
}

function getStatusBadgeClass(status: SessionStatus): string {
  switch (status) {
    case "active":
      return "badge--success badge--animated";
    case "idle":
      return "badge--warning";
    case "completed":
      return "badge--muted";
  }
}

function matchesSearch(row: GatewaySessionRow, search: string): boolean {
  if (!search) return true;
  const lower = search.toLowerCase();
  const searchable = [
    row.key,
    row.displayName,
    row.label,
    row.channel,
    row.subject,
    row.sessionId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return searchable.includes(lower);
}

function filterSessions(
  rows: GatewaySessionRow[],
  props: SessionsProps,
): GatewaySessionRow[] {
  return rows.filter((row) => {
    if (!matchesSearch(row, props.search)) return false;
    if (props.kindFilter !== "all" && row.kind !== props.kindFilter) return false;
    if (props.statusFilter !== "all") {
      const status = deriveSessionStatus(row);
      if (status !== props.statusFilter) return false;
    }
    return true;
  });
}

function sortSessions(
  rows: GatewaySessionRow[],
  sort: SessionSortColumn,
  sortDir: SessionSortDir,
): GatewaySessionRow[] {
  const sorted = [...rows];
  const dir = sortDir === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    switch (sort) {
      case "name": {
        const nameA = (a.displayName ?? a.label ?? a.key).toLowerCase();
        const nameB = (b.displayName ?? b.label ?? b.key).toLowerCase();
        return nameA.localeCompare(nameB) * dir;
      }
      case "updated": {
        const timeA = a.updatedAt ?? 0;
        const timeB = b.updatedAt ?? 0;
        return (timeA - timeB) * dir;
      }
      case "tokens": {
        const tokensA = a.totalTokens ?? 0;
        const tokensB = b.totalTokens ?? 0;
        return (tokensA - tokensB) * dir;
      }
      case "status": {
        const statusOrder = { active: 0, idle: 1, completed: 2 };
        const statusA = statusOrder[deriveSessionStatus(a)];
        const statusB = statusOrder[deriveSessionStatus(b)];
        return (statusA - statusB) * dir;
      }
      case "kind": {
        const kindOrder = { direct: 0, group: 1, global: 2, unknown: 3 };
        const kindA = kindOrder[a.kind] ?? 4;
        const kindB = kindOrder[b.kind] ?? 4;
        return (kindA - kindB) * dir;
      }
      default:
        return 0;
    }
  });
  return sorted;
}

function renderSessionsSkeleton() {
  return html`
    ${[1, 2, 3, 4, 5].map(
      (i) => html`
        <div class="data-table__row" style="animation: view-fade-in 0.2s ease-out; animation-delay: ${i * 50}ms; animation-fill-mode: backwards;">
          <div class="data-table__cell">${skeleton({ width: "140px", height: "20px" })}</div>
          <div class="data-table__cell">${skeleton({ width: "80px", height: "20px" })}</div>
          <div class="data-table__cell">${skeleton({ width: "60px", height: "20px" })}</div>
          <div class="data-table__cell">${skeleton({ width: "70px", height: "20px" })}</div>
          <div class="data-table__cell">${skeleton({ width: "70px", height: "20px" })}</div>
          <div class="data-table__cell">${skeleton({ width: "50px", height: "20px" })}</div>
          <div class="data-table__cell">${skeleton({ width: "70px", height: "28px" })}</div>
          <div class="data-table__cell">${skeleton({ width: "70px", height: "28px" })}</div>
          <div class="data-table__cell">${skeleton({ width: "70px", height: "28px" })}</div>
          <div class="data-table__cell">${skeleton({ width: "60px", height: "28px" })}</div>
        </div>
      `,
    )}
  `;
}

function copyToClipboard(text: string): void {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast.success("Session key copied");
    })
    .catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("Session key copied");
    });
}

function renderSortIcon(column: SessionSortColumn, props: SessionsProps) {
  if (props.sort !== column) {
    return html`<span class="sort-icon sort-icon--inactive">${icon("chevrons-up-down", { size: 12 })}</span>`;
  }
  const iconName = props.sortDir === "asc" ? "chevron-up" : "chevron-down";
  return html`<span class="sort-icon sort-icon--active">${icon(iconName, { size: 12 })}</span>`;
}

export function renderSessions(props: SessionsProps) {
  const allRows = props.result?.sessions ?? [];
  const filteredRows = filterSessions(allRows, props);
  const rows = sortSessions(filteredRows, props.sort, props.sortDir);
  const agents = props.agents?.agents ?? [];
  const totalCount = allRows.length;
  const filteredCount = filteredRows.length;
  const hasFilters = props.search || props.kindFilter !== "all" || props.statusFilter !== "all";

  return html`
    ${renderAgentsSection(props, agents)}
    <section class="card">
      <!-- Modern Table Header Card -->
      <div class="table-header-card">
        <div class="table-header-card__left">
          <div class="table-header-card__icon">
            ${icon("file-text", { size: 22 })}
          </div>
          <div class="table-header-card__info">
            <div class="table-header-card__title">Sessions</div>
            <div class="table-header-card__subtitle">
              ${hasFilters
                ? `${filteredCount} of ${totalCount} session${totalCount !== 1 ? "s" : ""}`
                : `${totalCount} session${totalCount !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
        <div class="table-header-card__right">
          <button class="btn btn--secondary" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${icon("refresh-cw", { size: 14 })}
            <span>${props.loading ? "Loading..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      <!-- Search and Client-side Filters (instant) -->
      <div class="table-filters--modern" style="margin-bottom: 8px;">
        <div class="field--modern table-filters__search" style="position: relative; flex: 1; min-width: 200px;">
          <label class="field__label">Search</label>
          <div class="field__input-wrapper">
            <span class="field__icon">${icon("search", { size: 14 })}</span>
            <input
              class="field__input"
              type="text"
              placeholder="Filter by name, key, channel..."
              .value=${props.search}
              @input=${(e: Event) => props.onSearchChange((e.target as HTMLInputElement).value)}
            />
            ${props.search
              ? html`
                <button
                  class="field__clear"
                  title="Clear search"
                  @click=${() => props.onSearchChange("")}
                >
                  ${icon("x", { size: 12 })}
                </button>
              `
              : nothing}
          </div>
        </div>
        <div class="field--modern" style="min-width: 100px;">
          <label class="field__label">Kind</label>
          <select
            class="field__input"
            .value=${props.kindFilter}
            @change=${(e: Event) =>
              props.onKindFilterChange((e.target as HTMLSelectElement).value as SessionKindFilter)}
          >
            <option value="all">All</option>
            <option value="direct">Direct</option>
            <option value="group">Group</option>
            <option value="global">Global</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div class="field--modern" style="min-width: 120px;">
          <label class="field__label">Status</label>
          <select
            class="field__input"
            .value=${props.statusFilter}
            @change=${(e: Event) =>
              props.onStatusFilterChange((e.target as HTMLSelectElement).value as SessionStatusFilter)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <!-- Server-side Fetch Options -->
      <div class="table-filters--modern table-filters--secondary">
        <div class="table-filters__label">
          ${icon("database", { size: 12 })}
          <span>Fetch options (click Refresh to apply)</span>
        </div>
        <div class="field--modern" style="min-width: 100px;">
          <label class="field__label">Active within</label>
          <div class="field__input-wrapper">
            <span class="field__icon">${icon("clock", { size: 14 })}</span>
            <input
              class="field__input"
              type="text"
              placeholder="Minutes"
              .value=${props.activeMinutes}
              @input=${(e: Event) =>
                props.onFiltersChange({
                  activeMinutes: (e.target as HTMLInputElement).value,
                  limit: props.limit,
                  includeGlobal: props.includeGlobal,
                  includeUnknown: props.includeUnknown,
                })}
            />
          </div>
        </div>
        <div class="field--modern" style="min-width: 80px;">
          <label class="field__label">Limit</label>
          <input
            class="field__input"
            type="text"
            placeholder="100"
            .value=${props.limit}
            @input=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: (e.target as HTMLInputElement).value,
                includeGlobal: props.includeGlobal,
                includeUnknown: props.includeUnknown,
              })}
          />
        </div>
        <label class="table-filters__toggle ${props.includeGlobal ? "table-filters__toggle--active" : ""}">
          <input
            type="checkbox"
            .checked=${props.includeGlobal}
            @change=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: props.limit,
                includeGlobal: (e.target as HTMLInputElement).checked,
                includeUnknown: props.includeUnknown,
              })}
          />
          <span>Global</span>
        </label>
        <label class="table-filters__toggle ${props.includeUnknown ? "table-filters__toggle--active" : ""}">
          <input
            type="checkbox"
            .checked=${props.includeUnknown}
            @change=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: props.limit,
                includeGlobal: props.includeGlobal,
                includeUnknown: (e.target as HTMLInputElement).checked,
              })}
          />
          <span>Unknown</span>
        </label>
      </div>

      ${props.error
        ? html`
          <div class="callout--danger" style="margin-top: 12px;">
            <div class="callout__icon">${icon("alert-circle", { size: 18 })}</div>
            <div class="callout__content">${props.error}</div>
          </div>
        `
        : nothing}

      ${props.result
        ? html`<div class="muted" style="font-size: 11px; margin-top: 4px;">Store: ${props.result.path}</div>`
        : nothing}

      <div class="data-table data-table--modern sessions-table">
        <div class="data-table__header">
          <div
            class="data-table__header-cell data-table__header-cell--sortable"
            @click=${() => props.onSortChange("name")}
          >
            <span>Name</span>
            ${renderSortIcon("name", props)}
          </div>
          <div class="data-table__header-cell">Label</div>
          <div
            class="data-table__header-cell data-table__header-cell--sortable"
            @click=${() => props.onSortChange("kind")}
          >
            <span>Kind</span>
            ${renderSortIcon("kind", props)}
          </div>
          <div
            class="data-table__header-cell data-table__header-cell--sortable"
            @click=${() => props.onSortChange("status")}
          >
            <span>Status</span>
            ${renderSortIcon("status", props)}
          </div>
          <div
            class="data-table__header-cell data-table__header-cell--sortable"
            @click=${() => props.onSortChange("updated")}
          >
            <span>Updated</span>
            ${renderSortIcon("updated", props)}
          </div>
          <div
            class="data-table__header-cell data-table__header-cell--sortable"
            @click=${() => props.onSortChange("tokens")}
          >
            <span>Tokens</span>
            ${renderSortIcon("tokens", props)}
          </div>
          <div class="data-table__header-cell">Thinking</div>
          <div class="data-table__header-cell">Verbose</div>
          <div class="data-table__header-cell">Reasoning</div>
          <div class="data-table__header-cell data-table__header-cell--actions">Actions</div>
        </div>
        <div class="data-table__body" aria-busy=${props.loading && !props.result}>
          ${props.loading && !props.result
            ? renderSessionsSkeleton()
            : rows.length === 0
              ? html`
                <div class="data-table__empty">
                  <div class="data-table__empty-icon">${icon("file-text", { size: 32 })}</div>
                  <div class="data-table__empty-title">
                    ${hasFilters ? "No matching sessions" : "No sessions found"}
                  </div>
                  <div class="data-table__empty-desc">
                    ${hasFilters
                      ? "Try adjusting your search or filter criteria"
                      : "Sessions will appear here when users start conversations"}
                  </div>
                </div>
              `
              : rows.map((row) =>
                  renderRow(
                    row,
                    props.basePath,
                    props.onPatch,
                    props.onDelete,
                    props.onSessionOpen,
                    props.loading,
                    props.agents?.agents ?? [],
                    props.activeTasks?.get(row.key) ?? [],
                    props.onViewSessionLogs,
                  ),
                )}
        </div>
      </div>
    </section>
  `;
}

function renderAgentsSection(props: SessionsProps, agents: GatewayAgentRow[]) {
  if (agents.length === 0) return nothing;
  return html`
    <section class="card" style="margin-bottom: 20px;">
      <div class="card-header">
        <div class="card-header__icon">
          ${icon("user", { size: 20 })}
        </div>
        <div>
          <div class="card-title">Agents</div>
          <div class="card-sub">Start or navigate to an agent session</div>
        </div>
      </div>
      <div class="agent-cards" style="margin-top: 16px;">
        ${agents.map((agent) => renderAgentCard(agent, props))}
      </div>
    </section>
  `;
}

function renderAgentCard(agent: GatewayAgentRow, props: SessionsProps) {
  const name = agent.identity?.name ?? agent.name ?? agent.id;
  const emoji = agent.identity?.emoji ?? "";
  const avatar = agent.identity?.avatarUrl ?? agent.identity?.avatar ?? null;
  const hasExistingSession = findExistingAgentSession(props.result, agent.id);
  const buttonLabel = hasExistingSession ? "Open" : "Start";

  return html`
    <div class="agent-card">
      ${avatar
        ? html`<img class="agent-card__avatar" src=${avatar} alt="" />`
        : html`<div class="agent-card__emoji">${emoji || "🤖"}</div>`}
      <div class="agent-card__info">
        <div class="agent-card__name">${name}</div>
        <div class="agent-card__id">${agent.id}</div>
      </div>
      <button
        class="btn btn--primary btn--sm"
        ?disabled=${props.loading}
        @click=${() => props.onAgentSessionOpen(agent.id)}
      >
        ${icon(hasExistingSession ? "message-square" : "play", { size: 12 })}
        <span>${buttonLabel}</span>
      </button>
    </div>
  `;
}

function findExistingAgentSession(
  sessions: SessionsListResult | null,
  agentId: string,
): boolean {
  if (!sessions?.sessions) return false;
  const prefix = `agent:${agentId.toLowerCase()}:`;
  return sessions.sessions.some((s) => s.key.toLowerCase().startsWith(prefix));
}

function extractAgentIdFromSessionKey(key: string): string | null {
  const match = key.match(/^agent:([^:]+):/i);
  return match ? match[1] : null;
}

function renderRow(
  row: GatewaySessionRow,
  basePath: string,
  onPatch: SessionsProps["onPatch"],
  onDelete: SessionsProps["onDelete"],
  onSessionOpen: SessionsProps["onSessionOpen"],
  disabled: boolean,
  agents: GatewayAgentRow[],
  activeTasks: SessionActiveTask[],
  onViewLogs?: (key: string) => void,
) {
  const updated = row.updatedAt ? formatAgo(row.updatedAt) : "n/a";
  const rawThinking = row.thinkingLevel ?? "";
  const isBinaryThinking = isBinaryThinkingProvider(row.modelProvider);
  const thinking = resolveThinkLevelDisplay(rawThinking, isBinaryThinking);
  const thinkLevels = resolveThinkLevelOptions(row.modelProvider);
  const verbose = row.verboseLevel ?? "";
  const reasoning = row.reasoningLevel ?? "";
  const displayName = row.displayName ?? row.key;
  const canLink = row.kind !== "global";
  const chatUrl = canLink
    ? `${pathForTab("chat", basePath)}?session=${encodeURIComponent(row.key)}`
    : null;
  const status = deriveSessionStatus(row);
  const statusBadgeClass = getStatusBadgeClass(status);

  const kindBadgeClass = row.kind === "global"
    ? "badge--muted"
    : row.kind === "direct"
      ? "badge--accent badge--animated"
      : "badge--info badge--animated";

  // Extract agent info from session key
  const agentId = extractAgentIdFromSessionKey(row.key);
  const agent = agentId ? agents.find((a) => a.id.toLowerCase() === agentId.toLowerCase()) : null;
  const agentEmoji = agent?.identity?.emoji ?? null;
  const agentName = agent?.identity?.name ?? agent?.name ?? agentId;

  // Active task info
  const hasActiveTasks = activeTasks.length > 0;
  const inProgressCount = activeTasks.filter((t) => t.status === "in-progress").length;

  return html`
    <div class="data-table__row ${hasActiveTasks ? "data-table__row--active" : ""}">
      <div class="data-table__cell" data-label="Name">
        <div class="session-key">
          ${agentId
            ? html`
                <span class="session-agent-badge" title="Agent: ${agentName}">
                  ${agentEmoji ?? icon("user", { size: 12 })}
                </span>
              `
            : nothing}
          ${canLink
            ? html`<a
                href=${chatUrl}
                class="session-key__text"
                title=${row.key}
                @click=${(event: MouseEvent) => {
                  if (!onSessionOpen) return;
                  if (
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  ) {
                    return;
                  }
                  event.preventDefault();
                  onSessionOpen(row.key);
                }}
              >${truncateKey(displayName)}</a>`
            : html`<span class="session-key__text" style="color: var(--muted);" title=${row.key}>${truncateKey(displayName)}</span>`}
          ${hasActiveTasks
            ? html`
                <span class="session-active-indicator" title="${inProgressCount} task(s) in progress">
                  ${icon("activity", { size: 12 })}
                  ${inProgressCount > 0 ? html`<span class="session-active-count">${inProgressCount}</span>` : nothing}
                </span>
              `
            : nothing}
          <button
            class="session-key__copy"
            title="Copy session key"
            aria-label="Copy session key"
            @click=${(e: Event) => {
              e.stopPropagation();
              copyToClipboard(row.key);
            }}
          >
            ${icon("copy", { size: 12 })}
          </button>
        </div>
      </div>
      <div class="data-table__cell" data-label="Label">
        <input
          class="field__input"
          style="padding: 6px 10px; font-size: 12px; border-radius: 8px;"
          .value=${row.label ?? ""}
          ?disabled=${disabled}
          placeholder="Label"
          @change=${(e: Event) => {
            const value = (e.target as HTMLInputElement).value.trim();
            onPatch(row.key, { label: value || null });
          }}
        />
      </div>
      <div class="data-table__cell" data-label="Kind">
        <span class="badge ${kindBadgeClass}">${row.kind}</span>
      </div>
      <div class="data-table__cell" data-label="Status">
        <span class="badge ${statusBadgeClass}">${status}</span>
      </div>
      <div class="data-table__cell" data-label="Updated" style="font-size: 12px; color: var(--muted);">${updated}</div>
      <div class="data-table__cell" data-label="Tokens">
        <span class="badge badge--muted">${formatSessionTokens(row)}</span>
      </div>
      <div class="data-table__cell" data-label="Thinking">
        <select
          class="field__input"
          style="padding: 6px 28px 6px 10px; font-size: 11px; border-radius: 8px;"
          .value=${thinking}
          ?disabled=${disabled}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, {
              thinkingLevel: resolveThinkLevelPatchValue(value, isBinaryThinking),
            });
          }}
        >
          ${thinkLevels.map((level) =>
            html`<option value=${level}>${level || "inherit"}</option>`,
          )}
        </select>
      </div>
      <div class="data-table__cell" data-label="Verbose">
        <select
          class="field__input"
          style="padding: 6px 28px 6px 10px; font-size: 11px; border-radius: 8px;"
          .value=${verbose}
          ?disabled=${disabled}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, { verboseLevel: value || null });
          }}
        >
          ${VERBOSE_LEVELS.map(
            (level) => html`<option value=${level.value}>${level.label}</option>`,
          )}
        </select>
      </div>
      <div class="data-table__cell" data-label="Reasoning">
        <select
          class="field__input"
          style="padding: 6px 28px 6px 10px; font-size: 11px; border-radius: 8px;"
          .value=${reasoning}
          ?disabled=${disabled}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, { reasoningLevel: value || null });
          }}
        >
          ${REASONING_LEVELS.map((level) =>
            html`<option value=${level}>${level || "inherit"}</option>`,
          )}
        </select>
      </div>
      <div class="data-table__cell data-table__cell--actions" data-label="">
        <div class="row-actions row-actions--modern">
          ${canLink
            ? html`
              <button
                class="row-actions__btn"
                title="Open chat"
                aria-label="Open chat"
                ?disabled=${disabled}
                @click=${() => onSessionOpen?.(row.key)}
              >
                ${icon("message-square", { size: 14 })}
              </button>
            `
            : nothing}
          ${onViewLogs
            ? html`
                <button
                  class="row-actions__btn"
                  title="View logs"
                  aria-label="View logs"
                  ?disabled=${disabled}
                  @click=${() => onViewLogs(row.key)}
                >
                  ${icon("file-text", { size: 14 })}
                </button>
              `
            : nothing}
          <button
            class="row-actions__btn row-actions__btn--danger"
            title="Delete session"
            aria-label="Delete session"
            ?disabled=${disabled}
            @click=${() => onDelete(row.key)}
          >
            ${icon("trash", { size: 14 })}
          </button>
        </div>
      </div>
    </div>
  `;
}
