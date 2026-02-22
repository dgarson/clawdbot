# OpenClaw Frontend UI Specification

**Author:** Luis, Principal UX Engineer
**Date:** 2026-02-21
**Status:** v1.0 — Living Document
**Codename:** Horizon

---

## 1. Executive Summary

OpenClaw Horizon is a ground-up reimagining of the OpenClaw control interface. The current Vite + Lit SPA is functional but engineer-oriented — it surfaces every capability without hierarchy, making it hostile to non-technical users. Horizon inverts this: **the default experience is beautiful, guided, and simple**, with power-user density available on demand.

The north star: **A non-technical user should be able to set up their first agent in under 5 minutes, without reading documentation.**

---

## 2. Framework & Stack

### Choice: **Next.js 15 (App Router) + React 19 + TypeScript**

**Rationale:**
- **React ecosystem dominance** — largest component library ecosystem, easiest hiring pipeline, most community resources for non-technical-friendly UI patterns
- **Next.js App Router** — file-based routing, server components for initial data fetch, streaming SSR for perceived performance. Even though this connects to a local Gateway, the framework patterns (layouts, loading states, error boundaries) are best-in-class
- **Server Components** — NOT for server rendering in production (this is a local app), but for the architectural patterns: co-located data fetching, streaming, Suspense boundaries
- **Static export mode** — `output: 'export'` for deployment as a static SPA served by the Gateway, identical to current `ui/` deployment model

**Key Libraries:**
| Concern | Library | Why |
|---------|---------|-----|
| Components | **shadcn/ui + Radix** | Accessible, unstyled primitives. We own the design system. |
| Styling | **Tailwind CSS 4** | Utility-first, design token integration, dark mode trivial |
| State | **Zustand** | Minimal boilerplate, works with React 19, no provider hell |
| WebSocket | **Custom client** (port existing `GatewayBrowserClient`) | Protocol-specific, can't use generic libs |
| Forms | **React Hook Form + Zod** | Validation co-located with TypeBox schemas |
| Animation | **Framer Motion** | Layout animations for adaptive UX transitions |
| Charts | **Recharts** | Usage/analytics visualizations |
| Editor | **Monaco Editor** (lazy) | Config/YAML/Markdown editing for power users |
| Icons | **Lucide React** | Consistent with shadcn, tree-shakeable |
| Markdown | **react-markdown + remark-gfm** | Chat message rendering |
| DnD | **@dnd-kit** | Agent builder drag-and-drop |

### Why NOT the current stack (Lit)?
- Lit's ecosystem is thin for complex UI — no equivalent to shadcn/ui, no form libraries, limited animation
- The adaptive UX system requires component-level conditional rendering that's more natural in React's compositional model
- React's Suspense/Error Boundary patterns map perfectly to our "loading states everywhere" requirement
- Hiring/contribution: React developers outnumber Lit developers 50:1

### Why NOT SvelteKit?
- Smaller component ecosystem
- Less mature accessibility tooling
- Runes are powerful but the community is still smaller for the kind of enterprise-quality components we need

---

## 3. Architecture

### 3.1 Directory Structure

