import { LitElement, css, html, nothing, svg } from "lit";
import { customElement, property } from "lit/decorators.js";
import "./oc-icon.js";

/**
 * <oc-empty-state> — Unified empty/loading/error state display.
 *
 * Consolidates three distinct patterns scattered across 20+ views:
 *   - Empty: muted "No items found" messages
 *   - Loading: spinner with label (e.g., "Loading schema…")
 *   - Error: warning icon with title and description
 *
 * @property {"empty"|"loading"|"error"} variant - Display variant (default: "empty").
 * @property {string} icon - Icon name from oc-icon registry. When provided, renders
 *   <oc-icon size="lg">. When omitted, a built-in default SVG is used per variant.
 * @property {string} title - Main heading text.
 * @property {string} description - Supporting paragraph text.
 *
 * @slot actions - Optional slot for action buttons below the description.
 *
 * @example
 *   <oc-empty-state title="No sessions found." description="Start a new session to get going."></oc-empty-state>
 *   <oc-empty-state variant="loading" title="Loading schema…"></oc-empty-state>
 *   <oc-empty-state variant="error" title="No configuration" description="Connect to load settings."></oc-empty-state>
 *   <oc-empty-state variant="error" icon="bug" title="Unexpected error">
 *     <oc-button slot="actions" variant="primary">Retry</oc-button>
 *   </oc-empty-state>
 */
@customElement("oc-empty-state")
export class OcEmptyState extends LitElement {
  @property({ type: String }) variant: "empty" | "loading" | "error" = "empty";
  @property({ type: String }) icon = "";
  @property({ type: String }) title = "";
  @property({ type: String }) description = "";

  static styles = css`
    :host {
      display: block;
    }

    .wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px 16px;
      gap: 12px;
      color: var(--muted);
    }

    /* ── Icon area ─────────────────────────────── */
    .icon-area {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
    }

    :host([variant="empty"]) .icon-area {
      opacity: 0.4;
    }

    :host([variant="error"]) .icon-area {
      color: var(--danger);
    }

    /* ── Inline default SVGs ────────────────────── */
    .icon-area svg {
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      width: 24px;
      height: 24px;
    }

    /* ── Spinner (loading variant) ──────────────── */
    .spinner {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation: none;
        border-top-color: var(--accent);
      }
    }

    /* ── Text ───────────────────────────────────── */
    .title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
      margin: 0;
    }

    :host([variant="error"]) .title {
      color: var(--danger);
    }

    .description {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.5;
      margin: 0;
      max-width: 280px;
    }

    /* ── Actions slot ───────────────────────────── */
    .actions {
      margin-top: 4px;
    }
  `;

  private _renderIconArea() {
    if (this.icon) {
      return html`
        <div class="icon-area">
          <oc-icon name=${this.icon} size="lg"></oc-icon>
        </div>
      `;
    }

    if (this.variant === "loading") {
      return html`
        <div class="icon-area">
          <div class="spinner" role="status" aria-label="Loading"></div>
        </div>
      `;
    }

    if (this.variant === "error") {
      return html`
        <div class="icon-area">
          <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
            ${svg`
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            `}
          </svg>
        </div>
      `;
    }

    // Default: empty variant — inbox/tray icon
    return html`
      <div class="icon-area">
        <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
          ${svg`
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          `}
        </svg>
      </div>
    `;
  }

  render() {
    return html`
      <div class="wrapper">
        ${this._renderIconArea()}
        ${this.title ? html`<p class="title">${this.title}</p>` : nothing}
        ${this.description ? html`<p class="description">${this.description}</p>` : nothing}
        <div class="actions">
          <slot name="actions"></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-empty-state": OcEmptyState;
  }
}
