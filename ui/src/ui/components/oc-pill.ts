import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <oc-pill> — Status pill / badge component.
 *
 * Replaces the repeated `.pill`, `.pill--ok`, `.pill--danger`, `.pill--sm`
 * patterns used in the topbar, skills, agents, and session views.
 *
 * @property {"neutral"|"ok"|"warn"|"danger"|"info"|"accent"} variant
 * @property {"sm"|"md"} size
 * @property {boolean} dot - Shows a status dot inside the pill.
 * @property {"ok"|"warn"|"danger"|"offline"} dotStatus - Status of the dot (when dot=true).
 *
 * @slot - Pill content (text, icons, etc.).
 *
 * @example
 *   <oc-pill variant="ok">Connected</oc-pill>
 *   <oc-pill variant="danger" size="sm">Error</oc-pill>
 *   <oc-pill dot dotStatus="ok">
 *     <span>Health</span>
 *     <span class="mono">OK</span>
 *   </oc-pill>
 */
@customElement("oc-pill")
export class OcPill extends LitElement {
  @property({ type: String }) variant:
    | "neutral"
    | "ok"
    | "warn"
    | "danger"
    | "info"
    | "accent" = "neutral";
  @property({ type: String }) size: "sm" | "md" = "md";
  @property({ type: Boolean }) dot = false;
  @property({ type: String, attribute: "dot-status" }) dotStatus:
    | "ok"
    | "warn"
    | "danger"
    | "offline" = "ok";

  static styles = css`
    :host {
      display: inline-flex;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--border);
      border-radius: var(--radius-full, 9999px);
      background: var(--secondary);
      font-weight: 500;
      transition: border-color var(--duration-fast) ease;
    }
    .pill:hover {
      border-color: var(--border-strong);
    }

    /* ── Sizes ────────────────────── */
    .pill.md { padding: 6px 12px; font-size: 13px; }
    .pill.sm { padding: 3px 8px; font-size: 11px; }

    /* ── Variants ─────────────────── */
    .pill.ok {
      border-color: rgba(34, 197, 94, 0.35);
      background: var(--ok-subtle);
      color: var(--ok);
    }
    .pill.warn {
      border-color: rgba(245, 158, 11, 0.35);
      background: var(--warn-subtle);
      color: var(--warn);
    }
    .pill.danger {
      border-color: var(--danger-subtle);
      background: var(--danger-subtle);
      color: var(--danger);
    }
    .pill.info {
      border-color: rgba(59, 130, 246, 0.35);
      background: rgba(59, 130, 246, 0.1);
      color: var(--info);
    }
    .pill.accent {
      border-color: var(--accent);
      background: var(--accent-subtle);
      color: var(--accent);
    }

    /* ── Status dot ──────────────── */
    .dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full, 9999px);
      flex-shrink: 0;
    }
    .sm .dot {
      width: 6px;
      height: 6px;
    }
    .dot.ok {
      background: var(--ok);
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
    }
    .dot.warn {
      background: var(--warn);
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
    }
    .dot.danger, .dot.offline {
      background: var(--danger);
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
      animation: pulse-subtle 2s ease-in-out infinite;
    }
    .dot.ok { animation: none; }

    @keyframes pulse-subtle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @media (prefers-reduced-motion: reduce) {
      .dot.danger, .dot.offline { animation: none; }
    }
  `;

  render() {
    const pillClasses = ["pill", this.variant, this.size].join(" ");

    return html`
      <span class=${pillClasses}>
        ${this.dot
          ? html`<span class="dot ${this.dotStatus}"></span>`
          : nothing}
        <slot></slot>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-pill": OcPill;
  }
}