```
apps/web/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (shell, sidebar, theme)
│   ├── page.tsx                  # Redirect → /chat or /setup (first-run)
│   ├── (auth)/                   # Auth/pairing flow group
│   │   ├── pair/page.tsx
│   │   └── login/page.tsx
│   ├── (main)/                   # Main authenticated layout group
│   │   ├── layout.tsx            # Sidebar + topbar shell
│   │   ├── chat/
│   │   │   ├── page.tsx          # Chat interface
│   │   │   └── [sessionKey]/page.tsx
│   │   ├── agents/
│   │   │   ├── page.tsx          # Agent list/grid
│   │   │   ├── new/page.tsx      # Agent builder wizard
│   │   │   └── [agentId]/
│   │   │       ├── page.tsx      # Agent detail/edit
│   │   │       ├── files/page.tsx
│   │   │       └── preview/page.tsx
│   │   ├── dashboard/page.tsx    # Overview dashboard
│   │   ├── sessions/page.tsx
│   │   ├── cron/page.tsx
│   │   ├── skills/page.tsx
│   │   ├── nodes/page.tsx
│   │   ├── channels/page.tsx
│   │   ├── analytics/page.tsx
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── config/page.tsx
│   │       └── devices/page.tsx
│   └── setup/                    # First-run onboarding wizard
│       └── page.tsx
├── components/
│   ├── ui/                       # shadcn/ui primitives (generated)
│   ├── shell/                    # App shell components
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   ├── command-palette.tsx
│   │   └── proficiency-switcher.tsx
│   ├── agent-builder/            # Agent creation/editing
│   │   ├── wizard/
│   │   ├── chat-assistant/
│   │   ├── file-editor/
│   │   ├── template-picker/
│   │   ├── auto-review/
│   │   └── live-preview/
│   ├── chat/                     # Chat interface
│   │   ├── message-list.tsx
│   │   ├── message-bubble.tsx
│   │   ├── input-composer.tsx
│   │   ├── tool-card.tsx
│   │   └── streaming-indicator.tsx
│   ├── adaptive/                 # Proficiency-aware wrappers
│   │   ├── adaptive-container.tsx
│   │   ├── guided-tooltip.tsx
│   │   ├── complexity-gate.tsx
│   │   └── help-beacon.tsx
│   └── shared/                   # Cross-cutting components
│       ├── status-badge.tsx
│       ├── empty-state.tsx
│       ├── loading-skeleton.tsx
│       └── error-boundary.tsx
├── lib/
│   ├── gateway/                  # Gateway API client
│   │   ├── client.ts             # WebSocket client (ported)
│   │   ├── hooks.ts              # useGateway, useMethod, useEvent
│   │   ├── types.ts              # TypeBox → TypeScript types
│   │   └── auth.ts               # Device identity & auth
│   ├── stores/                   # Zustand stores
│   │   ├── gateway.ts            # Connection state
│   │   ├── agents.ts             # Agent list & detail cache
│   │   ├── sessions.ts           # Session management
│   │   ├── chat.ts               # Chat messages, streaming
│   │   ├── cron.ts               # Cron jobs
│   │   ├── proficiency.ts        # User proficiency level
│   │   └── ui.ts                 # Theme, sidebar, layout prefs
│   ├── adaptive/                 # Adaptive UX engine
│   │   ├── proficiency.ts        # Detection & level definitions
│   │   ├── content.ts            # Level-specific copy/labels
│   │   └── layout.ts             # Level-specific layout rules
│   └── utils/
│       ├── format.ts
│       ├── markdown.ts
│       └── time.ts
├── styles/
│   ├── globals.css               # Tailwind base + custom properties
│   └── tokens.css                # Design tokens
├── public/
│   └── assets/
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 3.2 State Management

**Zustand** with the following store architecture:

```
┌─────────────────────────────────────────────┐
│              Gateway Store                   │
│  connected, hello, snapshot, features        │
│  ← WebSocket events auto-update             │
├─────────────────────────────────────────────┤
│  Agents Store    │  Sessions Store           │
│  list, detail,   │  list, active,            │
│  files, identity │  preview, usage           │
├──────────────────┼──────────────────────────┤
│  Chat Store      │  Cron Store               │
│  messages,       │  jobs, status,             │
│  streaming,      │  runs, form               │
│  queue, runId    │                            │
├──────────────────┼──────────────────────────┤
│  UI Store        │  Proficiency Store         │
│  theme, sidebar, │  level, detected,          │
│  layout prefs    │  overridden                │
└──────────────────┴──────────────────────────┘
```

Each store exposes:
- **State** — current values
- **Actions** — mutations (optimistic where possible)
- **Selectors** — derived/computed values
- **Gateway hooks** — auto-subscribe to WebSocket events

### 3.3 Gateway Client Architecture

Port `GatewayBrowserClient` to a standalone TypeScript class, then wrap with React hooks:

```typescript
// lib/gateway/hooks.ts
function useGateway(): { connected: boolean; client: GatewayClient }
function useMethod<T>(method: string, params?: unknown): { data: T; loading: boolean; error: Error | null; refetch: () => void }
function useEvent(event: string, handler: (payload: unknown) => void): void
function useSubscription(events: string[], handler: (event: string, payload: unknown) => void): void
```

The Gateway client is a singleton, initialized in the root layout, stored in the gateway Zustand store. All components access it via hooks — never directly.

---

## 4. Information Architecture

### 4.1 Navigation Hierarchy

The navigation adapts based on proficiency level:

#### Beginner Mode (3 items)
```
🏠 Home          → Dashboard + quick actions
🤖 My Agents     → Agent list with builder
💬 Chat          → Talk to agents
```

#### Standard Mode (6 items)
```
📊 Dashboard     → Overview, health, activity
🤖 Agents        → Agent list, builder, files
💬 Chat          → Conversations, history
⏰ Automations   → Cron jobs, schedules
🔌 Channels      → Messaging integrations
⚙️ Settings      → Config, devices, nodes
```

#### Expert Mode (full, 10 items)
```
📊 Dashboard     → Overview, health, presence
🤖 Agents        → Full agent management
💬 Chat          → Multi-session, debug views
📋 Sessions      → Session inspector
⏰ Cron          → Full cron management
⚡ Skills        → Skill marketplace
🔌 Channels      → Channel management
📱 Nodes         → Device management
📈 Analytics     → Usage, costs, performance
⚙️ Settings      → Config, debug, logs, devices
```

### 4.2 User Flows

#### Flow 1: First-Time Setup (Non-Technical)
```
Landing → Proficiency Quiz (3 questions) → Setup Wizard
  → Connect Gateway (auto-detect local)
  → Choose Template Agent (visual cards)
  → Customize via Chat ("Tell me about yourself")
  → Agent Created → Guided Tour of Chat
