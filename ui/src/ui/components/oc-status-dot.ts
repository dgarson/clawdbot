import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <oc-status-dot> — Status indicator dot with optional label.
 *
 * Replaces the repeated pattern:
 *   `<span class="statusDot ${connected ? "ok" : ""}"></span>`
 * and similar ok/warn/danger status coloring across the app.
 *
 * @property {"ok"|"warn"|"danger"|"offline"|"neutral"} status
 * @property {string} label - Optional text label next to the dot.
 * @property {"sm"|"md"} size
 * @property {boolean} pulse - Whether to pulse-animate (default: auto based on status).
 *
 * @example
 *   <oc-status-dot status="ok"></oc-status-dot>
 *   <oc-status-dot status="danger" label="Disconnected"></oc-status-dot>
 *   <oc-status-dot status=${connected ? "ok" : "offline"}></oc-status-dot>
 */
@customElement("oc-status-dot")
export class OcStatusDot extends LitElement {
  @property({ type: String }) status: "ok" | "warn" | "danger" | "offline" | "neutral" = "neutral";
  @property({ type: String }) label = "";
  @property({ type: String }) size: "sm" | "md" = "md";
  @property({ type: Boolean }) pulse: boolean | undefined = undefined;

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      border-radius: var(--radius-full, 9999px);
      flex-shrink: 0;
    }
    :host([size="sm"]) .dot { width: 6px; height: 6px; }
    :host([size="md"]) .dot { width: 8px; height: 8px; }

    /* ── Status colors ───────────── */
    .dot.ok {
      background: var(--ok);
      box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
    }
    .dot.warn {
      background: var(--warn);
      box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
    }
    .dot.danger {
      background: var(--danger);
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
    }
    .dot.offline {
      background: var(--danger);
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
    }
    .dot.neutral {
      background: var(--muted);
      box-shadow: none;
    }

    /* ── Pulse animation ─────────── */
    .dot.pulse {
      animation: pulse-subtle 2s ease-in-out infinite;
    }
    .dot.ok { animation: none; }

    @keyframes pulse-subtle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @media (prefers-reduced-motion: reduce) {
      .dot.pulse { animation: none; }
    }

    /* ── Label ────────────────────── */
    .label {
      font-size: 12px;
      font-weight: 500;
      color: var(--muted);
    }
  `;

  render() {
    const shouldPulse =
      this.pulse !== undefined
        ? this.pulse
        : this.status === "danger" || this.status === "offline";
    const dotClasses = [
      "dot",
      this.status,
      shouldPulse ? "pulse" : "",
    ].filter(Boolean).join(" ");

    return html`
      <span class=${dotClasses}></span>
      ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-status-dot": OcStatusDot;
  }
}
