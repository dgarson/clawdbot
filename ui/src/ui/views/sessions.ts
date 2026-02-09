import { html, nothing } from "lit";
import type {
  AgentsListResult,
  GatewaySessionRow,
  SessionsListResult,
  SessionsPreviewEntry,
} from "../types.ts";
import { renderErrorIf } from "../components/error-boundary.js";
import { formatRelativeTimestamp } from "../format.ts";
import { pathForTab } from "../navigation.ts";
import { formatSessionTokens } from "../presenter.ts";

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
export type SessionLaneFilter = "all" | "cron" | "regular";
export type SessionViewMode = "list" | "table" | "grouped";

export type SessionPreset = "all" | "active" | "errored" | "cron" | "custom";

export type SessionsProps = {
  loading: boolean;
  result: SessionsListResult | null;
  error: string | null;
  activeMinutes: string;
  limit: string;
  includeGlobal: boolean;
  includeUnknown: boolean;
  basePath: string;
  search: string;
  sort: SessionSortColumn;
  sortDir: SessionSortDir;
  kindFilter: SessionKindFilter;
  statusFilter: SessionStatusFilter;
  agentLabelFilter: string;
  laneFilter: SessionLaneFilter;
  tagFilter: string[];
  viewMode: SessionViewMode;
  showHidden: boolean;
  autoHideCompletedMinutes: number;
  autoHideErroredMinutes: number;
  preset: SessionPreset;
  showAdvancedFilters: boolean;
  drawerKey: string | null;
  drawerExpanded: boolean;
  drawerPreviewLoading: boolean;
  drawerPreviewError: string | null;
  drawerPreview: SessionsPreviewEntry | null;
  onDrawerOpen: (key: string) => void;
  onDrawerOpenExpanded: (key: string) => void;
  onDrawerClose: () => void;
  onDrawerToggleExpanded: () => void;
  onDrawerRefreshPreview: () => void;
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
  onAgentLabelFilterChange: (label: string) => void;
  onTagFilterChange: (tags: string[]) => void;
  onLaneFilterChange: (lane: SessionLaneFilter) => void;
  onViewModeChange: (mode: SessionViewMode) => void;
  onShowHiddenChange: (show: boolean) => void;
  onPresetChange?: (preset: SessionPreset) => void;
  onToggleAdvancedFilters?: () => void;
  onAutoHideChange: (next: { completedMinutes: number; erroredMinutes: number }) => void;
  onDeleteMany: (keys: string[]) => void;
  onRefresh: () => void;
  onPatch: (
    key: string,
    patch: {
      label?: string | null;
      tags?: string[] | null;
      thinkingLevel?: string | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    },
  ) => void;
  onAbort: (key: string) => void;
  onAbortAll: () => void;
  onDelete: (key: string) => void;
  onViewSessionLogs?: (key: string) => void;
  agentsList?: AgentsListResult | null;
  groupedExpandedAgents?: Set<string>;
  onToggleGroupedAgent?: (agentId: string) => void;
};

const THINK_LEVELS = ["", "off", "minimal", "low", "medium", "high", "xhigh"] as const;
const BINARY_THINK_LEVELS = ["", "off", "on"] as const;
const VERBOSE_LEVELS = [
  { value: "", label: "inherit" },
  { value: "off", label: "off (explicit)" },
  { value: "on", label: "on" },
  { value: "full", label: "full" },
] as const;
const REASONING_LEVELS = ["", "off", "on", "stream"] as const;

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

export function deriveSessionStatus(
  row: GatewaySessionRow,
  activeTasks?: SessionActiveTask[],
): SessionStatus {
  if (activeTasks && activeTasks.length > 0) return "active";
  if (!row.updatedAt) return "completed";
  const age = Date.now() - row.updatedAt;
  if (age < ACTIVE_THRESHOLD_MS) return "active";
  if (age < IDLE_THRESHOLD_MS) return "idle";
  return "completed";
}

export function getStatusBadgeClass(status: SessionStatus): string {
  switch (status) {
    case "active":
      return "badge--success badge--animated";
    case "idle":
      return "badge--warning";
    case "completed":
      return "badge--muted";
  }
}