```

#### Flow 2: Create Agent (Standard User)
```
Agents → "New Agent" → Template Picker
  → Selected Template → Visual Editor
    ├─ Identity (name, avatar, personality sliders)
    ├─ Capabilities (toggle skills, set tools)
    ├─ Model (dropdown with explanations)
    └─ Review (Auto-Review button, live preview)
  → Create → Chat with new agent
```

#### Flow 3: Create Agent (Expert)
```
Agents → "New Agent" → Blank or Template
  → File Editor (AGENTS.md, SOUL.md, etc.)
  → Monaco editor with schema validation
  → Quick Preview panel
  → Create
```

### 4.3 Page Inventory

| Page | Route | Proficiency | Gateway Methods Used |
|------|-------|-------------|---------------------|
| Dashboard | `/dashboard` | All | health, status, agents.list, sessions.list, usage.status |
| Agent List | `/agents` | All | agents.list, agent.identity.get |
| Agent Builder | `/agents/new` | All (adaptive) | agents.create, agents.files.set, models.list |
| Agent Detail | `/agents/[id]` | Standard+ | agents.files.list/get, skills.status, agent.identity.get |
| Chat | `/chat` | All | chat.send, chat.history, chat.abort |
| Chat Session | `/chat/[key]` | All | chat.send, chat.history, sessions.preview |
| Sessions | `/sessions` | Expert | sessions.list, sessions.preview, sessions.patch/reset/delete |
| Cron | `/cron` | Standard+ | cron.list, cron.status, cron.add/update/remove/run, cron.runs |
| Skills | `/skills` | Standard+ | skills.status, skills.install, skills.update |
| Channels | `/channels` | Standard+ | channels.status, channels.logout |
| Nodes | `/nodes` | Standard+ | node.list, node.describe |
| Analytics | `/analytics` | Standard+ | usage.status, usage.cost, sessions.usage |
| Settings | `/settings` | All (adaptive) | config.get, config.set |
| Config Editor | `/settings/config` | Expert | config.get, config.set, config.apply, config.schema |
| Devices | `/settings/devices` | Standard+ | device.pair.list, device.pair.approve/reject/remove |
| Debug | `/settings/debug` | Expert | health, status, models.list, logs.tail |
| Setup Wizard | `/setup` | Beginner | wizard.start, wizard.next, wizard.status |

---

## 5. Adaptive UX System

### 5.1 Proficiency Levels

Three tiers, each fundamentally changing the interaction model:

| Aspect | Beginner | Standard | Expert |
|--------|----------|----------|--------|
| **Navigation** | 3 items, icons + labels | 6 items, collapsible groups | 10 items, icon-only option |
| **Agent Creation** | Chat-driven wizard | Visual form + templates | File editor + raw config |
| **Config** | Guided settings cards | Grouped form fields | Raw YAML/JSON editor |
| **Labels** | Friendly ("AI personality") | Technical-lite ("System Prompt") | Technical ("SOUL.md") |
| **Help** | Tooltips everywhere, beacons | On-hover tooltips | Keyboard shortcuts overlay |
| **Data Density** | Cards, large touch targets | Balanced tables + cards | Dense tables, compact views |
| **Errors** | "Something went wrong" + action | Error code + message | Full error + stack trace |
| **Cron** | "Schedule" with preset times | Visual schedule builder | Raw cron expressions |

### 5.2 Detection & Switching

**Initial detection** via a 3-question onboarding quiz:
1. "Have you used AI assistants before?" (Chatbots / AI tools / Built my own)
2. "How comfortable are you with configuration files?" (What's that? / I can edit them / I write them daily)
3. "What's your goal?" (Personal assistant / Automate tasks / Build a fleet of agents)

Scoring maps to Beginner (0-3), Standard (4-6), Expert (7-9).

**Runtime switching:**
- Proficiency switcher in the sidebar footer (always visible)
- Gear icon → "Interface Complexity" toggle
- Smooth animated transitions between levels using Framer Motion layout animations

**Persistence:** Stored in the proficiency Zustand store → localStorage. No server-side storage needed.

### 5.3 Implementation Pattern

```tsx
// components/adaptive/complexity-gate.tsx
function ComplexityGate({
  level,        // minimum proficiency to show
  children,     // complex content
  fallback?,    // simplified alternative (or null to hide)
}: ComplexityGateProps) {
  const { proficiency } = useProficiency();
  if (proficiency < level) return fallback ?? null;
  return children;
}

// Usage:
<ComplexityGate level="expert" fallback={<SimpleScheduler />}>
  <CronExpressionEditor />
</ComplexityGate>
```

```tsx
// components/adaptive/adaptive-label.tsx
function AdaptiveLabel({ beginner, standard, expert }: AdaptiveLabelProps) {
  const { proficiency } = useProficiency();
  const labels = { beginner, standard, expert };
  return <span>{labels[proficiency]}</span>;
}

