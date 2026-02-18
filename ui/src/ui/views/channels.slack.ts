import { html, nothing } from "lit";
import type { SlackStatus } from "../types.ts";
import type { ChannelsProps } from "./channels.types.ts";
import { formatRelativeTimestamp } from "../format.ts";
import { renderChannelConfigSection } from "./channels.config.ts";

export function renderSlackCard(params: {
  props: ChannelsProps;
  slack?: SlackStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, slack, accountCountLabel } = params;

  return html`
    <oc-card title="Slack" subtitle="Socket mode status and channel configuration.">
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${slack?.configured ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${slack?.running ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Last start</span>
          <span>${slack?.lastStartAt ? formatRelativeTimestamp(slack.lastStartAt) : "n/a"}</span>
        </div>
        <div>
          <span class="label">Last probe</span>
          <span>${slack?.lastProbeAt ? formatRelativeTimestamp(slack.lastProbeAt) : "n/a"}</span>
        </div>
      </div>

      ${
        slack?.lastError
          ? html`<oc-callout variant="danger">${slack.lastError}</oc-callout>`
          : nothing
      }

      ${
        slack?.probe
          ? html`<oc-callout>
            Probe ${slack.probe.ok ? "ok" : "failed"} ·
            ${slack.probe.status ?? ""} ${slack.probe.error ?? ""}
          </oc-callout>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "slack", props })}

      <div class="row" style="margin-top: 12px;">
        <oc-button @click=${() => props.onRefresh(true)}>
          Probe
        </oc-button>
      </div>
    </oc-card>
  `;
}
