import { html, nothing, type TemplateResult } from "lit";
import { formatCost, formatNumber } from "./telemetry-format.ts";
import type {
  TelemetryReplayState,
  TelemetrySessionSummary,
  TelemetrySubagentNode,
  TelemetryTimelineEvent,
} from "./telemetry-types.ts";

export type TelemetrySessionDetailProps = {
  sessionKey: string;
  sessions: TelemetrySessionSummary[];
  timeline: TelemetryTimelineEvent[];
  timelineLoading: boolean;
  replay: TelemetryReplayState;
  tree: TelemetrySubagentNode[];
  treeLoading: boolean;
  onBack: () => void;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (index: number) => void;
  selectedEvent: TelemetryTimelineEvent | null;
  onEventSelect: (event: TelemetryTimelineEvent | null) => void;
  contextTokens: number;
  contextMax: number;
  compactionCount: number;
};

/** Session-detail timestamp format with subsecond precision. */
function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    return ts;
  }
}

function kindClass(kind: string): string {
  if (kind.startsWith("run.")) {
    return "telem-event--run";
  }
  if (kind.startsWith("tool.")) {
    return "telem-event--tool";
  }
  if (kind.startsWith("llm.") || kind.startsWith("model.")) {
    return "telem-event--llm";
  }
  if (kind.startsWith("message.")) {
    return "telem-event--message";
  }
  if (kind === "error" || kind.includes("error")) {
    return "telem-event--error";
  }
  return "telem-event--default";
}

/** Return the pill modifier class for an event kind badge. */
function kindPillClass(kind: string): string {
  if (kind.startsWith("run.")) {
    return "telem-pill--run";
  }
  if (kind.startsWith("tool.")) {
    return "telem-pill--tool";
  }
  if (kind.startsWith("llm.") || kind.startsWith("model.")) {
    return "telem-pill--llm";
  }
  if (kind.startsWith("message.")) {
    return "telem-pill--message";
  }
  if (kind === "error" || kind.includes("error")) {
    return "telem-pill--danger";
  }
  return "";
}

function kindIcon(kind: string): string {
  if (kind.startsWith("run.start")) {
    return "\u25B6";
  }
  if (kind.startsWith("run.end")) {
    return "\u25A0";
  }
  if (kind.startsWith("tool.")) {
    return "\u2699";
  }
  if (kind.startsWith("llm.") || kind.startsWith("model.")) {
    return "\u2728";
  }
  if (kind.startsWith("message.in")) {
    return "\u2190";
  }
  if (kind.startsWith("message.out")) {
    return "\u2192";
  }
  if (kind === "error" || kind.includes("error")) {
    return "\u26A0";
  }
  return "\u25CF";
}

function renderDataPreview(
  data: Record<string, unknown> | undefined,
): TemplateResult | typeof nothing {
  if (!data) {
    return nothing;
  }
  const entries = Object.entries(data).slice(0, 4);
  if (entries.length === 0) {
    return nothing;
  }

  return html`
    <div class="telem-event-data">
      ${entries.map(([key, val]) => {
        const display =
          typeof val === "string"
            ? val.length > 80
              ? val.slice(0, 80) + "..."
              : val
            : (JSON.stringify(val)?.slice(0, 80) ?? "");
        return html`<span class="telem-event-datum"><strong>${key}:</strong> ${display}</span>`;
      })}
    </div>
  `;
}

/** Render a single value inside the slide-out detail list. */
function renderDetailValue(val: unknown): TemplateResult {
  if (val === null || val === undefined) {
    return html`
      <span class="telem-detail-null">—</span>
    `;
  }
  if (typeof val === "string") {
    if (val.length > 120) {
      return html`<pre class="telem-event-code">${val}</pre>`;
    }
    return html`<span>${val}</span>`;
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return html`<span>${String(val)}</span>`;
  }
  // Object / array: pretty-print as JSON in a code block
  const json = JSON.stringify(val, null, 2);
  return html`<pre class="telem-event-code">${json}</pre>`;
}

/** Slide-out panel showing full event data. */
function renderEventSlideout(
  event: TelemetryTimelineEvent | null,
  onClose: () => void,
): TemplateResult {
  const isOpen = event != null;
  const pillClass = event ? kindPillClass(event.kind) : "";
  return html`
    <div class="telem-slideout ${isOpen ? "telem-slideout--open" : ""}">
      <div class="telem-slideout-backdrop" @click=${onClose}></div>
      <div class="telem-slideout-panel">
        ${
          isOpen && event
            ? html`
            <div class="telem-slideout-header">
              <span class="telem-pill ${pillClass}">${event.kind}</span>
              <span class="telem-slideout-time">${formatTimestamp(event.timestamp)}</span>
              <button class="telem-slideout-close" @click=${onClose} aria-label="Close">&#x2715;</button>
            </div>
            <div class="telem-slideout-body">
              <dl class="telem-event-detail-list">
                <dt>id</dt>
                <dd>${event.id}</dd>
                <dt>timestamp</dt>
                <dd><span style="font-family: var(--mono); font-size: 0.72rem;">${event.timestamp}</span></dd>
                <dt>kind</dt>
                <dd>${event.kind}</dd>
                ${
                  event.duration != null
                    ? html`<dt>duration</dt><dd>${event.duration}ms</dd>`
                    : nothing
                }
                ${
                  event.data
                    ? Object.entries(event.data).map(
                        ([key, val]) => html`
                        <dt>${key}</dt>
                        <dd>${renderDetailValue(val)}</dd>
                      `,
                      )
                    : nothing
                }
              </dl>
            </div>
          `
            : nothing
        }
      </div>
    </div>
  `;
}