// Usage:
<AdaptiveLabel
  beginner="AI Personality"
  standard="System Prompt"
  expert="SOUL.md"
/>
```

---

## 6. Agent Builder — The Crown Jewel

### 6.1 Overview

The Agent Builder is the most important page in the application. It must serve three audiences simultaneously:

1. **Non-technical users** who want to describe what they need in plain English
2. **Standard users** who want visual forms with smart defaults
3. **Power users** who want to edit markdown files directly

### 6.2 Builder Modes

#### Mode A: Chat-Driven Builder (Beginner)

A full-screen conversational interface where the user describes their ideal agent:

```
┌─────────────────────────────────────────────┐
│  🤖 Agent Builder                           │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Hi! I'll help you create your       │    │
│  │ perfect AI agent. What would you    │    │
│  │ like it to do?                      │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ I want an assistant that manages    │    │
│  │ my schedule and reminds me about    │    │
│  │ important tasks                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Great! I'll set up a Personal       │    │
│  │ Assistant agent. Here's what I'll   │    │
│  │ configure:                          │    │
│  │                                     │    │
│  │ ✅ Calendar integration             │    │
│  │ ✅ Task management                  │    │
│  │ ✅ Daily briefing cron job          │    │
│  │ ✅ Friendly, professional tone      │    │
│  │                                     │    │
│  │ Should I also enable email access?  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌──────────────────────────────────[Send]─┐│
│  │ Yes, and make it sound casual       │   ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ 📋 Preview Config  │  🚀 Create     │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

Implementation: This uses `chat.send` to a special builder-assistant session with a system prompt that generates agent configuration. The assistant's responses include structured data (agent name, files content, skills, model selection) that the UI extracts and uses to populate the agent creation API calls.

#### Mode B: Visual Form Builder (Standard)

A step-by-step form with visual controls:

```
┌─────────────────────────────────────────────────────────┐
│  Steps          │  Identity                              │
│                 │                                        │
│  ● Identity     │  Agent Name: [Schedule Assistant    ]  │
│  ○ Personality  │                                        │
│  ○ Capabilities │  Avatar:  [😊] [Upload] [Generate]    │
│  ○ Model        │                                        │
│  ○ Channels     │  Description:                          │
│  ○ Review       │  [A friendly assistant that helps     ]│
│                 │  [manage your daily schedule           ]│
│                 │                                        │
│                 │  Template: [Personal Assistant ▾]      │
│                 │                                        │
│                 │        [Back]  [Next: Personality →]   │
└─────────────────┴────────────────────────────────────────┘
```

**Step: Personality** — Sliders and toggles:
- Formality: Casual ←──●──→ Formal
- Verbosity: Concise ←──●──→ Detailed
- Proactivity: Reactive ←──●──→ Proactive
- Humor: Serious ←──●──→ Playful
- These map to SOUL.md content generation

**Step: Capabilities** — Visual skill/tool toggles:
- Grid of skill cards with on/off toggles
- Tool access profile selector (conservative → permissive)
- Channel bindings

**Step: Model** — Model picker with explanations:
- Cards showing model options with cost/speed/capability indicators
- "Recommended" badge on best-fit models
- Thinking level selector

**Step: Review** — Full preview with Auto-Review:
- Generated config preview
- "Auto-Review" button that sends config to LLM for feedback
- Live preview chat panel

#### Mode C: File Editor (Expert)

Direct editing of agent workspace files:

```
┌───────────────────────────────────────────────────────────┐
│  Files           │  SOUL.md                    [Preview]  │
│                  │                                        │
│  AGENTS.md     ● │  ┌──────────────────────────────────┐  │
│  SOUL.md       ● │  │ # Soul                           │  │
│  IDENTITY.md     │  │                                   │  │
│  CONTEXT.md      │  │ You are a schedule management     │  │
│  TOOLS.md        │  │ assistant. You're organized,      │  │
│  USER.md         │  │ proactive, and always helpful.    │  │
│  MEMORY.md       │  │                                   │  │
│                  │  │ ## Communication Style             │  │
│  [+ New File]    │  │ - Friendly but professional       │  │
│                  │  │ - Use bullet points for clarity   │  │
│  ───────────     │  │ - Confirm before taking actions   │  │
│  Model: [▾]     │  │                                   │  │
│  Thinking: [▾]  │  └──────────────────────────────────┘  │
│                  │                                        │
│  [Auto-Review]   │  [Discard]           [Save & Create]  │
└──────────────────┴────────────────────────────────────────┘
```

Uses Monaco editor with markdown language support, file tree navigation, and integrated preview.

### 6.3 Chat Assistant (Embedded)

Available in ALL builder modes as a collapsible side panel:

