import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <oc-button> — Button with loading state and variant support.
 *
 * Replaces the repeated pattern:
 *   `?disabled=${busy} @click=${handler}>${busy ? "Working…" : "Label"}`
 * that appears 40+ times across views.
 *
 * @property {"default"|"primary"|"danger"|"ghost"|"icon"} variant
 * @property {"sm"|"md"} size
 * @property {boolean} loading - Shows loading text and disables interaction.
 * @property {boolean} disabled
 * @property {string} loadingText - Text to show when loading (default: "Working…").
 *
 * @slot - Button label content.
 * @slot icon - Optional leading icon.
 *
 * @fires click - Standard click, suppressed when loading/disabled.
 *
 * @example
 *   <oc-button variant="primary" .loading=${saving}>Save</oc-button>
 *   <oc-button variant="danger" size="sm">Delete</oc-button>
 *   <oc-button variant="icon" title="Refresh">
 *     <oc-icon slot="icon" name="refresh" size="sm"></oc-icon>
 *   </oc-button>
 */
@customElement("oc-button")
export class OcButton extends LitElement {
  @property({ type: String }) variant: "default" | "primary" | "danger" | "ghost" | "icon" =
    "default";
  @property({ type: String }) size: "sm" | "md" = "md";
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: String, attribute: "loading-text" }) loadingText = "Working\u2026";
  @property({ type: Boolean }) active = false;

  static styles = css`
    :host {
      display: inline-flex;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid var(--border);
      background: var(--bg-elevated);
      border-radius: var(--radius-md);
      font-size: 13px;
      font-weight: 500;
      letter-spacing: -0.01em;
      cursor: pointer;
      transition:
        border-color var(--duration-fast) var(--ease-out),
        background var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out),
        transform var(--duration-fast) var(--ease-out);
      font-family: inherit;
      color: inherit;
      line-height: 1;
    }

    /* ── Sizes ────────────────────── */
    button.md { padding: 9px 16px; }
    button.sm { padding: 6px 10px; font-size: 12px; }

    /* ── Variants ─────────────────── */
    button:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }
    button:active {
      background: var(--secondary);
      transform: translateY(0);
      box-shadow: none;
    }
    button.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--primary-foreground);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    button.primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
      box-shadow: var(--shadow-md), 0 0 20px var(--accent-glow);
    }
    button.danger {
      border-color: transparent;
      background: var(--danger-subtle);
      color: var(--danger);
    }
    button.danger:hover {
      background: rgba(239, 68, 68, 0.15);
    }
    button.ghost {
      border-color: transparent;
      background: transparent;
    }
    button.ghost:hover {
      background: var(--bg-hover);
      border-color: var(--border);
    }
    button.icon {
      padding: 6px;
      border-color: transparent;
      background: transparent;
    }
    button.icon:hover {
      background: var(--bg-hover);
      border-color: var(--border);
    }
    button.active {
      border-color: var(--accent);
      background: var(--accent-subtle);
      color: var(--accent);
    }

    /* ── States ───────────────────── */
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    button:disabled:hover {
      background: var(--bg-elevated);
      border-color: var(--border);
      transform: none;
      box-shadow: none;
    }
    button.primary:disabled:hover {
      background: var(--accent);
      border-color: var(--accent);
    }

    /* ── Icon slot ────────────────── */
    ::slotted([slot="icon"]) {
      flex-shrink: 0;
    }

    /* ── Light theme overrides ───── */
    @media (prefers-color-scheme: light) {
      button { background: var(--bg); border-color: var(--input); }
      button:hover { background: var(--bg-hover); }
      button.primary { background: var(--accent); border-color: var(--accent); }
    }
  `;

  render() {
    const classes = [this.variant, this.size, this.active ? "active" : ""].filter(Boolean).join(" ");
    return html`
      <button
        class=${classes}
        ?disabled=${this.disabled || this.loading}
        @click=${this._handleClick}
        part="button"
      >
        <slot name="icon"></slot>
        ${this.loading ? this.loadingText : html`<slot></slot>`}
      </button>
    `;
  }

  private _handleClick(e: MouseEvent) {
    if (this.disabled || this.loading) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-button": OcButton;
  }
}