function renderSessionHeader(
  sessionKey: string,
  sessions: TelemetrySessionSummary[],
  contextTokens: number,
  contextMax: number,
  compactionCount: number,
  onBack: () => void,
): TemplateResult {
  const session = sessions.find((s) => s.key === sessionKey);
  const contextPct = contextMax > 0 ? Math.min(100, (contextTokens / contextMax) * 100) : 0;
  const contextPctRounded = Math.round(contextPct);

  return html`
    <div class="telem-detail-header">
      <button class="btn btn--sm telem-back-btn" @click=${onBack}>
        &larr; Back to Dashboard
      </button>
      <div class="telem-detail-title">
        <h2>Session: ${sessionKey.length > 30 ? sessionKey.slice(0, 30) + "..." : sessionKey}</h2>
        ${
          session
            ? html`
              <div class="telem-detail-stats">
                <span class="telem-detail-stat">Agent: <strong>${session.agentId ?? "default"}</strong></span>
                <span class="telem-detail-stat">Runs: <strong style="font-size:0.95rem;font-weight:600;font-variant-numeric:tabular-nums">${session.runCount}</strong></span>
                <span class="telem-detail-stat">Tokens: <strong style="font-size:0.95rem;font-weight:600;font-variant-numeric:tabular-nums">${session.totalTokens > 0 ? formatNumber(session.totalTokens) : "—"}</strong></span>
                <span class="telem-detail-stat">Cost: <strong style="font-size:0.95rem;font-weight:600;font-variant-numeric:tabular-nums">${session.totalCost > 0 ? formatCost(session.totalCost) : "—"}</strong></span>
                ${session.errorCount > 0 ? html`<span class="telem-detail-stat telem-detail-stat--danger">Errors: <strong>${session.errorCount}</strong></span>` : nothing}
                ${
                  compactionCount > 0
                    ? html`<span class="telem-pill telem-pill--compact" title="Context compacted ${compactionCount} time(s)">&circlearrowleft; ${compactionCount} compaction${compactionCount > 1 ? "s" : ""}</span>`
                    : nothing
                }
              </div>
              ${
                contextTokens > 0
                  ? html`
                  <div class="telem-context-bar-wrap" title="Context: ${contextTokens.toLocaleString()} / ${contextMax.toLocaleString()} tokens">
                    <div class="telem-context-bar-label">
                      <span>Context</span>
                      <span>${contextPctRounded}%</span>
                    </div>
                    <div class="telem-context-bar-track">
                      <div class="telem-context-bar-fill ${contextPct >= 80 ? "warn" : ""}" style="width: ${contextPct}%"></div>
                    </div>
                  </div>
                `
                  : nothing
              }
            `
            : nothing
        }
      </div>
    </div>
  `;
}

// -- Playback controls --
function renderPlaybackControls(
  replay: TelemetryReplayState,
  totalEvents: number,
  onPlayPause: () => void,
  onSpeedChange: (speed: number) => void,
  onSeek: (index: number) => void,
): TemplateResult {
  const speeds = [1, 2, 5];
  const progress = totalEvents > 0 ? (replay.currentIndex / totalEvents) * 100 : 0;

  return html`
    <div
      class="telem-playback"
      tabindex="0"
      @keydown=${(e: KeyboardEvent) => {
        if (e.code === "Space") {
          e.preventDefault();
          onPlayPause();
        }
      }}
    >
      <button class="btn btn--sm telem-play-btn" @click=${onPlayPause}>
        ${replay.playing ? "\u23F8 Pause" : "\u25B6 Play"}
      </button>
      <div class="telem-speed-group">
        ${speeds.map(
          (s) => html`
            <button
              class="telem-speed-btn ${s === replay.speed ? "telem-speed-btn--active" : ""}"
              @click=${() => onSpeedChange(s)}
            >${s}x</button>
          `,
        )}
      </div>
      <div class="telem-progress-wrap">
        <input
          type="range"
          class="telem-progress-slider"
          min="0"
          max=${totalEvents}
          .value=${String(replay.currentIndex)}
          @input=${(e: Event) => {
            const target = e.target as HTMLInputElement;
            onSeek(Number(target.value));
          }}
        />
        <div class="telem-progress-bar" style="width: ${progress}%"></div>
      </div>
      <span class="telem-progress-label">${replay.currentIndex} / ${totalEvents}</span>
    </div>
  `;
}

