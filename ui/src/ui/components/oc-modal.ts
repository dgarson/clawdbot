import type { Ref } from "lit/directives/ref.js";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";

/**
 * <oc-modal> — Modal dialog component wrapping the native <dialog> element.
 *
 * @property {boolean} open - Whether the dialog is visible. Toggling calls
 *   showModal() or close() on the inner <dialog>.
 * @property {string} heading - Modal title shown in the header bar.
 * @property {"sm"|"md"|"lg"} size - Width: sm=400px, md=560px, lg=720px.
 * @property {boolean} dismissible - When true, clicking the backdrop or pressing
 *   Escape closes the modal.
 *
 * @slot - Modal body content.
 * @slot footer - Action buttons. Displayed in a right-aligned row at the bottom.
 *   If empty, the footer area is omitted.
 *
 * @fires oc-close - Dispatched when the modal is dismissed (backdrop click,
 *   Escape key, or programmatic close). Host should react by setting open=false.
 *
 * @example
 *   <oc-modal heading="Confirm deletion" ?open=${this.showModal} size="sm"
 *             @oc-close=${() => (this.showModal = false)}>
 *     <p>Are you sure?</p>
 *     <oc-button slot="footer" variant="ghost" @click=${this._cancel}>Cancel</oc-button>
 *     <oc-button slot="footer" variant="danger" @click=${this._confirm}>Delete</oc-button>
 *   </oc-modal>
 */
@customElement("oc-modal")
export class OcModal extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) heading = "";
  @property({ type: String }) size: "sm" | "md" | "lg" = "md";
  @property({ type: Boolean }) dismissible = true;

  @state() private _hasFooter = false;

  private _dialogRef: Ref<HTMLDialogElement> = createRef();

  static styles = css`
    :host {
      display: contents;
    }

    dialog {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      padding: 0;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: var(--text);
      font-family: inherit;
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
    }

    /* ── Size variants ────────────── */
    :host([size="sm"]) dialog {
      width: 400px;
    }
    :host([size="md"]) dialog {
      width: 560px;
    }
    :host([size="lg"]) dialog {
      width: 720px;
    }

    /* Default to md when no size attribute is reflected */
    dialog {
      width: 560px;
    }

    /* ── Header ───────────────────── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .heading {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-strong);
      line-height: 1.3;
    }

    /* ── Close button ────────────── */
    .close-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: var(--radius-sm);
      color: var(--muted);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      transition:
        background var(--duration-normal) var(--ease-out),
        color var(--duration-normal) var(--ease-out);
    }

    .close-btn:hover {
      background: var(--bg-hover);
      color: var(--text-strong);
    }

    .close-btn:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }

    .close-btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* ── Body ─────────────────────── */
    .body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    /* ── Footer ───────────────────── */
    .footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-shrink: 0;
    }

    .footer.hidden {
      display: none;
    }
  `;

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has("open")) {
      const dialog = this._dialogRef.value;
      if (!dialog) {
        return;
      }
      if (this.open) {
        if (!dialog.open) {
          dialog.showModal();
        }
      } else {
        if (dialog.open) {
          dialog.close();
        }
      }
    }
  }

  private _dispatchClose = () => {
    this.dispatchEvent(new CustomEvent("oc-close", { bubbles: true, composed: true }));
  };

  private _close = () => {
    this._dispatchClose();
  };

  private _onNativeClose = () => {
    // The native close event fires after close() is called (including
    // programmatic close). Dispatch oc-close so the host can sync state.
    this._dispatchClose();
  };

  private _onNativeCancel = (event: Event) => {
    // Native cancel fires when the user presses Escape.
    if (!this.dismissible) {
      // Prevent the dialog from closing on Escape.
      event.preventDefault();
      return;
    }
    // Allow the native close to proceed; _onNativeClose will dispatch oc-close.
  };

  private _onDialogClick = (event: MouseEvent) => {
    if (!this.dismissible) {
      return;
    }
    const dialog = this._dialogRef.value;
    if (!dialog) {
      return;
    }
    // If the click target is the <dialog> itself the user clicked the backdrop.
    if (event.target === dialog) {
      dialog.close();
      // _onNativeClose will fire and dispatch oc-close.
    }
  };

  private _onFooterSlotChange = (event: Event) => {
    const slot = event.target as HTMLSlotElement;
    this._hasFooter = slot.assignedNodes({ flatten: true }).length > 0;
  };

  render() {
    return html`
      <dialog
        ${ref(this._dialogRef)}
        @close=${this._onNativeClose}
        @cancel=${this._onNativeCancel}
        @click=${this._onDialogClick}
      >
        <div class="header">
          <span class="heading">${this.heading}</span>
          ${
            this.dismissible
              ? html`
                <button
                  class="close-btn"
                  @click=${this._close}
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              `
              : nothing
          }
        </div>
        <div class="body">
          <slot></slot>
        </div>
        <div class=${this._hasFooter ? "footer" : "footer hidden"}>
          <slot name="footer" @slotchange=${this._onFooterSlotChange}></slot>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-modal": OcModal;
  }
}
