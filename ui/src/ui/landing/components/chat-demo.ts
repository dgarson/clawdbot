/**
 * Interactive Chat Preview Demo
 *
 * A simulated chat experience showing how users interact with Clawdbrain
 * agents through natural conversation.
 */

import { html, css, LitElement, TemplateResult, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  typing?: boolean;
  toolUse?: {
    name: string;
    status: "running" | "complete";
  };
}

const DEMO_CONVERSATION: ChatMessage[] = [
  {
    id: "1",
    type: "user",
    content: "Review the open PRs and summarize what needs attention",
    timestamp: "2:34 PM",
  },
  {
    id: "2",
    type: "assistant",
    content: "I'll check your open pull requests now.",
    timestamp: "2:34 PM",
    toolUse: { name: "github.list_prs", status: "complete" },
  },
  {
    id: "3",
    type: "assistant",
    content:
      "Found 3 open PRs:\n\n• **#142** — Auth refactor (2 approvals, ready to merge)\n• **#139** — API rate limiting (needs your review)\n• **#136** — Dashboard updates (CI failing)\n\nWant me to merge #142 or help fix the CI on #136?",
    timestamp: "2:35 PM",
  },
  {
    id: "4",
    type: "user",
    content: "Merge 142 and fix the CI issue on 136",
    timestamp: "2:35 PM",
  },
  {
    id: "5",
    type: "system",
    content: "🔒 Approval requested: Merge PR #142 to main",
    timestamp: "2:35 PM",
  },
];

