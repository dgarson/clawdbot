/**
 * Interactive Overseer Visualization Demo
 *
 * A live mockup showing the orchestration graph with animated agents
 * executing tasks, dependencies flowing, and status updates.
 */

import { html, css, LitElement, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";

interface DemoNode {
  id: string;
  label: string;
  icon: string;
  type: "goal" | "task" | "agent";
  status: "pending" | "running" | "complete" | "waiting";
  x: number;
  y: number;
  connections: string[];
}

interface DemoEdge {
  from: string;
  to: string;
  animated: boolean;
}

const DEMO_NODES: DemoNode[] = [
  {
    id: "goal",
    label: "Ship Feature X",
    icon: "🎯",
    type: "goal",
    status: "running",
    x: 50,
    y: 10,
    connections: ["plan", "research"],
  },
  {
    id: "plan",
    label: "Plan Tasks",
    icon: "📋",
    type: "task",
    status: "complete",
    x: 25,
    y: 35,
    connections: ["impl"],
  },
  {
    id: "research",
    label: "Research APIs",
    icon: "🔍",
    type: "task",
    status: "complete",
    x: 75,
    y: 35,
    connections: ["impl"],
  },
  {
    id: "impl",
    label: "Implement",
    icon: "⚙️",
    type: "task",
    status: "running",
    x: 50,
    y: 60,
    connections: ["review"],
  },
  {
    id: "review",
    label: "Code Review",
    icon: "👀",
    type: "task",
    status: "waiting",
    x: 50,
    y: 85,
    connections: [],
  },
];

const DEMO_AGENTS = [
  { id: "planner", name: "Planner", icon: "🧭", nodeId: "plan" },
  { id: "researcher", name: "Researcher", icon: "📚", nodeId: "research" },
  { id: "coder", name: "Coder", icon: "💻", nodeId: "impl" },
];

@customElement("overseer-demo")
export class OverseerDemo extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 400px;
      position: relative;
    }

    .demo-container {
      position: relative;
      width: 100%;
      height: 100%;
      background: var(--landing-bg-surface);
      border: 1px solid var(--landing-border);
      border-radius: 16px;
      overflow: hidden;
    }

    /* Header bar */
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

    /* Canvas area */
    .demo-canvas {
      position: relative;
      width: 100%;
      height: calc(100% - 45px);
      padding: 1.5rem;
    }

    /* SVG for edges */
    .demo-edges {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .edge-line {
      stroke: var(--landing-border);
      stroke-width: 2;
      fill: none;
    }

    .edge-line.animated {
      stroke: var(--landing-primary);
      stroke-dasharray: 8 4;
      animation: flowEdge 1s linear infinite;
    }

    @keyframes flowEdge {
      to {
        stroke-dashoffset: -12;
      }
    }

    /* Node styling */
    .demo-node {
      position: absolute;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
    }

    .node-circle {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      background: var(--landing-bg-elevated);
      border: 2px solid var(--landing-border);
      transition: all 0.3s ease;
      position: relative;
    }

    .node-circle.goal {
      width: 64px;
      height: 64px;
      font-size: 1.75rem;
      border-color: var(--landing-primary);
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
    }

    .node-circle.running {
      border-color: var(--landing-accent-teal);
      animation: pulseNode 2s ease-in-out infinite;
    }

    .node-circle.complete {
      border-color: var(--landing-accent-warm);
    }

    .node-circle.waiting {
      opacity: 0.6;
    }

    @keyframes pulseNode {
      0%,
      100% {
        box-shadow: 0 0 10px rgba(45, 212, 191, 0.2);
      }
      50% {
        box-shadow: 0 0 25px rgba(45, 212, 191, 0.4);
      }
    }

    /* Status indicator */
    .node-status {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid var(--landing-bg-elevated);
    }

    .node-status.pending {
      background: var(--landing-text-muted);
    }
    .node-status.running {
      background: var(--landing-accent-teal);
      animation: statusPulse 1.5s ease-in-out infinite;
    }
    .node-status.complete {
      background: var(--landing-accent-warm);
    }
    .node-status.waiting {
      background: var(--landing-text-muted);
    }

    @keyframes statusPulse {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.2);
      }
    }

    .node-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--landing-text-secondary);
      white-space: nowrap;
      text-align: center;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Agent badges */
    .demo-agents {
      position: absolute;
      bottom: 1rem;
      left: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .agent-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      background: var(--landing-glass-bg);
      backdrop-filter: blur(8px);
      border: 1px solid var(--landing-glass-border);
      border-radius: 20px;
      font-size: 0.75rem;
      color: var(--landing-text-secondary);
      opacity: 0;
      transform: translateX(-10px);
      animation: slideInAgent 0.4s ease-out forwards;
    }

    .agent-badge.active {
      border-color: var(--landing-accent-teal);
    }

    @keyframes slideInAgent {
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .agent-icon {
      font-size: 1rem;
    }

    .agent-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--landing-text-muted);
    }

    .agent-status-dot.active {
      background: var(--landing-accent-teal);
      animation: statusPulse 1.5s ease-in-out infinite;
    }

    /* Activity log */
    .demo-log {
      position: absolute;
      bottom: 1rem;
      right: 1rem;
      width: 200px;
      background: var(--landing-glass-bg);
      backdrop-filter: blur(8px);
      border: 1px solid var(--landing-glass-border);
      border-radius: 12px;
      padding: 0.75rem;
      font-size: 0.6875rem;
      font-family: var(--landing-font-mono, monospace);
    }

    .log-title {
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--landing-text-muted);
      margin-bottom: 0.5rem;
    }

    .log-entry {
      display: flex;
      gap: 0.5rem;
      padding: 0.25rem 0;
      color: var(--landing-text-secondary);
      opacity: 0;
      animation: fadeInLog 0.3s ease-out forwards;
    }

    @keyframes fadeInLog {
      to {
        opacity: 1;
      }
    }

    .log-time {
      color: var(--landing-text-muted);
      flex-shrink: 0;
    }

    .log-message {
      flex: 1;
    }

    .log-message.success {
      color: var(--landing-accent-warm);
    }
    .log-message.active {
      color: var(--landing-accent-teal);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .demo-log {
        display: none;
      }

      .demo-agents {
        flex-direction: row;
        flex-wrap: wrap;
        bottom: 0.75rem;
        left: 0.75rem;
        right: 0.75rem;
      }

      .node-label {
        font-size: 0.625rem;
        max-width: 70px;
      }

      .node-circle {
        width: 44px;
        height: 44px;
        font-size: 1.25rem;
      }

      .node-circle.goal {
        width: 52px;
        height: 52px;
        font-size: 1.5rem;
      }
    }
  `;

  @state()
  private logEntries: Array<{ time: string; message: string; type: string }> = [];

  @state()
  private currentStep = 0;

  @state()
  private nodes = [...DEMO_NODES];

  private animationInterval?: ReturnType<typeof setInterval>;

  connectedCallback(): void {
    super.connectedCallback();
    this.startAnimation();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopAnimation();
  }

  private startAnimation(): void {
    // Initial log entries
    this.logEntries = [
      { time: "09:12", message: "Goal accepted", type: "info" },
      { time: "09:12", message: "Plan complete ✓", type: "success" },
      { time: "09:18", message: "Research complete ✓", type: "success" },
    ];

    // Cycle through animation states
    this.animationInterval = setInterval(() => {
      this.currentStep = (this.currentStep + 1) % 4;
      this.updateAnimationState();
    }, 3000);
  }

  private stopAnimation(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
  }

  private updateAnimationState(): void {
    const newNodes = [...DEMO_NODES];

    switch (this.currentStep) {
      case 0:
        // Initial state: impl running
        newNodes[3].status = "running";
        newNodes[4].status = "waiting";
        this.logEntries = [
          { time: "09:12", message: "Goal accepted", type: "info" },
          { time: "09:12", message: "Plan complete ✓", type: "success" },
          { time: "09:18", message: "Research complete ✓", type: "success" },
          { time: "09:41", message: "Implementing...", type: "active" },
        ];
        break;
      case 1:
        // Impl complete, review starting
        newNodes[3].status = "complete";
        newNodes[4].status = "running";
        this.logEntries = [
          { time: "09:12", message: "Plan complete ✓", type: "success" },
          { time: "09:18", message: "Research complete ✓", type: "success" },
          { time: "09:41", message: "Impl complete ✓", type: "success" },
          { time: "09:55", message: "Review started", type: "active" },
        ];
        break;
      case 2:
        // All complete
        newNodes[3].status = "complete";
        newNodes[4].status = "complete";
        newNodes[0].status = "complete";
        this.logEntries = [
          { time: "09:18", message: "Research complete ✓", type: "success" },
          { time: "09:41", message: "Impl complete ✓", type: "success" },
          { time: "09:55", message: "Review complete ✓", type: "success" },
          { time: "10:02", message: "Goal achieved! 🎉", type: "success" },
        ];
        break;
      case 3:
        // Reset to beginning
        this.logEntries = [
          { time: "09:12", message: "Goal accepted", type: "info" },
          { time: "09:12", message: "Planning...", type: "active" },
        ];
        break;
    }

    this.nodes = newNodes;
  }

  private renderEdge(from: DemoNode, to: DemoNode, animated: boolean): TemplateResult {
    const x1 = from.x;
    const y1 = from.y + 8;
    const x2 = to.x;
    const y2 = to.y - 8;

    return html`
      <line
        class="edge-line ${animated ? "animated" : ""}"
        x1="${x1}%"
        y1="${y1}%"
        x2="${x2}%"
        y2="${y2}%"
      />
    `;
  }

  private renderNode(node: DemoNode): TemplateResult {
    return html`
      <div
        class="demo-node"
        style="left: ${node.x}%; top: ${node.y}%"
      >
        <div class="node-circle ${node.type} ${node.status}">
          ${node.icon}
          <span class="node-status ${node.status}"></span>
        </div>
        <span class="node-label">${node.label}</span>
      </div>
    `;
  }

  private renderAgentBadge(
    agent: { id: string; name: string; icon: string; nodeId: string },
    index: number,
  ): TemplateResult {
    const activeNode = this.nodes.find((n) => n.id === agent.nodeId);
    const isActive = activeNode?.status === "running";

    return html`
      <div
        class="agent-badge ${isActive ? "active" : ""}"
        style="animation-delay: ${index * 100}ms"
      >
        <span class="agent-icon">${agent.icon}</span>
        <span>${agent.name}</span>
        <span class="agent-status-dot ${isActive ? "active" : ""}"></span>
      </div>
    `;
  }

  render(): TemplateResult {
    // Compute edges with animation state
    const edges: Array<{ from: DemoNode; to: DemoNode; animated: boolean }> = [];
    for (const node of this.nodes) {
      for (const connId of node.connections) {
        const targetNode = this.nodes.find((n) => n.id === connId);
        if (targetNode) {
          const animated = node.status === "running" || targetNode.status === "running";
          edges.push({ from: node, to: targetNode, animated });
        }
      }
    }

    return html`
      <div class="demo-container">
        <div class="demo-header">
          <span class="demo-header-dot red"></span>
          <span class="demo-header-dot yellow"></span>
          <span class="demo-header-dot green"></span>
          <span class="demo-header-title">Overseer — Goal Orchestration</span>
        </div>

        <div class="demo-canvas">
          <svg class="demo-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${edges.map((e) => this.renderEdge(e.from, e.to, e.animated))}
          </svg>

          ${this.nodes.map((node) => this.renderNode(node))}

          <div class="demo-agents">
            ${DEMO_AGENTS.map((agent, i) => this.renderAgentBadge(agent, i))}
          </div>

          <div class="demo-log">
            <div class="log-title">Activity Log</div>
            ${this.logEntries.map(
              (entry, i) => html`
                <div class="log-entry" style="animation-delay: ${i * 100}ms">
                  <span class="log-time">${entry.time}</span>
                  <span class="log-message ${entry.type}">${entry.message}</span>
                </div>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "overseer-demo": OverseerDemo;
  }
}
