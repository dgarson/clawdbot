/**
 * Interactive Demo Section
 *
 * Showcases live previews of Clawdbrain's key features:
 * - Overseer visualization (goal orchestration)
 * - Chat interface preview
 */

import { html, css, LitElement, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import "../components/overseer-demo";
import "../components/chat-demo";

type DemoTab = "overseer" | "chat";

@customElement("landing-demos")
export class LandingDemos extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--landing-bg-dark);
      padding: var(--landing-section-padding-y, 8rem) var(--landing-padding-x, 2rem);
      font-family: var(--landing-font-body, inherit);
      scroll-margin-top: var(--landing-scroll-offset, 92px);
    }

    .section-container {
      max-width: var(--landing-max-width, 1100px);
      margin: 0 auto;
    }

    /* Header */
    .section-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--landing-primary);
      margin-bottom: 1rem;
    }

    .section-headline {
      font-family: var(--landing-font-display, inherit);
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 700;
      line-height: 1.2;
      color: var(--landing-text-primary);
      margin: 0;
    }

    .section-subheadline {
      margin: 1rem auto 0;
      max-width: 600px;
      font-size: 1.125rem;
      line-height: 1.7;
      color: var(--landing-text-secondary);
    }

    /* Tab navigation */
    .demo-tabs {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 2rem;
    }

    .demo-tab {
      font-family: var(--landing-font-body, inherit);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--landing-text-muted);
      background: transparent;
      border: 1px solid var(--landing-border);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .demo-tab:hover {
      color: var(--landing-text-primary);
      border-color: var(--landing-border-hover);
      background: rgba(255, 255, 255, 0.03);
    }

    .demo-tab:focus-visible {
      outline: 2px solid var(--landing-primary);
      outline-offset: 2px;
    }

    .demo-tab.active {
      color: var(--landing-text-primary);
      background: var(--landing-bg-elevated);
      border-color: var(--landing-primary);
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.15);
    }

    .demo-tab-icon {
      font-size: 1.125rem;
    }

    /* Demo viewport */
    .demo-viewport {
      position: relative;
      width: 100%;
      height: 500px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: var(--landing-shadow-lg);
    }

    .demo-content {
      position: absolute;
      inset: 0;
      opacity: 0;
      transform: scale(0.98);
      transition:
        opacity 0.4s ease,
        transform 0.4s ease;
      pointer-events: none;
    }

    .demo-content.active {
      opacity: 1;
      transform: scale(1);
      pointer-events: auto;
    }

    /* Demo frame glow effect */
    .demo-frame {
      position: relative;
      border-radius: 20px;
      overflow: hidden;
    }

    .demo-frame::before {
      content: "";
      position: absolute;
      inset: -2px;
      background: linear-gradient(
        135deg,
        var(--landing-primary) 0%,
        var(--landing-accent-teal) 50%,
        var(--landing-accent-lavender) 100%
      );
      border-radius: 22px;
      z-index: -1;
      opacity: 0.3;
      filter: blur(8px);
    }

    /* Feature highlights */
    .demo-highlights {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      margin-top: 3rem;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.6s ease-out 0.3s;
    }

    .demo-highlights.is-visible {
      opacity: 1;
      transform: translateY(0);
    }

    .highlight-card {
      padding: 1.25rem;
      background: var(--landing-bg-surface);
      border: 1px solid var(--landing-border);
      border-radius: 12px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .highlight-card:hover {
      transform: translateY(-2px);
      border-color: var(--landing-border-hover);
    }

    .highlight-icon {
      font-size: 1.5rem;
      margin-bottom: 0.75rem;
    }

    .highlight-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--landing-text-primary);
      margin-bottom: 0.25rem;
    }

    .highlight-description {
      font-size: 0.8125rem;
      color: var(--landing-text-muted);
      line-height: 1.5;
    }

    /* Section next CTA */
    .section-next {
      display: flex;
      justify-content: center;
      margin-top: 3rem;
    }

    .next-button {
      font-family: var(--landing-font-body, inherit);
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.125rem;
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--landing-text-primary);
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--landing-border);
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .next-button:hover {
      transform: translateY(-1px);
      border-color: var(--landing-border-hover);
      background: rgba(255, 255, 255, 0.05);
    }

    .next-button:focus-visible {
      outline: 2px solid var(--landing-primary);
      outline-offset: 2px;
    }

    .next-arrow {
      color: var(--landing-primary);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .demo-viewport {
        height: 420px;
      }

      .demo-highlights {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .demo-tabs {
        flex-wrap: wrap;
      }

      .demo-tab {
        flex: 1;
        min-width: 140px;
        justify-content: center;
      }
    }

    @media (max-width: 480px) {
      .demo-viewport {
        height: 380px;
      }

      .next-button {
        width: 100%;
        max-width: 320px;
        justify-content: center;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .demo-content {
        transition: opacity 0.2s ease;
        transform: none;
      }

      .demo-content.active {
        transform: none;
      }
    }
  `;

  @state()
  private activeTab: DemoTab = "overseer";

  @state()
  private isVisible = false;

  private readonly highlights = {
    overseer: [
      {
        icon: "🎯",
        title: "Goal Breakdown",
        description: "Complex goals split into actionable tasks",
      },
      {
        icon: "🤖",
        title: "Agent Assignment",
        description: "Right agent for each task, automatically",
      },
      {
        icon: "📊",
        title: "Live Progress",
        description: "Real-time status across the entire run",
      },
    ],
    chat: [
      {
        icon: "💬",
        title: "Natural Language",
        description: "Just describe what you need done",
      },
      {
        icon: "🔧",
        title: "Tool Integration",
        description: "Agents use your connected tools directly",
      },
      {
        icon: "✅",
        title: "Approval Gates",
        description: "Review sensitive actions before execution",
      },
    ],
  };

  firstUpdated(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.isVisible = true;
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(this);
  }

  private setActiveTab(tab: DemoTab): void {
    this.activeTab = tab;
  }

  private renderHighlights(): TemplateResult {
    const currentHighlights = this.highlights[this.activeTab];

    return html`
      <div class="demo-highlights ${this.isVisible ? "is-visible" : ""}">
        ${currentHighlights.map(
          (h) => html`
            <div class="highlight-card">
              <div class="highlight-icon">${h.icon}</div>
              <div class="highlight-title">${h.title}</div>
              <div class="highlight-description">${h.description}</div>
            </div>
          `,
        )}
      </div>
    `;
  }

  render(): TemplateResult {
    return html`
      <section id="demo-section">
        <div class="section-container">
          <div class="section-header">
            <span class="section-label">Live Preview</span>
            <h2 class="section-headline">See it in action</h2>
            <p class="section-subheadline">
              Watch how Clawdbrain orchestrates agents and handles complex workflows through simple conversation.
            </p>
          </div>

          <div class="demo-tabs" role="tablist" aria-label="Demo previews">
            <button
              class="demo-tab ${this.activeTab === "overseer" ? "active" : ""}"
              role="tab"
              aria-selected="${this.activeTab === "overseer"}"
              aria-controls="demo-overseer"
              @click=${() => this.setActiveTab("overseer")}
            >
              <span class="demo-tab-icon">🎯</span>
              <span>Orchestration</span>
            </button>
            <button
              class="demo-tab ${this.activeTab === "chat" ? "active" : ""}"
              role="tab"
              aria-selected="${this.activeTab === "chat"}"
              aria-controls="demo-chat"
              @click=${() => this.setActiveTab("chat")}
            >
              <span class="demo-tab-icon">💬</span>
              <span>Chat Interface</span>
            </button>
          </div>

          <div class="demo-frame">
            <div class="demo-viewport">
              <div
                id="demo-overseer"
                class="demo-content ${this.activeTab === "overseer" ? "active" : ""}"
                role="tabpanel"
                aria-hidden="${this.activeTab !== "overseer"}"
              >
                <overseer-demo></overseer-demo>
              </div>

              <div
                id="demo-chat"
                class="demo-content ${this.activeTab === "chat" ? "active" : ""}"
                role="tabpanel"
                aria-hidden="${this.activeTab !== "chat"}"
              >
                <chat-demo></chat-demo>
              </div>
            </div>
          </div>

          ${this.renderHighlights()}

          <div class="section-next">
            <button class="next-button" @click=${this.handleNext}>
              Next: See all features <span class="next-arrow">→</span>
            </button>
          </div>
        </div>
      </section>
    `;
  }

  private handleNext(): void {
    this.dispatchEvent(
      new CustomEvent("landing-navigate", {
        detail: { section: "features" },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "landing-demos": LandingDemos;
  }
}
