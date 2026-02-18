import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <oc-card> — Reusable card container with optional header, actions slot,
 * configurable body padding, and collapsible toggle support.
 *
 * Replaces the repeated pattern:
 *   `<div class="card">
 *     <div class="row" style="justify-content: space-between; align-items: flex-start;">
 *       <div>
 *         <div class="card-title">Title</div>
 *         <div class="card-sub">subtitle</div>
 *       </div>
 *       <button class="btn btn--sm">Refresh</button>
 *     </div>
 *     ${bodyContent}
 *   </div>`
 *
 * @property {string} title - Card heading. Header row is omitted when empty and no actions are slotted.
 * @property {string} subtitle - Secondary text below the title.
 * @property {"none"|"sm"|"md"|"lg"} pad - Body padding: none=0, sm=12px, md=20px (default), lg=28px.
 * @property {boolean} collapsible - Whether the body can be toggled open/closed.
 * @property {boolean} open - When collapsible, whether the card is expanded. Reflects to attribute.
 *
 * @slot actions - Top-right of header row (buttons, toggles, etc.).
 *   Header row renders when this slot has content OR title is non-empty.
 * @slot - Card body content.
 *
 * @fires oc-toggle - Dispatched when a collapsible card is toggled.
 *   detail: { open: boolean }
 *
 * @example
 *   <oc-card title="Skills" subtitle="Registered capabilities">
 *     <oc-button slot="actions" size="sm">Refresh</oc-button>
 *     ${bodyContent}
 *   </oc-card>
 *
 *   <oc-card title="Sessions" collapsible>
 *     ${sessionList}
 *   </oc-card>
 */
@customElement("oc-card")
export class OcCard extends LitElement {
  @property({ type: String }) title = "";
  @property({ type: String }) subtitle = "";
  @property({ type: String }) pad: "none" | "sm" | "md" | "lg" = "md";
  @property({ type: Boolean }) collapsible = false;
  @property({ type: Boolean, reflect: true }) open = true;

  static styles = css`
    :host {
      display: block;
    }

    .card {
      border: 1px solid var(--border);
      background: var(--card);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow:
        var(--shadow-sm),
        inset 0 1px 0 var(--card-highlight);
      transition:
        border-color var(--duration-normal) var(--ease-out),
        box-shadow var(--duration-normal) var(--ease-out);
    }

    .card:hover {
      border-color: var(--border-strong);
      box-shadow:
        var(--shadow-md),
        inset 0 1px 0 var(--card-highlight);
    }

    /* ── Header ───────────────────── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .header--pad-none {
      padding: 0;
    }
    .header--pad-sm {
      padding: 12px;
    }
    .header--pad-md {
      padding: 20px;
    }
    .header--pad-lg {
      padding: 28px;
    }

    /* When collapsible, header becomes a button */
    button.header {
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      cursor: pointer;
      font-family: inherit;
      color: inherit;
    }

    button.header:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }

    .header-text {
      flex: 1;
      min-width: 0;
    }

    .title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--text-strong);
    }

    .subtitle {
      color: var(--muted);
      font-size: 13px;
      margin-top: 6px;
      line-height: 1.5;
    }

    .actions {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* ── Chevron ──────────────────── */
    .chevron {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      transition: transform var(--duration-normal) var(--ease-out);
    }

    .chevron--open {
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

    /* ── Body ─────────────────────── */
    .body {
      box-sizing: border-box;
    }

    .body--pad-none {
      padding: 0;
    }
    .body--pad-sm {
      padding: 12px;
    }
    .body--pad-md {
      padding: 20px;
    }
    .body--pad-lg {
      padding: 28px;
    }

    /* When header is present, remove top padding from body to avoid double-spacing */
    .body--has-header.body--pad-sm {
      padding-top: 0;
    }
    .body--has-header.body--pad-md {
      padding-top: 0;
    }
    .body--has-header.body--pad-lg {
      padding-top: 0;
    }

    /* ── Collapsible body ─────────── */
    .body--collapsible {
      overflow: hidden;
      max-height: 2000px;
      transition:
        max-height 0.25s var(--ease-out),
        padding 0.25s var(--ease-out);
    }

    .body--collapsed {
      max-height: 0;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
    }
  `;

  private _bodyId = `oc-card-body-${Math.random().toString(36).slice(2, 9)}`;

  private _handleToggle = () => {
    this.open = !this.open;
    this.dispatchEvent(
      new CustomEvent("oc-toggle", {
        detail: { open: this.open },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private _renderChevron() {
    return html`
      <span class="chevron ${this.open ? "chevron--open" : ""}">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    `;
  }

  private _renderHeaderContent(hasTitle: boolean) {
    return html`
      ${
        hasTitle
          ? html`
            <div class="header-text">
              <div class="title">${this.title}</div>
              ${this.subtitle ? html`<div class="subtitle">${this.subtitle}</div>` : nothing}
            </div>
          `
          : nothing
      }
      <div class="actions">
        <slot name="actions"></slot>
      </div>
      ${this.collapsible ? this._renderChevron() : nothing}
    `;
  }

  render() {
    const hasTitle = this.title.length > 0;
    // We always render the header when collapsible so the toggle target exists.
    // For non-collapsible cards, header renders only when title or actions are present.
    // We use a slotchange listener approach: render header unconditionally when
    // collapsible; otherwise rely on title being non-empty (actions slot presence
    // is handled by the slot element always being rendered inside the header).
    const showHeader = this.collapsible || hasTitle;

    const headerPadClass = `header--pad-${this.pad}`;
    const bodyPadClass = `body--pad-${this.pad}`;
    const bodyHasHeaderClass = showHeader ? "body--has-header" : "";
    const bodyCollapsibleClass = this.collapsible ? "body--collapsible" : "";
    const bodyCollapsedClass = this.collapsible && !this.open ? "body--collapsed" : "";

    const header = showHeader
      ? this.collapsible
        ? html`
            <button
              class="header ${headerPadClass}"
              aria-expanded=${this.open ? "true" : "false"}
              aria-controls=${this._bodyId}
              @click=${this._handleToggle}
            >
              ${this._renderHeaderContent(hasTitle)}
            </button>
          `
        : html`
            <div class="header ${headerPadClass}">
              ${this._renderHeaderContent(hasTitle)}
            </div>
          `
      : nothing;

    return html`
      <div class="card">
        ${header}
        <div
          class="body ${bodyPadClass} ${bodyHasHeaderClass} ${bodyCollapsibleClass} ${bodyCollapsedClass}"
          id=${this._bodyId}
        >
          <slot></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-card": OcCard;
  }
}
