import { html } from "lit";
import { renderChannelCard } from "../components/channel-card.ts";
import { type StatusListItem } from "../components/core-cards.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { SignalStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderSignalCard(params: {
  props: ChannelsProps;
  signal?: SignalStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, signal, accountCountLabel } = params;
  const statusItems: StatusListItem[] = [
    { label: "Configured", value: signal?.configured ? "Yes" : "No" },
    { label: "Running", value: signal?.running ? "Yes" : "No" },
    { label: "Base URL", value: signal?.baseUrl ?? "n/a" },
    {
      label: "Last start",
      value: signal?.lastStartAt ? formatRelativeTimestamp(signal.lastStartAt) : "n/a",
    },
    {
      label: "Last probe",
      value: signal?.lastProbeAt ? formatRelativeTimestamp(signal.lastProbeAt) : "n/a",
    },
  ];

  return renderChannelCard({
    title: "Signal",
    subtitle: "signal-cli status and channel configuration.",
    accountCountLabel,
    statusItems,
    error: signal?.lastError ?? null,
    probe: signal?.probe ?? null,
    configSection: renderChannelConfigSection({ channelId: "signal", props }),
    actions: html`<button class="btn" @click=${() => props.onRefresh(true)}>Probe</button>`,
  });
}
