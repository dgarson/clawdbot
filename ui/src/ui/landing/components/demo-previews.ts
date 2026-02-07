import { html, css, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

type DemoPreviewKind = "overseer" | "chat" | "memory";

interface OverseerNode {
  id: string;
  label: string;
  status: "done" | "active" | "queued";
  x: number; // 0-100
  y: number; // 0-100
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface MemoryNode {
  id: string;
  label: string;
  kind: "experience" | "entity" | "relation" | "episode";
  x: number;
  y: number;
}

const OVERSEER_NODES: OverseerNode[] = [
  { id: "goal", label: "Goal", status: "done", x: 10, y: 55 },
  { id: "plan", label: "Plan", status: "done", x: 30, y: 30 },
  { id: "research", label: "Research", status: "active", x: 48, y: 62 },
  { id: "change", label: "Change", status: "queued", x: 66, y: 28 },
  { id: "verify", label: "Verify", status: "queued", x: 86, y: 58 },
];

const CHAT_SCRIPT: ChatMessage[] = [
  { role: "user", text: "Add interactive demos to the landing page." },
  {
    role: "assistant",
    text: "Got it. I'll add an Overseer visualization + a chat preview animation.",
  },
  { role: "assistant", text: "First: scanning existing landing sections + animation patterns…" },
  {
    role: "assistant",
    text: "Drafting a lightweight demo preview component (no backend required).",
  },
  {
    role: "assistant",
    text: "Hooking it into the hero section. Want it above the fold or below copy?",
  },
];

const MEMORY_NODES: MemoryNode[] = [
  { id: "exp1", label: "Tool Use", kind: "experience", x: 8, y: 35 },
  { id: "exp2", label: "Decision", kind: "experience", x: 8, y: 70 },
  { id: "ent1", label: "Project", kind: "entity", x: 38, y: 25 },
  { id: "ent2", label: "Person", kind: "entity", x: 38, y: 55 },
  { id: "ent3", label: "Tool", kind: "entity", x: 38, y: 80 },
  { id: "rel1", label: "works-on", kind: "relation", x: 64, y: 40 },
  { id: "rel2", label: "prefers", kind: "relation", x: 64, y: 68 },
  { id: "ep1", label: "Episode", kind: "episode", x: 88, y: 52 },
];

const MEMORY_EDGES: [string, string][] = [
  ["exp1", "ent1"],
  ["exp1", "ent3"],
  ["exp2", "ent2"],
  ["exp2", "ent1"],
  ["ent1", "rel1"],
  ["ent2", "rel1"],
  ["ent2", "rel2"],
  ["ent3", "rel2"],
  ["rel1", "ep1"],
  ["rel2", "ep1"],
];

/** Tab definitions for iteration */
const TABS: { kind: DemoPreviewKind; label: string; chip: string }[] = [
  { kind: "overseer", label: "Overseer", chip: "Live mock" },
  { kind: "chat", label: "Chat", chip: "Preview" },
  { kind: "memory", label: "Memory", chip: "Graph" },
];

@customElement("landing-demo-previews")
export class LandingDemoPreviews extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: min(960px, 100%);
      margin: 1.75rem auto 0;
    }

    .shell {
      border: 1px solid var(--landing-border);
      background: rgba(255, 255, 255, 0.03);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: var(--landing-shadow-lg);
    }

    :host-context([data-theme="light"]) .shell {
      background: rgba(0, 0, 0, 0.03);
    }

    .tabs {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      padding: 0.75rem;
      border-bottom: 1px solid var(--landing-border);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      background: rgba(10, 10, 15, 0.35);
    }

    :host-context([data-theme="light"]) .tabs {
      background: rgba(255, 255, 255, 0.55);
    }

    .tab {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: 999px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--landing-text-muted);
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition:
        background 0.2s ease,
        color 0.2s ease,
        border-color 0.2s ease;
    }

    .tab:hover {
      color: var(--landing-text-primary);
      background: rgba(255, 255, 255, 0.06);
    }

    :host-context([data-theme="light"]) .tab:hover {
      background: rgba(0, 0, 0, 0.06);
    }

    .tab:focus-visible {
      outline: 2px solid var(--landing-primary, #6366f1);
      outline-offset: 2px;
    }

    .tab[aria-selected="true"] {
      color: var(--landing-text-primary);
      border-color: rgba(99, 102, 241, 0.5);
      background: rgba(99, 102, 241, 0.12);
    }

    .hint {
      margin-left: auto;
      font-size: 0.8rem;
      color: var(--landing-text-muted);
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
    }

    .hint-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: rgba(45, 212, 191, 0.8);
      box-shadow: 0 0 0 6px rgba(45, 212, 191, 0.08);
      animation: hintPulse 1.8s ease-in-out infinite;
    }

    .hint-dot.paused {
      animation-play-state: paused;
    }

    @keyframes hintPulse {
      0%,
      100% {
        transform: scale(1);
        opacity: 0.9;
      }
      50% {
        transform: scale(1.15);
        opacity: 0.6;
      }
    }

    .panel {
      padding: 1rem;
    }

    .panel-inner {
      border-radius: 14px;
      border: 1px solid var(--landing-border);
      background: rgba(10, 10, 15, 0.35);
      overflow: hidden;
      min-height: 320px;
    }

    :host-context([data-theme="light"]) .panel-inner {
      background: rgba(255, 255, 255, 0.55);
    }

    /* Overseer preview */
    .overseer {
      position: relative;
      height: 320px;
      overflow: hidden;
    }

    .grid {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 20% 40%, rgba(99, 102, 241, 0.16), transparent 55%),
        radial-gradient(circle at 80% 70%, rgba(45, 212, 191, 0.12), transparent 55%),
        radial-gradient(circle at 50% 20%, rgba(168, 85, 247, 0.12), transparent 60%),
        linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
      background-size:
        auto,
        auto,
        auto,
        28px 28px,
        28px 28px;
      background-position:
        0 0,
        0 0,
        0 0,
        0 0,
        0 0;
      opacity: 0.7;
      mask-image: radial-gradient(circle at 50% 55%, black 30%, transparent 70%);
    }

    :host-context([data-theme="light"]) .grid {
      background:
        radial-gradient(circle at 20% 40%, rgba(99, 102, 241, 0.14), transparent 55%),
        radial-gradient(circle at 80% 70%, rgba(45, 212, 191, 0.12), transparent 55%),
        radial-gradient(circle at 50% 20%, rgba(168, 85, 247, 0.12), transparent 60%),
        linear-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
      opacity: 0.65;
    }

    .edge {
      position: absolute;
      height: 2px;
      transform-origin: left center;
      background: linear-gradient(
        90deg,
        rgba(99, 102, 241, 0),
        rgba(99, 102, 241, 0.65),
        rgba(45, 212, 191, 0)
      );
      opacity: 0.8;
      filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.22));
      animation: edgeFlow 2.6s ease-in-out infinite;
    }

    :host(.paused) .edge {
      animation-play-state: paused;
    }

    @keyframes edgeFlow {
      0%,
      100% {
        opacity: 0.55;
      }
      50% {
        opacity: 0.95;
      }
    }

    .node {
      position: absolute;
      transform: translate(-50%, -50%);
      width: 124px;
      border-radius: 14px;
      border: 1px solid var(--landing-border);
      background: rgba(10, 10, 15, 0.62);
      padding: 0.75rem 0.75rem 0.65rem;
      display: grid;
      gap: 0.35rem;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
      opacity: 0;
      animation: nodeAppear 0.5s ease-out forwards;
    }

    @keyframes nodeAppear {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.85);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    :host-context([data-theme="light"]) .node {
      background: rgba(255, 255, 255, 0.75);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
    }

    .node-label {
      font-weight: 700;
      font-size: 0.875rem;
      color: var(--landing-text-primary);
      letter-spacing: -0.01em;
    }

    .node-status {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--landing-text-muted);
    }

    .status-pill {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.7);
    }

    .node[data-status="done"] .status-pill {
      background: rgba(34, 197, 94, 0.85);
      box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.08);
    }

    .node[data-status="active"] {
      border-color: rgba(45, 212, 191, 0.55);
      box-shadow:
        0 0 0 1px rgba(45, 212, 191, 0.08),
        0 14px 28px rgba(0, 0, 0, 0.32);
    }

    .node[data-status="active"] .status-pill {
      background: rgba(45, 212, 191, 0.9);
      box-shadow: 0 0 0 7px rgba(45, 212, 191, 0.1);
      animation: activePulse 1.4s ease-in-out infinite;
    }

    :host(.paused) .node[data-status="active"] .status-pill {
      animation-play-state: paused;
    }

    @keyframes activePulse {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.2);
      }
    }

    .node[data-status="queued"] {
      opacity: 0.8;
    }

    .cursor {
      position: absolute;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 2px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 0 0 10px rgba(99, 102, 241, 0.08);
      opacity: 0;
      transform: translate(-50%, -50%);
      transition: opacity 200ms ease;
      pointer-events: none;
    }

    :host-context([data-theme="light"]) .cursor {
      border-color: rgba(0, 0, 0, 0.75);
    }

    .cursor.playing {
      opacity: 1;
      animation: cursorMove 5.2s ease-in-out infinite;
    }

    :host(.paused) .cursor.playing {
      animation-play-state: paused;
    }

    @keyframes cursorMove {
      0% {
        left: 16%;
        top: 58%;
      }
      25% {
        left: 32%;
        top: 34%;
      }
      52% {
        left: 50%;
        top: 62%;
      }
      72% {
        left: 66%;
        top: 32%;
      }
      100% {
        left: 86%;
        top: 60%;
      }
    }

    /* Chat preview */
    .chat {
      display: grid;
      grid-template-rows: auto 1fr;
      height: 320px;
    }

    .chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 0.9rem;
      border-bottom: 1px solid var(--landing-border);
      color: var(--landing-text-muted);
      font-size: 0.8rem;
      font-weight: 600;
    }

    .chat-title {
      display: inline-flex;
      gap: 0.5rem;
      align-items: center;
    }

    .chip {
      font-size: 0.7rem;
      padding: 0.18rem 0.5rem;
      border-radius: 999px;
      border: 1px solid var(--landing-border);
      color: var(--landing-text-muted);
      background: rgba(255, 255, 255, 0.03);
    }

    :host-context([data-theme="light"]) .chip {
      background: rgba(0, 0, 0, 0.03);
    }

    .chat-body {
      padding: 0.9rem;
      overflow: hidden;
      display: grid;
      align-content: start;
      gap: 0.65rem;
    }

    .bubble {
      width: fit-content;
      max-width: min(640px, 92%);
      border: 1px solid var(--landing-border);
      border-radius: 14px;
      padding: 0.6rem 0.75rem;
      font-size: 0.9rem;
      line-height: 1.35;
      opacity: 0;
      transform: translateY(8px);
      animation: bubbleIn 600ms ease-out forwards;
      background: rgba(255, 255, 255, 0.04);
    }

    :host-context([data-theme="light"]) .bubble {
      background: rgba(0, 0, 0, 0.04);
    }

    .bubble.user {
      margin-left: auto;
      background: rgba(99, 102, 241, 0.14);
      border-color: rgba(99, 102, 241, 0.28);
    }

    .bubble.assistant {
      margin-right: auto;
    }

    @keyframes bubbleIn {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .typing {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      color: var(--landing-text-muted);
      font-size: 0.85rem;
      font-weight: 600;
      opacity: 0;
      animation: typingIn 500ms ease-out forwards;
    }

    @keyframes typingIn {
      to {
        opacity: 1;
      }
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.8);
      animation: dotBounce 1.05s ease-in-out infinite;
    }
    .dot:nth-child(2) {
      animation-delay: 120ms;
    }
    .dot:nth-child(3) {
      animation-delay: 240ms;
    }

    @keyframes dotBounce {
      0%,
      100% {
        transform: translateY(0);
        opacity: 0.65;
      }
      50% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }

    /* Memory graph preview */
    .memory {
      position: relative;
      height: 320px;
      overflow: hidden;
    }

    .memory .grid {
      background:
        radial-gradient(circle at 30% 50%, rgba(168, 85, 247, 0.18), transparent 50%),
        radial-gradient(circle at 70% 50%, rgba(45, 212, 191, 0.14), transparent 50%),
        radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.1), transparent 50%),
        linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size:
        auto,
        auto,
        auto,
        24px 24px,
        24px 24px;
      mask-image: radial-gradient(circle at 50% 50%, black 35%, transparent 72%);
    }

    .memory-edge {
      position: absolute;
      height: 1.5px;
      transform-origin: left center;
      opacity: 0;
      animation: memEdgeIn 0.6s ease-out forwards;
    }

    .memory-edge.experience-entity {
      background: linear-gradient(
        90deg,
        rgba(168, 85, 247, 0),
        rgba(168, 85, 247, 0.5),
        rgba(99, 102, 241, 0)
      );
    }

    .memory-edge.entity-relation {
      background: linear-gradient(
        90deg,
        rgba(99, 102, 241, 0),
        rgba(99, 102, 241, 0.5),
        rgba(45, 212, 191, 0)
      );
    }

    .memory-edge.relation-episode {
      background: linear-gradient(
        90deg,
        rgba(45, 212, 191, 0),
        rgba(45, 212, 191, 0.5),
        rgba(251, 191, 36, 0)
      );
    }

    @keyframes memEdgeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 0.7;
      }
    }

    .mem-node {
      position: absolute;
      transform: translate(-50%, -50%);
      border-radius: 12px;
      border: 1px solid var(--landing-border);
      background: rgba(10, 10, 15, 0.65);
      padding: 0.5rem 0.65rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
      opacity: 0;
      animation: memNodeIn 0.5s ease-out forwards;
      white-space: nowrap;
    }

    :host-context([data-theme="light"]) .mem-node {
      background: rgba(255, 255, 255, 0.78);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
    }

    @keyframes memNodeIn {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    .mem-node-icon {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      flex-shrink: 0;
    }

    .mem-node[data-kind="experience"] .mem-node-icon {
      background: rgba(168, 85, 247, 0.85);
      box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.1);
    }

    .mem-node[data-kind="entity"] .mem-node-icon {
      background: rgba(99, 102, 241, 0.85);
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
    }

    .mem-node[data-kind="relation"] .mem-node-icon {
      background: rgba(45, 212, 191, 0.85);
      box-shadow: 0 0 0 4px rgba(45, 212, 191, 0.1);
    }

    .mem-node[data-kind="episode"] .mem-node-icon {
      background: rgba(251, 191, 36, 0.85);
      box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.1);
    }

    .mem-node-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--landing-text-secondary);
      letter-spacing: -0.01em;
    }

    .memory-legend {
      position: absolute;
      bottom: 0.75rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 1rem;
      font-size: 0.7rem;
      color: var(--landing-text-muted);
      opacity: 0;
      animation: fadeIn 0.6s ease-out 0.8s forwards;
    }

    @keyframes fadeIn {
      to {
        opacity: 1;
      }
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .legend-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
    }

    .legend-dot.experience {
      background: rgba(168, 85, 247, 0.85);
    }
    .legend-dot.entity {
      background: rgba(99, 102, 241, 0.85);
    }
    .legend-dot.relation {
      background: rgba(45, 212, 191, 0.85);
    }
    .legend-dot.episode {
      background: rgba(251, 191, 36, 0.85);
    }

    .memory-flow-label {
      position: absolute;
      top: 0.75rem;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--landing-text-muted);
      opacity: 0;
      animation: fadeIn 0.6s ease-out 0.4s forwards;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .flow-arrow {
      color: rgba(148, 163, 184, 0.5);
      font-size: 0.65rem;
    }

    /* Data pulse animation for memory */
    .data-pulse {
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 999px;
      background: rgba(168, 85, 247, 0.9);
      animation: dataPulseMove 3s ease-in-out infinite;
      opacity: 0;
    }

    .data-pulse:nth-child(2) {
      animation-delay: 1s;
      background: rgba(99, 102, 241, 0.9);
    }

    .data-pulse:nth-child(3) {
      animation-delay: 2s;
      background: rgba(45, 212, 191, 0.9);
    }

    @keyframes dataPulseMove {
      0% {
        left: 10%;
        top: 50%;
        opacity: 0;
      }
      10% {
        opacity: 0.9;
      }
      50% {
        left: 50%;
        top: 45%;
        opacity: 0.7;
      }
      90% {
        opacity: 0.9;
      }
      100% {
        left: 90%;
        top: 52%;
        opacity: 0;
      }
    }

    /* Reduce motion */
    @media (prefers-reduced-motion: reduce) {
      .edge,
      .cursor.playing,
      .hint-dot,
      .dot,
      .data-pulse {
        animation: none !important;
      }

      .bubble {
        opacity: 1;
        transform: none;
        animation: none;
      }

      .node,
      .mem-node,
      .memory-edge {
        animation: none !important;
        opacity: 1;
      }

      .mem-node {
        transform: translate(-50%, -50%);
      }

      .node {
        transform: translate(-50%, -50%);
      }
    }

    @media (max-width: 720px) {
      :host {
        margin-top: 1.25rem;
      }

      .hint {
        display: none;
      }

      .node {
        width: 100px;
        padding: 0.55rem;
      }

      .node-label {
        font-size: 0.78rem;
      }

      .node-status {
        font-size: 0.68rem;
      }

      .mem-node {
        padding: 0.4rem 0.5rem;
      }

      .mem-node-label {
        font-size: 0.7rem;
      }

      .memory-legend {
        gap: 0.6rem;
        font-size: 0.62rem;
      }

      .tabs {
        gap: 0.3rem;
        padding: 0.6rem;
      }

      .tab {
        padding: 0.4rem 0.6rem;
        font-size: 0.8rem;
      }
    }

    @media (max-width: 480px) {
      .chip {
        display: none;
      }
    }
  `;

  @property({ type: String })
  kind: DemoPreviewKind = "overseer";

  @state()
  private chatCycle = 0;

  @state()
  private isVisible = true;

  private chatTimer: number | null = null;
  private observer: IntersectionObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.startChatCycle();
    this.setupVisibilityObserver();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopChatCycle();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /** Use IntersectionObserver to pause animations when off-screen */
  private setupVisibilityObserver(): void {
    if (!("IntersectionObserver" in window)) return;
    this.observer = new IntersectionObserver(
      ([entry]) => {
        this.isVisible = entry.isIntersecting;
        if (this.isVisible) {
          this.classList.remove("paused");
          if (!this.chatTimer) this.startChatCycle();
        } else {
          this.classList.add("paused");
          this.stopChatCycle();
        }
      },
      { threshold: 0.15 },
    );
    this.observer.observe(this);
  }

  private startChatCycle(): void {
    if (this.chatTimer) return;
    this.chatTimer = window.setInterval(() => {
      const next = this.chatCycle + 1;
      if (next > CHAT_SCRIPT.length) {
        // Pause at the end for 2 extra ticks before restarting
        this.stopChatCycle();
        window.setTimeout(() => {
          this.chatCycle = 0;
          if (this.isVisible) this.startChatCycle();
        }, 3000);
      } else {
        this.chatCycle = next;
      }
    }, 2800);
  }

  private stopChatCycle(): void {
    if (this.chatTimer) {
      window.clearInterval(this.chatTimer);
      this.chatTimer = null;
    }
  }

  private setKind(next: DemoPreviewKind): void {
    this.kind = next;
    // Reset chat cycle when switching to chat tab
    if (next === "chat") {
      this.chatCycle = 0;
      this.stopChatCycle();
      this.startChatCycle();
    }
  }

  /** Handle keyboard navigation between tabs */
  private handleTabKeydown(e: KeyboardEvent): void {
    const currentIndex = TABS.findIndex((t) => t.kind === this.kind);
    let newIndex = currentIndex;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      newIndex = (currentIndex + 1) % TABS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      newIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      newIndex = TABS.length - 1;
    }

    if (newIndex !== currentIndex) {
      this.setKind(TABS[newIndex].kind);
      // Focus the new tab after render
      this.updateComplete.then(() => {
        const tabEls = this.renderRoot.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        tabEls[newIndex]?.focus();
      });
    }
  }

  private renderTabs(): TemplateResult {
    return html`
      <div class="tabs" role="tablist" aria-label="Interactive demo previews">
        ${TABS.map(
          (tab) => html`
            <button
              class="tab"
              role="tab"
              tabindex=${this.kind === tab.kind ? "0" : "-1"}
              aria-selected=${this.kind === tab.kind}
              aria-controls="demo-panel"
              @click=${() => this.setKind(tab.kind)}
              @keydown=${this.handleTabKeydown}
            >
              <span>${tab.label}</span>
              <span class="chip">${tab.chip}</span>
            </button>
          `,
        )}

        <div class="hint" aria-hidden="true">
          <span class="hint-dot ${this.isVisible ? "" : "paused"}"></span>
          <span>Interactive previews</span>
        </div>
      </div>
    `;
  }

  private renderOverseer(): TemplateResult {
    const edges = [
      ["goal", "plan"],
      ["plan", "research"],
      ["research", "change"],
      ["change", "verify"],
    ] as const;

    const nodeById = new Map(OVERSEER_NODES.map((n) => [n.id, n] as const));

    return html`
      <div class="overseer" role="img" aria-label="Overseer graph visualization mockup showing goal planning workflow">
        <div class="grid"></div>
        ${edges.map(([a, b], i) => {
          const from = nodeById.get(a)!;
          const to = nodeById.get(b)!;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          return html`
            <div
              class="edge"
              style=${[
                `left: ${from.x}%`,
                `top: ${from.y}%`,
                `width: ${len}%`,
                `transform: rotate(${angle}deg)`,
                `animation-delay: ${i * 160}ms`,
              ].join(";")}
            ></div>
          `;
        })}

        ${OVERSEER_NODES.map(
          (n, i) => html`
            <div
              class="node"
              data-status=${n.status}
              style=${`left:${n.x}%; top:${n.y}%; animation-delay:${i * 120}ms;`}
            >
              <div class="node-label">${n.label}</div>
              <div class="node-status">
                <span class="status-pill"></span>
                <span>
                  ${n.status === "done" ? "Complete" : n.status === "active" ? "In progress" : "Queued"}
                </span>
              </div>
            </div>
          `,
        )}

        <div class="cursor ${this.kind === "overseer" && this.isVisible ? "playing" : ""}"></div>
      </div>
    `;
  }

  private renderChat(): TemplateResult {
    const shown = CHAT_SCRIPT.slice(0, this.chatCycle);
    const showTyping = this.chatCycle < CHAT_SCRIPT.length;

    return html`
      <div class="chat" role="img" aria-label="Chat preview animation showing AI assistant conversation">
        <div class="chat-header">
          <div class="chat-title">
            <span>Clawdbrain</span>
            <span class="chip">Assistant</span>
          </div>
          <span class="chip">Streaming</span>
        </div>
        <div class="chat-body">
          ${shown.map((m, i) => {
            const delay = i * 260;
            return html`
              <div class=${`bubble ${m.role}`} style=${`animation-delay:${delay}ms`}>
                ${m.text}
              </div>
            `;
          })}

          ${
            showTyping
              ? html`
                <div class="typing" style=${`animation-delay:${shown.length * 260}ms`}>
                  <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                  <span style="margin-left:0.4rem">Thinking…</span>
                </div>
              `
              : null
          }
        </div>
      </div>
    `;
  }

  private renderMemory(): TemplateResult {
    const nodeById = new Map(MEMORY_NODES.map((n) => [n.id, n] as const));

    return html`
      <div class="memory" role="img" aria-label="Memory graph showing how experiences become persistent knowledge">
        <div class="grid"></div>

        <!-- Flow label -->
        <div class="memory-flow-label">
          <span>Capture</span>
          <span class="flow-arrow">→</span>
          <span>Extract</span>
          <span class="flow-arrow">→</span>
          <span>Relate</span>
          <span class="flow-arrow">→</span>
          <span>Remember</span>
        </div>

        <!-- Edges -->
        ${MEMORY_EDGES.map(([aId, bId], i) => {
          const a = nodeById.get(aId);
          const b = nodeById.get(bId);
          if (!a || !b) return null;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

          // Determine edge type based on node kinds
          let edgeClass = "experience-entity";
          if (a.kind === "entity" && b.kind === "relation") edgeClass = "entity-relation";
          else if (a.kind === "relation" && b.kind === "episode") edgeClass = "relation-episode";

          return html`
            <div
              class="memory-edge ${edgeClass}"
              style=${[
                `left: ${a.x}%`,
                `top: ${a.y}%`,
                `width: ${len}%`,
                `transform: rotate(${angle}deg)`,
                `animation-delay: ${i * 80 + 200}ms`,
              ].join(";")}
            ></div>
          `;
        })}

        <!-- Nodes -->
        ${MEMORY_NODES.map(
          (n, i) => html`
            <div
              class="mem-node"
              data-kind=${n.kind}
              style=${`left:${n.x}%; top:${n.y}%; animation-delay:${i * 100}ms;`}
            >
              <span class="mem-node-icon"></span>
              <span class="mem-node-label">${n.label}</span>
            </div>
          `,
        )}

        <!-- Data pulses flowing left to right -->
        ${
          this.isVisible
            ? html`
                <div class="data-pulse"></div>
                <div class="data-pulse"></div>
                <div class="data-pulse"></div>
              `
            : null
        }

        <!-- Legend -->
        <div class="memory-legend">
          <div class="legend-item">
            <span class="legend-dot experience"></span>
            <span>Experience</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot entity"></span>
            <span>Entity</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot relation"></span>
            <span>Relation</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot episode"></span>
            <span>Episode</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderPanel(): TemplateResult {
    switch (this.kind) {
      case "overseer":
        return this.renderOverseer();
      case "chat":
        return this.renderChat();
      case "memory":
        return this.renderMemory();
      default:
        return this.renderOverseer();
    }
  }

  render(): TemplateResult {
    return html`
      <div class="shell">
        ${this.renderTabs()}
        <div class="panel">
          <div class="panel-inner" id="demo-panel" role="tabpanel">
            ${this.renderPanel()}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "landing-demo-previews": LandingDemoPreviews;
  }
}
