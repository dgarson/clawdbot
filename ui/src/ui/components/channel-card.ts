import { html, nothing, type TemplateResult } from "lit";
import { renderErrorCallout, renderStatusList, type StatusListItem } from "./core-cards.ts";

type ChannelProbe = {
  ok?: boolean;
  status?: number | null;
  error?: string | null;
};

export type ChannelCardProps = {
  title: string;
  subtitle: string;
  accountCountLabel?: unknown;
  statusItems: StatusListItem[];
  error?: string | null;
  probe?: ChannelProbe | null;
  configSection: unknown;
  actions?: TemplateResult | typeof nothing;
  beforeConfig?: TemplateResult | typeof nothing;
};

export function renderChannelCard(props: ChannelCardProps) {
  const hasActions = Boolean(props.actions && props.actions !== nothing);
  return html`
    <div class="card channel-card">
      <div class="card-title">${props.title}</div>
      <div class="card-sub">${props.subtitle}</div>
      ${props.accountCountLabel ?? nothing}

      <div style="margin-top: 16px;">
        ${renderStatusList(props.statusItems)}
      </div>

      ${renderErrorCallout({ message: props.error ?? null, tone: "danger" })}

      ${renderProbeCallout(props.probe)}

      ${props.beforeConfig ?? nothing}

      ${props.configSection}

      ${hasActions ? html`<div class="row channel-card__actions">${props.actions}</div>` : nothing}
    </div>
  `;
}

function renderProbeCallout(probe: ChannelProbe | null | undefined) {
  if (!probe) {
    return nothing;
  }
  const ok = Boolean(probe.ok);
  return html`<div class="callout" style="margin-top: 12px;">
    Probe ${ok ? "ok" : "failed"} · ${probe.status ?? ""} ${probe.error ?? ""}
  </div>`;
}
