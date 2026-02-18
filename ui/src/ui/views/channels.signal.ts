import { html, nothing } from "lit";
import type { SignalStatus } from "../types.ts";
import type { ChannelsProps } from "./channels.types.ts";
import { formatRelativeTimestamp } from "../format.ts";
import { renderChannelConfigSection } from "./channels.config.ts";

export function renderSignalCard(params: {
  props: ChannelsProps;
  signal?: SignalStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, signal, accountCountLabel } = params;

  return html`
    <oc-card title="Signal" subtitle="signal-cli status and channel configuration.">
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${signal?.configured ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${signal?.running ? "Yes" : "No"}</span>
        </div>
        <div>
          <span class="label">Base URL</span>
          <span>${signal?.baseUrl ?? "n/a"}</span>
        </div>
        <div>
          <span class="label">Last start</span>
          <span>${signal?.lastStartAt ? formatRelativeTimestamp(signal.lastStartAt) : "n/a"}</span>
        </div>
        <div>
          <span class="label">Last probe</span>
          <span>${signal?.lastProbeAt ? formatRelativeTimestamp(signal.lastProbeAt) : "n/a"}</span>
        </div>
      </div>

      ${
        signal?.lastError
          ? html`<oc-callout variant="danger">${signal.lastError}</oc-callout>`
          : nothing
      }

      ${
        signal?.probe
          ? html`<oc-callout>
            Probe ${signal.probe.ok ? "ok" : "failed"} ·
            ${signal.probe.status ?? ""} ${signal.probe.error ?? ""}
          </oc-callout>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "signal", props })}

      <div class="row" style="margin-top: 12px;">
        <oc-button @click=${() => props.onRefresh(true)}>
          Probe
        </oc-button>
      </div>
    </oc-card>
  `;
}