```tsx
// components/agent-builder/chat-assistant/
// Always-available floating button that opens a chat panel
// System prompt instructs the LLM to:
// 1. Help users define their agent's purpose and personality
// 2. Suggest configurations based on user description
// 3. Generate SOUL.md, AGENTS.md content
// 4. Recommend skills and model selections
// 5. Output structured JSON that the UI can parse and apply
```

The assistant uses `chat.send` to a dedicated builder session with a specialized system prompt. Responses are parsed for structured config blocks (fenced code blocks with `agent-config` language tag) that can be "applied" to the form/editor with one click.

### 6.4 Auto-Review System

A button available on the Review step (Standard) and in the file editor toolbar (Expert):

**Flow:**
1. User clicks "Auto-Review" 🔍
2. UI serializes current agent config (all files, model, skills, channels)
3. Sends to Gateway via `chat.send` with a review-specific system prompt
4. LLM analyzes the config and returns structured feedback:
   - ✅ Strengths: "Clear personality definition in SOUL.md"
   - ⚠️ Suggestions: "Consider adding error handling guidance"
   - ❌ Issues: "Tool access profile is 'full' but agent only needs exec and web_search"
   - 💡 Tips: "Add a MEMORY.md to enable session continuity"
5. Feedback displayed as an annotated checklist with "Fix" action buttons

### 6.5 Templates & Presets

Curated starting points displayed as visual cards:

| Template | Description | Pre-configured |
|----------|-------------|----------------|
| 🧑‍💼 Personal Assistant | Schedule, tasks, reminders | Calendar skills, proactive style |
| 💻 Code Reviewer | PR reviews, code analysis | exec tool, technical style |
| 📧 Email Manager | Inbox triage, drafting | Email skills, formal style |
| 🎨 Creative Writer | Content creation, brainstorming | Web search, creative style |
| 📊 Data Analyst | Data queries, reports | exec + web tools, analytical style |
| 🛡️ Security Monitor | System monitoring, alerts | exec + cron, terse style |
| 🤝 Customer Support | Ticket handling, FAQ | Channel bindings, empathetic style |
| 📝 Meeting Notes | Transcription, summaries | Concise style, structured output |
| 🏠 Home Automation | Device control, routines | Node integration, casual style |
| ⬜ Blank | Start from scratch | Nothing pre-configured |

### 6.6 Live Preview

A split-pane or modal that shows how the agent would respond:

- Pre-populated with 3-5 sample prompts relevant to the template
- User can type custom test prompts
- Shows streaming response in real-time
- Uses `chat.send` to a temporary preview session
- Session is cleaned up on exit

---

## 7. Design System — "Horizon"

### 7.1 Design Principles

1. **Progressive Disclosure** — Show the minimum needed; reveal more on demand
2. **Spatial Consistency** — Same element, same place, every time
3. **Calm Interface** — Minimal visual noise; color = meaning, not decoration
4. **Motion with Purpose** — Animate transitions that help orientation, nothing else
5. **Accessibility First** — WCAG 2.1 AA minimum; keyboard-navigable; screen-reader-friendly

### 7.2 Color System

Built on CSS custom properties with automatic dark mode:

```css
/* Light mode */
--background: 0 0% 100%;        /* #FFFFFF */
--foreground: 240 10% 4%;       /* #09090B */
--card: 0 0% 100%;
--card-foreground: 240 10% 4%;
--primary: 262 83% 58%;         /* #7C3AED — OpenClaw Violet */
--primary-foreground: 0 0% 100%;
--secondary: 240 5% 96%;
--secondary-foreground: 240 6% 10%;
--muted: 240 5% 96%;
--muted-foreground: 240 4% 46%;
--accent: 262 83% 96%;          /* Light violet tint */
--destructive: 0 84% 60%;
--success: 142 76% 36%;
--warning: 38 92% 50%;
--border: 240 6% 90%;
--ring: 262 83% 58%;
--radius: 0.625rem;

/* Dark mode */
--background: 240 10% 4%;       /* #09090B */
--foreground: 0 0% 95%;
--card: 240 10% 6%;
--primary: 262 83% 68%;         /* Lighter violet for dark bg */
--border: 240 4% 16%;
/* ... */
```

