import { html } from "lit";
import { renderChannelCard } from "../components/channel-card.ts";
import { type StatusListItem } from "../components/core-cards.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { GoogleChatStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderGoogleChatCard(params: {
  props: ChannelsProps;
  googleChat?: GoogleChatStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, googleChat, accountCountLabel } = params;
  const statusItems: StatusListItem[] = [
    {
      label: "Configured",
      value: googleChat ? (googleChat.configured ? "Yes" : "No") : "n/a",
    },
    {
      label: "Running",
      value: googleChat ? (googleChat.running ? "Yes" : "No") : "n/a",
    },
    {
      label: "Credential",
      value: googleChat?.credentialSource ?? "n/a",
    },
    {
      label: "Audience",
      value: googleChat?.audienceType
        ? `${googleChat.audienceType}${googleChat.audience ? ` · ${googleChat.audience}` : ""}`
        : "n/a",
    },
    {
      label: "Last start",
      value: googleChat?.lastStartAt ? formatRelativeTimestamp(googleChat.lastStartAt) : "n/a",
    },
    {
      label: "Last probe",
      value: googleChat?.lastProbeAt ? formatRelativeTimestamp(googleChat.lastProbeAt) : "n/a",
    },
  ];

  return renderChannelCard({
    title: "Google Chat",
    subtitle: "Chat API webhook status and channel configuration.",
    accountCountLabel,
    statusItems,
    error: googleChat?.lastError ?? null,
    probe: googleChat?.probe ?? null,
    configSection: renderChannelConfigSection({ channelId: "googlechat", props }),
    actions: html`<button class="btn" @click=${() => props.onRefresh(true)}>Probe</button>`,
  });
}
