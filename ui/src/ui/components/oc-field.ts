import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <oc-field> — Form field wrapper with label, hint, and error support.
 *
 * Replaces the repeated pattern:
 *   html`<label class="field">
 *     <span>Label text</span>
 *     <input .value=${val} @input=${fn} />
 *   </label>`
 *
 * And the hint variant from config-form.ts:
 *   html`<label class="field">
 *     <span>Label text</span>
 *     <input .value=${val} @input=${fn} />
 *     <span class="field-hint">${hint}</span>
 *   </label>`
 *
 * @property {string} label - Field label text.
 * @property {string} hint - Helper text displayed below the input.
 * @property {string} error - Error message; when non-empty, shown instead of hint and error styling is applied.
 * @property {boolean} required - Appends a visual asterisk to the label.
 * @property {boolean} full - Sets grid-column: 1 / -1 for spanning full grid width.
 *
 * @slot - The actual form control (input, select, textarea, or any element).
 *
 * @part label - The label text span, for external styling.
 *
 * @example
 *   <oc-field label="API Key" hint="Found in your settings page">
 *     <input .value=${apiKey} @input=${onInput} />
 *   </oc-field>
 *
 *   <oc-field label="Name" required error=${nameError}>
 *     <input .value=${name} @input=${onInput} />
 *   </oc-field>
 *
 *   <oc-field label="Description" full>
 *     <textarea .value=${desc} @input=${onInput}></textarea>
 *   </oc-field>
 */
@customElement("oc-field")
export class OcField extends LitElement {
  @property({ type: String }) label = "";
  @property({ type: String }) hint = "";
  @property({ type: String }) error = "";
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) full = false;

  static styles = css`
    :host {
      display: block;
    }

    :host([full]) {
      grid-column: 1 / -1;
    }

    .wrapper {
      display: grid;
      gap: 6px;
    }

    .label-text {
      color: var(--muted);
      font-size: 13px;
      font-weight: 500;
    }

    :host([required]) .label-text::after {
      content: " *";
      color: var(--danger);
    }

    .hint {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.4;
    }

    .error {
      font-size: 12px;
      color: var(--danger);
      line-height: 1.4;
    }

    ::slotted(*) {
      border: 1px solid var(--input);
      background: var(--card);
      border-radius: var(--radius-md);
      padding: 8px 12px;
      outline: none;
      box-shadow: inset 0 1px 0 var(--card-highlight);
      transition:
        border-color var(--duration-fast) ease,
        box-shadow var(--duration-fast) ease;
      width: 100%;
      box-sizing: border-box;
    }

    ::slotted(*:focus) {
      border-color: var(--ring);
      box-shadow: var(--focus-ring);
    }

    :host([error]) ::slotted(*) {
      border-color: var(--danger);
    }
  `;

  render() {
    const hasError = this.error.length > 0;
    return html`
      <div class="wrapper">
        ${this.label ? html`<span class="label-text" part="label">${this.label}</span>` : nothing}
        <slot></slot>
        ${
          hasError
            ? html`<span class="error">${this.error}</span>`
            : this.hint
              ? html`<span class="hint">${this.hint}</span>`
              : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-field": OcField;
  }
}
