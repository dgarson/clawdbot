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

function renderSessionHeader(
  sessionKey: string,
  sessions: TelemetrySessionSummary[],
  onBack: () => void,
): TemplateResult {
  const session = sessions.find((s) => s.key === sessionKey);
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
                <span class="telem-detail-stat">Runs: <strong>${session.runCount}</strong></span>
                <span class="telem-detail-stat">Tokens: <strong>${formatNumber(session.totalTokens)}</strong></span>
                <span class="telem-detail-stat">Cost: <strong>${formatCost(session.totalCost)}</strong></span>
                ${session.errorCount > 0 ? html`<span class="telem-detail-stat telem-detail-stat--danger">Errors: <strong>${session.errorCount}</strong></span>` : nothing}
              </div>
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
    <div class="telem-playback">
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
            <div class="telem-event ${kindClass(evt.kind)}">
              <div class="telem-event-connector">
                <span class="telem-event-icon">${kindIcon(evt.kind)}</span>
                <div class="telem-event-line"></div>
              </div>
              <div class="telem-event-body">
                <div class="telem-event-header">
                  <span class="telem-event-kind">${evt.kind}</span>
                  <span class="telem-event-time">${formatTimestamp(evt.timestamp)}</span>
                  ${evt.duration != null ? html`<span class="telem-event-duration">${evt.duration}ms</span>` : nothing}
                </div>
                ${renderDataPreview(evt.data)}
              </div>
            </div>
          `,
        )}
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

// -- Main session detail render --
export function renderTelemetrySessionDetail(props: TelemetrySessionDetailProps): TemplateResult {
  return html`
    <div class="telem-session-detail">
      ${renderSessionHeader(props.sessionKey, props.sessions, props.onBack)}

      ${renderPlaybackControls(
        props.replay,
        props.timeline.length,
        props.onPlayPause,
        props.onSpeedChange,
        props.onSeek,
      )}

      ${renderTimeline(props.timeline, props.timelineLoading, props.replay)}

      ${renderSubagentTree(props.tree, props.treeLoading)}
    </div>
  `;
}
