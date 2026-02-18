import type { Ref } from "lit/directives/ref.js";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";

/**
 * <oc-select> — Styled native select / dropdown component.
 *
 * Wraps a native `<select>` element with custom styling while preserving full
 * browser accessibility, keyboard navigation, and mobile support.
 *
 * @property {string} value - Currently selected value.
 * @property {string} placeholder - Empty option shown at top when no value is selected.
 * @property {boolean} disabled - Disables the select.
 * @property {boolean} full - Makes the component fill its container width.
 * @property {Array<{value: string; label: string; disabled?: boolean}>} options - The options to render.
 *
 * @fires oc-change - Dispatched when the user picks a new option. Detail: { value: string }.
 *
 * @example
 *   <oc-select
 *     placeholder="Choose a model…"
 *     .options=${[{ value: "gpt-4", label: "GPT-4" }, { value: "claude", label: "Claude" }]}
 *     .value=${selectedModel}
 *     @oc-change=${(e) => (selectedModel = e.detail.value)}
 *   ></oc-select>
 *
 *   <oc-select full disabled .options=${opts} .value=${val}></oc-select>
 */
@customElement("oc-select")
export class OcSelect extends LitElement {
  @property({ type: String }) value = "";
  @property({ type: String }) placeholder = "";
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) full = false;
  @property({ type: Array }) options: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }> = [];

  private _selectRef: Ref<HTMLSelectElement> = createRef();

  static styles = css`
    :host {
      display: inline-block;
    }

    :host([full]) {
      display: block;
      width: 100%;
    }

    :host([full]) .wrapper {
      width: 100%;
    }

    .wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    select {
      appearance: none;
      -webkit-appearance: none;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      padding: 7px 32px 7px 10px;
      cursor: pointer;
      width: 100%;
      transition: border-color var(--duration-fast) ease;
      outline: none;
    }

    select:hover {
      border-color: var(--border-strong);
    }

    select:focus-visible {
      box-shadow: var(--focus-ring);
      border-color: var(--accent);
    }

    select:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .chevron {
      position: absolute;
      right: 8px;
      pointer-events: none;
      color: var(--muted);
      display: flex;
      align-items: center;
    }
  `;

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has("value") || changedProps.has("options")) {
      const sel = this._selectRef.value;
      if (sel && sel.value !== this.value) {
        sel.value = this.value;
      }
    }
  }

  private _handleChange = (e: Event) => {
    const sel = e.target as HTMLSelectElement;
    this.value = sel.value;
    this.dispatchEvent(
      new CustomEvent("oc-change", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  };

  render() {
    return html`
      <div class="wrapper">
        <select
          ${ref(this._selectRef)}
          ?disabled=${this.disabled}
          @change=${this._handleChange}
        >
          ${
            this.placeholder && !this.value
              ? html`<option value="" disabled selected>${this.placeholder}</option>`
              : nothing
          }
          ${this.options.map(
            (o) => html`
              <option
                value=${o.value}
                ?disabled=${o.disabled ?? false}
                ?selected=${o.value === this.value}
              >${o.label}</option>
            `,
          )}
        </select>
        <span class="chevron">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-select": OcSelect;
  }
}
