import{r as x,j as e,c as u,R as v}from"./index-DkocnQdW.js";const y=[{id:"getting-started",label:"Getting Started",emoji:"🚀",subsections:[{id:"gs-intro",label:"Introduction",pageId:"introduction"},{id:"gs-install",label:"Installation",pageId:"introduction"},{id:"gs-quickstart",label:"Quick Start",pageId:"introduction"}]},{id:"core-concepts",label:"Core Concepts",emoji:"💡",subsections:[{id:"cc-arch",label:"Architecture",pageId:"agent-configuration"},{id:"cc-agents",label:"Agent Model",pageId:"agent-configuration"},{id:"cc-sessions",label:"Sessions",pageId:"agent-configuration"}]},{id:"agents",label:"Agents",emoji:"🤖",subsections:[{id:"ag-config",label:"Configuration",pageId:"agent-configuration"},{id:"ag-lifecycle",label:"Lifecycle",pageId:"agent-configuration"},{id:"ag-tools",label:"Tool Binding",pageId:"agent-configuration"}]},{id:"integrations",label:"Integrations",emoji:"🔌",subsections:[{id:"int-slack",label:"Slack",pageId:"webhook-setup"},{id:"int-discord",label:"Discord",pageId:"webhook-setup"},{id:"int-webhooks",label:"Webhooks",pageId:"webhook-setup"}]},{id:"api-reference",label:"API Reference",emoji:"📡",subsections:[{id:"api-rest",label:"REST Endpoints",pageId:"api-endpoints"},{id:"api-ws",label:"WebSocket API",pageId:"api-endpoints"},{id:"api-auth",label:"Authentication",pageId:"api-endpoints"}]},{id:"changelog",label:"Changelog",emoji:"📋",subsections:[{id:"cl-latest",label:"v2.4.0",pageId:"introduction"},{id:"cl-prev",label:"v2.3.0",pageId:"introduction"}]}],h={introduction:{id:"introduction",title:"Getting Started with OpenClaw",sections:[{id:"intro-overview",heading:"Overview",level:1,paragraphs:["OpenClaw is an autonomous agent orchestration platform that enables teams to deploy, manage, and monitor AI agents at scale. It provides a robust framework for building multi-agent systems with built-in session management, tool binding, and cross-agent communication.","The platform supports multiple LLM providers including Anthropic Claude, OpenAI GPT, and custom model endpoints. Agents can be configured declaratively via YAML or programmatically through the TypeScript SDK."]},{id:"intro-installation",heading:"Installation",level:2,paragraphs:["Install the OpenClaw CLI globally using your preferred package manager. The CLI requires Node.js 20 or later."],codeBlock:{language:"bash",code:`# Install globally via npm
npm install -g @openclaw/cli

# Or via pnpm (recommended)
pnpm add -g @openclaw/cli

# Verify installation
openclaw --version`}},{id:"intro-quickstart",heading:"Quick Start",level:2,paragraphs:["Initialize a new project with the default template. This creates the necessary configuration files and directory structure."],codeBlock:{language:"bash",code:`# Initialize a new project
openclaw init my-project
cd my-project

# Start the gateway
openclaw gateway start

# Deploy your first agent
openclaw agent deploy ./agents/assistant.yaml`},callout:{type:"tip",title:"First-time setup",body:"Run openclaw auth login before deploying agents. You'll need an API key from the dashboard at app.openclaw.dev."}},{id:"intro-project-structure",heading:"Project Structure",level:2,paragraphs:["A typical OpenClaw project follows a convention-over-configuration approach. The agents/ directory contains agent definitions, tools/ holds custom tool implementations, and the openclaw.config.ts file controls global settings."],codeBlock:{language:"text",code:`my-project/
├── agents/
│   ├── assistant.yaml
│   └── researcher.yaml
├── tools/
│   ├── web-search.ts
│   └── file-reader.ts
├── memory/
│   └── .gitkeep
├── openclaw.config.ts
└── package.json`}},{id:"intro-config-file",heading:"Configuration File",level:3,paragraphs:["The openclaw.config.ts file is the central configuration for your project. It defines default model settings, tool policies, and gateway options."],codeBlock:{language:"typescript",code:`import { defineConfig } from "@openclaw/sdk";

export default defineConfig({
  gateway: {
    port: 3100,
    host: "127.0.0.1",
  },
  defaults: {
    model: "anthropic/claude-sonnet-4-6",
    maxTokens: 8192,
    temperature: 0.7,
  },
  tools: {
    policy: "allow-listed",
    allowed: ["read", "write", "exec", "web_search"],
  },
});`}}]},"agent-configuration":{id:"agent-configuration",title:"Agent Configuration",sections:[{id:"ac-overview",heading:"Agent Configuration",level:1,paragraphs:["Agents are the core building blocks of an OpenClaw system. Each agent is defined by a YAML configuration file that specifies its model, system prompt, available tools, and behavioral constraints. Agents can operate autonomously via heartbeats or respond to messages from channels like Slack and Discord."]},{id:"ac-yaml-schema",heading:"YAML Schema",level:2,paragraphs:["Agent configuration files follow a strict schema. Below are the top-level fields available in an agent definition."],params:[{name:"name",type:"string",required:!0,description:"Unique identifier for the agent. Must be lowercase alphanumeric with hyphens."},{name:"model",type:"string",required:!0,description:"LLM model identifier, e.g. anthropic/claude-sonnet-4-6 or openai/gpt-4o."},{name:"systemPrompt",type:"string",required:!0,description:"Path to the system prompt markdown file or inline prompt text."},{name:"tools",type:"string[]",required:!1,description:"List of tool names the agent can access. Defaults to project-level tool policy."},{name:"maxTokens",type:"number",required:!1,description:"Maximum tokens per response. Defaults to 8192."},{name:"temperature",type:"number",required:!1,description:"Sampling temperature between 0 and 1. Defaults to 0.7."},{name:"heartbeat",type:"HeartbeatConfig",required:!1,description:"Autonomous heartbeat configuration for periodic agent activation."},{name:"channels",type:"ChannelConfig[]",required:!1,description:"Communication channels the agent listens on (Slack, Discord, etc.)."}]},{id:"ac-example",heading:"Example Configuration",level:2,paragraphs:["Here is a complete agent configuration for a research assistant that monitors a Slack channel and runs periodic heartbeats."],codeBlock:{language:"yaml",code:`name: research-assistant
model: anthropic/claude-sonnet-4-6
systemPrompt: ./prompts/researcher.md
maxTokens: 16384
temperature: 0.3

tools:
  - web_search
  - read
  - write
  - browser

heartbeat:
  enabled: true
  intervalMinutes: 30
  prompt: "Check for new research topics and update findings."

channels:
  - type: slack
    channelId: C0ABC123DEF
    respondTo: mentions`},callout:{type:"info",title:"Model compatibility",body:"Not all models support tool use. Check the model compatibility matrix in the API Reference section before assigning tools to an agent."}},{id:"ac-lifecycle",heading:"Agent Lifecycle",level:2,paragraphs:["Agents move through a defined lifecycle: Created → Deployed → Running → Paused → Stopped. The gateway manages state transitions and ensures graceful shutdown of active sessions.","When an agent is deployed, the gateway validates its configuration, resolves tool references, and initializes the session manager. Heartbeat-enabled agents begin their autonomous cycle immediately after deployment."],callout:{type:"warning",title:"Session persistence",body:"Agent sessions are stored in memory by default. For production deployments, configure a persistent session store (Redis or PostgreSQL) in openclaw.config.ts to prevent data loss on gateway restarts."}},{id:"ac-tool-binding",heading:"Tool Binding",level:2,paragraphs:["Tools are bound to agents at deployment time. Each tool must be registered in the project's tool registry before it can be referenced in an agent configuration. Custom tools are defined as TypeScript modules that export a ToolDefinition."],codeBlock:{language:"typescript",code:`import { defineTool } from "@openclaw/sdk";

export default defineTool({
  name: "sentiment-analyzer",
  description: "Analyzes sentiment of the provided text",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to analyze",
      },
    },
    required: ["text"],
  },
  async execute({ text }) {
    // Implementation here
    return { sentiment: "positive", confidence: 0.92 };
  },
});`}},{id:"ac-memory",heading:"Memory & Context",level:3,paragraphs:["Agents can be configured with persistent memory that survives across sessions. Memory files are stored in the memory/ directory and can be read/written by the agent during execution. This enables long-term knowledge accumulation and task continuity.","Use the memoryPaths configuration to specify which files an agent should load at the start of each session."],inlineCode:["memoryPaths","MEMORY.md","memory/YYYY-MM-DD.md"]}]},"api-endpoints":{id:"api-endpoints",title:"API Reference",sections:[{id:"api-overview",heading:"API Reference",level:1,paragraphs:["The OpenClaw Gateway exposes a RESTful API for managing agents, sessions, and messages. All endpoints require authentication via Bearer token. The base URL defaults to http://127.0.0.1:3100/api/v1."]},{id:"api-auth",heading:"Authentication",level:2,paragraphs:["All API requests must include a valid Bearer token in the Authorization header. Tokens are generated via the CLI or the dashboard."],codeBlock:{language:"bash",code:`# Generate an API token
openclaw auth token create --name "my-integration"

# Use in requests
curl -H "Authorization: Bearer oclaw_sk_..." \\
  http://127.0.0.1:3100/api/v1/agents`},callout:{type:"warning",title:"Token security",body:"API tokens have full access to your gateway. Never commit tokens to version control. Use environment variables or a secrets manager in production."}},{id:"api-agents-list",heading:"List Agents",level:2,paragraphs:["Returns a paginated list of all deployed agents with their current status and configuration summary."],params:[{name:"status",type:"string",required:!1,description:"Filter by agent status: running, paused, stopped. Omit for all."},{name:"limit",type:"number",required:!1,description:"Maximum number of results. Default: 20, Max: 100."},{name:"offset",type:"number",required:!1,description:"Pagination offset. Default: 0."}],codeBlock:{language:"bash",code:`GET /api/v1/agents?status=running&limit=10

# Response
{
  "agents": [
    {
      "id": "agt_abc123",
      "name": "research-assistant",
      "model": "anthropic/claude-sonnet-4-6",
      "status": "running",
      "createdAt": "2026-02-20T10:30:00Z",
      "sessionCount": 3
    }
  ],
  "total": 1,
  "hasMore": false
}`}},{id:"api-agents-deploy",heading:"Deploy Agent",level:2,paragraphs:["Deploys a new agent or updates an existing one. The request body must contain the full agent configuration."],codeBlock:{language:"bash",code:`POST /api/v1/agents/deploy
Content-Type: application/json

{
  "name": "research-assistant",
  "model": "anthropic/claude-sonnet-4-6",
  "systemPrompt": "You are a helpful research assistant...",
  "tools": ["web_search", "read", "write"],
  "maxTokens": 16384
}

# Response (201 Created)
{
  "id": "agt_abc123",
  "name": "research-assistant",
  "status": "running",
  "deployedAt": "2026-02-22T03:30:00Z"
}`}},{id:"api-sessions",heading:"Sessions API",level:2,paragraphs:["Sessions represent individual agent execution contexts. Each session maintains its own message history, tool state, and memory scope."],params:[{name:"agentId",type:"string",required:!0,description:"The agent ID to create a session for."},{name:"channel",type:"string",required:!1,description:"Channel binding: slack, discord, api. Default: api."},{name:"metadata",type:"Record<string, string>",required:!1,description:"Arbitrary key-value metadata attached to the session."}],codeBlock:{language:"bash",code:`POST /api/v1/sessions
{
  "agentId": "agt_abc123",
  "channel": "api",
  "metadata": { "user": "david", "purpose": "research" }
}

# Response
{
  "sessionId": "sess_xyz789",
  "agentId": "agt_abc123",
  "status": "active",
  "createdAt": "2026-02-22T03:31:00Z"
}`}},{id:"api-messages",heading:"Send Message",level:2,paragraphs:["Sends a message to an active session and returns the agent's response. Supports streaming via Server-Sent Events when the Accept header is set to text/event-stream."],codeBlock:{language:"bash",code:`POST /api/v1/sessions/sess_xyz789/messages
{
  "content": "Find recent papers on multi-agent coordination",
  "stream": false
}

# Response
{
  "messageId": "msg_001",
  "role": "assistant",
  "content": "I found several recent papers on multi-agent coordination...",
  "toolCalls": [
    {
      "tool": "web_search",
      "input": { "query": "multi-agent coordination papers 2026" },
      "output": "..."
    }
  ],
  "usage": {
    "inputTokens": 1250,
    "outputTokens": 3400
  }
}`}},{id:"api-websocket",heading:"WebSocket API",level:2,paragraphs:["For real-time bidirectional communication, connect to the WebSocket endpoint. This is recommended for interactive applications that need streaming responses and live session events."],codeBlock:{language:"typescript",code:`const ws = new WebSocket("ws://127.0.0.1:3100/ws");

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "auth",
    token: "oclaw_sk_...",
  }));

  ws.send(JSON.stringify({
    type: "subscribe",
    sessionId: "sess_xyz789",
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "token") {
    process.stdout.write(msg.content);
  }
};`},callout:{type:"info",title:"Connection limits",body:"Each API token can maintain up to 10 concurrent WebSocket connections. Connections idle for more than 5 minutes are automatically closed."}}]},"webhook-setup":{id:"webhook-setup",title:"Webhook & Integration Setup",sections:[{id:"wh-overview",heading:"Webhooks & Integrations",level:1,paragraphs:["OpenClaw supports incoming and outgoing webhooks for event-driven agent activation. Webhooks enable external services to trigger agent actions and receive notifications when agents complete tasks or encounter errors."]},{id:"wh-incoming",heading:"Incoming Webhooks",level:2,paragraphs:["Incoming webhooks allow external services to send events to your agents. Each webhook endpoint is scoped to a specific agent and validates requests using HMAC-SHA256 signatures."],codeBlock:{language:"bash",code:`# Create a webhook endpoint
openclaw webhook create \\
  --agent research-assistant \\
  --events "message,task" \\
  --secret "whsec_your_secret_here"

# Webhook URL format
# POST http://127.0.0.1:3100/api/v1/webhooks/wh_abc123

# Example payload
curl -X POST http://127.0.0.1:3100/api/v1/webhooks/wh_abc123 \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Signature: sha256=..." \\
  -d '{"event": "message", "content": "Analyze this data"}'`},params:[{name:"agent",type:"string",required:!0,description:"Agent name or ID that will receive webhook events."},{name:"events",type:"string[]",required:!0,description:"Comma-separated list of event types: message, task, alert, custom."},{name:"secret",type:"string",required:!0,description:"HMAC secret for request signature validation."},{name:"url",type:"string",required:!1,description:"Override callback URL. Defaults to auto-generated gateway endpoint."}]},{id:"wh-outgoing",heading:"Outgoing Webhooks",level:2,paragraphs:["Outgoing webhooks notify external services when events occur in your OpenClaw system. Configure them to push agent completions, errors, or custom events to your application backend."],codeBlock:{language:"yaml",code:`# In openclaw.config.yaml
webhooks:
  outgoing:
    - name: task-completion
      url: https://api.yourapp.com/hooks/openclaw
      events:
        - agent.task.completed
        - agent.task.failed
      headers:
        X-Custom-Header: "your-value"
      retry:
        maxAttempts: 3
        backoffMs: 1000`},callout:{type:"tip",title:"Testing webhooks",body:"Use openclaw webhook test --id wh_abc123 to send a test payload to your webhook endpoint and verify the integration is working correctly."}},{id:"wh-slack",heading:"Slack Integration",level:2,paragraphs:["The Slack integration enables agents to listen and respond in Slack channels. OpenClaw uses the Slack Bolt framework under the hood and supports slash commands, mentions, and direct messages.","To set up the Slack integration, create a Slack app in your workspace, configure the required scopes, and provide the credentials in your OpenClaw configuration."],codeBlock:{language:"yaml",code:`# Agent channel configuration
channels:
  - type: slack
    appToken: xapp-1-...
    botToken: xoxb-...
    channelId: C0ABC123DEF
    respondTo: mentions   # mentions | all | threads
    threadMode: follow    # follow | new | none`},params:[{name:"appToken",type:"string",required:!0,description:"Slack app-level token starting with xapp-."},{name:"botToken",type:"string",required:!0,description:"Slack bot token starting with xoxb-."},{name:"channelId",type:"string",required:!0,description:"Slack channel ID where the agent operates."},{name:"respondTo",type:"string",required:!1,description:"Trigger mode: mentions (default), all, or threads."},{name:"threadMode",type:"string",required:!1,description:"Thread behavior: follow (reply in thread), new (new thread), none."}]},{id:"wh-discord",heading:"Discord Integration",level:2,paragraphs:["Discord integration supports bot presence in guilds with slash command registration and message handling. Agents can operate across multiple guilds and channels simultaneously."],codeBlock:{language:"yaml",code:`# Discord channel configuration
channels:
  - type: discord
    botToken: MTIz...
    guildId: "987654321"
    channelIds:
      - "111222333"
      - "444555666"
    respondTo: mentions
    slashCommands:
      - name: ask
        description: Ask the agent a question`},callout:{type:"info",title:"Required Discord permissions",body:"Your Discord bot needs the following permissions: Send Messages, Read Message History, Use Slash Commands, and Embed Links. Add these in the Discord Developer Portal."}},{id:"wh-signature-verification",heading:"Signature Verification",level:3,paragraphs:["All incoming webhook payloads must be verified using HMAC-SHA256 signatures. The signature is sent in the X-Webhook-Signature header and is computed over the raw request body using your webhook secret."],codeBlock:{language:"typescript",code:`import { createHmac } from "crypto";

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return \`sha256=\${expected}\` === signature;
}`}}]}};function C(a){return a.pageId}function N(a,s,t){for(const l of a)for(const d of l.subsections)if(d.id===t)return["📖 Docs",l.label,d.label];const n=h[s];return["📖 Docs",(n==null?void 0:n.title)??"Unknown"]}function I({value:a,onChange:s}){return e.jsx("div",{className:"px-3 pt-4 pb-3",children:e.jsxs("div",{className:"relative",children:[e.jsx("span",{className:"absolute left-3 top-1/2 -translate-y-1/2 text-sm",children:"🔍"}),e.jsx("input",{type:"text",value:a,onChange:t=>s(t.target.value),placeholder:"Search docs...",className:"w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"})]})})}function S({sections:a,search:s,expandedSections:t,onToggleSection:n,activeSubId:l,onSelectSub:d}){const p=s.toLowerCase(),g=a.map(o=>{if(!s)return o;const m=o.subsections.filter(c=>c.label.toLowerCase().includes(p)||o.label.toLowerCase().includes(p));return m.length===0?null:{...o,subsections:m}}).filter(o=>o!==null);return e.jsxs("nav",{className:"flex-1 overflow-y-auto px-2 pb-4",children:[g.map(o=>{const m=t[o.id]??!1;return e.jsxs("div",{className:"mb-1",children:[e.jsxs("button",{onClick:()=>n(o.id),className:"w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left",children:[e.jsx("span",{className:"text-base",children:o.emoji}),e.jsx("span",{className:"flex-1",children:o.label}),e.jsx("span",{className:"text-xs text-zinc-500",children:m?"▾":"▸"})]}),m&&e.jsx("div",{className:"ml-4 border-l border-zinc-800 pl-2 mt-1 space-y-0.5",children:o.subsections.map(c=>e.jsx("button",{onClick:()=>d(c),className:u("w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",l===c.id?"bg-indigo-500/15 text-indigo-400 font-medium":"text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"),children:c.label},c.id))})]},o.id)}),g.length===0&&e.jsxs("div",{className:"px-3 py-8 text-center text-sm text-zinc-500",children:["No results for “",s,"”"]})]})}function z({callout:a}){const t={info:{emoji:"ℹ️",borderColor:"border-indigo-500/40",bgColor:"bg-indigo-500/5",titleColor:"text-indigo-400"},warning:{emoji:"⚠️",borderColor:"border-amber-400/40",bgColor:"bg-amber-400/5",titleColor:"text-amber-400"},tip:{emoji:"💡",borderColor:"border-emerald-400/40",bgColor:"bg-emerald-400/5",titleColor:"text-emerald-400"}}[a.type];return e.jsxs("div",{className:u("rounded-lg border-l-4 p-4 my-4",t.borderColor,t.bgColor),children:[e.jsxs("div",{className:u("flex items-center gap-2 font-semibold text-sm mb-1",t.titleColor),children:[e.jsx("span",{children:t.emoji}),e.jsx("span",{children:a.title})]}),e.jsx("p",{className:"text-sm text-zinc-300 leading-relaxed",children:a.body})]})}function T({params:a}){return e.jsx("div",{className:"my-4 overflow-x-auto rounded-lg border border-zinc-800",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsxs("tr",{className:"bg-zinc-800/60",children:[e.jsx("th",{className:"text-left px-4 py-2.5 text-zinc-300 font-semibold",children:"Parameter"}),e.jsx("th",{className:"text-left px-4 py-2.5 text-zinc-300 font-semibold",children:"Type"}),e.jsx("th",{className:"text-left px-4 py-2.5 text-zinc-300 font-semibold",children:"Required"}),e.jsx("th",{className:"text-left px-4 py-2.5 text-zinc-300 font-semibold",children:"Description"})]})}),e.jsx("tbody",{children:a.map((s,t)=>e.jsxs("tr",{className:u("border-t border-zinc-800",t%2===0?"bg-zinc-900/50":"bg-zinc-900/30"),children:[e.jsx("td",{className:"px-4 py-2.5",children:e.jsx("code",{className:"text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs font-mono",children:s.name})}),e.jsx("td",{className:"px-4 py-2.5",children:e.jsx("code",{className:"text-emerald-400 text-xs font-mono",children:s.type})}),e.jsx("td",{className:"px-4 py-2.5",children:s.required?e.jsx("span",{className:"text-rose-400 font-medium text-xs",children:"Required"}):e.jsx("span",{className:"text-zinc-500 text-xs",children:"Optional"})}),e.jsx("td",{className:"px-4 py-2.5 text-zinc-300",children:s.description})]},s.name))})]})})}function A({codes:a}){return e.jsxs("p",{className:"text-zinc-300 leading-relaxed my-3",children:["Related: ",a.map((s,t)=>e.jsxs(v.Fragment,{children:[e.jsx("code",{className:"text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-sm font-mono",children:s}),t<a.length-1&&", "]},s))]})}function q({page:a,activeTocId:s,onTocClick:t}){return e.jsx("div",{className:"space-y-8",children:a.sections.map(n=>{var l;return e.jsxs("div",{id:n.id,children:[n.level===1&&e.jsx("h1",{className:"text-3xl font-bold text-white mb-4 cursor-pointer hover:text-indigo-400 transition-colors",onClick:()=>t(n.id),children:n.heading}),n.level===2&&e.jsx("h2",{className:"text-xl font-semibold text-white mb-3 pt-4 border-t border-zinc-800/50 cursor-pointer hover:text-indigo-400 transition-colors",onClick:()=>t(n.id),children:n.heading}),n.level===3&&e.jsx("h3",{className:"text-lg font-medium text-zinc-200 mb-2 pt-2 cursor-pointer hover:text-indigo-400 transition-colors",onClick:()=>t(n.id),children:n.heading}),(l=n.paragraphs)==null?void 0:l.map((d,p)=>e.jsx("p",{className:"text-zinc-300 leading-relaxed my-3 text-[15px]",children:d},p)),n.inlineCode&&e.jsx(A,{codes:n.inlineCode}),n.codeBlock&&e.jsxs("div",{className:"my-4 rounded-lg overflow-hidden border border-zinc-800",children:[e.jsxs("div",{className:"bg-zinc-800/80 px-4 py-2 flex items-center justify-between",children:[e.jsx("span",{className:"text-xs text-zinc-400 font-mono",children:n.codeBlock.language}),e.jsx("span",{className:"text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors",children:"📋 Copy"})]}),e.jsx("pre",{className:"bg-zinc-900/80 p-4 overflow-x-auto",children:e.jsx("code",{className:"text-sm font-mono text-emerald-300 leading-relaxed whitespace-pre",children:n.codeBlock.code})})]}),n.callout&&e.jsx(z,{callout:n.callout}),n.params&&e.jsx(T,{params:n.params})]},n.id)})})}function O({page:a,activeTocId:s,onTocClick:t}){return e.jsxs("div",{className:"sticky top-6",children:[e.jsx("h4",{className:"text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 px-1",children:"On this page"}),e.jsx("nav",{className:"space-y-0.5",children:a.sections.map(n=>e.jsx("button",{onClick:()=>t(n.id),className:u("w-full text-left py-1.5 text-sm transition-colors rounded-md block",n.level===1&&"px-2",n.level===2&&"px-2 pl-4",n.level===3&&"px-2 pl-6",s===n.id?"text-indigo-400 font-medium bg-indigo-500/5":"text-zinc-500 hover:text-zinc-300"),children:n.heading},n.id))})]})}function P({items:a}){return e.jsx("div",{className:"flex items-center gap-1.5 text-sm text-zinc-500 mb-6",children:a.map((s,t)=>e.jsxs(v.Fragment,{children:[t>0&&e.jsx("span",{className:"text-zinc-700",children:"/"}),e.jsx("span",{className:u(t===a.length-1?"text-zinc-300 font-medium":"hover:text-zinc-300 cursor-pointer transition-colors"),children:s})]},t))})}function B(){const[a,s]=x.useState(""),[t,n]=x.useState("introduction"),[l,d]=x.useState("gs-intro"),[p,g]=x.useState(""),[o,m]=x.useState({"getting-started":!0,"core-concepts":!1,agents:!1,integrations:!1,"api-reference":!1,changelog:!1}),c=h[t]??h.introduction,w=i=>{m(r=>({...r,[i]:!r[i]}))},k=i=>{d(i.id);const r=C(i);n(r);const f=h[r];f&&f.sections.length>0&&g(f.sections[0].id)},b=i=>{g(i);const r=document.getElementById(i);r&&r.scrollIntoView({behavior:"smooth",block:"start"})},j=N(y,t,l);return e.jsxs("div",{className:"min-h-screen bg-zinc-950 text-white flex flex-col",children:[e.jsxs("header",{className:"bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("span",{className:"text-xl",children:"📖"}),e.jsx("h1",{className:"text-lg font-bold text-white",children:"OpenClaw Docs"}),e.jsx("span",{className:"text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-medium",children:"v2.4.0"})]}),e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsxs("span",{className:"text-sm text-zinc-400 hidden sm:block",children:["📄 ",Object.keys(h).length," pages"]}),e.jsx("button",{className:"text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-800",children:"⌨️ Shortcuts"})]})]}),e.jsxs("div",{className:"flex flex-1 overflow-hidden",children:[e.jsxs("aside",{className:"w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0 overflow-hidden",children:[e.jsx(I,{value:a,onChange:s}),e.jsx(S,{sections:y,search:a,expandedSections:o,onToggleSection:w,activeSubId:l,onSelectSub:k}),e.jsx("div",{className:"border-t border-zinc-800 px-4 py-3 shrink-0",children:e.jsx("p",{className:"text-xs text-zinc-500",children:"🤖 Built with OpenClaw"})})]}),e.jsx("main",{className:"flex-1 overflow-y-auto",children:e.jsxs("div",{className:"max-w-3xl mx-auto px-8 py-8",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx(P,{items:j}),e.jsxs("button",{className:"text-sm text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1.5 shrink-0",children:[e.jsx("span",{children:"✏️"}),e.jsx("span",{children:"Edit on GitHub"})]})]}),e.jsx(q,{page:c,activeTocId:p,onTocClick:b}),e.jsxs("div",{className:"mt-12 pt-6 border-t border-zinc-800 flex items-center justify-between",children:[e.jsxs("button",{className:"text-sm text-zinc-400 hover:text-indigo-400 transition-colors flex items-center gap-2",onClick:()=>{const i=Object.keys(h),r=i.indexOf(t);r>0&&(n(i[r-1]),g(""))},children:[e.jsx("span",{children:"←"}),e.jsx("span",{children:"Previous"})]}),e.jsxs("button",{className:"text-sm text-zinc-400 hover:text-indigo-400 transition-colors flex items-center gap-2",onClick:()=>{const i=Object.keys(h),r=i.indexOf(t);r<i.length-1&&(n(i[r+1]),g(""))},children:[e.jsx("span",{children:"Next"}),e.jsx("span",{children:"→"})]})]}),e.jsx("div",{className:"mt-8 pt-6 border-t border-zinc-800/50 text-center",children:e.jsx("p",{className:"text-xs text-zinc-600",children:"Last updated February 2026 · OpenClaw Documentation"})})]})}),e.jsx("aside",{className:"w-56 bg-zinc-950 border-l border-zinc-800 p-4 shrink-0 overflow-y-auto hidden lg:block",children:e.jsx(O,{page:c,activeTocId:p,onTocClick:b})})]})]})}export{B as default};
