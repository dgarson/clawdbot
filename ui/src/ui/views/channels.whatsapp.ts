import { html, nothing } from "lit";
import { renderChannelCard } from "../components/channel-card.ts";
import { type StatusListItem } from "../components/core-cards.ts";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import type { WhatsAppStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderWhatsAppCard(params: {
  props: ChannelsProps;
  whatsapp?: WhatsAppStatus;
  accountCountLabel: unknown;
}) {
  const { props, whatsapp, accountCountLabel } = params;
  const statusItems: StatusListItem[] = [
    { label: "Configured", value: whatsapp?.configured ? "Yes" : "No" },
    { label: "Linked", value: whatsapp?.linked ? "Yes" : "No" },
    { label: "Running", value: whatsapp?.running ? "Yes" : "No" },
    { label: "Connected", value: whatsapp?.connected ? "Yes" : "No" },
    {
      label: "Last connect",
      value: whatsapp?.lastConnectedAt ? formatRelativeTimestamp(whatsapp.lastConnectedAt) : "n/a",
    },
    {
      label: "Last message",
      value: whatsapp?.lastMessageAt ? formatRelativeTimestamp(whatsapp.lastMessageAt) : "n/a",
    },
    {
      label: "Auth age",
      value: whatsapp?.authAgeMs != null ? formatDurationHuman(whatsapp.authAgeMs) : "n/a",
    },
  ];

  return renderChannelCard({
    title: "WhatsApp",
    subtitle: "Link WhatsApp Web and monitor connection health.",
    accountCountLabel,
    statusItems,
    error: whatsapp?.lastError ?? null,
    beforeConfig: html`
      ${
        props.whatsappMessage
          ? html`<div class="callout" style="margin-top: 12px;">${props.whatsappMessage}</div>`
          : nothing
      }
      ${
        props.whatsappQrDataUrl
          ? html`
              <div class="qr-wrap">
                <img src=${props.whatsappQrDataUrl} alt="WhatsApp QR" />
              </div>
            `
          : nothing
      }
    `,
    configSection: renderChannelConfigSection({ channelId: "whatsapp", props }),
    actions: html`
      <button class="btn primary" ?disabled=${props.whatsappBusy} @click=${() => props.onWhatsAppStart(false)}>
        ${props.whatsappBusy ? "Working…" : "Show QR"}
      </button>
      <button class="btn" ?disabled=${props.whatsappBusy} @click=${() => props.onWhatsAppStart(true)}>
        Relink
      </button>
      <button class="btn" ?disabled=${props.whatsappBusy} @click=${() => props.onWhatsAppWait()}>
        Wait for scan
      </button>
      <button class="btn danger" ?disabled=${props.whatsappBusy} @click=${() => props.onWhatsAppLogout()}>
        Logout
      </button>
      <button class="btn" @click=${() => props.onRefresh(true)}>Refresh</button>
    `,
  });
}
