import { html } from "lit";
import { renderChannelCard } from "../components/channel-card.ts";
import { type StatusListItem } from "../components/core-cards.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { IMessageStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderIMessageCard(params: {
  props: ChannelsProps;
  imessage?: IMessageStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, imessage, accountCountLabel } = params;
  const statusItems: StatusListItem[] = [
    { label: "Configured", value: imessage?.configured ? "Yes" : "No" },
    { label: "Running", value: imessage?.running ? "Yes" : "No" },
    {
      label: "Last start",
      value: imessage?.lastStartAt ? formatRelativeTimestamp(imessage.lastStartAt) : "n/a",
    },
    {
      label: "Last probe",
      value: imessage?.lastProbeAt ? formatRelativeTimestamp(imessage.lastProbeAt) : "n/a",
    },
  ];

  return renderChannelCard({
    title: "iMessage",
    subtitle: "macOS bridge status and channel configuration.",
    accountCountLabel,
    statusItems,
    error: imessage?.lastError ?? null,
    probe: imessage?.probe ?? null,
    configSection: renderChannelConfigSection({ channelId: "imessage", props }),
    actions: html`<button class="btn" @click=${() => props.onRefresh(true)}>Probe</button>`,
  });
}
