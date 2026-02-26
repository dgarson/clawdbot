import { html, nothing } from "lit";
import { renderChannelCard } from "../components/channel-card.ts";
import { type StatusListItem } from "../components/core-cards.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelAccountSnapshot, TelegramStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderTelegramCard(params: {
  props: ChannelsProps;
  telegram?: TelegramStatus;
  telegramAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, telegram, telegramAccounts, accountCountLabel } = params;
  const hasMultipleAccounts = telegramAccounts.length > 1;
  const statusItems: StatusListItem[] = [
    { label: "Configured", value: telegram?.configured ? "Yes" : "No" },
    { label: "Running", value: telegram?.running ? "Yes" : "No" },
    { label: "Mode", value: telegram?.mode ?? "n/a" },
    {
      label: "Last start",
      value: telegram?.lastStartAt ? formatRelativeTimestamp(telegram.lastStartAt) : "n/a",
    },
    {
      label: "Last probe",
      value: telegram?.lastProbeAt ? formatRelativeTimestamp(telegram.lastProbeAt) : "n/a",
    },
  ];

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const probe = account.probe as { bot?: { username?: string } } | undefined;
    const botUsername = probe?.bot?.username;
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">
            ${botUsername ? `@${botUsername}` : label}
          </div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">Running</span>
            <span>${account.running ? "Yes" : "No"}</span>
          </div>
          <div>
            <span class="label">Configured</span>
            <span>${account.configured ? "Yes" : "No"}</span>
          </div>
          <div>
            <span class="label">Last inbound</span>
            <span>${account.lastInboundAt ? formatRelativeTimestamp(account.lastInboundAt) : "n/a"}</span>
          </div>
          ${
            account.lastError
              ? html`
                <div class="account-card-error">
                  ${account.lastError}
                </div>
              `
              : nothing
          }
        </div>
      </div>
    `;
  };

  return renderChannelCard({
    title: "Telegram",
    subtitle: "Bot status and channel configuration.",
    accountCountLabel,
    statusItems,
    error: telegram?.lastError ?? null,
    probe: telegram?.probe ?? null,
    beforeConfig: hasMultipleAccounts
      ? html`
          <div class="account-card-list" style="margin-top: 16px;">
            ${telegramAccounts.map((account) => renderAccountCard(account))}
          </div>
        `
      : nothing,
    configSection: renderChannelConfigSection({ channelId: "telegram", props }),
    actions: html`<button class="btn" @click=${() => props.onRefresh(true)}>Probe</button>`,
  });
}
