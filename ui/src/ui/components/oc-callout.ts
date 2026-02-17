import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <oc-callout> — Alert / callout box component.
 *
 * Replaces the repeated pattern:
 *   `<div class="callout danger" style="margin-top: 12px;">${msg}</div>`
 * that appears 20+ times across views, and the error pill pattern
 *   `<div class="pill danger">${lastError}</div>` in the topbar.
 *
 * @property {"info"|"warn"|"danger"|"success"|"neutral"} variant
 * @property {boolean} dismissible - Shows a close button.
 * @property {boolean} compact - Reduces padding for inline use.
 *
 * @slot - Callout content.
 * @fires dismiss - Dispatched when the close button is clicked.
 *
 * @example
 *   <oc-callout variant="danger">${error}</oc-callout>
 *   <oc-callout variant="info" dismissible>Update available.</oc-callout>
 *   <oc-callout variant="success">Saved successfully.</oc-callout>
 */
@customElement("oc-callout")
export class OcCallout extends LitElement {
  @property({ type: String }) variant: "info" | "warn" | "danger" | "success" | "neutral" =
    "neutral";
  @property({ type: Boolean }) dismissible = false;
  @property({ type: Boolean }) compact = false;

  static styles = css`
    :host {
      display: block;
    }
    .callout {
      padding: 14px 16px;
      border-radius: var(--radius-md);
      background: var(--secondary);
      border: 1px solid var(--border);
      font-size: 13px;
      line-height: 1.5;
      position: relative;
    }
    .callout.compact {
      padding: 8px 12px;
    }
    .callout.dismissible {
      padding-right: 36px;
    }

    /* ── Variants ─────────────────── */
    .callout.danger {
      border-color: rgba(239, 68, 68, 0.25);
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.04) 100%);
      color: var(--danger);
    }
    .callout.info {
      border-color: rgba(59, 130, 246, 0.25);
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%);
      color: var(--info);
    }
    .callout.warn {
      border-color: rgba(245, 158, 11, 0.25);
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%);
      color: var(--warn);
    }
    .callout.success {
      border-color: rgba(34, 197, 94, 0.25);
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.04) 100%);
      color: var(--ok);
    }

    /* ── Close button ────────────── */
    .close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      display: grid;
      place-items: center;
      border-radius: var(--radius-sm);
      color: inherit;
      opacity: 0.6;
      transition: opacity var(--duration-fast) ease;
    }
    .close:hover {
      opacity: 1;
    }
    .close svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `;

  render() {
    const classes = [
      "callout",
      this.variant,
      this.compact ? "compact" : "",
      this.dismissible ? "dismissible" : "",
    ].filter(Boolean).join(" ");

    return html`
      <div class=${classes} role="alert">
        <slot></slot>
        ${this.dismissible
          ? html`
              <button
                class="close"
                @click=${this._dismiss}
                aria-label="Dismiss"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            `
          : nothing}
      </div>
    `;
  }

  private _dismiss() {
    this.dispatchEvent(
      new CustomEvent("dismiss", { bubbles: true, composed: true }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-callout": OcCallout;
  }
}
