import { html, nothing } from "lit";
import type { IMessageStatus } from "../types.ts";
import type { ChannelsProps } from "./channels.types.ts";
import { formatRelativeTimestamp } from "../format.ts";
import { renderChannelConfigSection } from "./channels.config.ts";

export function renderIMessageCard(params: {
  props: ChannelsProps;
  imessage?: IMessageStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, imessage, accountCountLabel } = params;

  return html`
    <oc-card title="iMessage" subtitle="macOS bridge status and channel configuration.">
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${imessage?.configured ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${imessage?.running ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Last start</span>
          <span>${imessage?.lastStartAt ? formatRelativeTimestamp(imessage.lastStartAt) : "n/a"}</span>
        </div>
        <div>
          <span class="label">Last probe</span>
          <span>${imessage?.lastProbeAt ? formatRelativeTimestamp(imessage.lastProbeAt) : "n/a"}</span>
        </div>
      </div>

      ${
        imessage?.lastError
          ? html`<oc-callout variant="danger">${imessage.lastError}</oc-callout>`
          : nothing
      }

      ${
        imessage?.probe
          ? html`<oc-callout>
            Probe ${imessage.probe.ok ? "ok" : "failed"} ·
            ${imessage.probe.error ?? ""}
          </oc-callout>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "imessage", props })}

      <div class="row" style="margin-top: 12px;">
        <oc-button @click=${() => props.onRefresh(true)}>
          Probe
        </oc-button>
      </div>
    </oc-card>
  `;
}