@customElement("chat-demo")
export class ChatDemo extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 400px;
    }

    .demo-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--landing-bg-surface);
      border: 1px solid var(--landing-border);
      border-radius: 16px;
      overflow: hidden;
    }

    /* Header */
    .demo-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid var(--landing-border);
    }

    .demo-header-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .demo-header-dot.red {
      background: var(--window-dot-close);
    }
    .demo-header-dot.yellow {
      background: var(--window-dot-minimize);
    }
    .demo-header-dot.green {
      background: var(--window-dot-maximize);
    }

    .demo-header-title {
      flex: 1;
      text-align: center;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--landing-text-muted);
      letter-spacing: 0.02em;
    }

    /* Chat area */
    .chat-area {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Message styles */
    .message {
      display: flex;
      gap: 0.75rem;
      opacity: 0;
      transform: translateY(10px);
      animation: messageIn 0.4s ease-out forwards;
    }

    @keyframes messageIn {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message.user {
      flex-direction: row-reverse;
    }

    .message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .message.user .message-avatar {
      background: linear-gradient(135deg, var(--landing-primary), var(--landing-accent-lavender));
      color: white;
    }

    .message.assistant .message-avatar {
      background: var(--landing-bg-elevated);
      border: 1px solid var(--landing-border);
    }

    .message-content {
      max-width: 80%;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .message.user .message-content {
      align-items: flex-end;
    }

    .message-bubble {
      padding: 0.75rem 1rem;
      border-radius: 16px;
      font-size: 0.875rem;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .message.user .message-bubble {
      background: var(--landing-primary);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message.assistant .message-bubble {
      background: var(--landing-bg-elevated);
      color: var(--landing-text-primary);
      border: 1px solid var(--landing-border);
      border-bottom-left-radius: 4px;
    }

    .message.system {
      justify-content: center;
    }

    .message.system .message-bubble {
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: var(--landing-primary);
      font-size: 0.8125rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
    }

    /* Tool use indicator */
    .tool-use {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.5rem;
      background: rgba(45, 212, 191, 0.1);
      border: 1px solid rgba(45, 212, 191, 0.3);
      border-radius: 6px;
      font-size: 0.6875rem;
      font-family: var(--landing-font-mono, monospace);
      color: var(--landing-accent-teal);
      margin-bottom: 0.25rem;
    }

    .tool-use-icon {
      width: 12px;
      height: 12px;
    }

    .tool-use-icon.running {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .tool-use-icon.complete {
      color: var(--landing-accent-warm);
    }

    .message-time {
      font-size: 0.625rem;
      color: var(--landing-text-muted);
      padding: 0 0.25rem;
    }

    /* Typing indicator */
    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 0.75rem 1rem;
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--landing-text-muted);
      animation: typingBounce 1.4s ease-in-out infinite;
    }

    .typing-dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    .typing-dot:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typingBounce {
      0%,
      60%,
      100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(-4px);
      }
    }

    /* Input area */
    .chat-input-area {
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--landing-border);
      background: rgba(0, 0, 0, 0.2);
    }

    .chat-input {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      background: var(--landing-bg-elevated);
      border: 1px solid var(--landing-border);
      border-radius: 24px;
      transition: border-color 0.2s ease;
    }

    .chat-input:focus-within {
      border-color: var(--landing-primary);
    }

    .chat-input-text {
      flex: 1;
      font-size: 0.875rem;
      color: var(--landing-text-muted);
    }

    .chat-input-send {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--landing-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .chat-input-send:hover {
      transform: scale(1.1);
    }

    .chat-input-send svg {
      width: 14px;
      height: 14px;
      color: white;
    }

    /* Markdown-like formatting */
    .message-bubble strong {
      font-weight: 600;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .message-content {
        max-width: 90%;
      }

      .message-bubble {
        font-size: 0.8125rem;
        padding: 0.625rem 0.875rem;
      }
    }
  `;

  @state()
  private visibleMessages: ChatMessage[] = [];

  @state()
  private isTyping = false;

  @state()
  private currentMessageIndex = 0;

  private animationTimeout?: ReturnType<typeof setTimeout>;

  connectedCallback(): void {
    super.connectedCallback();
    this.startAnimation();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
  }

  private startAnimation(): void {
    this.visibleMessages = [];
    this.currentMessageIndex = 0;
    this.showNextMessage();
  }

  private showNextMessage(): void {
    if (this.currentMessageIndex >= DEMO_CONVERSATION.length) {
      // Reset after a pause
      this.animationTimeout = setTimeout(() => {
        this.startAnimation();
      }, 4000);
      return;
    }

    const nextMessage = DEMO_CONVERSATION[this.currentMessageIndex];

    // Show typing indicator for assistant messages
    if (nextMessage.type === "assistant") {
      this.isTyping = true;
      this.animationTimeout = setTimeout(() => {
        this.isTyping = false;
        this.visibleMessages = [...this.visibleMessages, nextMessage];
        this.currentMessageIndex++;
        this.animationTimeout = setTimeout(() => this.showNextMessage(), 1500);
      }, 1200);
    } else {
      this.visibleMessages = [...this.visibleMessages, nextMessage];
      this.currentMessageIndex++;
      const delay = nextMessage.type === "system" ? 800 : 1200;
      this.animationTimeout = setTimeout(() => this.showNextMessage(), delay);
    }
  }

  private renderToolUse(toolUse: { name: string; status: "running" | "complete" }): TemplateResult {
    return html`
      <div class="tool-use">
        ${
          toolUse.status === "running"
            ? html`
                <svg
                  class="tool-use-icon running"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              `
            : html`
                <svg
                  class="tool-use-icon complete"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              `
        }
        <span>${toolUse.name}</span>
      </div>
    `;
  }

  private renderMessage(message: ChatMessage, index: number): TemplateResult {
    if (message.type === "system") {
      return html`
        <div class="message system" style="animation-delay: ${index * 100}ms">
          <div class="message-bubble">${message.content}</div>
        </div>
      `;
    }

    const avatar = message.type === "user" ? "D" : "🤖";

    // Simple markdown-like formatting
    const formattedContent = message.content
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

    return html`
      <div class="message ${message.type}" style="animation-delay: ${index * 100}ms">
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
          ${message.toolUse ? this.renderToolUse(message.toolUse) : nothing}
          <div class="message-bubble" .innerHTML=${formattedContent}></div>
          ${
            message.timestamp
              ? html`<span class="message-time">${message.timestamp}</span>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private renderTypingIndicator(): TemplateResult {
    return html`
      <div class="message assistant">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
          <div class="message-bubble">
            <div class="typing-indicator">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  render(): TemplateResult {
    return html`
      <div class="demo-container">
        <div class="demo-header">
          <span class="demo-header-dot red"></span>
          <span class="demo-header-dot yellow"></span>
          <span class="demo-header-dot green"></span>
          <span class="demo-header-title">Clawdbrain — Chat</span>
        </div>

        <div class="chat-area">
          ${this.visibleMessages.map((msg, i) => this.renderMessage(msg, i))}
          ${this.isTyping ? this.renderTypingIndicator() : nothing}
        </div>

        <div class="chat-input-area">
          <div class="chat-input">
            <span class="chat-input-text">Message Clawdbrain...</span>
            <div class="chat-input-send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-demo": ChatDemo;
  }
}
