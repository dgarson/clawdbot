import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <oc-toggle> — Toggle/switch input styled as a slide switch.
 *
 * Wraps a visually hidden checkbox so it participates in forms and
 * remains keyboard- and screen-reader-accessible, while the visual
 * track+thumb is driven entirely by CSS via :host([checked]).
 *
 * @property {boolean} checked - Whether the toggle is on.
 * @property {boolean} disabled - Disables the toggle.
 * @property {string} label - Optional text label to the right of the switch.
 * @property {"sm"|"md"} size - Visual size (default: "md").
 *
 * @fires oc-change - CustomEvent<{ checked: boolean }>, bubbles, composed.
 *
 * @example
 *   <oc-toggle label="Enable notifications" checked></oc-toggle>
 *   <oc-toggle size="sm" @oc-change=${e => console.log(e.detail.checked)}></oc-toggle>
 */
@customElement("oc-toggle")
export class OcToggle extends LitElement {
  @property({ type: Boolean, reflect: true }) checked = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: String }) label = "";
  @property({ type: String }) size: "sm" | "md" = "md";

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
    }

    :host([disabled]) {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: inherit;
    }

    /* Hidden real checkbox */
    input[type="checkbox"] {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
      pointer-events: none;
    }

    /* ── Track ─────────────────── */
    .track {
      position: relative;
      flex-shrink: 0;
      border-radius: var(--radius-full, 9999px);
      background: var(--border-strong);
      transition: background var(--duration-fast) var(--ease-out);
    }

    /* md size (default) */
    :host([size="md"]) .track,
    .track {
      width: 36px;
      height: 20px;
    }

    /* sm size */
    :host([size="sm"]) .track {
      width: 28px;
      height: 16px;
    }

    /* Checked state — track turns accent */
    :host([checked]) .track {
      background: var(--accent);
    }

    /* ── Thumb ─────────────────── */
    .thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      background: white;
      border-radius: var(--radius-full, 9999px);
      transition: transform var(--duration-fast) var(--ease-out);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    /* md thumb */
    :host([size="md"]) .thumb,
    .thumb {
      width: 16px;
      height: 16px;
    }

    /* sm thumb */
    :host([size="sm"]) .thumb {
      width: 12px;
      height: 12px;
    }

    /* Slide thumb right when checked */
    :host([checked]) .thumb {
      transform: translateX(16px); /* 36 - 20 = 16 for md */
    }

    :host([checked][size="sm"]) .thumb {
      transform: translateX(12px); /* 28 - 16 = 12 for sm */
    }

    /* Focus ring on the label (keyboard nav) */
    label:focus-within .track {
      box-shadow: var(--focus-ring);
    }

    /* ── Label text ─────────────── */
    .label-text {
      font-size: 13px;
      color: var(--text);
    }
  `;

  private _handleChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    this.checked = input.checked;
    this.dispatchEvent(
      new CustomEvent("oc-change", {
        detail: { checked: this.checked },
        bubbles: true,
        composed: true,
      }),
    );
  };

  render() {
    return html`
      <label>
        <input
          type="checkbox"
          ?checked=${this.checked}
          ?disabled=${this.disabled}
          @change=${this._handleChange}
          aria-label=${this.label || "Toggle"}
        />
        <span class="track">
          <span class="thumb"></span>
        </span>
        ${this.label ? html`<span class="label-text">${this.label}</span>` : nothing}
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-toggle": OcToggle;
  }
}
