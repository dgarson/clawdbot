import { html, nothing, type TemplateResult } from "lit";

export type StatusTone = "neutral" | "ok" | "warn" | "danger";

export type StatusListItem = {
  label: string;
  value: string;
  tone?: StatusTone;
  mono?: boolean;
};

export type CardShellProps = {
  title: string;
  subtitle?: string;
  className?: string;
  actions?: TemplateResult | typeof nothing;
  body: TemplateResult;
  footer?: TemplateResult | typeof nothing;
};

export function renderCardShell(props: CardShellProps) {
  const className = props.className ? ` ${props.className}` : "";
  const hasActions = Boolean(props.actions && props.actions !== nothing);
  const hasFooter = Boolean(props.footer && props.footer !== nothing);
  return html`
    <section class="card core-card${className}">
      <header class="core-card__header">
        <div>
          <div class="card-title">${props.title}</div>
          ${props.subtitle ? html`<div class="card-sub">${props.subtitle}</div>` : nothing}
        </div>
        ${hasActions ? html`<div class="core-card__actions">${props.actions}</div>` : nothing}
      </header>
      <div class="core-card__body">${props.body}</div>
      ${hasFooter ? html`<footer class="core-card__footer">${props.footer}</footer>` : nothing}
    </section>
  `;
}

export type ActionBarProps = {
  dirty: boolean;
  busy?: boolean;
  dirtyLabel?: string;
  cleanLabel?: string;
  meta?: TemplateResult | typeof nothing;
  actions?: TemplateResult | typeof nothing;
};

export function renderActionBar(props: ActionBarProps) {
  const dirtyLabel = props.dirtyLabel ?? "Unsaved changes";
  const cleanLabel = props.cleanLabel ?? "No changes";
  const hasActions = Boolean(props.actions && props.actions !== nothing);
  return html`
    <div class="core-action-bar ${props.busy ? "is-busy" : ""}">
      <div class="core-action-bar__left">
        <span class="core-action-bar__status ${props.dirty ? "is-dirty" : ""}">
          ${props.dirty ? dirtyLabel : cleanLabel}
        </span>
        ${props.meta ?? nothing}
      </div>
      ${hasActions ? html`<div class="core-action-bar__right">${props.actions}</div>` : nothing}
    </div>
  `;
}

export function renderStatusList(items: StatusListItem[], className?: string) {
  const mergedClassName = className ? ` status-list--${className}` : "";
  if (items.length === 0) {
    return html`
      <div class="muted">No status available.</div>
    `;
  }
  return html`
    <div class="status-list core-status-list${mergedClassName}">
      ${items.map(
        (item) => html`
          <div>
            <span class="label">${item.label}</span>
            <span class="${item.mono ? "mono" : ""} ${toneClass(item.tone)}">${item.value}</span>
          </div>
        `,
      )}
    </div>
  `;
}

export function renderErrorCallout(params: { message: string | null; tone?: StatusTone }) {
  if (!params.message) {
    return nothing;
  }
  const tone = params.tone ?? "danger";
  const calloutToneClass =
    tone === "danger" ? "danger" : tone === "warn" ? "warn" : tone === "ok" ? "success" : "info";
  return html`<div class="callout ${calloutToneClass}" style="margin-top: 12px;">${params.message}</div>`;
}

function toneClass(tone: StatusTone | undefined) {
  if (tone === "ok") {
    return "core-status-value--ok";
  }
  if (tone === "warn") {
    return "core-status-value--warn";
  }
  if (tone === "danger") {
    return "core-status-value--danger";
  }
  return "";
}
