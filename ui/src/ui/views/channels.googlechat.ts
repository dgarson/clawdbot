import { html, nothing } from "lit";
import type { GoogleChatStatus } from "../types.ts";
import type { ChannelsProps } from "./channels.types.ts";
import { formatRelativeTimestamp } from "../format.ts";
import { renderChannelConfigSection } from "./channels.config.ts";

export function renderGoogleChatCard(params: {
  props: ChannelsProps;
  googleChat?: GoogleChatStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, googleChat, accountCountLabel } = params;

  return html`
    <oc-card title="Google Chat" subtitle="Chat API webhook status and channel configuration.">
      ${accountCountLabel}

      <div class="status-list" style="margin-top: 16px;">
        <div>
          <span class="label">Configured</span>
          <span>${googleChat ? (googleChat.configured ? "Yes" : "No") : "n/a"}</span>
        </div>
        <div>
          <span class="label">Running</span>
          <span>${googleChat ? (googleChat.running ? "Yes" : "No") : "n/a"}</span>
        </div>
        <div>
          <span class="label">Credential</span>
          <span>${googleChat?.credentialSource ?? "n/a"}</span>
        </div>
        <div>
          <span class="label">Audience</span>
          <span>
            ${
              googleChat?.audienceType
                ? `${googleChat.audienceType}${googleChat.audience ? ` · ${googleChat.audience}` : ""}`
                : "n/a"
            }
          </span>
        </div>
        <div>
          <span class="label">Last start</span>
          <span>${googleChat?.lastStartAt ? formatRelativeTimestamp(googleChat.lastStartAt) : "n/a"}</span>
        </div>
        <div>
          <span class="label">Last probe</span>
          <span>${googleChat?.lastProbeAt ? formatRelativeTimestamp(googleChat.lastProbeAt) : "n/a"}</span>
        </div>
      </div>

      ${
        googleChat?.lastError
          ? html`<oc-callout variant="danger">${googleChat.lastError}</oc-callout>`
          : nothing
      }

      ${
        googleChat?.probe
          ? html`<oc-callout>
            Probe ${googleChat.probe.ok ? "ok" : "failed"} ·
            ${googleChat.probe.status ?? ""} ${googleChat.probe.error ?? ""}
          </oc-callout>`
          : nothing
      }

      ${renderChannelConfigSection({ channelId: "googlechat", props })}

      <div class="row" style="margin-top: 12px;">
        <oc-button @click=${() => props.onRefresh(true)}>
          Probe
        </oc-button>
      </div>
    </oc-card>
  `;
}
