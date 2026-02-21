import { html } from "lit";
import { renderChannelCard } from "../components/channel-card.ts";
import { type StatusListItem } from "../components/core-cards.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { DiscordStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderDiscordCard(params: {
  props: ChannelsProps;
  discord?: DiscordStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, discord, accountCountLabel } = params;
  const statusItems: StatusListItem[] = [
    { label: "Configured", value: discord?.configured ? "Yes" : "No" },
    { label: "Running", value: discord?.running ? "Yes" : "No" },
    {
      label: "Last start",
      value: discord?.lastStartAt ? formatRelativeTimestamp(discord.lastStartAt) : "n/a",
    },
    {
      label: "Last probe",
      value: discord?.lastProbeAt ? formatRelativeTimestamp(discord.lastProbeAt) : "n/a",
    },
  ];

  return renderChannelCard({
    title: "Discord",
    subtitle: "Bot status and channel configuration.",
    accountCountLabel,
    statusItems,
    error: discord?.lastError ?? null,
    probe: discord?.probe ?? null,
    configSection: renderChannelConfigSection({ channelId: "discord", props }),
    actions: html`<button class="btn" @click=${() => props.onRefresh(true)}>Probe</button>`,
  });
}
