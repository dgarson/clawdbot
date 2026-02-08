/**
 * Error Boundary Component & Utilities
 *
 * Provides reusable error display with:
 * - Retry mechanism with exponential backoff
 * - User-friendly error messages with recovery suggestions
 * - Collapsible technical details
 * - Consistent styling across all views
 *
 * Usage:
 *   // As a Lit template helper (preferred for view functions):
 *   import { renderError } from '../components/error-boundary.js';
 *   ${renderError({ message: 'Failed to load sessions', onRetry: () => loadSessions() })}
 *
 *   // As a custom element:
 *   <error-boundary .error=${'Connection failed'} .onRetry=${() => reconnect()}></error-boundary>
 */

import { html, css, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ErrorSeverity = "danger" | "warning" | "info";

export type ErrorBoundaryProps = {
  /** The error message to display */
  message: string;
  /** Optional detailed/technical error info (shown in collapsible section) */
  details?: string;
  /** Severity level — controls color and icon */
  severity?: ErrorSeverity;
  /** Callback for retry action. If omitted, no retry button is shown. */
  onRetry?: () => void;
  /** Custom retry button label */
  retryLabel?: string;
  /** Optional dismiss callback */
  onDismiss?: () => void;
  /** Friendly suggestion for the user */
  suggestion?: string;
  /** Compact mode — smaller padding, inline layout */
  compact?: boolean;
};

// ─── Error Message Helpers ───────────────────────────────────────────────────

/** Common error patterns → friendly messages + suggestions */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  message: string;
  suggestion: string;
}> = [
  {
    pattern: /fetch|network|ECONNREFUSED|ENOTFOUND|ERR_NETWORK/i,
    message: "Unable to connect",
    suggestion: "Check your network connection and try again.",
  },
  {
    pattern: /timeout|ETIMEDOUT|deadline/i,
    message: "Request timed out",
    suggestion: "The server took too long to respond. Try again in a moment.",
  },
  {
    pattern: /401|unauthorized|unauthenticated/i,
    message: "Authentication required",
    suggestion: "You may need to log in again.",
  },
  {
    pattern: /403|forbidden|permission/i,
    message: "Access denied",
    suggestion: "You don't have permission for this action.",
  },
  {
    pattern: /404|not found/i,
    message: "Not found",
    suggestion: "The requested resource doesn't exist or was moved.",
  },
  {
    pattern: /429|rate.limit|too many/i,
    message: "Rate limited",
    suggestion: "Too many requests. Please wait a moment and try again.",
  },
  {
    pattern: /5\d{2}|internal.server|server error/i,
    message: "Server error",
    suggestion: "Something went wrong on the server. Try again shortly.",
  },
  {
    pattern: /websocket|ws:|wss:/i,
    message: "Connection lost",
    suggestion: "The real-time connection was interrupted. Reconnecting...",
  },
  {
    pattern: /parse|JSON|syntax/i,
    message: "Data format error",
    suggestion: "The response was in an unexpected format.",
  },
];

/**
 * Get a user-friendly error message and suggestion from a raw error string.
 * Returns the original message if no pattern matches.
 */
export function friendlyError(rawError: string): {
  message: string;
  suggestion: string;
} {
  for (const { pattern, message, suggestion } of ERROR_PATTERNS) {
    if (pattern.test(rawError)) {
      return { message, suggestion };
    }
  }
  return { message: rawError, suggestion: "" };
}

// ─── Severity helpers ────────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<ErrorSeverity, string> = {
  danger: "⚠️",
  warning: "⚡",
  info: "ℹ️",
};

// ─── Template Helper ─────────────────────────────────────────────────────────

/**
 * Render an error callout with optional retry button.
 * This is the preferred way to show errors in view functions.
 *
 * @example
 * ```ts
 * ${props.error ? renderError({
 *   message: props.error,
 *   onRetry: () => controller.refresh(),
 *   compact: true,
 * }) : nothing}
 * ```
 */