// -- Timeline --
function renderTimeline(
  events: TelemetryTimelineEvent[],
  loading: boolean,
  replay: TelemetryReplayState,
  onEventSelect: (event: TelemetryTimelineEvent | null) => void,
): TemplateResult {
  if (loading) {
    return html`
      <div class="card telem-timeline-card">
        <div class="card-title">Timeline</div>
        <div class="telem-timeline-loading">Loading events...</div>
      </div>
    `;
  }
  if (events.length === 0) {
    return html`
      <div class="card telem-timeline-card">
        <div class="card-title">Timeline</div>
        <div class="telem-empty">No events recorded for this session</div>
      </div>
    `;
  }

  // Show events up to currentIndex when replaying, or all events if not playing
  const visibleEvents =
    replay.playing || replay.currentIndex > 0 ? events.slice(0, replay.currentIndex) : events;

  return html`
    <div class="card telem-timeline-card">
      <div class="card-title">Timeline <span class="telem-badge">${events.length} events</span></div>
      <div class="telem-timeline">
        ${visibleEvents.map(
          (evt) => html`
            <div
              class="telem-event ${kindClass(evt.kind)}"
              style="cursor: pointer"
              @click=${() => onEventSelect(evt)}
            >
              <div class="telem-event-connector">
                <span class="telem-event-icon">${kindIcon(evt.kind)}</span>
                <div class="telem-event-line"></div>
              </div>
              <div class="telem-event-body">
                <div class="telem-event-header">
                  <span class="telem-pill ${kindPillClass(evt.kind)} telem-event-kind-pill">${evt.kind}</span>
                  <span class="telem-event-time" style="font-family: var(--mono); font-size: 0.72rem;">${formatTimestamp(evt.timestamp)}</span>
                  ${evt.duration != null ? html`<span class="telem-event-duration">${evt.duration}ms</span>` : nothing}
                </div>
                ${renderDataPreview(evt.data)}
              </div>
            </div>
          `,
        )}
      </div>
      <div class="telem-timeline-footer">
        Showing ${visibleEvents.length} of ${events.length} events
      </div>
    </div>
  `;
}

// -- Subagent tree --
function renderSubagentTree(
  tree: TelemetrySubagentNode[],
  loading: boolean,
): TemplateResult | typeof nothing {
  if (loading) {
    return html`
      <div class="card">
        <div class="card-title">Subagent Tree</div>
        <div class="telem-empty">Loading...</div>
      </div>
    `;
  }
  if (tree.length === 0) {
    return nothing;
  }

  const renderNode = (node: TelemetrySubagentNode, depth: number): TemplateResult => html`
    <div class="telem-tree-node" style="padding-left: ${depth * 20}px">
      <span class="telem-tree-icon">${node.children.length > 0 ? "\u251C" : "\u2514"}</span>
      <span class="telem-tree-label">${node.agentId}</span>
      ${node.sessionKey ? html`<span class="telem-tree-session">${node.sessionKey}</span>` : nothing}
    </div>
    ${node.children.map((child) => renderNode(child, depth + 1))}
  `;

  return html`
    <div class="card telem-tree-card">
      <div class="card-title">Subagent Hierarchy</div>
      <div class="telem-tree">
        ${tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  `;
}

// -- Attachments placeholder --
function renderAttachments(): TemplateResult {
  return html`
    <div class="card telem-attachments-card">
      <div class="telem-card-header">
        <div class="card-title">Attachments &amp; Deliverables</div>
        <span class="telem-badge telem-badge--muted">Coming soon</span>
      </div>
      <div class="telem-empty">Files produced or consumed by this session will appear here.</div>
    </div>
  `;
}

// -- Main session detail render --
export function renderTelemetrySessionDetail(props: TelemetrySessionDetailProps): TemplateResult {
  return html`
    <div class="telem-session-detail">
      ${renderSessionHeader(
        props.sessionKey,
        props.sessions,
        props.contextTokens,
        props.contextMax,
        props.compactionCount,
        props.onBack,
      )}

      ${renderPlaybackControls(
        props.replay,
        props.timeline.length,
        props.onPlayPause,
        props.onSpeedChange,
        props.onSeek,
      )}

      ${renderTimeline(props.timeline, props.timelineLoading, props.replay, props.onEventSelect)}

      ${renderSubagentTree(props.tree, props.treeLoading)}

      ${renderAttachments()}

      ${renderEventSlideout(props.selectedEvent, () => props.onEventSelect(null))}
    </div>
  `;
}
