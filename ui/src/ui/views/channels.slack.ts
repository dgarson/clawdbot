import { html } from "lit";
import { renderChannelCard } from "../components/channel-card.ts";
import { type StatusListItem } from "../components/core-cards.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { SlackStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderSlackCard(params: {
  props: ChannelsProps;
  slack?: SlackStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, slack, accountCountLabel } = params;
  const statusItems: StatusListItem[] = [
    { label: "Configured", value: slack?.configured ? "Yes" : "No" },
    { label: "Running", value: slack?.running ? "Yes" : "No" },
    {
      label: "Last start",
      value: slack?.lastStartAt ? formatRelativeTimestamp(slack.lastStartAt) : "n/a",
    },
    {
      label: "Last probe",
      value: slack?.lastProbeAt ? formatRelativeTimestamp(slack.lastProbeAt) : "n/a",
    },
  ];

  return renderChannelCard({
    title: "Slack",
    subtitle: "Socket mode status and channel configuration.",
    accountCountLabel,
    statusItems,
    error: slack?.lastError ?? null,
    probe: slack?.probe ?? null,
    configSection: renderChannelConfigSection({ channelId: "slack", props }),
    actions: html`<button class="btn" @click=${() => props.onRefresh(true)}>Probe</button>`,
  });
}