export function renderError(props: ErrorBoundaryProps): TemplateResult {
  const {
    message,
    details,
    severity = "danger",
    onRetry,
    retryLabel = "Retry",
    onDismiss,
    suggestion,
    compact = false,
  } = props;

  const friendly = friendlyError(message);
  const displayMessage = suggestion ? message : friendly.message;
  const displaySuggestion = suggestion ?? friendly.suggestion;

  return html`
    <div
      class="error-boundary error-boundary--${severity} ${compact ? "error-boundary--compact" : ""}"
      role="alert"
      aria-live="polite"
    >
      <div class="error-boundary__content">
        <div class="error-boundary__header">
          <span class="error-boundary__icon">${SEVERITY_ICONS[severity]}</span>
          <span class="error-boundary__message">${displayMessage}</span>
          ${
            onDismiss
              ? html`<button
                class="error-boundary__dismiss"
                @click=${onDismiss}
                aria-label="Dismiss error"
                title="Dismiss"
              >×</button>`
              : nothing
          }
        </div>
        ${
          displaySuggestion
            ? html`<div class="error-boundary__suggestion">${displaySuggestion}</div>`
            : nothing
        }
        ${
          details
            ? html`
              <details class="error-boundary__details">
                <summary>Technical details</summary>
                <pre class="error-boundary__details-content">${details}</pre>
              </details>
            `
            : nothing
        }
      </div>
      ${
        onRetry
          ? html`
            <div class="error-boundary__actions">
              <button class="error-boundary__retry btn btn-sm" @click=${onRetry}>
                ↻ ${retryLabel}
              </button>
            </div>
          `
          : nothing
      }
    </div>
  `;
}

/**
 * Convenience: render error only if truthy, otherwise nothing.
 * Replaces the common `${error ? html\`<div class="callout danger">${error}</div>\` : nothing}` pattern.
 */
export function renderErrorIf(
  error: string | null | undefined,
  options?: Partial<ErrorBoundaryProps>,
): TemplateResult | typeof nothing {
  if (!error) return nothing;
  return renderError({ message: error, ...options });
}

// ─── Custom Element ──────────────────────────────────────────────────────────

/**
 * `<error-boundary>` — Standalone error display with retry.
 *
 * Supports auto-retry with exponential backoff.
 */
