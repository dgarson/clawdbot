import { html, nothing } from "lit";
import type { ChannelUiMetaEntry, CronJob, CronRunLogEntry, CronStatus } from "../types.ts";
import type { CronFormState } from "../ui-types.ts";
import { formatRelativeTimestamp, formatMs } from "../format.ts";
import { pathForTab } from "../navigation.ts";
import { formatCronSchedule, formatNextRun } from "../presenter.ts";

export type CronProps = {
  basePath: string;
  loading: boolean;
  status: CronStatus | null;
  jobs: CronJob[];
  error: string | null;
  busy: boolean;
  form: CronFormState;
  channels: string[];
  channelLabels?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  runsJobId: string | null;
  runs: CronRunLogEntry[];
  onFormChange: (patch: Partial<CronFormState>) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onToggle: (job: CronJob, enabled: boolean) => void;
  onRun: (job: CronJob) => void;
  onRemove: (job: CronJob) => void;
  onLoadRuns: (jobId: string) => void;
};

function buildChannelOptions(props: CronProps): string[] {
  const options = ["last", ...props.channels.filter(Boolean)];
  const current = props.form.deliveryChannel?.trim();
  if (current && !options.includes(current)) {
    options.push(current);
  }
  const seen = new Set<string>();
  return options.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function resolveChannelLabel(props: CronProps, channel: string): string {
  if (channel === "last") {
    return "last";
  }
  const meta = props.channelMeta?.find((entry) => entry.id === channel);
  if (meta?.label) {
    return meta.label;
  }
  return props.channelLabels?.[channel] ?? channel;
}

export function renderCron(props: CronProps) {
  const channelOptions = buildChannelOptions(props);
  const selectedJob =
    props.runsJobId == null ? undefined : props.jobs.find((job) => job.id === props.runsJobId);
  const selectedRunTitle = selectedJob?.name ?? props.runsJobId ?? "(select a job)";
  const orderedRuns = props.runs.toSorted((a, b) => b.ts - a.ts);
  const supportsAnnounce =
    props.form.sessionTarget === "isolated" && props.form.payloadKind === "agentTurn";
  const selectedDeliveryMode =
    props.form.deliveryMode === "announce" && !supportsAnnounce ? "none" : props.form.deliveryMode;
  return html`
    <section class="grid grid-cols-2">
      <oc-card title="Scheduler" subtitle="Gateway-owned cron scheduler status.">
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">Enabled</div>
            <div class="stat-value">
              ${props.status ? (props.status.enabled ? "Yes" : "No") : "n/a"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Jobs</div>
            <div class="stat-value">${props.status?.jobs ?? "n/a"}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Next wake</div>
            <div class="stat-value">${formatNextRun(props.status?.nextWakeAtMs ?? null)}</div>
          </div>
        </div>
        <div class="row" style="margin-top: 12px;">
          <oc-button .loading=${props.loading} @click=${props.onRefresh}>
            Refresh
          </oc-button>
          ${props.error ? html`<span class="muted">${props.error}</span>` : nothing}
        </div>
      </oc-card>

      <oc-card title="New Job" subtitle="Create a scheduled wakeup or agent run.">
        <div class="form-grid" style="margin-top: 16px;">
          <oc-field label="Name">
            <input
              .value=${props.form.name}
              @input=${(e: Event) =>
                props.onFormChange({ name: (e.target as HTMLInputElement).value })}
            />
          </oc-field>
          <oc-field label="Description">
            <input
              .value=${props.form.description}
              @input=${(e: Event) =>
                props.onFormChange({ description: (e.target as HTMLInputElement).value })}
            />
          </oc-field>
          <oc-field label="Agent ID">
            <input
              .value=${props.form.agentId}
              @input=${(e: Event) =>
                props.onFormChange({ agentId: (e.target as HTMLInputElement).value })}
              placeholder="default"
            />
          </oc-field>
          <oc-toggle
            label="Enabled"
            .checked=${props.form.enabled}
            @oc-change=${(e: CustomEvent<{ checked: boolean }>) =>
              props.onFormChange({ enabled: e.detail.checked })}
          ></oc-toggle>
          <oc-field label="Schedule">
            <oc-select
              .value=${props.form.scheduleKind}
              .options=${[
                { value: "every", label: "Every" },
                { value: "at", label: "At" },
                { value: "cron", label: "Cron" },
              ]}
              @oc-change=${(e: CustomEvent<{ value: string }>) =>
                props.onFormChange({
                  scheduleKind: e.detail.value as CronFormState["scheduleKind"],
                })}
            ></oc-select>
          </oc-field>
        </div>
        ${renderScheduleFields(props)}
        <div class="form-grid" style="margin-top: 12px;">
          <oc-field label="Session">
            <oc-select
              .value=${props.form.sessionTarget}
              .options=${[
                { value: "main", label: "Main" },
                { value: "isolated", label: "Isolated" },
              ]}
              @oc-change=${(e: CustomEvent<{ value: string }>) =>
                props.onFormChange({
                  sessionTarget: e.detail.value as CronFormState["sessionTarget"],
                })}
            ></oc-select>
          </oc-field>
          <oc-field label="Wake mode">
            <oc-select
              .value=${props.form.wakeMode}
              .options=${[
                { value: "now", label: "Now" },
                { value: "next-heartbeat", label: "Next heartbeat" },
              ]}
              @oc-change=${(e: CustomEvent<{ value: string }>) =>
                props.onFormChange({
                  wakeMode: e.detail.value as CronFormState["wakeMode"],
                })}
            ></oc-select>
          </oc-field>
          <oc-field label="Payload">
            <oc-select
              .value=${props.form.payloadKind}
              .options=${[
                { value: "systemEvent", label: "System event" },
                { value: "agentTurn", label: "Agent turn" },
              ]}
              @oc-change=${(e: CustomEvent<{ value: string }>) =>
                props.onFormChange({
                  payloadKind: e.detail.value as CronFormState["payloadKind"],
                })}
            ></oc-select>
          </oc-field>
        </div>
        <oc-field label=${props.form.payloadKind === "systemEvent" ? "System text" : "Agent message"} style="margin-top: 12px;">
          <textarea
            .value=${props.form.payloadText}
            @input=${(e: Event) =>
              props.onFormChange({
                payloadText: (e.target as HTMLTextAreaElement).value,
              })}
            rows="4"
          ></textarea>
        </oc-field>
        <div class="form-grid" style="margin-top: 12px;">
          <oc-field label="Delivery">
            <oc-select
              .value=${selectedDeliveryMode}
              .options=${[
                ...(supportsAnnounce
                  ? [{ value: "announce", label: "Announce summary (default)" }]
                  : []),
                { value: "webhook", label: "Webhook POST" },
                { value: "none", label: "None (internal)" },
              ]}
              @oc-change=${(e: CustomEvent<{ value: string }>) =>
                props.onFormChange({
                  deliveryMode: e.detail.value as CronFormState["deliveryMode"],
                })}
            ></oc-select>
          </oc-field>
          ${
            props.form.payloadKind === "agentTurn"
              ? html`
                  <oc-field label="Timeout (seconds)">
                    <input
                      .value=${props.form.timeoutSeconds}
                      @input=${(e: Event) =>
                        props.onFormChange({
                          timeoutSeconds: (e.target as HTMLInputElement).value,
                        })}
                    />
                  </oc-field>
                `
              : nothing
          }
          ${
            selectedDeliveryMode !== "none"
              ? html`
                  <oc-field label=${selectedDeliveryMode === "webhook" ? "Webhook URL" : "Channel"}>
                    ${
                      selectedDeliveryMode === "webhook"
                        ? html`
                            <input
                              .value=${props.form.deliveryTo}
                              @input=${(e: Event) =>
                                props.onFormChange({
                                  deliveryTo: (e.target as HTMLInputElement).value,
                                })}
                              placeholder="https://example.invalid/cron"
                            />
                          `
                        : html`
                            <oc-select
                              .value=${props.form.deliveryChannel || "last"}
                              .options=${channelOptions.map((channel) => ({
                                value: channel,
                                label: resolveChannelLabel(props, channel),
                              }))}
                              @oc-change=${(e: CustomEvent<{ value: string }>) =>
                                props.onFormChange({
                                  deliveryChannel: e.detail.value,
                                })}
                            ></oc-select>
                          `
                    }
                  </oc-field>
                  ${
                    selectedDeliveryMode === "announce"
                      ? html`
                          <oc-field label="To">
                            <input
                              .value=${props.form.deliveryTo}
                              @input=${(e: Event) =>
                                props.onFormChange({
                                  deliveryTo: (e.target as HTMLInputElement).value,
                                })}
                              placeholder="+1555… or chat id"
                            />
                          </oc-field>
                        `
                      : nothing
                  }
                `
              : nothing
          }
        </div>
        <div class="row" style="margin-top: 14px;">
          <button class="btn primary" ?disabled=${props.busy} @click=${props.onAdd}>
            ${props.busy ? "Saving…" : "Add job"}
          </button>
        </div>
      </oc-card>
    </section>

    <oc-card title="Jobs" subtitle="All scheduled jobs stored in the gateway." style="margin-top: 18px;">
      ${
        props.jobs.length === 0
          ? html`
              <div class="muted" style="margin-top: 12px">No jobs yet.</div>
            `
          : html`
            <div class="list" style="margin-top: 12px;">
              ${props.jobs.map((job) => renderJob(job, props))}
            </div>
          `
      }
    </oc-card>

    <oc-card title="Run history" subtitle=${"Latest runs for " + selectedRunTitle + "."} style="margin-top: 18px;">
      ${
        props.runsJobId == null
          ? html`
              <div class="muted" style="margin-top: 12px">Select a job to inspect run history.</div>
            `
          : orderedRuns.length === 0
            ? html`
                <div class="muted" style="margin-top: 12px">No runs yet.</div>
              `
            : html`
              <div class="list" style="margin-top: 12px;">
                ${orderedRuns.map((entry) => renderRun(entry, props.basePath))}
              </div>
            `
      }
    </oc-card>
  `;
}

function renderScheduleFields(props: CronProps) {
  const form = props.form;
  if (form.scheduleKind === "at") {
    return html`
      <oc-field label="Run at" style="margin-top: 12px;">
        <input
          type="datetime-local"
          .value=${form.scheduleAt}
          @input=${(e: Event) =>
            props.onFormChange({
              scheduleAt: (e.target as HTMLInputElement).value,
            })}
        />
      </oc-field>
    `;
  }
  if (form.scheduleKind === "every") {
    return html`
      <div class="form-grid" style="margin-top: 12px;">
        <oc-field label="Every">
          <input
            .value=${form.everyAmount}
            @input=${(e: Event) =>
              props.onFormChange({
                everyAmount: (e.target as HTMLInputElement).value,
              })}
          />
        </oc-field>
        <oc-field label="Unit">
          <oc-select
            .value=${form.everyUnit}
            .options=${[
              { value: "minutes", label: "Minutes" },
              { value: "hours", label: "Hours" },
              { value: "days", label: "Days" },
            ]}
            @oc-change=${(e: CustomEvent<{ value: string }>) =>
              props.onFormChange({
                everyUnit: e.detail.value as CronFormState["everyUnit"],
              })}
          ></oc-select>
        </oc-field>
      </div>
    `;
  }
  return html`
    <div class="form-grid" style="margin-top: 12px;">
      <oc-field label="Expression">
        <input
          .value=${form.cronExpr}
          @input=${(e: Event) =>
            props.onFormChange({ cronExpr: (e.target as HTMLInputElement).value })}
        />
      </oc-field>
      <oc-field label="Timezone (optional)">
        <input
          .value=${form.cronTz}
          @input=${(e: Event) =>
            props.onFormChange({ cronTz: (e.target as HTMLInputElement).value })}
        />
      </oc-field>
    </div>
  `;
}

function renderJob(job: CronJob, props: CronProps) {
  const isSelected = props.runsJobId === job.id;
  const itemClass = `list-item list-item-clickable cron-job${isSelected ? " list-item-selected" : ""}`;
  return html`
    <div class=${itemClass} @click=${() => props.onLoadRuns(job.id)}>
      <div class="list-main">
        <div class="list-title">${job.name}</div>
        <div class="list-sub">${formatCronSchedule(job)}</div>
        ${renderJobPayload(job)}
        ${job.agentId ? html`<div class="muted cron-job-agent">Agent: ${job.agentId}</div>` : nothing}
      </div>
      <div class="list-meta">
        ${renderJobState(job)}
      </div>
      <div class="cron-job-footer">
        <div class="chip-row cron-job-chips">
          <span class=${`chip ${job.enabled ? "chip-ok" : "chip-danger"}`}>
            ${job.enabled ? "enabled" : "disabled"}
          </span>
          <span class="chip">${job.sessionTarget}</span>
          <span class="chip">${job.wakeMode}</span>
        </div>
        <div class="row cron-job-actions">
          <oc-button
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onToggle(job, !job.enabled);
            }}
          >
            ${job.enabled ? "Disable" : "Enable"}
          </oc-button>
          <oc-button
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onRun(job);
            }}
          >
            Run
          </oc-button>
          <oc-button
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onLoadRuns(job.id);
            }}
          >
            History
          </oc-button>
          <button
            class="btn danger"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onRemove(job);
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderJobPayload(job: CronJob) {
  if (job.payload.kind === "systemEvent") {
    return html`<div class="cron-job-detail">
      <span class="cron-job-detail-label">System</span>
      <span class="muted cron-job-detail-value">${job.payload.text}</span>
    </div>`;
  }

  const delivery = job.delivery;
  const deliveryTarget =
    delivery?.mode === "webhook"
      ? delivery.to
        ? ` (${delivery.to})`
        : ""
      : delivery?.channel || delivery?.to
        ? ` (${delivery.channel ?? "last"}${delivery.to ? ` -> ${delivery.to}` : ""})`
        : "";

  return html`
    <div class="cron-job-detail">
      <span class="cron-job-detail-label">Prompt</span>
      <span class="muted cron-job-detail-value">${job.payload.message}</span>
    </div>
    ${
      delivery
        ? html`<div class="cron-job-detail">
            <span class="cron-job-detail-label">Delivery</span>
            <span class="muted cron-job-detail-value">${delivery.mode}${deliveryTarget}</span>
          </div>`
        : nothing
    }
  `;
}

function formatStateRelative(ms?: number) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return "n/a";
  }
  return formatRelativeTimestamp(ms);
}

function renderJobState(job: CronJob) {
  const status = job.state?.lastStatus ?? "n/a";
  const statusClass =
    status === "ok"
      ? "cron-job-status-ok"
      : status === "error"
        ? "cron-job-status-error"
        : status === "skipped"
          ? "cron-job-status-skipped"
          : "cron-job-status-na";
  const nextRunAtMs = job.state?.nextRunAtMs;
  const lastRunAtMs = job.state?.lastRunAtMs;

  return html`
    <div class="cron-job-state">
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Status</span>
        <span class=${`cron-job-status-pill ${statusClass}`}>${status}</span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Next</span>
        <span class="cron-job-state-value" title=${formatMs(nextRunAtMs)}>
          ${formatStateRelative(nextRunAtMs)}
        </span>
      </div>
      <div class="cron-job-state-row">
        <span class="cron-job-state-key">Last</span>
        <span class="cron-job-state-value" title=${formatMs(lastRunAtMs)}>
          ${formatStateRelative(lastRunAtMs)}
        </span>
      </div>
    </div>
  `;
}

function renderRun(entry: CronRunLogEntry, basePath: string) {
  const chatUrl =
    typeof entry.sessionKey === "string" && entry.sessionKey.trim().length > 0
      ? `${pathForTab("chat", basePath)}?session=${encodeURIComponent(entry.sessionKey)}`
      : null;
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${entry.status}</div>
        <div class="list-sub">${entry.summary ?? ""}</div>
      </div>
      <div class="list-meta">
        <div>${formatMs(entry.ts)}</div>
        <div class="muted">${entry.durationMs ?? 0}ms</div>
        ${
          chatUrl
            ? html`<div><a class="session-link" href=${chatUrl}>Open run chat</a></div>`
            : nothing
        }
        ${entry.error ? html`<div class="muted">${entry.error}</div>` : nothing}
      </div>
    </div>
  `;
}
