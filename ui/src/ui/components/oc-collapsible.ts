import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <oc-collapsible> — Expandable/collapsible section with smooth animation.
 *
 * Replaces inconsistently styled <details>/<summary> usage across skills.ts
 * (skill groups), config.ts (diff panel), and agent views (skill group listings).
 *
 * @property {boolean} open - Whether the body is expanded. Reflects to attribute.
 * @property {string} label - Header text when the `header` slot is not used.
 * @property {boolean} animated - Whether to animate open/close transitions.
 *
 * @slot header - Custom header content (icon + label + badge). Falls back to `label` prop.
 * @slot - The collapsible body content.
 *
 * @fires oc-toggle - Dispatched on state change. detail: { open: boolean }
 *
 * @example
 *   <oc-collapsible label="Skills">
 *     <div>skill rows here</div>
 *   </oc-collapsible>
 *
 * @example
 *   <oc-collapsible open>
 *     <span slot="header">
 *       <oc-icon name="brain" size="sm"></oc-icon>
 *       My Group
 *       <span class="agent-pill">3</span>
 *     </span>
 *     <div>content</div>
 *   </oc-collapsible>
 */
@customElement("oc-collapsible")
export class OcCollapsible extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) label = "";
  @property({ type: Boolean }) animated = true;

  static styles = css`
    :host {
      display: block;
    }

    /* ── Trigger button ──────────────────────────────────────────────── */
    .trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      text-align: left;
      border: none;
      border-bottom: 1px solid var(--border);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      padding: 8px 0;
      transition: color var(--duration-fast) ease;
    }

    .trigger:hover {
      color: var(--text-strong);
    }

    /* ── Label text ──────────────────────────────────────────────────── */
    .label-text {
      flex: 1;
    }

    /* ── Chevron icon ────────────────────────────────────────────────── */
    .chevron {
      margin-left: auto;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: transform var(--duration-fast) var(--ease-out);
    }

    :host([open]) .chevron {
      transform: rotate(90deg);
    }

    .chevron svg {
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* ── Body wrapper ────────────────────────────────────────────────── */
    .body {
      overflow: hidden;
    }

    /* Animated (default) */
    :host([animated]) .body,
    .body {
      transition:
        max-height 0.25s var(--ease-out),
        opacity 0.2s ease;
      max-height: 0;
      opacity: 0;
      visibility: hidden;
    }

    :host([open]) .body {
      max-height: 4000px;
      opacity: 1;
      visibility: visible;
    }

    /* Non-animated */
    :host(:not([animated])) .body {
      transition: none;
      max-height: 0;
      opacity: 0;
      visibility: hidden;
    }

    :host(:not([animated])[open]) .body {
      max-height: none;
      opacity: 1;
      visibility: visible;
    }

    /* ── Body inner ──────────────────────────────────────────────────── */
    .body-inner {
      padding-top: 8px;
    }
  `;

  render() {
    return html`
      <button
        class="trigger"
        aria-expanded=${this.open}
        @click=${this._handleClick}
      >
        <slot name="header">${this.label ? html`<span class="label-text">${this.label}</span>` : ""}</slot>
        <span class="chevron">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </button>
      <div class="body">
        <div class="body-inner">
          <slot></slot>
        </div>
      </div>
    `;
  }

  private _handleClick = () => {
    this.open = !this.open;
    this.dispatchEvent(
      new CustomEvent("oc-toggle", {
        detail: { open: this.open },
        bubbles: true,
        composed: true,
      }),
    );
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-collapsible": OcCollapsible;
  }
}