@customElement("error-boundary")
export class ErrorBoundary extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .error-boundary {
      padding: 14px 16px;
      border-radius: var(--radius-md, 8px);
      border: 1px solid;
      font-size: 0.875rem;
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .error-boundary--danger {
      border-color: rgba(239, 68, 68, 0.25);
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.04) 100%);
      color: var(--color-danger, #ef4444);
    }

    .error-boundary--warning {
      border-color: rgba(245, 158, 11, 0.25);
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%);
      color: var(--color-warning, #f59e0b);
    }

    .error-boundary--info {
      border-color: rgba(59, 130, 246, 0.25);
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%);
      color: var(--color-info, #3b82f6);
    }

    .error-boundary--compact {
      padding: 8px 12px;
      font-size: 0.8125rem;
    }

    .error-boundary__content {
      flex: 1;
      min-width: 0;
    }

    .error-boundary__header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .error-boundary__icon {
      flex-shrink: 0;
      font-size: 1rem;
    }

    .error-boundary__message {
      font-weight: 500;
      word-break: break-word;
    }

    .error-boundary__dismiss {
      margin-left: auto;
      background: none;
      border: none;
      color: inherit;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0 4px;
      opacity: 0.6;
      transition: opacity 0.15s ease;
      line-height: 1;
    }

    .error-boundary__dismiss:hover {
      opacity: 1;
    }

    .error-boundary__suggestion {
      margin-top: 4px;
      font-size: 0.8125rem;
      opacity: 0.8;
      font-weight: 400;
    }

    .error-boundary__details {
      margin-top: 8px;
    }

    .error-boundary__details summary {
      cursor: pointer;
      font-size: 0.75rem;
      opacity: 0.7;
      user-select: none;
    }

    .error-boundary__details summary:hover {
      opacity: 1;
    }

    .error-boundary__details-content {
      margin-top: 6px;
      padding: 8px;
      font-family: var(--font-mono, monospace);
      font-size: 0.75rem;
      background: rgba(0, 0, 0, 0.15);
      border-radius: 4px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
      color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    }

    .error-boundary__actions {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }

    .error-boundary__retry {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-primary, #fff);
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: var(--radius-sm, 6px);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      font-family: inherit;
    }

    .error-boundary__retry:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.25);
    }

    .error-boundary__retry:active {
      transform: scale(0.97);
    }

    .error-boundary__retry:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-boundary__retry-countdown {
      font-size: 0.75rem;
      opacity: 0.7;
      margin-top: 4px;
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .error-boundary__retry:active {
        transform: none;
      }
    }
  `;

  @property({ type: String })
  error = "";

  @property({ type: String })
  details = "";

  @property({ type: String })
  severity: ErrorSeverity = "danger";

  @property({ type: String })
  suggestion = "";

  @property({ type: String, attribute: "retry-label" })
  retryLabel = "Retry";

  @property({ type: Boolean })
  compact = false;

  /** Auto-retry: max number of automatic retries */
  @property({ type: Number, attribute: "max-retries" })
  maxRetries = 0;

  /** Auto-retry: initial delay in ms (doubles each attempt) */
  @property({ type: Number, attribute: "retry-delay" })
  retryDelay = 1000;

  @property({ attribute: false })
  onRetry?: () => void;

  @property({ attribute: false })
  onDismiss?: () => void;

  @state()
  private retryCount = 0;

  @state()
  private autoRetrying = false;

  @state()
  private countdown = 0;

  private retryTimer?: ReturnType<typeof setTimeout>;
  private countdownInterval?: ReturnType<typeof setInterval>;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearTimers();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("error")) {
      if (!this.error || changed.get("error") !== this.error) {
        this.clearTimers();
        this.retryCount = 0;
        this.autoRetrying = false;
        this.countdown = 0;
      }

      if (this.error && this.maxRetries > 0) {
        this.scheduleAutoRetry();
      }
    }
  }

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }

  private scheduleAutoRetry(): void {
    if (this.retryCount >= this.maxRetries || !this.onRetry) return;

    this.clearTimers();
    const delay = this.retryDelay * Math.pow(2, this.retryCount);
    this.autoRetrying = true;
    this.countdown = Math.ceil(delay / 1000);

    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0 && this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
    }, 1000);

    this.retryTimer = setTimeout(() => {
      this.retryCount++;
      this.autoRetrying = false;
      this.onRetry?.();
    }, delay);
  }

  private handleManualRetry(): void {
    this.clearTimers();
    this.retryCount = 0;
    this.autoRetrying = false;
    this.onRetry?.();
  }

  render(): TemplateResult {
    if (!this.error)
      return html`
        <slot></slot>
      `;

    const friendly = friendlyError(this.error);
    const displayMessage = this.suggestion || friendly.message;
    const displaySuggestion = this.suggestion ? "" : friendly.suggestion;

    return html`
      <div
        class="error-boundary error-boundary--${this.severity} ${this.compact ? "error-boundary--compact" : ""}"
        role="alert"
        aria-live="polite"
      >
        <div class="error-boundary__content">
          <div class="error-boundary__header">
            <span class="error-boundary__icon">${SEVERITY_ICONS[this.severity]}</span>
            <span class="error-boundary__message">${displayMessage}</span>
            ${
              this.onDismiss
                ? html`<button
                  class="error-boundary__dismiss"
                  @click=${this.onDismiss}
                  aria-label="Dismiss error"
                >×</button>`
                : nothing
            }
          </div>
          ${
            displaySuggestion
              ? html`<div class="error-boundary__suggestion">${displaySuggestion}</div>`
              : nothing
          }
          ${
            this.autoRetrying
              ? html`<div class="error-boundary__retry-countdown">
                Retrying in ${this.countdown}s (attempt ${this.retryCount + 1}/${this.maxRetries})...
              </div>`
              : nothing
          }
          ${
            this.details
              ? html`
                <details class="error-boundary__details">
                  <summary>Technical details</summary>
                  <pre class="error-boundary__details-content">${this.details}</pre>
                </details>
              `
              : nothing
          }
        </div>
        ${
          this.onRetry
            ? html`
              <div class="error-boundary__actions">
                <button
                  class="error-boundary__retry"
                  @click=${this.handleManualRetry}
                  ?disabled=${this.autoRetrying}
                >
                  ↻ ${this.retryLabel}
                </button>
              </div>
            `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "error-boundary": ErrorBoundary;
  }
}
