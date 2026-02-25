import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type CalloutType = "info" | "warning" | "tip";

interface Callout {
  type: CalloutType;
  title: string;
  body: string;
}

interface Param {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface CodeBlock {
  language: string;
  code: string;
}

interface ContentSection {
  id: string;
  heading: string;
  level: 1 | 2 | 3;
  paragraphs?: string[];
  inlineCode?: string[];
  codeBlock?: CodeBlock;
  callout?: Callout;
  params?: Param[];
}

interface DocPage {
  id: string;
  title: string;
  sections: ContentSection[];
}

interface NavSubsection {
  id: string;
  label: string;
  pageId: string;
}

interface NavSection {
  id: string;
  label: string;
  emoji: string;
  subsections: NavSubsection[];
}

// ─── Documentation Data ──────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    emoji: "🚀",
    subsections: [
      { id: "gs-intro", label: "Introduction", pageId: "introduction" },
      { id: "gs-install", label: "Installation", pageId: "introduction" },
      { id: "gs-quickstart", label: "Quick Start", pageId: "introduction" },
    ],
  },
  {
    id: "core-concepts",
    label: "Core Concepts",
    emoji: "💡",
    subsections: [
      { id: "cc-arch", label: "Architecture", pageId: "agent-configuration" },
      { id: "cc-agents", label: "Agent Model", pageId: "agent-configuration" },
      { id: "cc-sessions", label: "Sessions", pageId: "agent-configuration" },
    ],
  },
  {
    id: "agents",
    label: "Agents",
    emoji: "🤖",
    subsections: [
      { id: "ag-config", label: "Configuration", pageId: "agent-configuration" },
      { id: "ag-lifecycle", label: "Lifecycle", pageId: "agent-configuration" },
      { id: "ag-tools", label: "Tool Binding", pageId: "agent-configuration" },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    emoji: "🔌",
    subsections: [
      { id: "int-slack", label: "Slack", pageId: "webhook-setup" },
      { id: "int-discord", label: "Discord", pageId: "webhook-setup" },
      { id: "int-webhooks", label: "Webhooks", pageId: "webhook-setup" },
    ],
  },
  {
    id: "api-reference",
    label: "API Reference",
    emoji: "📡",
    subsections: [
      { id: "api-rest", label: "REST Endpoints", pageId: "api-endpoints" },
      { id: "api-ws", label: "WebSocket API", pageId: "api-endpoints" },
      { id: "api-auth", label: "Authentication", pageId: "api-endpoints" },
    ],
  },
  {
    id: "changelog",
    label: "Changelog",
    emoji: "📋",
    subsections: [
      { id: "cl-latest", label: "v2.4.0", pageId: "introduction" },
      { id: "cl-prev", label: "v2.3.0", pageId: "introduction" },
    ],
  },
];

