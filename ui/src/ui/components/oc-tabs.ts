import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <oc-tab> — Individual tab item, child of <oc-tabs>.
 *
 * Renders its own tab button and panel. The parent <oc-tabs> sets
 * `active` and `disabled` as reflected attributes; this element shows
 * or hides its panel accordingly via CSS.
 *
 * @property {string} value - Unique identifier for this tab.
 * @property {string} label - Tab button label text.
 * @property {boolean} disabled - When true, tab cannot be selected.
 * @property {boolean} active - Set by parent oc-tabs when this tab is selected.
 *
 * @slot - Tab panel content (shown when active, hidden otherwise).
 *
 * @fires oc-tab-select - Dispatched when the tab button is clicked.
 *   detail: { value: string }
 *
 * @example
 *   <oc-tab value="agents" label="Agents">
 *     <div>Agents panel</div>
 *   </oc-tab>
 */
@customElement("oc-tab")
export class OcTab extends LitElement {
  @property({ type: String, reflect: true }) value = "";
  @property({ type: String }) label = "";
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) active = false;

  static styles = css`
    :host {
      display: contents;
    }

    .tab-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 8px 14px;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      color: var(--muted);
      border-bottom: 2px solid transparent;
      transition:
        color var(--duration-fast) ease,
        border-color var(--duration-fast) ease;
    }

    :host([active]) .tab-btn {
      color: var(--text-strong);
      border-bottom-color: var(--accent);
    }

    .tab-btn:hover:not(:disabled) {
      color: var(--text-strong);
    }

    :host([disabled]) .tab-btn {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    .panel {
      display: none;
      padding-top: 16px;
    }

    :host([active]) .panel {
      display: block;
    }
  `;

  private _handleTabClick = () => {
    if (this.disabled) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent("oc-tab-select", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  };

  render() {
    return html`
      <button
        class="tab-btn"
        role="tab"
        aria-selected=${this.active}
        aria-disabled=${this.disabled}
        ?disabled=${this.disabled}
        @click=${this._handleTabClick}
      >
        ${this.label}
      </button>
      <div class="panel" role="tabpanel">
        <slot></slot>
      </div>
    `;
  }
}

/**
 * <oc-tabs> — Tab container and controller.
 *
 * Renders a tablist that slots child <oc-tab> elements. Listens for
 * `oc-tab-select` events bubbled from children and synchronises the
 * `active` attribute across all child tabs.
 *
 * @property {string} active - Value of the currently selected tab.
 *
 * @slot - <oc-tab> elements.
 *
 * @fires oc-tab-change - Dispatched when the active tab changes.
 *   detail: { value: string }
 *
 * @example
 *   <oc-tabs active="agents">
 *     <oc-tab value="agents" label="Agents"><div>Agents panel</div></oc-tab>
 *     <oc-tab value="skills" label="Skills"><div>Skills panel</div></oc-tab>
 *   </oc-tabs>
 */
@customElement("oc-tabs")
export class OcTabs extends LitElement {
  @property({ type: String }) active = "";

  static styles = css`
    :host {
      display: block;
    }

    .tablist {
      display: flex;
      border-bottom: 1px solid var(--border);
      gap: 0;
      overflow-x: auto;
    }

    .panels {
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("oc-tab-select", this._handleTabSelect);
    this._syncTabs();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("oc-tab-select", this._handleTabSelect);
  }

  private _handleTabSelect = (e: Event) => {
    const detail = (e as CustomEvent<{ value: string }>).detail;
    if (!detail?.value || detail.value === this.active) {
      return;
    }
    this.active = detail.value;
    this._syncTabs();
    this.dispatchEvent(
      new CustomEvent("oc-tab-change", {
        detail: { value: this.active },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private _handleSlotChange = () => {
    this._syncTabs();
  };

  private _syncTabs() {
    const tabs = this.querySelectorAll<OcTab>("oc-tab");
    tabs.forEach((tab) => {
      tab.active = tab.value === this.active;
    });
  }

  render() {
    return html`
      <div class="tablist" role="tablist">
        <slot @slotchange=${this._handleSlotChange}></slot>
      </div>
      <div class="panels"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-tabs": OcTabs;
    "oc-tab": OcTab;
  }
}