function normalizeProviderId(provider?: string | null): string {
  if (!provider) {
    return "";
  }
  const normalized = provider.trim().toLowerCase();
  if (normalized === "z.ai" || normalized === "z-ai") {
    return "zai";
  }
  return normalized;
}

function isBinaryThinkingProvider(provider?: string | null): boolean {
  return normalizeProviderId(provider) === "zai";
}

function resolveThinkLevelOptions(provider?: string | null): readonly string[] {
  return isBinaryThinkingProvider(provider) ? BINARY_THINK_LEVELS : THINK_LEVELS;
}

function withCurrentOption(options: readonly string[], current: string): string[] {
  if (!current) {
    return [...options];
  }
  if (options.includes(current)) {
    return [...options];
  }
  return [...options, current];
}

function withCurrentLabeledOption(
  options: readonly { value: string; label: string }[],
  current: string,
): Array<{ value: string; label: string }> {
  if (!current) {
    return [...options];
  }
  if (options.some((option) => option.value === current)) {
    return [...options];
  }
  return [...options, { value: current, label: `${current} (custom)` }];
}

function resolveThinkLevelDisplay(value: string, isBinary: boolean): string {
  if (!isBinary) {
    return value;
  }
  if (!value || value === "off") {
    return value;
  }
  return "on";
}

function resolveThinkLevelPatchValue(value: string, isBinary: boolean): string | null {
  if (!value) {
    return null;
  }
  if (!isBinary) {
    return value;
  }
  if (value === "on") {
    return "low";
  }
  return value;
}