const DOC_PAGES: Record<string, DocPage> = {
  introduction: {
    id: "introduction",
    title: "Getting Started with OpenClaw",
    sections: [
      {
        id: "intro-overview",
        heading: "Overview",
        level: 1,
        paragraphs: [
          "OpenClaw is an autonomous agent orchestration platform that enables teams to deploy, manage, and monitor AI agents at scale. It provides a robust framework for building multi-agent systems with built-in session management, tool binding, and cross-agent communication.",
          "The platform supports multiple LLM providers including Anthropic Claude, OpenAI GPT, and custom model endpoints. Agents can be configured declaratively via YAML or programmatically through the TypeScript SDK.",
        ],
      },
      {
        id: "intro-installation",
        heading: "Installation",
        level: 2,
        paragraphs: [
          "Install the OpenClaw CLI globally using your preferred package manager. The CLI requires Node.js 20 or later.",
        ],
        codeBlock: {
          language: "bash",
          code: "# Install globally via npm\nnpm install -g @openclaw/cli\n\n# Or via pnpm (recommended)\npnpm add -g @openclaw/cli\n\n# Verify installation\nopenclaw --version",
        },
      },
      {
        id: "intro-quickstart",
        heading: "Quick Start",
        level: 2,
        paragraphs: [
          "Initialize a new project with the default template. This creates the necessary configuration files and directory structure.",
        ],
        codeBlock: {
          language: "bash",
          code: "# Initialize a new project\nopenclaw init my-project\ncd my-project\n\n# Start the gateway\nopenclaw gateway start\n\n# Deploy your first agent\nopenclaw agent deploy ./agents/assistant.yaml",
        },
        callout: {
          type: "tip",
          title: "First-time setup",
          body: "Run openclaw auth login before deploying agents. You'll need an API key from the dashboard at app.openclaw.dev.",
        },
      },
      {
        id: "intro-project-structure",
        heading: "Project Structure",
        level: 2,
        paragraphs: [
          "A typical OpenClaw project follows a convention-over-configuration approach. The agents/ directory contains agent definitions, tools/ holds custom tool implementations, and the openclaw.config.ts file controls global settings.",
        ],
        codeBlock: {
          language: "text",
          code: "my-project/\n├── agents/\n│   ├── assistant.yaml\n│   └── researcher.yaml\n├── tools/\n│   ├── web-search.ts\n│   └── file-reader.ts\n├── memory/\n│   └── .gitkeep\n├── openclaw.config.ts\n└── package.json",
        },
      },
      {
        id: "intro-config-file",
        heading: "Configuration File",
        level: 3,
        paragraphs: [
          "The openclaw.config.ts file is the central configuration for your project. It defines default model settings, tool policies, and gateway options.",
        ],
        codeBlock: {
          language: "typescript",
          code: 'import { defineConfig } from "@openclaw/sdk";\n\nexport default defineConfig({\n  gateway: {\n    port: 3100,\n    host: "127.0.0.1",\n  },\n  defaults: {\n    model: "anthropic/claude-sonnet-4-6",\n    maxTokens: 8192,\n    temperature: 0.7,\n  },\n  tools: {\n    policy: "allow-listed",\n    allowed: ["read", "write", "exec", "web_search"],\n  },\n});',
        },
      },
    ],
  },
  "agent-configuration": {
    id: "agent-configuration",
    title: "Agent Configuration",
    sections: [
      {
        id: "ac-overview",
        heading: "Agent Configuration",
        level: 1,
        paragraphs: [
          "Agents are the core building blocks of an OpenClaw system. Each agent is defined by a YAML configuration file that specifies its model, system prompt, available tools, and behavioral constraints. Agents can operate autonomously via heartbeats or respond to messages from channels like Slack and Discord.",
        ],
      },
      {
        id: "ac-yaml-schema",
        heading: "YAML Schema",
        level: 2,
        paragraphs: [
          "Agent configuration files follow a strict schema. Below are the top-level fields available in an agent definition.",
        ],
        params: [
          { name: "name", type: "string", required: true, description: "Unique identifier for the agent. Must be lowercase alphanumeric with hyphens." },
          { name: "model", type: "string", required: true, description: "LLM model identifier, e.g. anthropic/claude-sonnet-4-6 or openai/gpt-4o." },
          { name: "systemPrompt", type: "string", required: true, description: "Path to the system prompt markdown file or inline prompt text." },
          { name: "tools", type: "string[]", required: false, description: "List of tool names the agent can access. Defaults to project-level tool policy." },
          { name: "maxTokens", type: "number", required: false, description: "Maximum tokens per response. Defaults to 8192." },
          { name: "temperature", type: "number", required: false, description: "Sampling temperature between 0 and 1. Defaults to 0.7." },
          { name: "heartbeat", type: "HeartbeatConfig", required: false, description: "Autonomous heartbeat configuration for periodic agent activation." },
          { name: "channels", type: "ChannelConfig[]", required: false, description: "Communication channels the agent listens on (Slack, Discord, etc.)." },
        ],
      },
      {
        id: "ac-example",
        heading: "Example Configuration",
        level: 2,
        paragraphs: [
          "Here is a complete agent configuration for a research assistant that monitors a Slack channel and runs periodic heartbeats.",
        ],
        codeBlock: {
          language: "yaml",
          code: 'name: research-assistant\nmodel: anthropic/claude-sonnet-4-6\nsystemPrompt: ./prompts/researcher.md\nmaxTokens: 16384\ntemperature: 0.3\n\ntools:\n  - web_search\n  - read\n  - write\n  - browser\n\nheartbeat:\n  enabled: true\n  intervalMinutes: 30\n  prompt: "Check for new research topics and update findings."\n\nchannels:\n  - type: slack\n    channelId: C0ABC123DEF\n    respondTo: mentions',
        },
        callout: {
          type: "info",
          title: "Model compatibility",
          body: "Not all models support tool use. Check the model compatibility matrix in the API Reference section before assigning tools to an agent.",
        },
      },
      {
        id: "ac-lifecycle",
        heading: "Agent Lifecycle",
        level: 2,
        paragraphs: [
          "Agents move through a defined lifecycle: Created → Deployed → Running → Paused → Stopped. The gateway manages state transitions and ensures graceful shutdown of active sessions.",
          "When an agent is deployed, the gateway validates its configuration, resolves tool references, and initializes the session manager. Heartbeat-enabled agents begin their autonomous cycle immediately after deployment.",
        ],
        callout: {
          type: "warning",
          title: "Session persistence",
          body: "Agent sessions are stored in memory by default. For production deployments, configure a persistent session store (Redis or PostgreSQL) in openclaw.config.ts to prevent data loss on gateway restarts.",
        },
      },
      {
        id: "ac-tool-binding",
        heading: "Tool Binding",
        level: 2,
        paragraphs: [
          "Tools are bound to agents at deployment time. Each tool must be registered in the project's tool registry before it can be referenced in an agent configuration. Custom tools are defined as TypeScript modules that export a ToolDefinition.",
        ],
        codeBlock: {
          language: "typescript",
          code: 'import { defineTool } from "@openclaw/sdk";\n\nexport default defineTool({\n  name: "sentiment-analyzer",\n  description: "Analyzes sentiment of the provided text",\n  parameters: {\n    type: "object",\n    properties: {\n      text: {\n        type: "string",\n        description: "The text to analyze",\n      },\n    },\n    required: ["text"],\n  },\n  async execute({ text }) {\n    // Implementation here\n    return { sentiment: "positive", confidence: 0.92 };\n  },\n});',
        },
      },
      {
        id: "ac-memory",
        heading: "Memory & Context",
        level: 3,
        paragraphs: [
          "Agents can be configured with persistent memory that survives across sessions. Memory files are stored in the memory/ directory and can be read/written by the agent during execution. This enables long-term knowledge accumulation and task continuity.",
          "Use the memoryPaths configuration to specify which files an agent should load at the start of each session.",
        ],
        inlineCode: ["memoryPaths", "MEMORY.md", "memory/YYYY-MM-DD.md"],
      },
    ],
  },
  "api-endpoints": {
    id: "api-endpoints",
    title: "API Reference",
    sections: [
      {
        id: "api-overview",
        heading: "API Reference",
        level: 1,
        paragraphs: [
          "The OpenClaw Gateway exposes a RESTful API for managing agents, sessions, and messages. All endpoints require authentication via Bearer token. The base URL defaults to http://127.0.0.1:3100/api/v1.",
        ],
      },
      {
        id: "api-auth",
        heading: "Authentication",
        level: 2,
        paragraphs: [
          "All API requests must include a valid Bearer token in the Authorization header. Tokens are generated via the CLI or the dashboard.",
        ],
        codeBlock: {
          language: "bash",
          code: '# Generate an API token\nopenclaw auth token create --name "my-integration"\n\n# Use in requests\ncurl -H "Authorization: Bearer oclaw_sk_..." \\\n  http://127.0.0.1:3100/api/v1/agents',
        },
        callout: {
          type: "warning",
          title: "Token security",
          body: "API tokens have full access to your gateway. Never commit tokens to version control. Use environment variables or a secrets manager in production.",
        },
      },
      {
        id: "api-agents-list",
        heading: "List Agents",
        level: 2,
        paragraphs: [
          "Returns a paginated list of all deployed agents with their current status and configuration summary.",
        ],
        params: [
          { name: "status", type: "string", required: false, description: "Filter by agent status: running, paused, stopped. Omit for all." },
          { name: "limit", type: "number", required: false, description: "Maximum number of results. Default: 20, Max: 100." },
          { name: "offset", type: "number", required: false, description: "Pagination offset. Default: 0." },
        ],
        codeBlock: {
          language: "bash",
          code: 'GET /api/v1/agents?status=running&limit=10\n\n# Response\n{\n  "agents": [\n    {\n      "id": "agt_abc123",\n      "name": "research-assistant",\n      "model": "anthropic/claude-sonnet-4-6",\n      "status": "running",\n      "createdAt": "2026-02-20T10:30:00Z",\n      "sessionCount": 3\n    }\n  ],\n  "total": 1,\n  "hasMore": false\n}',
        },
      },
      {
        id: "api-agents-deploy",
        heading: "Deploy Agent",
        level: 2,
        paragraphs: [
          "Deploys a new agent or updates an existing one. The request body must contain the full agent configuration.",
        ],
        codeBlock: {
          language: "bash",
          code: 'POST /api/v1/agents/deploy\nContent-Type: application/json\n\n{\n  "name": "research-assistant",\n  "model": "anthropic/claude-sonnet-4-6",\n  "systemPrompt": "You are a helpful research assistant...",\n  "tools": ["web_search", "read", "write"],\n  "maxTokens": 16384\n}\n\n# Response (201 Created)\n{\n  "id": "agt_abc123",\n  "name": "research-assistant",\n  "status": "running",\n  "deployedAt": "2026-02-22T03:30:00Z"\n}',
        },
      },
      {
        id: "api-sessions",
        heading: "Sessions API",
        level: 2,
        paragraphs: [
          "Sessions represent individual agent execution contexts. Each session maintains its own message history, tool state, and memory scope.",
        ],
        params: [
          { name: "agentId", type: "string", required: true, description: "The agent ID to create a session for." },
          { name: "channel", type: "string", required: false, description: "Channel binding: slack, discord, api. Default: api." },
          { name: "metadata", type: "Record<string, string>", required: false, description: "Arbitrary key-value metadata attached to the session." },
        ],
        codeBlock: {
          language: "bash",
          code: 'POST /api/v1/sessions\n{\n  "agentId": "agt_abc123",\n  "channel": "api",\n  "metadata": { "user": "david", "purpose": "research" }\n}\n\n# Response\n{\n  "sessionId": "sess_xyz789",\n  "agentId": "agt_abc123",\n  "status": "active",\n  "createdAt": "2026-02-22T03:31:00Z"\n}',
        },
      },
      {
        id: "api-messages",
        heading: "Send Message",
        level: 2,
        paragraphs: [
          "Sends a message to an active session and returns the agent's response. Supports streaming via Server-Sent Events when the Accept header is set to text/event-stream.",
        ],
        codeBlock: {
          language: "bash",
          code: 'POST /api/v1/sessions/sess_xyz789/messages\n{\n  "content": "Find recent papers on multi-agent coordination",\n  "stream": false\n}\n\n# Response\n{\n  "messageId": "msg_001",\n  "role": "assistant",\n  "content": "I found several recent papers on multi-agent coordination...",\n  "toolCalls": [\n    {\n      "tool": "web_search",\n      "input": { "query": "multi-agent coordination papers 2026" },\n      "output": "..."\n    }\n  ],\n  "usage": {\n    "inputTokens": 1250,\n    "outputTokens": 3400\n  }\n}',
        },
      },
      {
        id: "api-websocket",
        heading: "WebSocket API",
        level: 2,
        paragraphs: [
          "For real-time bidirectional communication, connect to the WebSocket endpoint. This is recommended for interactive applications that need streaming responses and live session events.",
        ],
        codeBlock: {
          language: "typescript",
          code: 'const ws = new WebSocket("ws://127.0.0.1:3100/ws");\n\nws.onopen = () => {\n  ws.send(JSON.stringify({\n    type: "auth",\n    token: "oclaw_sk_...",\n  }));\n\n  ws.send(JSON.stringify({\n    type: "subscribe",\n    sessionId: "sess_xyz789",\n  }));\n};\n\nws.onmessage = (event) => {\n  const msg = JSON.parse(event.data);\n  if (msg.type === "token") {\n    process.stdout.write(msg.content);\n  }\n};',
        },
        callout: {
          type: "info",
          title: "Connection limits",
          body: "Each API token can maintain up to 10 concurrent WebSocket connections. Connections idle for more than 5 minutes are automatically closed.",
        },
      },
    ],
  },
  "webhook-setup": {
    id: "webhook-setup",
    title: "Webhook & Integration Setup",
    sections: [
      {
        id: "wh-overview",
        heading: "Webhooks & Integrations",
        level: 1,
        paragraphs: [
          "OpenClaw supports incoming and outgoing webhooks for event-driven agent activation. Webhooks enable external services to trigger agent actions and receive notifications when agents complete tasks or encounter errors.",
        ],
      },
      {
        id: "wh-incoming",
        heading: "Incoming Webhooks",
        level: 2,
        paragraphs: [
          "Incoming webhooks allow external services to send events to your agents. Each webhook endpoint is scoped to a specific agent and validates requests using HMAC-SHA256 signatures.",
        ],
        codeBlock: {
          language: "bash",
          code: '# Create a webhook endpoint\nopenclaw webhook create \\\n  --agent research-assistant \\\n  --events "message,task" \\\n  --secret "whsec_your_secret_here"\n\n# Webhook URL format\n# POST http://127.0.0.1:3100/api/v1/webhooks/wh_abc123\n\n# Example payload\ncurl -X POST http://127.0.0.1:3100/api/v1/webhooks/wh_abc123 \\\n  -H "Content-Type: application/json" \\\n  -H "X-Webhook-Signature: sha256=..." \\\n  -d \'{"event": "message", "content": "Analyze this data"}\'',
        },
        params: [
          { name: "agent", type: "string", required: true, description: "Agent name or ID that will receive webhook events." },
          { name: "events", type: "string[]", required: true, description: "Comma-separated list of event types: message, task, alert, custom." },
          { name: "secret", type: "string", required: true, description: "HMAC secret for request signature validation." },
          { name: "url", type: "string", required: false, description: "Override callback URL. Defaults to auto-generated gateway endpoint." },
        ],
      },
      {
        id: "wh-outgoing",
        heading: "Outgoing Webhooks",
        level: 2,
        paragraphs: [
          "Outgoing webhooks notify external services when events occur in your OpenClaw system. Configure them to push agent completions, errors, or custom events to your application backend.",
        ],
        codeBlock: {
          language: "yaml",
          code: '# In openclaw.config.yaml\nwebhooks:\n  outgoing:\n    - name: task-completion\n      url: https://api.yourapp.com/hooks/openclaw\n      events:\n        - agent.task.completed\n        - agent.task.failed\n      headers:\n        X-Custom-Header: "your-value"\n      retry:\n        maxAttempts: 3\n        backoffMs: 1000',
        },
        callout: {
          type: "tip",
          title: "Testing webhooks",
          body: "Use openclaw webhook test --id wh_abc123 to send a test payload to your webhook endpoint and verify the integration is working correctly.",
        },
      },
      {
        id: "wh-slack",
        heading: "Slack Integration",
        level: 2,
        paragraphs: [
          "The Slack integration enables agents to listen and respond in Slack channels. OpenClaw uses the Slack Bolt framework under the hood and supports slash commands, mentions, and direct messages.",
          "To set up the Slack integration, create a Slack app in your workspace, configure the required scopes, and provide the credentials in your OpenClaw configuration.",
        ],
        codeBlock: {
          language: "yaml",
          code: "# Agent channel configuration\nchannels:\n  - type: slack\n    appToken: xapp-1-...\n    botToken: xoxb-...\n    channelId: C0ABC123DEF\n    respondTo: mentions   # mentions | all | threads\n    threadMode: follow    # follow | new | none",
        },
        params: [
          { name: "appToken", type: "string", required: true, description: "Slack app-level token starting with xapp-." },
          { name: "botToken", type: "string", required: true, description: "Slack bot token starting with xoxb-." },
          { name: "channelId", type: "string", required: true, description: "Slack channel ID where the agent operates." },
          { name: "respondTo", type: "string", required: false, description: "Trigger mode: mentions (default), all, or threads." },
          { name: "threadMode", type: "string", required: false, description: "Thread behavior: follow (reply in thread), new (new thread), none." },
        ],
      },
      {
        id: "wh-discord",
        heading: "Discord Integration",
        level: 2,
        paragraphs: [
          "Discord integration supports bot presence in guilds with slash command registration and message handling. Agents can operate across multiple guilds and channels simultaneously.",
        ],
        codeBlock: {
          language: "yaml",
          code: "# Discord channel configuration\nchannels:\n  - type: discord\n    botToken: MTIz...\n    guildId: \"987654321\"\n    channelIds:\n      - \"111222333\"\n      - \"444555666\"\n    respondTo: mentions\n    slashCommands:\n      - name: ask\n        description: Ask the agent a question",
        },
        callout: {
          type: "info",
          title: "Required Discord permissions",
          body: "Your Discord bot needs the following permissions: Send Messages, Read Message History, Use Slash Commands, and Embed Links. Add these in the Discord Developer Portal.",
        },
      },
      {
        id: "wh-signature-verification",
        heading: "Signature Verification",
        level: 3,
        paragraphs: [
          "All incoming webhook payloads must be verified using HMAC-SHA256 signatures. The signature is sent in the X-Webhook-Signature header and is computed over the raw request body using your webhook secret.",
        ],
        codeBlock: {
          language: "typescript",
          code: 'import { createHmac } from "crypto";\n\nfunction verifyWebhookSignature(\n  payload: string,\n  signature: string,\n  secret: string\n): boolean {\n  const expected = createHmac("sha256", secret)\n    .update(payload)\n    .digest("hex");\n  return `sha256=${expected}` === signature;\n}',
        },
      },
    ],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPageIdForNav(subsection: NavSubsection): string {
  return subsection.pageId;
}

function getBreadcrumb(
  navSections: NavSection[],
  activePageId: string,
  activeSubId: string
): string[] {
  for (const section of navSections) {
    for (const sub of section.subsections) {
      if (sub.id === activeSubId) {
        return ["📖 Docs", section.label, sub.label];
      }
    }
  }
  const page = DOC_PAGES[activePageId];
  return ["📖 Docs", page?.title ?? "Unknown"];
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="px-3 pt-4 pb-3">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">
          🔍
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search docs..."
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-primary focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
      </div>
    </div>
  );
}

function NavTree({
  sections,
  search,
  expandedSections,
  onToggleSection,
  activeSubId,
  onSelectSub,
}: {
  sections: NavSection[];
  search: string;
  expandedSections: Record<string, boolean>;
  onToggleSection: (id: string) => void;
  activeSubId: string;
  onSelectSub: (sub: NavSubsection) => void;
}) {
  const lowerSearch = search.toLowerCase();
  const filtered = sections
    .map((section) => {
      if (!search) {return section;}
      const matchingSubs = section.subsections.filter(
        (sub) =>
          sub.label.toLowerCase().includes(lowerSearch) ||
          section.label.toLowerCase().includes(lowerSearch)
      );
      if (matchingSubs.length === 0) {return null;}
      return { ...section, subsections: matchingSubs };
    })
    .filter((s): s is NavSection => s !== null);

  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-4">
      {filtered.map((section) => {
        const isExpanded = expandedSections[section.id] ?? false;
        return (
          <div key={section.id} className="mb-1">
            <button
              onClick={() => onToggleSection(section.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors text-left"
            >
              <span className="text-base">{section.emoji}</span>
              <span className="flex-1">{section.label}</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {isExpanded ? "▾" : "▸"}
              </span>
            </button>
            {isExpanded && (
              <div className="ml-4 border-l border-[var(--color-border)] pl-2 mt-1 space-y-0.5">
                {section.subsections.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => onSelectSub(sub)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                      activeSubId === sub.id
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]/50"
                    )}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {filtered.length === 0 && (
        <div className="px-3 py-8 text-center text-sm text-[var(--color-text-muted)]">
          No results for &ldquo;{search}&rdquo;
        </div>
      )}
    </nav>
  );
}

function CalloutBox({ callout }: { callout: Callout }) {
  const config: Record<
    CalloutType,
    { emoji: string; borderColor: string; bgColor: string; titleColor: string }
  > = {
    info: {
      emoji: "ℹ️",
      borderColor: "border-primary/40",
      bgColor: "bg-primary/5",
      titleColor: "text-primary",
    },
    warning: {
      emoji: "⚠️",
      borderColor: "border-amber-400/40",
      bgColor: "bg-amber-400/5",
      titleColor: "text-amber-400",
    },
    tip: {
      emoji: "💡",
      borderColor: "border-emerald-400/40",
      bgColor: "bg-emerald-400/5",
      titleColor: "text-emerald-400",
    },
  };
  const c = config[callout.type];

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 p-4 my-4",
        c.borderColor,
        c.bgColor
      )}
    >
      <div className={cn("flex items-center gap-2 font-semibold text-sm mb-1", c.titleColor)}>
        <span>{c.emoji}</span>
        <span>{callout.title}</span>
      </div>
      <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{callout.body}</p>
    </div>
  );
}

function ParamTable({ params }: { params: Param[] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface-2)]/60">
            <th className="text-left px-4 py-2.5 text-[var(--color-text-primary)] font-semibold">
              Parameter
            </th>
            <th className="text-left px-4 py-2.5 text-[var(--color-text-primary)] font-semibold">
              Type
            </th>
            <th className="text-left px-4 py-2.5 text-[var(--color-text-primary)] font-semibold">
              Required
            </th>
            <th className="text-left px-4 py-2.5 text-[var(--color-text-primary)] font-semibold">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, idx) => (
            <tr
              key={p.name}
              className={cn(
                "border-t border-[var(--color-border)]",
                idx % 2 === 0 ? "bg-[var(--color-surface-1)]/50" : "bg-[var(--color-surface-1)]/30"
              )}
            >
              <td className="px-4 py-2.5">
                <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs font-mono">
                  {p.name}
                </code>
              </td>
              <td className="px-4 py-2.5">
                <code className="text-emerald-400 text-xs font-mono">
                  {p.type}
                </code>
              </td>
              <td className="px-4 py-2.5">
                {p.required ? (
                  <span className="text-rose-400 font-medium text-xs">
                    Required
                  </span>
                ) : (
                  <span className="text-[var(--color-text-muted)] text-xs">Optional</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-[var(--color-text-primary)]">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineCodeList({ codes }: { codes: string[] }) {
  return (
    <p className="text-[var(--color-text-primary)] leading-relaxed my-3">
      {"Related: "}
      {codes.map((c, i) => (
        <React.Fragment key={c}>
          <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-sm font-mono">
            {c}
          </code>
          {i < codes.length - 1 && ", "}
        </React.Fragment>
      ))}
    </p>
  );
}

function ContentRenderer({
  page,
  activeTocId,
  onTocClick,
}: {
  page: DocPage;
  activeTocId: string;
  onTocClick: (id: string) => void;
}) {
  return (
    <div className="space-y-8">
      {page.sections.map((section) => (
        <div key={section.id} id={section.id}>
          {section.level === 1 && (
            <h1
              className="text-3xl font-bold text-[var(--color-text-primary)] mb-4 cursor-pointer hover:text-primary transition-colors"
              onClick={() => onTocClick(section.id)}
            >
              {section.heading}
            </h1>
          )}
          {section.level === 2 && (
            <h2
              className="text-xl font-semibold text-[var(--color-text-primary)] mb-3 pt-4 border-t border-[var(--color-border)]/50 cursor-pointer hover:text-primary transition-colors"
              onClick={() => onTocClick(section.id)}
            >
              {section.heading}
            </h2>
          )}
          {section.level === 3 && (
            <h3
              className="text-lg font-medium text-[var(--color-text-primary)] mb-2 pt-2 cursor-pointer hover:text-primary transition-colors"
              onClick={() => onTocClick(section.id)}
            >
              {section.heading}
            </h3>
          )}
          {section.paragraphs?.map((p, i) => (
            <p key={i} className="text-[var(--color-text-primary)] leading-relaxed my-3 text-[15px]">
              {p}
            </p>
          ))}
          {section.inlineCode && <InlineCodeList codes={section.inlineCode} />}
          {section.codeBlock && (
            <div className="my-4 rounded-lg overflow-hidden border border-[var(--color-border)]">
              <div className="bg-[var(--color-surface-2)]/80 px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-secondary)] font-mono">
                  {section.codeBlock.language}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-primary)] transition-colors">
                  📋 Copy
                </span>
              </div>
              <pre className="bg-[var(--color-surface-1)]/80 p-4 overflow-x-auto">
                <code className="text-sm font-mono text-emerald-300 leading-relaxed whitespace-pre">
                  {section.codeBlock.code}
                </code>
              </pre>
            </div>
          )}
          {section.callout && <CalloutBox callout={section.callout} />}
          {section.params && <ParamTable params={section.params} />}
        </div>
      ))}
    </div>
  );
}

function TableOfContents({
  page,
  activeTocId,
  onTocClick,
}: {
  page: DocPage;
  activeTocId: string;
  onTocClick: (id: string) => void;
}) {
  return (
    <div className="sticky top-6">
      <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 px-1">
        On this page
      </h4>
      <nav className="space-y-0.5">
        {page.sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onTocClick(section.id)}
            className={cn(
              "w-full text-left py-1.5 text-sm transition-colors rounded-md block",
              section.level === 1 && "px-2",
              section.level === 2 && "px-2 pl-4",
              section.level === 3 && "px-2 pl-6",
              activeTocId === section.id
                ? "text-primary font-medium bg-primary/5"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {section.heading}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Breadcrumb({ items }: { items: string[] }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] mb-6">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-[var(--color-text-muted)]">/</span>}
          <span
            className={cn(
              i === items.length - 1
                ? "text-[var(--color-text-primary)] font-medium"
                : "hover:text-[var(--color-text-primary)] cursor-pointer transition-colors"
            )}
          >
            {item}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DocumentationViewer() {
  const [search, setSearch] = useState("");
  const [activePageId, setActivePageId] = useState("introduction");
  const [activeSubId, setActiveSubId] = useState("gs-intro");
  const [activeTocId, setActiveTocId] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    "getting-started": true,
    "core-concepts": false,
    agents: false,
    integrations: false,
    "api-reference": false,
    changelog: false,
  });

  const currentPage = DOC_PAGES[activePageId] ?? DOC_PAGES["introduction"];

  const handleToggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleSelectSub = (sub: NavSubsection) => {
    setActiveSubId(sub.id);
    const pageId = getPageIdForNav(sub);
    setActivePageId(pageId);
    const page = DOC_PAGES[pageId];
    if (page && page.sections.length > 0) {
      setActiveTocId(page.sections[0].id);
    }
  };

  const handleTocClick = (sectionId: string) => {
    setActiveTocId(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const breadcrumbItems = getBreadcrumb(NAV_SECTIONS, activePageId, activeSubId);

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] flex flex-col">
      {/* Top Bar */}
      <header className="bg-[var(--color-surface-1)] border-b border-[var(--color-border)] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">📖</span>
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">OpenClaw Docs</h1>
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
            v2.4.0
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--color-text-secondary)] hidden sm:block">
            📄 {Object.keys(DOC_PAGES).length} pages
          </span>
          <button className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors px-3 py-1.5 rounded-md hover:bg-[var(--color-surface-2)]">
            ⌨️ Shortcuts
          </button>
        </div>
      </header>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Nav sidebar */}
        <aside className="w-64 bg-[var(--color-surface-1)] border-r border-[var(--color-border)] flex flex-col shrink-0 overflow-hidden">
          <SearchBar value={search} onChange={setSearch} />
          <NavTree
            sections={NAV_SECTIONS}
            search={search}
            expandedSections={expandedSections}
            onToggleSection={handleToggleSection}
            activeSubId={activeSubId}
            onSelectSub={handleSelectSub}
          />
          <div className="border-t border-[var(--color-border)] px-4 py-3 shrink-0">
            <p className="text-xs text-[var(--color-text-muted)]">
              🤖 Built with OpenClaw
            </p>
          </div>
        </aside>

        {/* Center: Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Breadcrumb + edit */}
            <div className="flex items-center justify-between mb-2">
              <Breadcrumb items={breadcrumbItems} />
              <button className="text-sm text-[var(--color-text-muted)] hover:text-primary transition-colors flex items-center gap-1.5 shrink-0">
                <span>✏️</span>
                <span>Edit on GitHub</span>
              </button>
            </div>

            {/* Page content */}
            <ContentRenderer
              page={currentPage}
              activeTocId={activeTocId}
              onTocClick={handleTocClick}
            />

            {/* Bottom nav */}
            <div className="mt-12 pt-6 border-t border-[var(--color-border)] flex items-center justify-between">
              <button
                className="text-sm text-[var(--color-text-secondary)] hover:text-primary transition-colors flex items-center gap-2"
                onClick={() => {
                  const pageIds = Object.keys(DOC_PAGES);
                  const idx = pageIds.indexOf(activePageId);
                  if (idx > 0) {
                    setActivePageId(pageIds[idx - 1]);
                    setActiveTocId("");
                  }
                }}
              >
                <span>←</span>
                <span>Previous</span>
              </button>
              <button
                className="text-sm text-[var(--color-text-secondary)] hover:text-primary transition-colors flex items-center gap-2"
                onClick={() => {
                  const pageIds = Object.keys(DOC_PAGES);
                  const idx = pageIds.indexOf(activePageId);
                  if (idx < pageIds.length - 1) {
                    setActivePageId(pageIds[idx + 1]);
                    setActiveTocId("");
                  }
                }}
              >
                <span>Next</span>
                <span>→</span>
              </button>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-[var(--color-border)]/50 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">
                Last updated February 2026 · OpenClaw Documentation
              </p>
            </div>
          </div>
        </main>

        {/* Right: TOC sidebar */}
        <aside className="w-56 bg-[var(--color-surface-0)] border-l border-[var(--color-border)] p-4 shrink-0 overflow-y-auto hidden lg:block">
          <TableOfContents
            page={currentPage}
            activeTocId={activeTocId}
            onTocClick={handleTocClick}
          />
        </aside>
      </div>
    </div>
  );
}