**Semantic colors:**
- **Violet** (#7C3AED) — Primary actions, active states, brand
- **Green** — Success, connected, healthy, enabled
- **Amber** — Warnings, pending states
- **Red** — Errors, destructive actions, disconnected
- **Blue** — Information, links, secondary actions
- **Gray scale** — Content hierarchy, borders, backgrounds

### 7.3 Typography

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Scale */
--text-xs:   0.75rem / 1rem;     /* 12px — captions, badges */
--text-sm:   0.875rem / 1.25rem;  /* 14px — secondary text, labels */
--text-base: 1rem / 1.5rem;      /* 16px — body text */
--text-lg:   1.125rem / 1.75rem;  /* 18px — section headers */
--text-xl:   1.25rem / 1.75rem;   /* 20px — page subtitles */
--text-2xl:  1.5rem / 2rem;       /* 24px — page titles */
--text-3xl:  1.875rem / 2.25rem;  /* 30px — hero text */
```

### 7.4 Spacing & Layout

8px grid system:
```
--space-1: 0.25rem   (4px)
--space-2: 0.5rem    (8px)
--space-3: 0.75rem   (12px)
--space-4: 1rem      (16px)
--space-5: 1.25rem   (20px)
--space-6: 1.5rem    (24px)
--space-8: 2rem      (32px)
--space-10: 2.5rem   (40px)
--space-12: 3rem     (48px)
--space-16: 4rem     (64px)
```

### 7.5 Component Patterns

**Cards** — Primary content container:
```
- 1px border (--border)
- rounded-lg (--radius)
- bg-card
- shadow-sm (light mode only)
- hover: shadow-md transition
- p-6 standard padding
```

**Buttons:**
```
Primary:    bg-primary text-primary-foreground    → Create, Save, Send
Secondary:  bg-secondary text-secondary-foreground → Cancel, Back
Ghost:      bg-transparent hover:bg-accent         → Toolbar actions
Destructive: bg-destructive text-white              → Delete
Outline:    border bg-transparent                   → Alternative actions
```

**Status Indicators:**
```
● Connected / Healthy / Enabled   → green-500 with subtle pulse
● Warning / Pending               → amber-500
● Error / Disconnected            → red-500
● Inactive / Disabled             → gray-400
```

**Empty States:**
- Illustrated SVG + headline + description + CTA button
- Example: "No agents yet" → illustration of friendly robot → "Create your first agent" button

---

## 8. API Integration Plan

### 8.1 Gateway Method → UI Feature Mapping

#### Connection & Health
| Method | UI Feature | Location |
|--------|-----------|----------|
| `connect` | WebSocket handshake | Root layout (automatic) |
| `health` | Health indicators | Dashboard, topbar status dot |
| `status` | System status | Dashboard, debug page |
| `system-presence` | Connected clients list | Dashboard |
| `last-heartbeat` | Heartbeat indicator | Topbar |

#### Agents
| Method | UI Feature | Location |
|--------|-----------|----------|
| `agents.list` | Agent grid/list | Agents page, sidebar, dashboard |
| `agents.create` | Agent creation | Agent Builder (all modes) |
| `agents.update` | Agent editing | Agent detail page |
| `agents.delete` | Agent deletion | Agent detail → delete action |
| `agents.files.list` | File tree | Agent Builder (Expert), Agent detail |
| `agents.files.get` | File content | File editor panels |
| `agents.files.set` | File save | File editor save action |
| `agent.identity.get` | Agent avatar/name | Everywhere agents appear |
| `models.list` | Model picker | Agent Builder, settings |

#### Chat
| Method | UI Feature | Location |
|--------|-----------|----------|
| `chat.send` | Send message | Chat page, Builder chat assistant |
| `chat.history` | Message history | Chat page on load |
| `chat.abort` | Stop generation | Chat page stop button |
| `chat.inject` | System message | Debug/admin only |

#### Sessions
| Method | UI Feature | Location |
|--------|-----------|----------|
| `sessions.list` | Session table | Sessions page, chat sidebar |
| `sessions.preview` | Session preview | Session hover cards |
| `sessions.patch` | Edit session | Session detail actions |
| `sessions.reset` | Reset session | Session context menu |
| `sessions.delete` | Delete session | Session context menu |
| `sessions.compact` | Compact session | Session actions (Expert) |
| `sessions.usage` | Usage per session | Analytics page |
| `sessions.resolve` | Find session | Internal routing |

#### Cron
| Method | UI Feature | Location |
|--------|-----------|----------|
| `cron.list` | Cron job list | Cron/Automations page |
| `cron.status` | Scheduler status | Cron page header |
| `cron.add` | Create job | Cron builder form |
| `cron.update` | Edit job | Cron job detail |
| `cron.remove` | Delete job | Cron job context menu |
| `cron.run` | Manual trigger | Cron job "Run Now" button |
| `cron.runs` | Run history | Cron job detail panel |

#### Skills
| Method | UI Feature | Location |
|--------|-----------|----------|
| `skills.status` | Installed skills | Skills page, Agent Builder |
| `skills.install` | Install skill | Skills marketplace |
| `skills.update` | Configure skill | Skill settings panel |

#### Nodes
| Method | UI Feature | Location |
|--------|-----------|----------|
| `node.list` | Node list | Nodes page |
| `node.describe` | Node detail | Node detail panel |
| `node.invoke` | Run command | Node actions (Expert) |

#### Config
| Method | UI Feature | Location |
|--------|-----------|----------|
| `config.get` | Load config | Settings pages |
| `config.set` | Save config (raw) | Config editor (Expert) |
| `config.apply` | Apply + restart | Config editor |
| `config.schema` | Form generation | Settings form view |
| `config.patch` | Partial update | Individual settings |

#### Devices & Pairing
| Method | UI Feature | Location |
|--------|-----------|----------|
| `device.pair.list` | Device list | Devices page |
| `device.pair.approve/reject` | Pairing decisions | Pairing notifications |
| `device.pair.remove` | Remove device | Device context menu |
| `device.token.rotate/revoke` | Token management | Device security (Expert) |

#### Exec Approvals
| Method | UI Feature | Location |
|--------|-----------|----------|
| `exec.approval.request` | Approval notification | Global notification bar |
| `exec.approval.resolve` | Approve/deny action | Approval dialog |

#### Other
| Method | UI Feature | Location |
|--------|-----------|----------|
| `usage.status` | Usage summary | Dashboard, Analytics |
| `usage.cost` | Cost tracking | Analytics page |
| `tts.enable/disable/convert` | Voice toggle | Chat settings |
| `logs.tail` | Live logs | Logs page (Expert) |
| `channels.status` | Channel health | Channels page |
| `channels.logout` | Disconnect channel | Channel actions |
| `wizard.start/next/cancel/status` | Setup wizard | First-run experience |

### 8.2 Event Subscriptions

The WebSocket event stream drives real-time updates:

| Event | UI Behavior |
|-------|-------------|
| `chat.*` | Stream messages into chat, update message list |
| `agent.*` | Tool stream cards, run status indicators |
| `tick` | Keep-alive, refresh stale data |
| `shutdown` | Show reconnection overlay |
| `presence.*` | Update connected clients indicator |
| `health.*` | Update health badges |
| `exec.approval.request` | Show approval notification bar |
| `cron.*` | Update cron job states |
| `device.pair.*` | Show pairing request notification |

---

## 9. Responsive Design

### 9.1 Breakpoints

```css
/* Tailwind defaults, extended */
sm:  640px   /* Large phones landscape */
md:  768px   /* Tablets portrait */
lg:  1024px  /* Tablets landscape, small laptops */
xl:  1280px  /* Desktops */
2xl: 1536px  /* Large desktops */
```

### 9.2 Layout Behavior

| Breakpoint | Sidebar | Content | Chat |
|------------|---------|---------|------|
| < 640px | Hidden (hamburger) | Full width | Full screen overlay |
| 640-1023 | Collapsed (icons only) | Full width - sidebar | Slide-over panel |
| 1024-1279 | Expanded (icons + labels) | Content area | Split pane available |
| ≥ 1280 | Expanded + collapsible | Content area | Persistent split pane |

### 9.3 Mobile-Specific Adaptations
- Bottom tab bar replaces sidebar on mobile
- Chat input anchored to bottom with safe-area padding
- Swipe gestures for navigation (back, sidebar reveal)
- Cards stack vertically, tables become card lists
- Agent Builder steps become full-screen pages with progress bar
- No Monaco editor on mobile — plain textarea with basic highlighting

---

## 10. Key Page Designs

### 10.1 Dashboard

The landing page after login. Shows system health at a glance:

```
┌─────────────────────────────────────────────────────┐
│  Good morning, David 👋                              │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │ 3 Agents │ │ ● Online │ │ 12 Chats │ │ $2.40  ││
│  │ Active   │ │ Healthy  │ │ Today    │ │ Today  ││
│  └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                                                     │
│  Quick Actions                                      │
│  [🤖 New Agent] [💬 Chat] [⏰ New Automation]      │
│                                                     │
│  Recent Activity                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🤖 Assistant responded to "meeting summary" │   │
│  │ ⏰ Daily Briefing ran successfully          │   │
│  │ 📧 Email Agent processed 3 messages         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Your Agents                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐          │
│  │ 🧑‍💼      │ │ 💻      │ │ + New Agent │          │
│  │ Assistant│ │ CodeBot │ │             │          │
│  │ ● Active │ │ ● Idle  │ │             │          │
│  └─────────┘ └─────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────┘
```

### 10.2 Chat Interface

Clean, modern messaging UI:

```
┌────────────────────────────────────────────────────────┐
│ Sessions  │  🧑‍💼 Assistant          ● Online    [⋯]    │
│           │                                            │
│ ● Main    │  ┌──────────────────────────────────────┐  │
│   2m ago  │  │ 👤 Summarize my meeting notes from   │  │
│           │  │    today                              │  │
│ ○ CodeBot │  └──────────────────────────────────────┘  │
│   1h ago  │                                            │
│           │  ┌──────────────────────────────────────┐  │
│ ○ Debug   │  │ 🤖 Here's your meeting summary:      │  │
│   3h ago  │  │                                      │  │
│           │  │ ## Team Standup (10:00 AM)            │  │
│           │  │ - Sprint velocity on track            │  │
│           │  │ - Luis: UI spec in progress           │  │
│           │  │ - Deploy scheduled for Friday         │  │
│           │  │                                      │  │
│           │  │ ⚡ Used: read, web_search             │  │
│           │  └──────────────────────────────────────┘  │
│           │                                            │
│           │  ┌──────────────────────────────[Send]──┐  │
│           │  │ Message Assistant...          📎 🎤  │  │
│           │  └─────────────────────────────────────┘  │
└───────────┴────────────────────────────────────────────┘
```

Features:
- Session list sidebar (collapsible)
- Streaming message display with typing indicator
- Tool usage cards (expandable)
- Markdown rendering with syntax highlighting
- File/image attachments
- Voice input toggle (TTS integration)
- Message actions (copy, retry, edit)

### 10.3 Cron / Automations

Visual schedule builder for non-technical users:

```
┌───────────────────────────────────────────────────────┐
│  Automations                          [+ New]         │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 🌅 Daily Briefing                    ● Enabled  │ │
│  │ Every day at 7:00 AM                            │ │
│  │ Next run: Tomorrow at 7:00 AM                   │ │
│  │ Last run: Today at 7:00 AM — ✅ OK (1.2s)       │ │
│  │                              [Run Now] [Edit]   │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 📊 Weekly Report                     ○ Disabled  │ │
│  │ Every Monday at 9:00 AM                         │ │
│  │ Last run: 3 days ago — ✅ OK (4.5s)              │ │
│  │                           [Enable] [Edit] [⋯]  │ │
│  └─────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

Schedule builder adapts:
- **Beginner:** Preset time picker ("Every morning", "Every Monday", "Every hour")
- **Standard:** Visual day/time grid with interval selector
- **Expert:** Raw cron expression with next-5-runs preview

---

## 11. Performance & Technical Constraints

### 11.1 Performance Budget
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3s
- **Bundle size:** < 200KB initial (gzipped)
- **WebSocket connection:** < 500ms to hello-ok

### 11.2 Code Splitting Strategy
- Route-based splitting (automatic with Next.js)
- Monaco editor: lazy-loaded only when Expert mode enters file editor
- Chart libraries: lazy-loaded only on Analytics page
- Template data: fetched on-demand, not bundled

### 11.3 Offline Behavior
- Show cached data when Gateway is unreachable
- Queue messages for send-on-reconnect
- Visual indicator of connection state (always visible in topbar)
- Auto-reconnect with exponential backoff (ported from current client)

### 11.4 Static Export
The app MUST work as a static export (`next export` / `output: 'export'`) served by the Gateway's built-in HTTP server. No Node.js server required in production. All data fetching happens client-side via WebSocket.

---

## 12. Accessibility

- **WCAG 2.1 AA** compliance target
- All interactive elements keyboard-accessible
- Focus management on route changes and modal opens
- Aria labels on all icon-only buttons
- Color contrast ratios ≥ 4.5:1 for text, ≥ 3:1 for large text
- Reduced motion support via `prefers-reduced-motion`
- Screen reader announcements for streaming chat messages
- Skip-to-content link
- Form validation errors linked to inputs via `aria-describedby`

---

## 13. Internationalization

- Built on `next-intl` or lightweight i18n solution
- Default: English
- All user-facing strings externalized
- RTL support in CSS (logical properties: `margin-inline-start` vs `margin-left`)
- Date/time formatting respects locale
- Number formatting for costs/usage

---

## 14. Security Considerations

- Device identity keys stored in IndexedDB (Web Crypto API)
- Auth tokens in memory + localStorage (existing pattern)
- No sensitive data in URL parameters
- CSP headers configured in static export
- XSS protection via React's default escaping + DOMPurify for markdown
- WebSocket messages validated against TypeBox schemas

---

## 15. Migration Strategy

### Phase 1: Parallel Deployment
- New UI at `/next/` path alongside existing `/` UI
- Feature flag to make new UI the default
- Both UIs share the same Gateway WebSocket

### Phase 2: Feature Parity
- Implement all existing tabs/views in new UI
- A/B testing with real users
- Iterate on adaptive UX based on feedback

### Phase 3: Cutover
- New UI becomes `/` default
- Old UI available at `/legacy/` for transition period
- Remove legacy UI after 2 release cycles

---

## 16. Success Metrics

| Metric | Current (est.) | Target |
|--------|---------------|--------|
| Time to first agent (new user) | 30+ min | < 5 min |
| Agent setup completion rate | ~40% | > 85% |
| Support tickets for setup | High | -70% |
| User proficiency level distribution | 90% expert | 40/40/20 B/S/E |
| Page load time | ~2s | < 1.5s |
| Accessibility score (Lighthouse) | Unknown | > 95 |

---

*This specification is a living document. It will evolve as implementation reveals new constraints and user testing surfaces new insights. The architecture is designed to be iterative — we can ship value incrementally without waiting for full completion.*

**— Luis, Principal UX Engineer**
**OpenClaw Horizon Project**