export function renderSessions(props: SessionsProps) {
  const rows = props.result?.sessions ?? [];
  const activeCount = rows.filter(
    (r) => r.updatedAt && Date.now() - r.updatedAt < 5 * 60 * 1000 && r.kind !== "global",
  ).length;
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Sessions</div>
          <div class="card-sub">Active session keys and per-session overrides.</div>
        </div>
        <div class="row" style="gap: 8px;">
          ${
            activeCount > 0
              ? html`
                  <button
                    class="btn danger"
                    ?disabled=${props.loading}
                    @click=${props.onAbortAll}
                    title="Emergency stop — abort all active sessions"
                  >
                    ⛔ Stop All (${activeCount})
                  </button>
                `
              : nothing
          }
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      <div class="filters" style="margin-top: 14px;">
        <label class="field">
          <span>Active within (minutes)</span>
          <input
            .value=${props.activeMinutes}
            @input=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: (e.target as HTMLInputElement).value,
                limit: props.limit,
                includeGlobal: props.includeGlobal,
                includeUnknown: props.includeUnknown,
              })}
          />
        </label>
        <label class="field">
          <span>Limit</span>
          <input
            .value=${props.limit}
            @input=${(e: Event) =>
              props.onFiltersChange({
                activeMinutes: props.activeMinutes,
                limit: (e.target as HTMLInputElement).value,
                includeGlobal: props.includeGlobal,
                includeUnknown: props.includeUnknown,
              })}
          />
        </label>
        <label class="field checkbox">
          <span>Include global</span>
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
        </label>
        <label class="field checkbox">
          <span>Include unknown</span>
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
        </label>
      </div>

      ${renderErrorIf(props.error)}

      <div class="muted" style="margin-top: 12px;">
        ${props.result ? `Store: ${props.result.path}` : ""}
      </div>

      <div class="table" style="margin-top: 16px;">
        <div class="table-head">
          <div>Key</div>
          <div>Label</div>
          <div>Kind</div>
          <div>Updated</div>
          <div>Tokens</div>
          <div>Thinking</div>
          <div>Verbose</div>
          <div>Reasoning</div>
          <div>Actions</div>
        </div>
        ${
          rows.length === 0
            ? html`
                <div class="muted">No sessions found.</div>
              `
            : rows.map((row) =>
                renderRow(
                  row,
                  props.basePath,
                  props.onPatch,
                  props.onAbort,
                  props.onDelete,
                  props.loading,
                ),
              )
        }
      </div>
    </section>
  `;
}

function renderRow(
  row: GatewaySessionRow,
  basePath: string,
  onPatch: SessionsProps["onPatch"],
  onAbort: SessionsProps["onAbort"],
  onDelete: SessionsProps["onDelete"],
  disabled: boolean,
) {
  const updated = row.updatedAt ? formatRelativeTimestamp(row.updatedAt) : "n/a";
  const rawThinking = row.thinkingLevel ?? "";
  const isBinaryThinking = isBinaryThinkingProvider(row.modelProvider);
  const thinking = resolveThinkLevelDisplay(rawThinking, isBinaryThinking);
  const thinkLevels = withCurrentOption(resolveThinkLevelOptions(row.modelProvider), thinking);
  const verbose = row.verboseLevel ?? "";
  const verboseLevels = withCurrentLabeledOption(VERBOSE_LEVELS, verbose);
  const reasoning = row.reasoningLevel ?? "";
  const reasoningLevels = withCurrentOption(REASONING_LEVELS, reasoning);
  const displayName =
    typeof row.displayName === "string" && row.displayName.trim().length > 0
      ? row.displayName.trim()
      : null;
  const label = typeof row.label === "string" ? row.label.trim() : "";
  const showDisplayName = Boolean(displayName && displayName !== row.key && displayName !== label);
  const canLink = row.kind !== "global";
  const chatUrl = canLink
    ? `${pathForTab("chat", basePath)}?session=${encodeURIComponent(row.key)}`
    : null;

  return html`
    <div class="table-row">
      <div class="mono session-key-cell">
        ${canLink ? html`<a href=${chatUrl} class="session-link">${row.key}</a>` : row.key}
        ${showDisplayName ? html`<span class="muted session-key-display-name">${displayName}</span>` : nothing}
      </div>
      <div>
        <input
          .value=${row.label ?? ""}
          ?disabled=${disabled}
          placeholder="(optional)"
          @change=${(e: Event) => {
            const value = (e.target as HTMLInputElement).value.trim();
            onPatch(row.key, { label: value || null });
          }}
        />
      </div>
      <div>${row.kind}</div>
      <div>${updated}</div>
      <div>${formatSessionTokens(row)}</div>
      <div>
        <select
          ?disabled=${disabled}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, {
              thinkingLevel: resolveThinkLevelPatchValue(value, isBinaryThinking),
            });
          }}
        >
          ${thinkLevels.map(
            (level) =>
              html`<option value=${level} ?selected=${thinking === level}>
                ${level || "inherit"}
              </option>`,
          )}
        </select>
      </div>
      <div>
        <select
          ?disabled=${disabled}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, { verboseLevel: value || null });
          }}
        >
          ${verboseLevels.map(
            (level) =>
              html`<option value=${level.value} ?selected=${verbose === level.value}>
                ${level.label}
              </option>`,
          )}
        </select>
      </div>
      <div>
        <select
          ?disabled=${disabled}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            onPatch(row.key, { reasoningLevel: value || null });
          }}
        >
          ${reasoningLevels.map(
            (level) =>
              html`<option value=${level} ?selected=${reasoning === level}>
                ${level || "inherit"}
              </option>`,
          )}
        </select>
      </div>
      <div style="display: flex; gap: 4px; align-items: center;">
        ${
          isRecentlyActive(row)
            ? html`
                <button
                  class="btn warning"
                  ?disabled=${disabled}
                  @click=${() => onAbort(row.key)}
                  title="Abort active run for this session"
                >
                  ⏹ Abort
                </button>
              `
            : nothing
        }
        <button class="btn danger" ?disabled=${disabled} @click=${() => onDelete(row.key)}>
          Delete
        </button>
      </div>
    </div>
  `;
}

/** Check if a session was active in the last 5 minutes */
function isRecentlyActive(row: GatewaySessionRow): boolean {
  return Boolean(
    row.updatedAt && Date.now() - row.updatedAt < 5 * 60 * 1000 && row.kind !== "global",
  );
}
