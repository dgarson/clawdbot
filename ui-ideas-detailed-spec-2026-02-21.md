# OpenClaw UI Ideas — Detailed Implementation Specs

**File:** `/Users/openclaw/.openclaw/workspace/luis/ui-ideas-detailed-spec-2026-02-21.md`
**Author:** Luis (Principal UX Engineer)
**Date:** 2026-02-21
**Requested by:** David (CEO/Founder)
**Source:** Follow-up on brainstorm roadmap (`brainstorm-roadmap-2026-02-21.md`)

---

## Executive Summary

This document contains **detailed implementation specifications for all 15 UI ideas** from the February 2026 brainstorm session. Each idea has been developed from a high-level concept into a production-ready spec with:

- **Technical approach** — framework choices, libraries, rendering strategies, data flow
- **Component architecture** — full component trees with names, props, and responsibilities
- **Interaction patterns** — user flows, animations, keyboard shortcuts, gestures
- **Wireframe descriptions** — detailed textual wireframes with ASCII art layouts
- **Data model & API integration** — endpoints, Zustand stores, TypeScript interfaces
- **Accessibility considerations** — ARIA patterns, keyboard nav, screen reader support
- **Phasing plans** — 2-4 implementation phases per idea with concrete deliverables
- **Open questions & risks** — technical unknowns, decision points, risk mitigations

### Organization

The specs are organized in three priority tiers:

**🔴 Tier 1 — Do Now (Ideas 1-5)**
1. Guided Interactive Onboarding Tour
2. Agent Relationship Visualization & Topology View
3. Universal Command Palette & Natural Language Actions
4. Real-Time Agent Activity Dashboard ("Mission Control")
5. Contextual Empty States & Zero-Data Experiences

**🟡 Tier 2 — Next Sprint (Ideas 6-10)**
6. Adaptive Progressive Disclosure System (Proficiency 2.0)
7. Session Replay & Debug Timeline
8. Unified Configuration Experience
9. Skill Creation IDE / Skill Builder
10. Inline Documentation & Contextual Help System

**🔵 Tier 3 — Plan & Prototype (Ideas 11-15)**
11. Multi-Model A/B Testing & Comparison View
12. Agent Template Marketplace with Community Ratings
13. Mobile-Native Companion App (React Native)
14. Theming Engine & Design Token Customization
15. Visual Workflow Builder (Node-Based Agent Orchestration)

### Estimated Total Effort

| Tier | Ideas | Est. Engineering Weeks |
|------|-------|----------------------|
| 🔴 Tier 1 | 1-5 | ~12-16 weeks |
| 🟡 Tier 2 | 6-10 | ~16-20 weeks |
| 🔵 Tier 3 | 11-15 | ~30-40 weeks |
| **Total** | **15 ideas** | **~58-76 weeks** |

*Note: Many ideas have shared infrastructure (graph libraries, Zustand patterns, WebSocket integration) that reduces total effort when built in sequence.*

---

# TIER 1 — DO NOW

# OpenClaw Horizon — Tier 1 UI Implementation Specs

**Author:** Luis, Principal UX Engineer  
**Date:** 2026-02-21  
**Status:** Draft — Ready for Review  
**Covers:** 5 highest-priority UI features for Horizon  

---

## 1. Guided Interactive Onboarding Tour

### Overview

Replace the existing 6-step `OnboardingFlow` component — which collects preferences but performs no actual configuration — with a live, gateway-connected onboarding experience that walks users through their first successful agent interaction. The new tour drives real `wizard.start` / `wizard.next` RPC calls, writes actual config via `config.set`, connects a real channel via `channels.status`, and ends with the user chatting with a live agent — not a mock. The flow is adaptive: it queries gateway state on mount, skips steps already completed (e.g. provider already connected), and adjusts its copy/complexity to the detected proficiency level.

### Technical Approach

- **Framework:** React 19 + Next.js 15 App Router (static export mode). The onboarding lives at `/setup` route.
- **State management:** New Zustand store `useOnboardingStore` tracks step completion, wizard session state, and completion flags. Persists `onboardingCompleted` to `localStorage`.
- **Gateway integration:** `useWizard` hook (already exists) drives wizard RPC. `useGateway` hook provides the WebSocket client. The tour calls `wizard.start({ mode: 'onboard' })` on mount and sequences through steps via `wizard.next`.
- **Dynamic forms:** Wizard steps of type `text`, `select`, `confirm` are rendered by the existing `WizardModal` step renderers (`TextStepRenderer`, `SelectStepRenderer`, `ConfirmStepRenderer`, `NoteStepRenderer`, `ProgressStepRenderer`) — but embedded inline (not in a modal) within the full-screen onboarding layout.
- **Config schema:** `config.schema` RPC provides field definitions for provider setup forms. `useConfigSchema` hook fetches and caches the schema, then dynamically generates form fields using React Hook Form + Zod validation derived from the schema.
- **Channel verification:** `channels.status` RPC polled every 3 seconds during channel connection step to detect when connection succeeds. Visual feedback via `ProgressStepRenderer`.
- **Animation:** Framer Motion `AnimatePresence` + `motion.div` for step transitions. `layoutId` on progress indicators for smooth pill animations. Step enter: `opacity: 0 → 1, y: 12 → 0` over `300ms ease-out`. Step exit: `opacity: 1 → 0, y: 0 → -8` over `200ms ease-in`.
- **Libraries:** Framer Motion 11, React Hook Form 7, Zod 3, Lucide React (icons), `confetti-js` for final celebration (replacing the current CSS-only confetti).

### Component Architecture

```
SetupPage (app/setup/page.tsx)
├── OnboardingShell
│   ├── OnboardingProgressBar
│   │   └── ProgressPill (per step, animated width + color)
│   ├── OnboardingStepLabel
│   └── OnboardingContent (AnimatePresence wrapper)
│       ├── WelcomeStep
│       │   ├── BrandLogo
│       │   ├── WelcomeHeadline
│       │   ├── ProficiencyQuiz (3 questions → sets proficiency)
│       │   └── StartButton
│       ├── GatewayCheckStep
│       │   ├── GatewayStatusIndicator (auto-detect local gateway)
│       │   ├── GatewayConnectionForm (if not auto-detected)
│       │   └── GatewayHealthCard (version, uptime)
│       ├── ProviderSetupStep
│       │   ├── ProviderGrid (cards: Anthropic, OpenAI, Google, MiniMax, xAI)
│       │   │   └── ProviderCard (icon, name, authMethod badge, status)
│       │   ├── ProviderConfigForm (dynamic, from config.schema)
│       │   │   ├── DynamicFormField (text/select/toggle, from schema)
│       │   │   ├── OAuthConnectButton (for OAuth providers)
│       │   │   └── TokenPasteField (for API key providers)
│       │   └── ProviderVerifyIndicator (tests API key validity)
│       ├── ChannelSetupStep
│       │   ├── ChannelGrid
│       │   │   └── ChannelCard (Slack, Discord, Telegram, WhatsApp, webchat)
│       │   ├── ChannelConfigWizard (embedded wizard.next steps)
│       │   └── ChannelStatusPoller (polls channels.status, shows ✓ when live)
│       ├── AgentCreationStep
│       │   ├── TemplateGallery (3-4 starter templates: Personal Assistant, Coder, Researcher, Custom)
│       │   │   └── TemplateCard (illustration, name, description, tag pills)
│       │   ├── AgentNameInput (with emoji picker, reuse existing)
│       │   ├── PersonalityPresetPicker (reuse PERSONALITY_PRESETS)
│       │   └── AgentCreationProgress (calls agents.create, shows spinner)
│       ├── FirstChatStep
│       │   ├── LiveChatInterface (real chat.send to the just-created agent)
│       │   │   ├── MessageList (real messages, not mock)
│       │   │   ├── StreamingIndicator
│       │   │   └── ChatInput
│       │   ├── SuggestedPromptChips ("Say hello", "Ask for a joke", "Request a summary")
│       │   └── ChatSuccessDetector (detects successful response → enables "Continue")
│       └── CompletionStep
│           ├── ConfettiCanvas (canvas-based confetti, not CSS)
│           ├── SetupSummaryCard (what was configured, with ✓ marks)
│           ├── NextStepsSuggestions (3 cards: "Explore Dashboard", "Add more agents", "Set up automations")
│           └── GoToDashboardButton
├── OnboardingSkipControl (floating bottom-right: "Skip setup")
└── OnboardingDebugPanel (expert only: shows raw wizard RPC traffic)
```

**Component props:**

| Component | Key Props |
|-----------|-----------|
| `OnboardingShell` | `children`, `currentStep: number`, `totalSteps: number` |
| `OnboardingProgressBar` | `steps: OnboardingStepDef[]`, `currentIndex: number`, `completedIndices: Set<number>` |
| `ProviderCard` | `provider: ModelProvider`, `connected: boolean`, `onSelect: () => void` |
| `ProviderConfigForm` | `provider: string`, `schema: ConfigSchema`, `onComplete: () => void` |
| `ChannelCard` | `channel: ChannelDef`, `status: 'disconnected' | 'connecting' | 'connected'`, `onSelect: () => void` |
| `TemplateCard` | `template: AgentTemplate`, `selected: boolean`, `onSelect: () => void` |
| `LiveChatInterface` | `agentId: string`, `sessionKey: string`, `suggestedPrompts?: string[]` |
| `SetupSummaryCard` | `items: { label: string; status: 'done' | 'skipped' }[]` |

### Interaction Patterns

**User flow:**
1. User navigates to `/setup` (auto-redirect on first visit if `onboardingCompleted !== true` in localStorage)
2. Welcome screen with proficiency quiz (3 radio-button questions, scored 0-9)
3. Gateway check: auto-detects `ws://localhost:18789`. If found, auto-advances (200ms delay for visual feedback). If not found, shows "Start Gateway" instructions with copy-pasteable CLI command.
4. Provider setup: User picks a provider → dynamic config form appears (slides in from right, `300ms`). For OAuth providers, a new window opens; polling detects completion. For token-based, paste → verify → green checkmark.
5. Channel setup: Similar to provider. Selecting "Webchat" is instant (built-in). Others show channel-specific wizard steps.
6. Agent creation: User picks template → customizes name/emoji → system calls `agents.create` via RPC. Progress spinner with step labels ("Creating workspace...", "Writing identity files...", "Starting agent...").
7. First chat: User sees their real agent respond. Suggested prompt chips above the input bar. After first successful exchange (agent responds with non-error content), a subtle "✨ Your first conversation!" toast appears, and the "Continue" button pulses.
8. Completion: Confetti, summary, CTA buttons.

**Keyboard shortcuts:**
- `Enter` — advance to next step (when CTA is focused)
- `Escape` — open skip confirmation dialog
- `Tab` / `Shift+Tab` — standard form navigation
- `1-5` number keys — select provider/channel card when grid is focused

**Animations:**
- Step transitions: `300ms` Framer Motion layout animation with crossfade
- Progress bar: smooth width transition `500ms cubic-bezier(0.4, 0, 0.2, 1)`
- Card selection: `scale(1.02)` + border glow on select, `150ms`
- Success checkmark: SVG path drawing animation `400ms ease-in-out`
- Confetti: canvas particle system, 120 particles, `3s` duration, gravity + wind simulation

**Adaptive behavior:**
- Beginner: All explanatory text shown, helper tooltips on every field, "What is this?" links, estimated time remaining
- Standard: Concise labels, optional explanations collapsed by default
- Expert: Minimal chrome, raw config preview toggle, "Import existing config" shortcut

### Wireframe Description

```
┌────────────────────────────────────────────────────────────────┐
│ [Full viewport, bg-gray-950 with radial violet/pink gradient] │
│                                                                │
│  ┌─ Progress Bar (top, full-width, h-1) ──────────────────┐   │
│  │ ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  Step 3 of 7 · "Connect a Provider"        [Skip setup →]     │
│                                                                │
│  ┌─ Content Card (max-w-2xl, mx-auto, centered) ─────────┐   │
│  │                                                        │   │
│  │   🔐                                                  │   │
│  │   Connect an AI Provider                              │   │
│  │   "Your agents need a brain. Pick a model provider."  │   │
│  │                                                        │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │   │  🧠      │  │  🤖      │  │  💎      │           │   │
│  │   │Anthropic │  │ OpenAI   │  │ Google   │           │   │
│  │   │ OAuth    │  │ API Key  │  │ OAuth    │           │   │
│  │   │[Connect] │  │[Connect] │  │[Connect] │           │   │
│  │   └──────────┘  └──────────┘  └──────────┘           │   │
│  │   ┌──────────┐  ┌──────────┐                          │   │
│  │   │  🌊      │  │  ⚡      │                          │   │
│  │   │ MiniMax  │  │  xAI     │                          │   │
│  │   │ OAuth    │  │ API Key  │                          │   │
│  │   │[Connect] │  │[Connect] │                          │   │
│  │   └──────────┘  └──────────┘                          │   │
│  │                                                        │   │
│  │  ─── When provider selected, form slides in below ──  │   │
│  │                                                        │   │
│  │   API Key: [________________________]  [👁]           │   │
│  │   ⓘ Find your API key at console.anthropic.com        │   │
│  │                                                        │   │
│  │   [Verify & Continue →]                               │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│                   ● ● ● ◉ ○ ○ ○  (step dots, bottom)         │
└────────────────────────────────────────────────────────────────┘
```

### Data Model & API Integration

**Gateway RPC calls used:**

| Step | RPC Method | Purpose |
|------|-----------|---------|
| Gateway Check | `health` | Verify gateway is running |
| Gateway Check | `status` | Get version, features, uptime |
| Provider Setup | `config.schema` | Get dynamic form fields for provider config |
| Provider Setup | `wizard.start({ mode: 'add-provider', provider: 'anthropic' })` | Start provider wizard |
| Provider Setup | `wizard.next({ sessionId, answer })` | Submit provider config |
| Provider Setup | `config.get({ path: 'auth.profiles' })` | Verify provider connected |
| Channel Setup | `channels.status` | Check which channels are connected |
| Channel Setup | `wizard.start({ mode: 'add-channel' })` | Start channel wizard |
| Agent Creation | `agents.create` | Create the agent |
| First Chat | `chat.send` | Send first message |
| First Chat | WebSocket event `chat.message` | Receive agent response |
| Completion | `config.set({ path: 'ui.onboardingCompleted', value: true })` | Mark onboarding done |

**Zustand store: `useOnboardingStore`**

```typescript
interface OnboardingState {
  // Progress
  currentStep: number;
  completedSteps: Set<number>;
  skippedSteps: Set<number>;
  proficiencyScore: number;

  // Gateway
  gatewayConnected: boolean;
  gatewayVersion: string | null;

  // Provider
  selectedProvider: string | null;
  providerConnected: boolean;

  // Channel
  selectedChannel: string | null;
  channelConnected: boolean;

  // Agent
  selectedTemplate: string | null;
  agentData: { name: string; emoji: string; role: string; preset: string };
  createdAgentId: string | null;

  // Wizard session
  wizardSessionId: string | null;

  // Actions
  setStep: (step: number) => void;
  completeStep: (step: number) => void;
  skipStep: (step: number) => void;
  setProficiency: (score: number) => void;
  setAgentData: (data: Partial<OnboardingState['agentData']>) => void;
  reset: () => void;
}
```

**Data shapes:**

```typescript
interface OnboardingStepDef {
  id: string;
  label: string;
  icon: string;
  required: boolean;
  canSkip: boolean;
  checkCompletion: () => Promise<boolean>; // queries gateway to see if already done
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  defaultFiles: Record<string, string>; // filename → content
  defaultModel: string;
  defaultPersonality: PersonalityConfig;
}

interface ConfigSchema {
  fields: ConfigSchemaField[];
}

interface ConfigSchemaField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  label: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: { pattern?: string; min?: number; max?: number };
}
```

### Accessibility Considerations

- **ARIA:** Each step region has `role="region"` with `aria-label="Step N: Step Name"`. Progress bar uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. Provider/channel grids use `role="radiogroup"` with individual `role="radio"` and `aria-checked`.
- **Keyboard navigation:** Full tab order through all interactive elements. Arrow keys navigate card grids. `Enter` selects focused card. `Space` toggles. Focus ring: `ring-2 ring-violet-500 ring-offset-2 ring-offset-gray-950`.
- **Screen reader:** Step transitions announced via `aria-live="polite"` region. Completion status announced: "Step 3 complete. Moving to step 4: Create Agent."
- **Color contrast:** All text meets WCAG AA (4.5:1 for body, 3:1 for large text). Status indicators use icon + text, never color alone.
- **Reduced motion:** `prefers-reduced-motion` media query disables Framer Motion animations, uses `opacity` transitions only.
- **Focus management:** Focus moves to first interactive element in each new step after transition completes (300ms delay).

### Phasing Plan

**Phase 1 — Foundation (3 days)**
- Create `useOnboardingStore` Zustand store
- Build `OnboardingShell`, `OnboardingProgressBar`, `OnboardingStepLabel`
- Implement `WelcomeStep` with proficiency quiz (port existing questions)
- Implement `GatewayCheckStep` with auto-detection
- Wire `AnimatePresence` step transitions
- Route `/setup` with redirect logic

**Phase 2 — Configuration Steps (4 days)**
- Implement `ProviderSetupStep` with `config.schema` dynamic forms
- Build `ProviderConfigForm` + `DynamicFormField` + `OAuthConnectButton`
- Implement `ChannelSetupStep` with `channels.status` polling
- Wire `wizard.start` / `wizard.next` for both provider and channel flows
- Adaptive skip logic: check existing config, auto-complete if already configured

**Phase 3 — Agent Creation & First Chat (3 days)**
- Build `TemplateGallery` with starter templates
- Implement `AgentCreationStep` with real `agents.create` call
- Build `LiveChatInterface` (connect to real `chat.send` / `chat.message` events)
- Implement `SuggestedPromptChips` and `ChatSuccessDetector`
- Build `CompletionStep` with canvas confetti and summary

**Phase 4 — Polish & Adaptive (2 days)**
- Proficiency-adaptive copy variants (beginner/standard/expert)
- `OnboardingDebugPanel` for expert mode
- Reduced motion support
- Full accessibility audit (axe-core, screen reader testing)
- E2E test: full onboarding flow with gateway mock

### Open Questions & Risks

1. **Wizard protocol completeness:** Does `wizard.start({ mode: 'onboard' })` exist as a gateway wizard mode, or do we need to orchestrate multiple wizard sessions (`add-provider`, `add-channel`) ourselves? Need confirmation from gateway team.
2. **OAuth popup flow:** For OAuth providers (Anthropic, Google, MiniMax), the current pattern opens a popup. Need to confirm popup-to-parent communication mechanism (postMessage? redirect with token?). Mobile browsers may block popups.
3. **Agent creation latency:** `agents.create` may take 5-15 seconds (workspace creation, file writes, agent start). Need loading UX that feels fast. Consider optimistic UI or staged progress messages.
4. **First chat cold start:** Agent's first response may be slow (model cold start, initial context loading). Need graceful handling if response takes >30 seconds.
5. **Gateway not running:** If user has no gateway, onboarding can't proceed. Need clear "Install & Start Gateway" instructions with platform-specific commands. Consider embedding a "Start Gateway" button that calls `openclaw gateway start` via a local API.
6. **Template content:** Who writes the agent templates (SOUL.md, AGENTS.md content)? Need content from product team.

---

## 2. Agent Relationship Visualization & Topology View

### Overview

A dedicated interactive graph view that visualizes the entire agent ecosystem — how agents spawn sub-agents, delegate tasks, share workspaces, and communicate in real-time. Users click nodes to inspect agent status, watch sessions spawn live as animated edge additions, zoom into specific sub-trees for message flow detail, and filter by time range or agent status. This is a core product differentiator: no other multi-agent platform provides this level of operational visibility.

### Technical Approach

- **Graph library:** React Flow v12 (over D3-force or Cytoscape). Rationale: React Flow is React-native (no DOM bridging), has built-in minimap/controls/zoom, supports custom node/edge components with full React rendering, handles 500+ nodes performantly with viewport culling, and has first-class TypeScript support. D3-force is lower-level (we'd rebuild most of React Flow's features), and Cytoscape.js requires a jQuery-era imperative API.
- **Layout algorithm:** Dagre (hierarchical layout) for the default tree view — agents flow top-to-bottom with spawned sub-agents as children. `@dagrejs/dagre` computes positions, React Flow renders. Alternative layout: force-directed (via `d3-force` simulation) for the "relationship web" view, toggled by user.
- **Real-time updates:** Gateway WebSocket events `sessions.spawn`, `sessions.end`, `agent.send`, `agent.status` drive live graph mutations. `useEvent` hook from `useGateway` subscribes to these events and dispatches to a dedicated `useTopologyStore` Zustand store.
- **Performance strategy:** Viewport culling (React Flow built-in), node virtualization for >100 nodes, debounced layout recalculation (max 1 recalc per 500ms), `React.memo` on all custom node/edge components, `useMemo` for layout computation. Web Workers for layout computation when node count exceeds 200.
- **Rendering:** Canvas renderer for edges (via React Flow's `<EdgeRenderer />` with `edgeType="smoothstep"`), DOM for nodes (allows rich interactive content inside nodes). Minimap uses Canvas.
- **Animation library:** Framer Motion for node entry/exit animations. CSS `@keyframes` for edge pulse effects (data flow visualization). `requestAnimationFrame` for smooth viewport panning during auto-follow.

### Component Architecture

```
TopologyPage (app/(main)/topology/page.tsx)
├── TopologyToolbar
│   ├── LayoutToggle (tree | force | radial)
│   ├── TimeRangeFilter (Radix Select: "Last hour" | "Today" | "This week" | "All time")
│   ├── StatusFilter (Radix ToggleGroup: active | idle | error | all)
│   ├── SearchAgentInput (fuzzy search, highlights matching node)
│   ├── AutoFollowToggle (toggle: auto-pan to new spawns)
│   └── FullscreenToggle
├── TopologyCanvas (React Flow <ReactFlow> wrapper)
│   ├── AgentNode (custom React Flow node)
│   │   ├── AgentNodeAvatar (emoji + status dot)
│   │   ├── AgentNodeLabel (name, role)
│   │   ├── AgentNodeStatusBadge (active/idle/error/offline)
│   │   ├── AgentNodeMetrics (mini: session count, msg count)
│   │   └── AgentNodeTooltip (hover: model, health, last active, tools)
│   ├── SessionNode (custom React Flow node — smaller, secondary)
│   │   ├── SessionNodeIcon (chat bubble or cog)
│   │   ├── SessionNodeLabel (session key, truncated)
│   │   └── SessionNodeDuration (time since start)
│   ├── SpawnEdge (custom edge: parent → child, animated dash)
│   ├── DelegationEdge (custom edge: agent → agent, different color)
│   ├── MessageFlowEdge (custom edge: animated particles along path)
│   ├── TopologyMinimap (React Flow <MiniMap> with custom node colors)
│   └── TopologyControls (React Flow <Controls> + custom zoom presets)
├── TopologyDetailPanel (slide-in from right, 400px wide)
│   ├── DetailPanelHeader (agent name, emoji, close button)
│   ├── DetailPanelStatus (status, health, model, uptime)
│   ├── DetailPanelSessions (list of active sessions)
│   ├── DetailPanelMessageFlow (recent messages, scrollable)
│   ├── DetailPanelActions (buttons: "Chat", "View Files", "Restart")
│   └── DetailPanelSubTree (mini graph of this agent's sub-agents only)
└── TopologyLegend (bottom-left overlay: node/edge type legend)
```

**Component props:**

| Component | Key Props |
|-----------|-----------|
| `AgentNode` | `data: { agent: Agent; sessions: Session[]; isSpawning: boolean; metrics: NodeMetrics }` |
| `SessionNode` | `data: { session: Session; agentEmoji: string }` |
| `SpawnEdge` | `data: { animated: boolean; label?: string; spawnTime?: string }` |
| `MessageFlowEdge` | `data: { messageCount: number; lastMessageTime: string; direction: 'sending' | 'receiving' }` |
| `TopologyDetailPanel` | `agentId: string | null`, `onClose: () => void`, `onNavigate: (route: string) => void` |
| `TopologyToolbar` | `layout: LayoutType`, `onLayoutChange: (l: LayoutType) => void`, `filters: TopologyFilters`, `onFiltersChange: (f: TopologyFilters) => void` |

### Interaction Patterns

**User flows:**

1. **Explore topology:** User navigates to `/topology` → graph renders with all agents as primary nodes, sessions as secondary nodes, spawn/delegation edges connecting them. Dagre layout positions the tree top-to-bottom. User scrolls/pinch-zooms to explore.
2. **Inspect agent:** User clicks an `AgentNode` → `TopologyDetailPanel` slides in from the right (Framer Motion: `x: 400 → 0`, `300ms ease-out`). Panel shows agent details, active sessions, recent messages, action buttons. Clicking "Chat" navigates to `/chat/[sessionKey]`.
3. **Watch live spawn:** When gateway broadcasts `sessions.spawn`, a new `SessionNode` appears with entrance animation (`scale: 0 → 1, opacity: 0 → 1, 400ms spring`), a `SpawnEdge` draws from parent to child (SVG path grow animation, `600ms`), and if Auto-Follow is enabled, the viewport smoothly pans to center the new node (`500ms ease-in-out`).
4. **Filter by status:** User clicks "Active" in `StatusFilter` → non-matching nodes fade to 20% opacity (`200ms`), edges to non-matching nodes become dashed and faded. Graph doesn't remove nodes (preserves spatial memory).
5. **Message flow visualization:** Toggled via toolbar button. When active, edges show animated particles (small dots moving along the edge path) proportional to message volume. High-traffic edges pulse brighter.
6. **Layout switching:** User clicks Dagre → Force → Radial in `LayoutToggle`. Nodes animate to new positions via Framer Motion `layout` transition (`800ms spring, stiffness: 200, damping: 30`).

**Keyboard shortcuts:**
- `F` — toggle fullscreen
- `R` — reset zoom to fit all nodes
- `L` — cycle layout modes
- `Escape` — close detail panel
- `1-4` — zoom presets (25%, 50%, 100%, 150%)
- `/` — focus search input
- `A` — toggle auto-follow

**Gestures (trackpad/touch):**
- Pinch to zoom
- Two-finger pan
- Double-click node to zoom-to-fit that node's sub-tree
- Click + drag to box-select multiple nodes

### Wireframe Description

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ┌─ Toolbar ──────────────────────────────────────────────────────────┐ │
│ │ [Tree ▾] [Force] [Radial] │ Time: [Last hour ▾] │ [●Active][○Idle]│ │
│ │ [🔍 Search agents...    ] │ [⟳ Auto-follow] [⛶ Fullscreen]       │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Graph Canvas (flex-1, bg-gray-950, dot-grid pattern) ────────────┐ │
│ │                                                                    │ │
│ │          ┌──────────┐                                              │ │
│ │          │ 🧠 Xavier│ ←── AgentNode (rounded-xl, border,          │ │
│ │          │ CTO      │     bg-gray-900, w-48, active glow)         │ │
│ │          │ ● Active │                                              │ │
│ │          └────┬─────┘                                              │ │
│ │               │ (SpawnEdge, animated dashes)                       │ │
│ │        ┌──────┴──────┐                                             │ │
│ │   ┌────┴───┐    ┌────┴───┐                                        │ │
│ │   │ 🎨 Luis│    │ 📣     │                                        │ │
│ │   │ UX Eng │    │Stephan │                                        │ │
│ │   │ ● Act  │    │ ○ Idle │                                        │ │
│ │   └───┬────┘    └────────┘                                        │ │
│ │       │                                                            │ │
│ │  ┌────┴────┐                                                       │ │
│ │  │ ⚡ Harry│ ←── SessionNode (smaller, rounded-lg)                │ │
│ │  │ ● Active│                                                       │ │
│ │  └─────────┘                                                       │ │
│ │                                                                    │ │
│ │  ┌─ Minimap (bottom-left, 180x120, bg-gray-900/80) ─┐            │ │
│ │  │ [  ·  ·                                          ]│            │ │
│ │  │ [    · · ·                                       ]│            │ │
│ │  └──────────────────────────────────────────────────┘            │ │
│ │                                                                    │ │
│ │  ┌─ Legend (bottom-left, above minimap) ──────┐                   │ │
│ │  │ ● Agent  ○ Session  ── Spawn  ···> Message │                   │ │
│ │  └───────────────────────────────────────────┘                   │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Detail Panel (right, w-[400px], slide-in) ───────────────────────┐ │
│ │ [← Back]  🎨 Luis                                    [✕ Close]   │ │
│ │ Principal UX Engineer                                             │ │
│ │ ─────────────────────────────────────────────                     │ │
│ │ Status: ● Active    Health: ✓ Healthy                            │ │
│ │ Model: claude-opus-4-6    Since: 30m ago                         │ │
│ │ ─────────────────────────────────────────────                     │ │
│ │ Active Sessions (2)                                               │ │
│ │  ├ luis-ux-implementation (24 msgs, 30m)                          │ │
│ │  └ luis-ui-spec-tier1 (12 msgs, 15m)                              │ │
│ │ ─────────────────────────────────────────────                     │ │
│ │ Sub-Agents                                                        │ │
│ │  ├ ⚡ Harry (active, component impl)                              │ │
│ │  └ 📝 Larry (completed, builder wizard)                           │ │
│ │ ─────────────────────────────────────────────                     │ │
│ │ [💬 Chat]  [📁 Files]  [🔄 Restart]                             │ │
│ └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Model & API Integration

**Gateway RPC & events:**

| Source | Method/Event | Data Used |
|--------|-------------|-----------|
| Initial load | `agents.list` | All agents with status, model, role |
| Initial load | `sessions.list` | All sessions with `parentId`, `children`, `agentId` |
| Real-time | `sessions.spawn` (WS event) | `{ sessionId, parentId, agentId, label }` |
| Real-time | `sessions.end` (WS event) | `{ sessionId, status }` |
| Real-time | `agent.status` (WS event) | `{ agentId, status, health }` |
| Real-time | `agent.send` (WS event) | `{ from, to, sessionId }` — for message flow edges |
| On click | `sessions.preview` | Detailed session info for detail panel |
| On click | `agents.files.list` | Workspace files for detail panel |

**Zustand store: `useTopologyStore`**

```typescript
interface TopologyState {
  // Graph data
  nodes: Map<string, TopologyNode>;    // agentId | sessionId → node data
  edges: Map<string, TopologyEdge>;    // edgeId → edge data

  // View state
  layout: 'dagre' | 'force' | 'radial';
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  filters: TopologyFilters;
  autoFollow: boolean;
  showMessageFlow: boolean;

  // Computed positions (from layout algorithm)
  positions: Map<string, { x: number; y: number }>;

  // Actions
  addAgent: (agent: Agent) => void;
  removeAgent: (agentId: string) => void;
  addSession: (session: Session) => void;
  endSession: (sessionId: string) => void;
  updateAgentStatus: (agentId: string, status: Agent['status']) => void;
  selectNode: (nodeId: string | null) => void;
  setLayout: (layout: TopologyState['layout']) => void;
  setFilters: (filters: TopologyFilters) => void;
  recalculateLayout: () => void;
}

interface TopologyNode {
  id: string;
  type: 'agent' | 'session';
  data: Agent | Session;
  metrics: { sessionCount: number; messageCount: number; subAgentCount: number };
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: 'spawn' | 'delegation' | 'messageFlow';
  animated: boolean;
  data: { messageCount?: number; spawnTime?: string };
}

interface TopologyFilters {
  status: Agent['status'][] | 'all';
  timeRange: 'hour' | 'today' | 'week' | 'all';
  searchQuery: string;
}
```

### Accessibility Considerations

- **ARIA:** Graph canvas has `role="img"` with `aria-label="Agent topology graph showing N agents and M connections"`. Each node is a `role="button"` with `aria-label` describing the agent/session. Detail panel is `role="complementary"` with `aria-label="Agent details"`.
- **Keyboard navigation:** `Tab` moves through nodes in document order. `Enter` selects focused node (opens detail panel). Arrow keys move between connected nodes (following edges). `Escape` deselects.
- **Screen reader alternative:** A `TopologyTableView` component (accessible via toolbar toggle) presents the same data as an accessible `<table>` with sortable columns: Agent, Status, Parent, Sub-agents, Sessions, Last Active. Screen reader users can switch to this view.
- **Color:** Node status colors are always paired with text labels and icons. Edges use both color and line style (solid for spawn, dashed for delegation, dotted for message flow).
- **Zoom:** Minimum zoom 25%, maximum 400%. Zoom level shown as text. Ctrl+0 resets to 100%.
- **Focus visible:** All interactive nodes show a prominent focus ring (`ring-2 ring-violet-500`) when focused via keyboard.

### Phasing Plan

**Phase 1 — Static Graph Render (4 days)**
- Install and configure React Flow v12 with custom theme
- Create `AgentNode` and `SessionNode` custom node components
- Create `SpawnEdge` custom edge component
- Build `TopologyCanvas` wrapper with minimap and controls
- Implement Dagre layout algorithm integration
- Load data from `agents.list` + `sessions.list` on mount
- Basic click → select node interaction

**Phase 2 — Real-Time & Interaction (3 days)**
- Subscribe to `sessions.spawn`, `sessions.end`, `agent.status` WebSocket events
- Animate new node/edge additions (Framer Motion entrance)
- Build `TopologyDetailPanel` with slide-in animation
- Implement auto-follow (viewport panning to new nodes)
- Node hover tooltips

**Phase 3 — Advanced Features (3 days)**
- Force-directed and radial layout alternatives
- Layout switching with animated transitions
- `MessageFlowEdge` with animated particles
- `StatusFilter` and `TimeRangeFilter` with opacity fade
- Search with node highlighting
- Fullscreen mode

**Phase 4 — Polish & Performance (2 days)**
- Web Worker for layout computation (>200 nodes)
- `TopologyTableView` accessible alternative
- `TopologyLegend` overlay
- Performance profiling and optimization (target: 60fps with 300 nodes)
- Keyboard shortcut overlay (press `?` to show)

### Open Questions & Risks

1. **Event availability:** Do `sessions.spawn`, `sessions.end`, `agent.send` gateway events exist and broadcast to the WebSocket? Need to verify with gateway team. If not, we fall back to polling `sessions.list` every 5 seconds.
2. **Scale concern:** OpenClaw instances with 50+ agents and hundreds of sessions may overwhelm the graph. Need viewport culling + collapsed sub-trees for large deployments. Consider a "collapsed group" node that shows count badge.
3. **Layout stability:** Force-directed layouts are non-deterministic — nodes jump around on each recalculation. Dagre is deterministic. Default to Dagre; force-directed is opt-in.
4. **Session → Agent mapping:** Sessions reference `agentId`, but spawning relationships (parent-child) are on sessions, not agents. The graph needs to show both: agent-level relationships AND session-level trees. May need two views or a toggle.
5. **React Flow licensing:** React Flow v12 is MIT licensed for open source. Confirm no license issues for our use case.
6. **Mobile:** Graph interaction on mobile is challenging. Consider disabling topology view on mobile or showing the table view by default.

---

## 3. Universal Command Palette & Natural Language Actions

### Overview

Evolve the existing ⌘K command palette from a simple navigation/theme switcher into the universal action surface for the entire application. The palette becomes the fastest way to do anything in OpenClaw: create agents, start sessions, install skills, check gateway health, search across all entities, toggle channels, run cron jobs, and manage settings — all from a single keyboard shortcut. The killer differentiator is natural language intent parsing: typing "create an agent that monitors GitHub PRs" triggers the agent builder with pre-filled configuration, bridging the gap between intent and action.

### Technical Approach

- **Foundation:** Radix `<Dialog>` for the modal overlay, providing focus trapping, scroll locking, and portal rendering. The palette renders in a portal at the document root to avoid z-index conflicts with the sidebar/topbar.
- **Search engine:** `fuse.js` v7 for client-side fuzzy search across all registered commands, entities, and recently used items. Custom scoring that weights exact matches (`score: 0`) above fuzzy matches, and recent items above others. Index rebuilt when entities change (agents created/deleted, skills installed).
- **Command registry:** A `CommandRegistry` singleton class that components self-register into. Each command declares: `id`, `label`, `keywords`, `icon`, `category`, `action`, `shortcut?`, `available?` (predicate function). Registry supports dynamic commands (e.g., one command per agent for "Chat with [agent]").
- **Natural language parsing:** Phase 3 feature. A lightweight local intent classifier (rule-based first, LLM-backed later) maps free-text input to structured actions. Rule-based patterns: regex + keyword extraction. Example: `/create\s+(an?\s+)?agent.*(?:that|to|for)\s+(.+)/i` → `{ intent: 'create-agent', description: $2 }`. LLM-backed: sends input to a fast model (`minimax-2.5`) via `chat.send` with a system prompt that returns structured JSON intents.
- **State:** `useCommandPaletteStore` Zustand store tracks open/closed, search query, selected index, history, and mode (navigation | search | NL).
- **Animation:** Radix `<Dialog>` with Framer Motion: overlay `opacity: 0 → 1` in `150ms`, palette `scale: 0.95 → 1, opacity: 0 → 1, y: -8 → 0` in `200ms cubic-bezier(0.16, 1, 0.3, 1)` (spring-like ease). Result list items enter staggered: `50ms` delay per item, `opacity: 0 → 1, y: 4 → 0` in `150ms`.

### Component Architecture

```
CommandPaletteProvider (wraps root layout, registers global ⌘K listener)
├── CommandPaletteDialog (Radix Dialog.Root + Dialog.Portal + Dialog.Overlay)
│   └── CommandPaletteContent (Radix Dialog.Content, max-w-xl, centered)
│       ├── CommandPaletteHeader
│       │   ├── CommandSearchInput (text input, auto-focused, font-medium)
│       │   ├── SearchModeIndicator (pill: "Commands" | "Search" | "AI")
│       │   └── CloseButton (Radix Dialog.Close, hidden on desktop)
│       ├── CommandPaletteBody
│       │   ├── RecentCommandsSection (if query empty, max 5 recent)
│       │   │   └── CommandItem (repeated)
│       │   ├── CommandResultsSection (grouped by category)
│       │   │   ├── CommandGroup (category header: "Navigation", "Agents", "Actions", etc.)
│       │   │   │   └── CommandItem (repeated)
│       │   │   └── CommandGroup (...)
│       │   ├── EntitySearchResults (when query matches agents/sessions/skills)
│       │   │   ├── EntityResultGroup (category: "Agents", "Sessions", etc.)
│       │   │   │   └── EntityResultItem (name, type badge, status, action on select)
│       │   │   └── EntityResultGroup (...)
│       │   └── NLIntentPreview (Phase 3: when NL intent detected)
│       │       ├── IntentIcon (emoji/icon for detected intent)
│       │       ├── IntentDescription ("Create agent: monitors GitHub PRs")
│       │       ├── IntentParametersList (extracted params)
│       │       └── IntentExecuteButton ("Create this agent →")
│       ├── CommandPaletteFooter
│       │   ├── KeyboardHints ("↑↓ navigate", "↵ select", "⎋ close")
│       │   ├── ResultCount ("12 results")
│       │   └── ModeToggleHint ("Tab to switch mode")
│       └── CommandPaletteEmpty (when no results: helpful message)
│           ├── EmptyStateIllustration
│           └── EmptyStateSuggestion ("Try 'create agent' or 'check gateway'")
└── CommandRegistry (singleton, not a component)
```

**Component props:**

| Component | Key Props |
|-----------|-----------|
| `CommandPaletteDialog` | `open: boolean`, `onOpenChange: (open: boolean) => void` |
| `CommandItem` | `command: Command`, `selected: boolean`, `onSelect: () => void`, `onHover: () => void` |
| `CommandGroup` | `category: string`, `commands: Command[]`, `selectedId: string | null` |
| `EntityResultItem` | `entity: SearchableEntity`, `type: 'agent' | 'session' | 'skill' | 'cron'`, `onSelect: () => void` |
| `NLIntentPreview` | `intent: ParsedIntent`, `onExecute: () => void`, `onEdit: () => void` |
| `CommandSearchInput` | `value: string`, `onChange: (v: string) => void`, `mode: SearchMode`, `onModeChange: (m: SearchMode) => void` |

### Interaction Patterns

**Opening:**
- `⌘K` (macOS) / `Ctrl+K` (Windows/Linux) — opens palette, focuses search input
- Click the search icon in the topbar
- Palette opens centered, 40% down from viewport top, max-width 640px

**Navigation:**
- `↑` / `↓` — move selection through results
- `Enter` — execute selected command
- `Escape` — close palette (if input empty) or clear input (if has text)
- `Tab` — cycle through search modes: Commands → Search → AI
- `⌘Backspace` — clear input
- Type to filter: results update as user types, debounced 100ms

**Command execution examples:**

| User types | Mode | Matched command | Action |
|-----------|------|-----------------|--------|
| `new agent` | Commands | "Create New Agent" | Navigate to `/agents/new` |
| `xavier` | Search | Agent: Xavier | Navigate to `/agents/1` or open detail |
| `gateway` | Commands | "Check Gateway Status" | Calls `health` RPC, shows result toast |
| `dark mode` | Commands | "Toggle Dark Mode" | Toggles theme instantly |
| `⌘K → cron` | Commands | "Manage Cron Jobs" | Navigate to `/cron` |
| `install slack` | Commands | "Install Slack Skill" | Calls `skills.install` |
| `create agent that summarizes emails` | AI | NL Intent: create-agent | Opens agent builder pre-filled |

**Result grouping (when query empty — "home screen"):**
1. **Recent** — last 5 used commands (stored in localStorage)
2. **Quick Actions** — Create Agent, Start Chat, Check Gateway
3. **Navigation** — Dashboard, Agents, Chat, Sessions, etc.

**Result grouping (when query present):**
1. **Commands** — matching registered commands
2. **Agents** — matching agent names/roles
3. **Sessions** — matching session labels
4. **Skills** — matching skill names
5. **Settings** — matching setting labels

### Wireframe Description

```
┌───── Overlay (bg-black/60, backdrop-blur-sm) ──────────────────────┐
│                                                                      │
│    ┌─ Palette (w-[640px], mx-auto, mt-[20vh]) ───────────────────┐  │
│    │                                                              │  │
│    │  ┌─ Search Input ─────────────────────────────────────────┐ │  │
│    │  │ 🔍  Type a command, search, or describe what you want… │ │  │
│    │  │                                         [Commands ▾]   │ │  │
│    │  └────────────────────────────────────────────────────────┘ │  │
│    │                                                              │  │
│    │  ┌─ Results (max-h-[360px], overflow-y-auto) ─────────────┐ │  │
│    │  │                                                        │ │  │
│    │  │  RECENT                                                │ │  │
│    │  │  ├ 🤖  Create New Agent          ⌘N                   │ │  │
│    │  │  ├ 💬  Start Chat                ⌘⇧C                 │ │  │
│    │  │  └ ⚙️  Open Settings             ⌘,                   │ │  │
│    │  │                                                        │ │  │
│    │  │  NAVIGATION                                            │ │  │
│    │  │  ├ 📊  Dashboard                                      │ │  │
│    │  │  ├ 🤖  Agents                                         │ │  │
│    │  │  ├ 💬  Chat                                           │ │  │
│    │  │  ├ 📋  Sessions                                       │ │  │
│    │  │  ├ ⏰  Cron Jobs                                      │ │  │
│    │  │  └ ⚡  Skills                                         │ │  │
│    │  │                                                        │ │  │
│    │  │  ACTIONS                                               │ │  │
│    │  │  ├ 🔌  Check Gateway Status                           │ │  │
│    │  │  ├ 🌙  Toggle Dark Mode                               │ │  │
│    │  │  ├ 🔄  Restart Gateway                                │ │  │
│    │  │  └ 📤  Export Config                                   │ │  │
│    │  │                                                        │ │  │
│    │  └────────────────────────────────────────────────────────┘ │  │
│    │                                                              │  │
│    │  ┌─ Footer ───────────────────────────────────────────────┐ │  │
│    │  │  ↑↓ Navigate   ↵ Select   ⎋ Close   Tab Switch mode   │ │  │
│    │  └────────────────────────────────────────────────────────┘ │  │
│    └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

--- When NL Intent Detected (Phase 3) ---

│    │  ┌─ NL Intent Preview ──────────────────────────────────┐ │  │
│    │  │  ✨ AI Suggestion                                    │ │  │
│    │  │                                                      │ │  │
│    │  │  🤖 Create Agent                                     │ │  │
│    │  │  "monitors GitHub PRs and notifies on Slack"         │ │  │
│    │  │                                                      │ │  │
│    │  │  Detected parameters:                                │ │  │
│    │  │  • Integration: GitHub                               │ │  │
│    │  │  • Channel: Slack                                    │ │  │
│    │  │  • Behavior: Monitor + Notify                        │ │  │
│    │  │                                                      │ │  │
│    │  │  [Create this agent →]     [Edit details]            │ │  │
│    │  └──────────────────────────────────────────────────────┘ │  │
```

### Data Model & API Integration

**Command registry data shape:**

```typescript
interface Command {
  id: string;                     // unique: "nav:dashboard", "action:create-agent"
  label: string;                  // display name
  keywords: string[];             // additional search terms
  icon: React.ReactNode;          // Lucide icon or emoji
  category: CommandCategory;      // "navigation" | "action" | "agent" | "settings" | "search"
  shortcut?: string;              // display shortcut: "⌘N"
  action: () => void | Promise<void>;  // what happens on select
  available?: () => boolean;      // predicate: is this command available now?
  priority?: number;              // sort order within category (lower = higher)
}

type CommandCategory = 'recent' | 'quickAction' | 'navigation' | 'action' | 'agent' | 'session' | 'skill' | 'settings';

interface SearchableEntity {
  id: string;
  name: string;
  type: 'agent' | 'session' | 'skill' | 'cron' | 'setting';
  icon: string;
  description?: string;
  status?: string;
  route: string;  // where to navigate on select
}

interface ParsedIntent {
  intent: 'create-agent' | 'start-session' | 'install-skill' | 'search' | 'unknown';
  confidence: number;    // 0-1
  description: string;   // human-readable description of what was parsed
  parameters: Record<string, string>;  // extracted params
  action: () => void;    // pre-built action
}
```

**Zustand store: `useCommandPaletteStore`**

```typescript
interface CommandPaletteState {
  // UI state
  open: boolean;
  query: string;
  selectedIndex: number;
  mode: 'commands' | 'search' | 'ai';

  // Data
  recentCommands: string[];     // command IDs, max 10
  results: CommandResult[];     // current filtered results

  // NL
  parsedIntent: ParsedIntent | null;
  intentLoading: boolean;

  // Actions
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  executeSelected: () => void;
  cycleMode: () => void;
  addToRecent: (commandId: string) => void;
}
```

**API integration:**

| Feature | RPC Call | When |
|---------|---------|------|
| Dynamic agent commands | `agents.list` | On palette open (cached in agents store) |
| Gateway status command | `health` | On command execution |
| Skill install command | `skills.install` | On command execution |
| Cron run command | `cron.run` | On command execution |
| Channel toggle | `channels.status` | On command execution |
| NL intent parsing | `chat.send` (to system agent) | On 800ms debounce after typing in AI mode |
| Cross-entity search | Client-side Fuse.js | Instant, no RPC |

### Accessibility Considerations

- **ARIA:** `<Dialog>` with `role="dialog"`, `aria-modal="true"`, `aria-label="Command palette"`. Search input: `role="combobox"`, `aria-expanded="true"`, `aria-controls="command-results"`, `aria-activedescendant` pointing to selected item. Results list: `role="listbox"`. Each item: `role="option"`, `aria-selected`.
- **Keyboard:** Full keyboard operation. No mouse required. `⌘K` opens, `Escape` closes, arrows navigate, `Enter` selects. Shortcuts announced in footer.
- **Screen reader:** Selected item change announced via `aria-activedescendant`. Category headers are `role="presentation"` with `aria-label` for grouping context. Result count announced via `aria-live="polite"` region: "12 results found".
- **Focus trap:** Radix Dialog handles focus trapping. On close, focus returns to previously focused element.
- **Color contrast:** All text meets WCAG AA. Selected item: distinct background (`bg-violet-600/20`) + text color change. Keyboard shortcut badges: high contrast.
- **Reduced motion:** Disable entrance animations. Palette appears instantly (opacity transition only, no scale/translate).

### Phasing Plan

**Phase 1 — Core Palette & Navigation Commands (3 days)**
- Build `CommandPaletteProvider` with `⌘K` listener
- Build `CommandPaletteDialog` + `CommandSearchInput` + `CommandItem`
- Implement `CommandRegistry` singleton with registration API
- Register navigation commands for all 19 routes
- Register theme toggle, proficiency switch
- Fuzzy search with Fuse.js
- Recent commands (localStorage)
- Keyboard navigation (↑↓ Enter Escape)

**Phase 2 — Action Commands & Entity Search (3 days)**
- Register action commands: create agent, start session, check gateway, install skill, run cron, toggle channel, restart gateway, export config
- Build dynamic commands from `agents.list` ("Chat with Xavier", "Edit Luis", etc.)
- Build `EntitySearchResults` cross-entity search (agents, sessions, skills, cron)
- `CommandGroup` category grouping
- `CommandPaletteFooter` with keyboard hints
- Result count indicator

**Phase 3 — Natural Language Intents (4 days)**
- Build `SearchModeIndicator` with mode cycling (Tab)
- Implement rule-based intent parser (regex patterns for common intents)
- Build `NLIntentPreview` component
- Wire NL intent to agent builder (pre-fill agent creation form)
- Implement LLM-backed intent parsing (fast model, debounced 800ms)
- Fallback: if NL confidence < 0.5, show regular search results instead

**Phase 4 — Polish (2 days)**
- Staggered entrance animations for result items
- Empty state with suggestions
- Performance optimization: memoize search results, debounce input
- Accessibility audit
- Command palette analytics (track most-used commands)

### Open Questions & Risks

1. **NL parsing latency:** LLM-backed intent parsing adds 1-3 seconds of latency. Need to show the palette results immediately (from fuzzy search) and overlay the NL intent when it arrives. The rule-based parser should handle 80% of cases instantly.
2. **Command discovery:** With dozens of commands, users may not discover power features. Consider a "What can I do?" command that lists all available actions grouped by category.
3. **Dynamic command staleness:** Agent-derived commands ("Chat with Xavier") become stale if agents are created/deleted. Need to invalidate Fuse.js index when agent store changes. Use Zustand `subscribe` to trigger reindex.
4. **Conflicting shortcuts:** `⌘K` conflicts with some browser shortcuts (e.g., Chrome search bar focus). Need to `preventDefault` reliably. Some VS Code-embedded webviews also capture `⌘K`.
5. **NL false positives:** Natural language parsing might misinterpret search queries as intents. "Xavier agent" might trigger "create agent named Xavier" instead of searching for Xavier. Need high confidence threshold (>0.7) before showing NL intent.

---

## 4. Real-Time Agent Activity Dashboard ("Mission Control")

### Overview

Transform the current static `AgentDashboard` — which renders mock data in a filterable grid — into a real-time operational control center powered by the Gateway WebSocket. The dashboard becomes the first thing users see: live session indicators with streaming status, real-time token usage counters, active tool call visualization, pending approval badges, error tickers, and an activity timeline that updates as events flow in. Every data point on the dashboard is live, updating within 500ms of the gateway event. This is "Mission Control" for your AI team.

### Technical Approach

- **Data source:** All data flows through the existing `useGateway` WebSocket hook. The Gateway already broadcasts events for sessions, agent status, tool usage, errors, and approvals. The dashboard subscribes to these events and dispatches to Zustand stores.
- **State management:** Three Zustand stores power the dashboard: `useAgentStore` (agent list + status), `useSessionStore` (active sessions + metrics), and `useDashboardStore` (dashboard-specific state: layout, selected widgets, time range). Stores update reactively from WebSocket events.
- **Rendering strategy:** React 19 with `useSyncExternalStore` for store subscriptions. Heavy use of `React.memo` on all stat cards and agent cards to prevent re-renders when unrelated data changes. `useTransition` for non-urgent updates (e.g., activity timeline appends).
- **Token counter animation:** `AnimatedCounter` component (exists in `AnimatedComponents.tsx`) with `requestAnimationFrame`-based interpolation. Target value updates from WebSocket; display value lerps toward target at 60fps over `500ms`.
- **Charts:** Recharts for the usage sparkline and session history chart. `ResponsiveContainer` ensures proper sizing. Data buffered: last 60 data points for sparklines (1 per minute), last 24 for hourly histograms.
- **Activity timeline:** Virtualized list (`@tanstack/react-virtual`) for the activity feed. New events prepend to the top with Framer Motion `layoutId` animation. Keeps max 500 events in memory; older events are discarded (not paginated, since this is real-time monitoring, not historical analysis).
- **Polling fallback:** If WebSocket disconnects, falls back to 10-second polling via `health` + `agents.list` + `sessions.list`. Visual indicator shows "Live" (green) or "Polling" (yellow) connection status.

### Component Architecture

```
DashboardPage (app/(main)/dashboard/page.tsx)
├── DashboardHeader
│   ├── DashboardTitle ("Mission Control")
│   ├── ConnectionStatusBadge (Live | Polling | Disconnected)
│   ├── TimeRangeSelector (Radix Select: Live | 1h | 24h | 7d)
│   └── DashboardActions
│       ├── RefreshButton
│       ├── LayoutToggle (grid | compact)
│       └── FullscreenToggle
├── DashboardStatsRow (grid cols-4 gap-4)
│   ├── StatCard (variant: "activeAgents")
│   │   ├── StatCardIcon (Lucide Activity, text-green-400)
│   │   ├── StatCardValue (AnimatedCounter)
│   │   ├── StatCardLabel ("Active Agents")
│   │   └── StatCardSparkline (Recharts tiny area chart, h-8)
│   ├── StatCard (variant: "activeSessions")
│   │   ├── StatCardIcon (Lucide MessageSquare, text-blue-400)
│   │   ├── StatCardValue (AnimatedCounter)
│   │   ├── StatCardLabel ("Active Sessions")
│   │   └── StatCardTrend (↑12% vs last hour)
│   ├── StatCard (variant: "tokensUsed")
│   │   ├── StatCardIcon (Lucide Zap, text-yellow-400)
│   │   ├── StatCardValue (AnimatedCounter, formatted: "1.2M")
│   │   ├── StatCardLabel ("Tokens Today")
│   │   └── StatCardCost ("≈ $2.34")
│   └── StatCard (variant: "pendingApprovals")
│       ├── StatCardIcon (Lucide AlertCircle, text-orange-400)
│       ├── StatCardValue (AnimatedCounter)
│       ├── StatCardLabel ("Pending Approvals")
│       └── StatCardUrgencyPulse (pulsing ring if count > 0)
├── DashboardMainGrid (grid cols-12 gap-4)
│   ├── AgentStatusGrid (col-span-8)
│   │   ├── AgentStatusGridHeader ("Your Agents" + view toggle)
│   │   └── AgentStatusGridBody
│   │       └── LiveAgentCard (repeated, per agent)
│   │           ├── AgentAvatar (emoji + status ring)
│   │           ├── AgentName
│   │           ├── AgentCurrentActivity (streaming text: "Editing file...", "Thinking...")
│   │           ├── AgentSessionCount (badge)
│   │           ├── AgentTokenUsage (mini bar)
│   │           └── AgentQuickActions (hover: Chat, View, Pause)
│   ├── ActivityTimeline (col-span-4)
│   │   ├── ActivityTimelineHeader ("Activity" + filter)
│   │   └── ActivityTimelineList (virtualized)
│   │       └── ActivityTimelineItem (repeated)
│   │           ├── ActivityIcon (per type: spawn, message, error, tool, approval)
│   │           ├── ActivityDescription ("Xavier spawned sub-agent Harry")
│   │           ├── ActivityTimestamp (relative: "2m ago")
│   │           └── ActivityAction (optional: "Approve" button for approvals)
│   ├── ActiveToolCallsPanel (col-span-6)
│   │   ├── ToolCallsPanelHeader ("Active Tool Calls")
│   │   └── ToolCallsList
│   │       └── ToolCallItem (repeated)
│   │           ├── ToolCallAgent (avatar + name)
│   │           ├── ToolCallName ("exec: npm test")
│   │           ├── ToolCallDuration (live counter: "12s")
│   │           └── ToolCallStatus (running | waiting | completed)
│   ├── RecentErrorsPanel (col-span-6)
│   │   ├── ErrorsPanelHeader ("Recent Errors" + count badge)
│   │   └── ErrorsList
│   │       └── ErrorItem (repeated)
│   │           ├── ErrorSeverity (icon + color: warning | error | critical)
│   │           ├── ErrorAgent (who errored)
│   │           ├── ErrorMessage (truncated)
│   │           ├── ErrorTimestamp
│   │           └── ErrorAction ("View Details" → modal)
│   └── QuickActionsBar (col-span-12, bottom)
│       ├── QuickActionButton ("New Agent", icon: Plus)
│       ├── QuickActionButton ("Start Chat", icon: MessageSquare)
│       ├── QuickActionButton ("Run Cron", icon: Clock)
│       └── QuickActionButton ("Open Palette", icon: Search, ⌘K)
└── DashboardEmptyState (shown when zero agents exist)
    ├── EmptyIllustration
    ├── EmptyHeadline ("Your mission control awaits")
    ├── EmptyDescription
    └── CreateFirstAgentButton
```

**Component props:**

| Component | Key Props |
|-----------|-----------|
| `StatCard` | `icon: LucideIcon`, `value: number`, `label: string`, `trend?: { value: number; direction: 'up' | 'down' }`, `sparklineData?: number[]`, `variant: string`, `loading: boolean` |
| `LiveAgentCard` | `agent: Agent`, `currentActivity?: string`, `sessionCount: number`, `tokenUsage: number`, `onChat: () => void`, `onView: () => void` |
| `ActivityTimelineItem` | `event: ActivityEvent`, `onAction?: () => void` |
| `ToolCallItem` | `toolCall: ActiveToolCall`, `agentName: string`, `agentEmoji: string` |
| `ErrorItem` | `error: RecentError`, `onViewDetails: () => void` |
| `ConnectionStatusBadge` | `status: 'live' | 'polling' | 'disconnected'` |
| `AnimatedCounter` | `value: number`, `duration?: number`, `formatter?: (v: number) => string` |

### Interaction Patterns

**Auto-update behavior:**
- All stat cards update within 500ms of gateway event
- `AnimatedCounter` smoothly interpolates from old value to new value over `500ms`
- Sparkline charts append new data points and shift left (sliding window, 60 points)
- Activity timeline prepends new events at top with `slideInFromTop` animation (`200ms`)
- Agent cards update status ring color and activity text instantly

**User interactions:**
1. **Click LiveAgentCard** → navigate to `/agents/[id]`
2. **Hover LiveAgentCard** → show quick action buttons (Chat, View, Pause) with `opacity: 0 → 1, 150ms`
3. **Click "Approve" on ActivityTimelineItem** → calls `sessions.approve` RPC, item updates to "Approved ✓"
4. **Click error item "View Details"** → opens `ErrorDetailModal` with full stack trace, session context, and "Restart Session" button
5. **Toggle time range** → stat card values recalculate, sparkline data reloads
6. **Pull-to-refresh (mobile)** → triggers full data refresh

**Keyboard shortcuts:**
- `R` — refresh all data
- `N` — create new agent (navigate to builder)
- `C` — start new chat
- `P` — open command palette
- `1-4` — focus stat cards for detail expansion

**Animations:**
- Stat card value change: number morphing animation via `AnimatedCounter` (`500ms`)
- New activity event: `translateY(-20px) → 0, opacity: 0 → 1` in `200ms ease-out`
- Agent status change: status ring color transition `300ms` + subtle scale pulse `scale(1.05)` in `200ms`
- Error appears: left border flash red `3 times` over `600ms`
- Pending approval count > 0: orange ring pulse animation, continuous, `2s` period

### Wireframe Description

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ┌─ Header ───────────────────────────────────────────────────────────┐ │
│ │ 📊 Mission Control           ● Live          [Live ▾] [⊞] [⛶]   │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Stats Row (grid-cols-4, gap-4) ──────────────────────────────────┐ │
│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │ │
│ │ │ ⚡ 4       │ │ 💬 12      │ │ ⚡ 1.2M    │ │ ⚠️ 3       │      │ │
│ │ │ Active     │ │ Sessions   │ │ Tokens     │ │ Approvals  │      │ │
│ │ │ Agents     │ │ Active     │ │ Today      │ │ Pending    │      │ │
│ │ │ ▁▂▃▅▇▅▃▂ │ │  ↑12%     │ │ ≈$2.34     │ │ (pulsing)  │      │ │
│ │ └────────────┘ └────────────┘ └────────────┘ └────────────┘      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Main Grid ───────────────────────────────────────────────────────┐ │
│ │                                                                    │ │
│ │ ┌─ Agent Grid (col-span-8) ────────────────────┐ ┌─ Activity ──┐ │ │
│ │ │ Your Agents                        [Grid|List]│ │ Activity    │ │ │
│ │ │                                               │ │             │ │ │
│ │ │ ┌──────────┐ ┌──────────┐ ┌──────────┐      │ │ 🟢 Xavier   │ │ │
│ │ │ │ 🧠 Xavier│ │ 🎨 Luis  │ │ 📣Stephan│      │ │ spawned     │ │ │
│ │ │ │ ● Active │ │ ● Active │ │ ○ Idle   │      │ │ Harry (2m)  │ │ │
│ │ │ │ Editing  │ │ Writing  │ │          │      │ │             │ │ │
│ │ │ │ file...  │ │ spec...  │ │          │      │ │ 🔧 Luis     │ │ │
│ │ │ │ 3 sess   │ │ 2 sess   │ │ 0 sess   │      │ │ tool:exec   │ │ │
│ │ │ │ ████░░   │ │ ██░░░░   │ │ ░░░░░░   │      │ │ (5m ago)    │ │ │
│ │ │ └──────────┘ └──────────┘ └──────────┘      │ │             │ │ │
│ │ │ ┌──────────┐ ┌──────────┐ ┌──────────┐      │ │ 🔴 Roman   │ │ │
│ │ │ │ 🏗️ Tim   │ │ ⚡ Harry │ │ 🔬 Roman │      │ │ error:     │ │ │
│ │ │ │ ◌ Offline│ │ ● Active │ │ ✕ Error  │      │ │ timeout    │ │ │
│ │ │ │          │ │ Running  │ │ Failed   │      │ │ (8m ago)    │ │ │
│ │ │ │          │ │ tests... │ │ at 10:32 │      │ │             │ │ │
│ │ │ └──────────┘ └──────────┘ └──────────┘      │ │ ⚠️ 3 pending│ │ │
│ │ └───────────────────────────────────────────────┘ │ approvals  │ │ │
│ │                                                    │ [Approve]  │ │ │
│ │ ┌─ Tool Calls (col-span-6) ─┐ ┌─ Errors ────────┐│            │ │ │
│ │ │ Active Tool Calls (3)      │ │ Recent Errors (2)││            │ │ │
│ │ │                            │ │                  ││            │ │ │
│ │ │ 🧠 Xavier: exec           │ │ 🔬 Roman         ││            │ │ │
│ │ │ "npm test" — 12s ●        │ │ Session timeout  │└────────────┘ │ │
│ │ │                            │ │ 8 min ago [View] │              │ │
│ │ │ 🎨 Luis: browser          │ │                  │              │ │
│ │ │ "snapshot" — 3s ●         │ │ ⚡ Harry          │              │ │
│ │ │                            │ │ Tool exec failed │              │ │
│ │ │ ⚡ Harry: read             │ │ 22 min ago [View]│              │ │
│ │ │ "package.json" — 1s ●     │ │                  │              │ │
│ │ └────────────────────────────┘ └──────────────────┘              │ │
│ │                                                                    │ │
│ │ ┌─ Quick Actions (col-span-12) ────────────────────────────────┐ │ │
│ │ │ [+ New Agent]  [💬 Start Chat]  [⏰ Run Cron]  [🔍 ⌘K]     │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Model & API Integration

**Gateway events consumed:**

| WebSocket Event | Dashboard Update |
|----------------|------------------|
| `agent.status` | Updates `LiveAgentCard` status ring + `StatCard` active count |
| `sessions.spawn` | Increments session count, adds activity timeline event, updates agent session badge |
| `sessions.end` | Decrements session count, adds timeline event |
| `chat.message` | Updates agent "current activity" text |
| `tool.start` | Adds item to `ActiveToolCallsPanel`, starts duration counter |
| `tool.end` | Removes item from tool calls panel (with fade-out) |
| `approval.request` | Increments pending approvals stat, adds timeline event with "Approve" button |
| `approval.resolve` | Decrements pending approvals, updates timeline item |
| `error` | Adds to errors panel, increments error count stat (if shown) |
| `usage.update` | Updates tokens stat card, sparkline data |

**Zustand store: `useDashboardStore`**

```typescript
interface DashboardState {
  // Layout
  layout: 'grid' | 'compact';
  timeRange: 'live' | '1h' | '24h' | '7d';

  // Real-time data
  activityEvents: ActivityEvent[];  // max 500, FIFO
  activeToolCalls: ActiveToolCall[];
  recentErrors: RecentError[];      // max 50
  pendingApprovals: PendingApproval[];

  // Stats
  stats: {
    activeAgents: number;
    activeSessions: number;
    tokensToday: number;
    tokensCost: number;
    pendingApprovalCount: number;
  };
  sparklineData: {
    agents: number[];      // last 60 data points
    sessions: number[];
    tokens: number[];
  };

  // Actions
  addActivityEvent: (event: ActivityEvent) => void;
  addToolCall: (call: ActiveToolCall) => void;
  removeToolCall: (callId: string) => void;
  addError: (error: RecentError) => void;
  updateStats: (partial: Partial<DashboardState['stats']>) => void;
  appendSparkline: (key: string, value: number) => void;
}

interface ActivityEvent {
  id: string;
  type: 'spawn' | 'end' | 'message' | 'tool' | 'error' | 'approval';
  agentId: string;
  agentName: string;
  agentEmoji: string;
  description: string;
  timestamp: string;
  actionable?: boolean;
  actionLabel?: string;
  actionCallback?: () => void;
}

interface ActiveToolCall {
  id: string;
  agentId: string;
  agentName: string;
  agentEmoji: string;
  toolName: string;
  toolArgs: string;      // truncated display string
  startedAt: string;
  status: 'running' | 'waiting';
}

interface RecentError {
  id: string;
  agentId: string;
  agentName: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  sessionId?: string;
  stackTrace?: string;
}

interface PendingApproval {
  id: string;
  agentId: string;
  agentName: string;
  description: string;
  timestamp: string;
  sessionId: string;
}
```

### Accessibility Considerations

- **ARIA landmarks:** Dashboard page uses `role="main"`. Stats row: `role="region"` with `aria-label="Dashboard statistics"`. Agent grid: `role="region"` with `aria-label="Agent status grid"`. Activity timeline: `role="log"` with `aria-live="polite"` for new events.
- **AnimatedCounter:** Uses `aria-live="off"` during animation, sets final value with `aria-live="polite"` on completion. Reduced motion: no animation, instant value update.
- **Live updates:** Activity timeline uses `aria-live="polite"` — screen reader announces new events without interrupting current speech. Error events use `aria-live="assertive"` for critical errors.
- **Color + icon:** All status indicators (active/idle/error/offline) use icon + text label + color. Never color alone.
- **Keyboard:** Tab through stat cards, agent cards, activity items, tool calls, errors. `Enter` on agent card navigates to agent detail. `Enter` on "Approve" button triggers approval.
- **Focus management:** When new error appears, focus is not forcibly moved (would be disruptive). Instead, a subtle toast appears with "View Error" link.
- **Reduced motion:** Sparkline animations disabled. Counter values update instantly. Activity items appear without slide animation.

### Phasing Plan

**Phase 1 — Static Dashboard with Live Data (3 days)**
- Replace `mockAgents` with real `agents.list` data from gateway
- Build `StatCard` component with `AnimatedCounter`
- Build `LiveAgentCard` with real agent data
- Wire `useAgentStore` to gateway (`agents.list` on mount)
- `ConnectionStatusBadge` component
- Basic layout: stats row + agent grid

**Phase 2 — WebSocket Events & Activity Timeline (4 days)**
- Subscribe to gateway WebSocket events (`agent.status`, `sessions.spawn`, `sessions.end`)
- Build `ActivityTimeline` with `@tanstack/react-virtual` virtualization
- Build `ActivityTimelineItem` with type-specific icons and descriptions
- Real-time stat card updates from events
- Sparkline data collection (1-minute intervals)
- Agent "current activity" text from `chat.message` events

**Phase 3 — Tool Calls, Errors, Approvals (3 days)**
- Build `ActiveToolCallsPanel` with live duration counters
- Build `RecentErrorsPanel` with `ErrorDetailModal`
- Build approval flow: pending approval items with "Approve" button
- Wire `tool.start` / `tool.end`, `error`, `approval.request` / `approval.resolve` events
- Pending approval stat card with pulsing animation

**Phase 4 — Polish & Quick Actions (2 days)**
- `QuickActionsBar` with keyboard shortcuts
- Layout toggle (grid/compact)
- Time range selector (recalculates stats for historical periods)
- `DashboardEmptyState` for zero-agent state
- Performance audit: ensure 60fps with 20+ agents and continuous events
- Mobile responsive layout (stack columns)

### Open Questions & Risks

1. **Event schema:** Need confirmation of exact WebSocket event payloads for `tool.start`, `tool.end`, `approval.request`, `error`. These are assumed based on gateway architecture but need verified field names and data shapes.
2. **Token usage tracking:** `usage.update` event may not exist as a real-time WebSocket event. May need to poll `usage.status` periodically (every 60s) and compute deltas.
3. **Performance at scale:** With 50+ agents each generating events, the activity timeline could receive >10 events/second. Need throttling: batch DOM updates, max 2 timeline prepends per second, queue excess.
4. **Historical stats:** "Last 24h" and "7d" time ranges require server-side aggregation. Does the gateway support `usage.history` or similar? If not, client can only show "Live" mode data.
5. **Approval UX:** "Approve" on the dashboard is a shortcut — users might need context. Consider showing the full approval request (what the agent wants to do, what tool, what params) in a confirmation dialog before executing.
6. **Dashboard as default page:** Should `/` redirect to `/dashboard` or `/chat`? The current flow redirects to `/chat`. Mission Control argues for `/dashboard` as the default for power users. Make this a user preference.

---

## 5. Contextual Empty States & Zero-Data Experiences

### Overview

Redesign every empty state across all 19 routes to be educational, actionable, and emotionally welcoming. Currently, empty states are either bare text ("No agents found") or missing entirely (blank page). The new design treats every empty state as a teaching opportunity: explain what this feature does, why it matters, show a custom illustration, provide a primary CTA to get started, and offer secondary links to documentation or related features. This is a low-complexity, high-impact improvement that dramatically improves the first-visit experience on every page.

### Technical Approach

- **Component:** A single, flexible `EmptyState` component with variants driven by props. No page-specific empty state components — one component rules them all, configured per route.
- **Illustrations:** SVG illustrations, either hand-crafted or from a library like `undraw.co` (MIT licensed). Each illustration is a React component for theming (fill colors adapt to dark/light mode). Lazy-loaded via `React.lazy` + `Suspense` with a small placeholder (colored blob) to avoid layout shift.
- **Copy:** All copy lives in a centralized `emptyStateContent.ts` constants file — not inline in components. This makes it easy to update copy, localize, or A/B test. Each entry includes: `title`, `description`, `primaryCta`, `secondaryCtas`, `tips`, and `illustration` key.
- **CTA wiring:** Primary CTAs are `<Link>` or `<Button>` components that navigate to the creation flow, open a wizard, or trigger a command palette action. Secondary CTAs link to docs (`docs.openclaw.ai/[topic]`) or related in-app pages.
- **Progressive disclosure:** For features with complexity (e.g., Cron), the empty state includes an expandable "What is this?" section with a brief explanation + animated GIF or static diagram showing the feature in action.
- **Animation:** Illustration entrance: `opacity: 0 → 1, scale: 0.9 → 1` in `400ms ease-out`. CTA buttons: `opacity: 0 → 1, y: 8 → 0` staggered `100ms` each. No continuous animations (empty states should feel calm, not busy).
- **Dark mode:** All illustrations use CSS custom properties for fills, automatically adapting to theme. Primary colors: `var(--violet-400)`, `var(--gray-700)`, accent: `var(--pink-400)`.

### Component Architecture

```
EmptyState (components/shared/EmptyState.tsx)
├── EmptyStateIllustration
│   └── LazyIllustration (React.lazy, per illustration key)
│       ├── IllustrationNoAgents (SVG component)
│       ├── IllustrationNoSessions (SVG component)
│       ├── IllustrationNoCron (SVG component)
│       ├── IllustrationNoSkills (SVG component)
│       ├── IllustrationNoChannels (SVG component)
│       ├── IllustrationNoNodes (SVG component)
│       ├── IllustrationNoUsage (SVG component)
│       ├── IllustrationNoChat (SVG component)
│       ├── IllustrationNoFiles (SVG component)
│       ├── IllustrationNoErrors (SVG component — happy state!)
│       ├── IllustrationSetupRequired (SVG component)
│       ├── IllustrationGatewayDown (SVG component)
│       └── IllustrationGeneric (SVG component — fallback)
├── EmptyStateContent
│   ├── EmptyStateIcon (emoji or Lucide icon, above title)
│   ├── EmptyStateTitle (text-xl font-semibold)
│   ├── EmptyStateDescription (text-sm text-gray-400, max-w-md)
│   └── EmptyStateTips (optional, expandable "What is this?" accordion)
│       └── EmptyStateTipItem (icon + text)
├── EmptyStateCTAs
│   ├── EmptyStatePrimaryCTA (Button variant: default, size: lg)
│   └── EmptyStateSecondaryCTAs (flex gap-3)
│       └── EmptyStateSecondaryLink (text-sm text-violet-400 hover:underline)
└── EmptyStateTemplateGallery (optional, for agents page only)
    └── TemplateQuickCard (mini template card: icon + name + "Use" button)
```

**Component props:**

```typescript
interface EmptyStateProps {
  illustration: IllustrationKey;       // "no-agents" | "no-sessions" | etc.
  icon?: string | React.ReactNode;     // emoji or Lucide icon
  title: string;
  description: string;
  primaryCta?: {
    label: string;
    href?: string;                     // for Link-based CTAs
    onClick?: () => void;              // for action-based CTAs
    icon?: React.ReactNode;
  };
  secondaryCtas?: {
    label: string;
    href: string;
    external?: boolean;                // opens in new tab
  }[];
  tips?: {
    icon: string;
    text: string;
  }[];
  templates?: AgentTemplate[];         // optional template gallery
  className?: string;
}

type IllustrationKey =
  | 'no-agents'
  | 'no-sessions'
  | 'no-cron'
  | 'no-skills'
  | 'no-channels'
  | 'no-nodes'
  | 'no-usage'
  | 'no-chat'
  | 'no-files'
  | 'no-errors'
  | 'setup-required'
  | 'gateway-down'
  | 'search-empty'
  | 'generic';
```

### Interaction Patterns

**User flow (example: Agents page, no agents):**
1. User navigates to `/agents` → no agents exist
2. `EmptyState` renders with the "no-agents" illustration (friendly robot looking curious)
3. Title: "Create your first agent" — Description: "Agents are AI teammates that know you, your work, and your tools. They persist across sessions and get better over time."
4. Primary CTA: "Create Agent" button → navigates to `/agents/new`
5. Secondary CTAs: "Browse templates" (→ template gallery modal), "Read the docs" (→ `docs.openclaw.ai/agents`)
6. Tips: "💡 Agents have memory — they remember past conversations" / "⚡ Start with a template and customize later" / "🔄 Agents can spawn sub-agents for parallel work"
7. Bottom: Template gallery showing 3-4 quick-start templates with "Use this" buttons

**CTA behaviors:**
- Primary CTA buttons have `hover:scale-[1.02]` + `shadow-lg` transition in `150ms`
- Secondary links have `hover:underline` + color shift
- "What is this?" accordion uses Radix `<Collapsible>` with height animation `200ms`
- Template cards have hover lift effect: `translateY(-2px)` + `shadow-md` in `150ms`

**Emotional design:**
- Illustrations are warm, friendly, slightly whimsical (not corporate-sterile)
- Titles are encouraging ("Create your first agent" not "No agents found")
- Descriptions explain value, not just state ("Agents are AI teammates..." not "You have no agents")
- Happy-path empty states (no errors) show a celebration illustration and positive copy: "All clear! No errors to report. 🎉"

### Wireframe Description

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│ [Page header: "Agents" or "Cron Jobs" etc. — same as normal page]      │
│                                                                         │
│ ┌─ Empty State Container (flex-col items-center, py-20, mx-auto) ────┐ │
│ │                                                                      │ │
│ │        ┌───────────────────────────┐                                 │ │
│ │        │                           │                                 │ │
│ │        │   [SVG Illustration]      │  ← 200x160px, themed colors    │ │
│ │        │   (friendly robot /       │    Framer entrance animation    │ │
│ │        │    empty desk / etc.)     │                                 │ │
│ │        │                           │                                 │ │
│ │        └───────────────────────────┘                                 │ │
│ │                                                                      │ │
│ │        🤖                                    ← Icon/emoji, 32px     │ │
│ │                                                                      │ │
│ │        Create your first agent               ← Title, text-xl       │ │
│ │                                              font-semibold, white   │ │
│ │                                                                      │ │
│ │        Agents are AI teammates that know     ← Description, text-sm │ │
│ │        you, your work, and your tools.       text-gray-400, max-w-md│ │
│ │        They persist across sessions and                              │ │
│ │        get better over time.                                         │ │
│ │                                                                      │ │
│ │        [+ Create Agent]                      ← Primary CTA, violet  │ │
│ │                                              bg, rounded-xl, px-6   │ │
│ │                                                                      │ │
│ │        Browse templates · Read the docs      ← Secondary links,     │ │
│ │                                              text-sm, text-violet-400│ │
│ │                                                                      │ │
│ │        ─── What are agents? ─── [▾ expand]   ← Collapsible tips     │ │
│ │                                                                      │ │
│ │        (expanded:)                                                   │ │
│ │        💡 Agents have memory — they remember past conversations     │ │
│ │        ⚡ Start with a template and customize later                 │ │
│ │        🔄 Agents can spawn sub-agents for parallel work             │ │
│ │                                                                      │ │
│ │        ─── Quick Start Templates ───                                 │ │
│ │        ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │ │
│ │        │ 🧑‍💼      │ │ 💻      │ │ 🔬      │ │ ✨      │         │ │
│ │        │ Personal │ │ Coder   │ │Researcher│ │ Custom  │         │ │
│ │        │Assistant │ │         │ │          │ │         │         │ │
│ │        │ [Use →]  │ │ [Use →] │ │ [Use →]  │ │ [Use →] │         │ │
│ │        └──────────┘ └──────────┘ └──────────┘ └──────────┘         │ │
│ │                                                                      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Model & API Integration

**No real-time data needed.** Empty states are rendered when the corresponding data store reports zero items. The `EmptyState` component is purely presentational — it receives content via props, which are configured per-route in the `emptyStateContent.ts` constants file.

**Content registry:**

```typescript
// lib/emptyStateContent.ts

interface EmptyStateContent {
  illustration: IllustrationKey;
  icon: string;
  title: string;
  description: string;
  primaryCta: { label: string; href?: string; action?: string };
  secondaryCtas: { label: string; href: string; external?: boolean }[];
  tips: { icon: string; text: string }[];
}

const EMPTY_STATE_CONTENT: Record<string, EmptyStateContent> = {
  agents: {
    illustration: 'no-agents',
    icon: '🤖',
    title: 'Create your first agent',
    description: 'Agents are AI teammates that know you, your work, and your tools. They persist across sessions and get better over time.',
    primaryCta: { label: 'Create Agent', href: '/agents/new' },
    secondaryCtas: [
      { label: 'Browse templates', href: '/agents/new?tab=templates' },
      { label: 'Read the docs', href: 'https://docs.openclaw.ai/agents', external: true },
    ],
    tips: [
      { icon: '💡', text: 'Agents have memory — they remember past conversations' },
      { icon: '⚡', text: 'Start with a template and customize later' },
      { icon: '🔄', text: 'Agents can spawn sub-agents for parallel work' },
    ],
  },
  sessions: {
    illustration: 'no-sessions',
    icon: '💬',
    title: 'No sessions yet',
    description: 'Sessions are conversations between you and your agents. Start a chat to create your first session.',
    primaryCta: { label: 'Start a Chat', href: '/chat' },
    secondaryCtas: [
      { label: 'What are sessions?', href: 'https://docs.openclaw.ai/sessions', external: true },
    ],
    tips: [
      { icon: '📋', text: 'Sessions persist — pick up where you left off' },
      { icon: '🌳', text: 'Sessions can branch into sub-agent trees' },
    ],
  },
  cron: {
    illustration: 'no-cron',
    icon: '⏰',
    title: 'Schedule automated tasks',
    description: 'Cron jobs let your agents work on a schedule — daily standups, weekly reports, periodic health checks. Set it and forget it.',
    primaryCta: { label: 'Create Schedule', href: '/cron/new' },
    secondaryCtas: [
      { label: 'Cron expression guide', href: 'https://docs.openclaw.ai/cron', external: true },
    ],
    tips: [
      { icon: '🔁', text: 'Cron jobs run even when you\'re not around' },
      { icon: '📊', text: 'Great for daily summaries, health checks, and reports' },
      { icon: '⚙️', text: 'Use natural language: "Every weekday at 9am"' },
    ],
  },
  skills: {
    illustration: 'no-skills',
    icon: '⚡',
    title: 'Supercharge your agents',
    description: 'Skills are plug-and-play capability packs. Install skills to give agents new abilities — web search, file management, coding, and more.',
    primaryCta: { label: 'Browse ClawhHub', href: '/skills' },
    secondaryCtas: [
      { label: 'Create a skill', href: 'https://docs.openclaw.ai/skills/create', external: true },
    ],
    tips: [
      { icon: '🧩', text: 'Skills bundle tools, knowledge, and configuration together' },
      { icon: '🌐', text: 'Find community skills on ClawhHub' },
    ],
  },
  channels: {
    illustration: 'no-channels',
    icon: '🔌',
    title: 'Connect your first channel',
    description: 'Channels are where your agents live — Slack, Discord, Telegram, WhatsApp, and more. Connect a channel to start chatting with your agents where you already work.',
    primaryCta: { label: 'Connect Channel', action: 'wizard:add-channel' },
    secondaryCtas: [
      { label: 'Supported channels', href: 'https://docs.openclaw.ai/channels', external: true },
      { label: 'Use webchat instead', href: '/chat' },
    ],
    tips: [
      { icon: '💬', text: 'Agents respond on the same channel they receive messages' },
      { icon: '🔗', text: 'Connect multiple channels — agents adapt to each' },
    ],
  },
  nodes: {
    illustration: 'no-nodes',
    icon: '📱',
    title: 'Pair a device',
    description: 'Nodes are other devices paired to your OpenClaw instance — phones, tablets, other computers. They extend your agents\' reach with cameras, screens, location, and more.',
    primaryCta: { label: 'Pair Device', action: 'wizard:pair-device' },
    secondaryCtas: [
      { label: 'What can nodes do?', href: 'https://docs.openclaw.ai/nodes', external: true },
    ],
    tips: [
      { icon: '📷', text: 'Agents can use your phone camera' },
      { icon: '📍', text: 'Share location for location-aware tasks' },
      { icon: '🖥️', text: 'Pair a server for always-on capabilities' },
    ],
  },
  analytics: {
    illustration: 'no-usage',
    icon: '📈',
    title: 'Usage data will appear here',
    description: 'Once your agents start working, you\'ll see token usage, costs, and performance metrics here. Start a conversation to generate your first data.',
    primaryCta: { label: 'Start a Chat', href: '/chat' },
    secondaryCtas: [],
    tips: [
      { icon: '💰', text: 'Track costs per agent, per model, per day' },
      { icon: '📊', text: 'Identify your most active agents and optimize' },
    ],
  },
  chat: {
    illustration: 'no-chat',
    icon: '💬',
    title: 'Start a conversation',
    description: 'Chat with your agents directly. Ask questions, assign tasks, or just say hello.',
    primaryCta: { label: 'New Chat', action: 'new-chat' },
    secondaryCtas: [
      { label: 'Chat tips', href: 'https://docs.openclaw.ai/chat', external: true },
    ],
    tips: [],
  },
  'search-empty': {
    illustration: 'search-empty',
    icon: '🔍',
    title: 'No results found',
    description: 'Try adjusting your search terms or clearing filters.',
    primaryCta: { label: 'Clear Filters', action: 'clear-filters' },
    secondaryCtas: [],
    tips: [],
  },
  'gateway-down': {
    illustration: 'gateway-down',
    icon: '🔌',
    title: 'Gateway not connected',
    description: 'OpenClaw can\'t reach the Gateway. Make sure it\'s running on your machine.',
    primaryCta: { label: 'Retry Connection', action: 'retry-gateway' },
    secondaryCtas: [
      { label: 'Troubleshooting guide', href: 'https://docs.openclaw.ai/troubleshooting', external: true },
    ],
    tips: [
      { icon: '💻', text: 'Run `openclaw gateway start` in your terminal' },
      { icon: '🔧', text: 'Default port: 18789' },
    ],
  },
  errors: {
    illustration: 'no-errors',
    icon: '🎉',
    title: 'All clear!',
    description: 'No errors to report. Your agents are running smoothly.',
    primaryCta: undefined,
    secondaryCtas: [],
    tips: [],
  },
  'agent-files': {
    illustration: 'no-files',
    icon: '📁',
    title: 'No workspace files',
    description: 'This agent\'s workspace is empty. Files like SOUL.md, AGENTS.md, and MEMORY.md will appear here as the agent works.',
    primaryCta: { label: 'Add File', action: 'add-file' },
    secondaryCtas: [
      { label: 'Workspace structure', href: 'https://docs.openclaw.ai/workspace', external: true },
    ],
    tips: [],
  },
  settings: {
    illustration: 'generic',
    icon: '⚙️',
    title: 'Nothing configured yet',
    description: 'Run the setup wizard to configure your OpenClaw instance.',
    primaryCta: { label: 'Run Setup', href: '/setup' },
    secondaryCtas: [],
    tips: [],
  },
};
```

**Integration points:**

| Route | Empty Condition | Content Key |
|-------|----------------|-------------|
| `/agents` | `agentStore.agents.length === 0` | `agents` |
| `/sessions` | `sessionStore.sessions.length === 0` | `sessions` |
| `/cron` | `cronStore.jobs.length === 0` | `cron` |
| `/skills` | `skillStore.installed.length === 0` | `skills` |
| `/channels` | `channelStore.channels.length === 0` | `channels` |
| `/nodes` | `nodeStore.nodes.length === 0` | `nodes` |
| `/analytics` | `usageStore.records.length === 0` | `analytics` |
| `/chat` (no history) | `chatStore.sessions.length === 0` | `chat` |
| `/agents/[id]/files` | `agent.files.length === 0` | `agent-files` |
| `/settings/config` | `configStore.values === null` | `settings` |
| Any page, gateway down | `gatewayStore.connected === false` | `gateway-down` |
| Any search with 0 results | `filteredResults.length === 0` | `search-empty` |
| Dashboard errors panel | `dashboardStore.errors.length === 0` | `errors` |

### Accessibility Considerations

- **ARIA:** `EmptyState` container has `role="status"` with `aria-label="No [items] found"`. Primary CTA is auto-focused after render (`autoFocus` or `useEffect` focus) so keyboard users can immediately act.
- **Illustrations:** SVG illustrations have `role="img"` with descriptive `aria-label` (e.g., "Illustration of a friendly robot looking for agents"). Decorative elements use `aria-hidden="true"`.
- **Links:** External links have `aria-label` including "(opens in new tab)" suffix. Use `target="_blank"` with `rel="noopener noreferrer"`.
- **Expandable tips:** Radix `<Collapsible>` with `aria-expanded` state. Trigger button: "Learn more about [feature]".
- **Color contrast:** Illustration colors meet AA contrast against `bg-gray-950`. Title text: white (`#fff`) on gray-950 = 15.4:1. Description: `text-gray-400` (`#9ca3af`) on gray-950 = 6.1:1 (passes AA).
- **Focus visible:** CTA buttons show focus ring `ring-2 ring-violet-500 ring-offset-2 ring-offset-gray-950`.

### Phasing Plan

**Phase 1 — Core Component & High-Traffic Routes (2 days)**
- Build `EmptyState` component with all sub-components
- Build `IllustrationGeneric` fallback SVG illustration
- Create `emptyStateContent.ts` with all 14 content entries
- Integrate into top-5 routes: `/agents`, `/chat`, `/sessions`, `/dashboard` (no agents), `/cron`
- Wire CTAs to navigation and actions

**Phase 2 — All Routes & Illustrations (3 days)**
- Create or source SVG illustrations for all 13 `IllustrationKey` variants
- Theme illustrations for dark/light mode via CSS custom properties
- Integrate into remaining routes: `/skills`, `/channels`, `/nodes`, `/analytics`, `/settings`, `/agents/[id]/files`
- Add `gateway-down` empty state to all pages (connection-dependent)
- Add `search-empty` empty state to all searchable views

**Phase 3 — Template Gallery & Tips (2 days)**
- Build `EmptyStateTemplateGallery` + `TemplateQuickCard` for agents page
- Implement expandable tips with Radix `<Collapsible>`
- Add entrance animations (Framer Motion)
- Copy review and refinement with product/content team

**Phase 4 — Polish & Proficiency Adaptation (1 day)**
- Adapt copy for proficiency levels (beginner gets more detail, expert gets less)
- Accessibility audit (axe-core, VoiceOver testing)
- Lazy-load illustrations with `React.lazy` + `Suspense`
- Final visual polish: spacing, typography, illustration sizing

### Open Questions & Risks

1. **Illustration sourcing:** Do we create custom illustrations or use a library (undraw.co, storyset.com)? Custom is more on-brand but slower. Recommendation: start with undraw or Storyset illustrations (MIT licensed), plan custom replacements for v2.
2. **Copy quality:** Empty state copy is critical — it sets the tone. Need review by Stephan (CMO) for voice/brand consistency. Propose a copy review session.
3. **Template content:** The template gallery on the agents empty state needs real template data. Where do templates live — hardcoded, fetched from ClawhHub, or defined in the gateway? Start with 4 hardcoded templates, migrate to ClawhHub API later.
4. **Gateway-down state:** The `gateway-down` empty state preempts all other empty states on every page. Need to handle the case where gateway goes down mid-session (data already loaded but connection lost) — show a top banner, not replace the whole page.
5. **Empty state fatigue:** If users see empty states on every page during first visit, it may feel overwhelming. Consider a sequential reveal — dashboard empty state encourages creating an agent, agents page empty state appears only after visiting agents, etc.
6. **Performance:** 13 SVG illustrations loaded lazily. Need to ensure React.lazy + Suspense doesn't cause visible loading spinners. Preload illustrations for the current route's empty state during page transition.

---

*End of Tier 1 UI Specs — Ready for architecture review and phasing into sprint planning.*


---

# TIER 2 — NEXT SPRINT

# Tier 2 UI Implementation Specs

**Author:** Luis, Principal UX Engineer
**Date:** 2026-02-21
**Status:** Draft — Ready for Review
**Scope:** Ideas 6–10 from OpenClaw UI ideation

---

## IDEA 6: Adaptive Progressive Disclosure System (Proficiency 2.0)

### 6.1 Overview

Evolve the current 3-tier global proficiency system (Beginner / Standard / Expert) into a continuous, context-aware, per-feature disclosure engine. Instead of a single global toggle that dumbs down or powers up the entire UI, each feature area independently tracks user engagement and adapts its complexity accordingly. A user who has never touched cron scheduling sees a simplified "Schedule a task" card with plain language, while a power user who has created 20 cron jobs sees the full cron expression editor, history table, and bulk operations. A persistent "Teach me" affordance on any simplified surface expands inline with progressive explanations, bridging the gap between modes.

### 6.2 Technical Approach

**Framework & Libraries:**
- React 18+ with Suspense boundaries for deferred rendering of complex views
- Zustand v4 for per-feature proficiency state (replaces current global `useProficiencyStore`)
- `immer` middleware in Zustand for immutable state updates on nested feature maps
- `zod` for runtime validation of proficiency rule definitions
- `framer-motion` for layout animations when transitioning between disclosure levels
- CSS Modules + Tailwind utility classes for conditional styling per disclosure tier

**Rendering Strategy:**
- Replace current `<ComplexityGate>` wrapper with new `<DisclosureGate featureKey={string} minLevel={number}>` component
- Rendering is conditional: children only mount when the user's computed proficiency for `featureKey` meets or exceeds `minLevel`
- Proficiency levels are continuous floats 0.0–1.0 (not discrete tiers), mapped to thresholds per feature
- Server-side proficiency data synced on session init; client updates are optimistic with periodic flush

**Data Flow:**
```
User Action → FeatureUsageTracker middleware → Zustand featureProficiency store
  → DisclosureGate reads store → conditional render
  → Periodic flush to server (POST /api/proficiency/sync)
  → Server aggregates across sessions/devices
```

### 6.3 Component Architecture

```
<App>
  └─ <ProficiencyProvider>          // Context provider, initializes store from API
       ├─ <FeatureUsageTracker>     // Invisible, intercepts feature interactions
       └─ <Page>
            ├─ <DisclosureGate featureKey="cron" minLevel={0.0}>
            │    └─ <CronSimplifiedView>
            │         ├─ <TeachMeButton featureKey="cron" />
            │         └─ <SimpleSchedulePicker />
            ├─ <DisclosureGate featureKey="cron" minLevel={0.4}>
            │    └─ <CronStandardView>
            │         ├─ <CronExpressionInput />
            │         ├─ <CronPreview />
            │         └─ <TeachMeButton featureKey="cron" />
            ├─ <DisclosureGate featureKey="cron" minLevel={0.8}>
            │    └─ <CronPowerView>
            │         ├─ <CronExpressionInput advanced />
            │         ├─ <CronHistoryTable />
            │         ├─ <BulkCronOperations />
            │         └─ <CronTemplateLibrary />
            └─ <DisclosureGate featureKey="skills" minLevel={0.0}>
                 └─ <SkillListSimplified />
```

**Key Components:**

| Component | Props | Responsibility |
|-----------|-------|----------------|
| `ProficiencyProvider` | `children`, `initialData?: FeatureProficiencyMap` | Hydrates Zustand store from server data on mount |
| `FeatureUsageTracker` | `children` | Middleware component; listens to route changes & UI events, increments feature usage counters |
| `DisclosureGate` | `featureKey: string`, `minLevel: number`, `maxLevel?: number`, `fallback?: ReactNode`, `children` | Reads proficiency for `featureKey`, renders children only if level is within range |
| `TeachMeButton` | `featureKey: string`, `topic?: string`, `variant?: 'inline' | 'popover' | 'panel'` | Renders expandable educational content; clicking increments proficiency slightly |
| `TeachMePanel` | `featureKey: string`, `topic: string`, `isOpen: boolean`, `onClose: () => void` | Slide-over panel with structured educational content (steps, examples, links) |
| `ProficiencyDebugOverlay` | `enabled: boolean` | Dev-only overlay showing all feature proficiency values as colored badges |
| `ProficiencyResetButton` | `featureKey?: string` | Resets proficiency for one or all features (in settings) |

**Zustand Store — `useFeatureProficiencyStore`:**

```typescript
interface FeatureUsageRecord {
  featureKey: string;
  actionCount: number;
  uniqueActionTypes: Set<string>;
  firstUsed: string;       // ISO date
  lastUsed: string;        // ISO date
  teachMeViews: number;
  errorCount: number;
  computedLevel: number;   // 0.0–1.0, derived
}

interface FeatureProficiencyState {
  features: Record<string, FeatureUsageRecord>;
  globalOverride: number | null;  // null = adaptive, number = forced level
  isLoaded: boolean;

  // Actions
  trackAction: (featureKey: string, actionType: string) => void;
  trackTeachMe: (featureKey: string) => void;
  trackError: (featureKey: string) => void;
  getLevel: (featureKey: string) => number;
  setGlobalOverride: (level: number | null) => void;
  resetFeature: (featureKey: string) => void;
  resetAll: () => void;
  syncFromServer: (data: FeatureProficiencyMap) => void;
  flushToServer: () => Promise<void>;
}
```

**Proficiency Rules Engine:**

```typescript
interface ProficiencyRule {
  featureKey: string;
  thresholds: {
    level: number;        // 0.0–1.0
    requires: {
      minActions?: number;
      minUniqueActions?: number;
      minDaysActive?: number;
      minTeachMeViews?: number;
    };
  }[];
}

// Example rule
const cronRule: ProficiencyRule = {
  featureKey: 'cron',
  thresholds: [
    { level: 0.0, requires: {} },                                    // Everyone starts here
    { level: 0.3, requires: { minActions: 3 } },                      // Used cron 3x
    { level: 0.5, requires: { minActions: 8, minUniqueActions: 3 } }, // Diverse usage
    { level: 0.8, requires: { minActions: 20, minDaysActive: 5 } },  // Power user
    { level: 1.0, requires: { minActions: 50, minDaysActive: 14, minUniqueActions: 6 } },
  ],
};
```

### 6.4 Interaction Patterns

**Progressive Reveal Flow:**
1. User lands on a feature area for the first time → sees simplified view (level 0.0)
2. User performs actions → `FeatureUsageTracker` increments counters silently
3. When threshold crossed → next-level UI elements fade in with `framer-motion` `layoutId` animations (300ms ease-out)
4. Brief toast: "🎓 You've unlocked advanced cron options" (auto-dismiss 4s)
5. New elements appear with subtle highlight pulse (1 cycle, 600ms)

**"Teach Me" Flow:**
1. User clicks `<TeachMeButton>` on simplified view
2. Inline accordion expands below the button (250ms slide-down, `framer-motion`)
3. Content shows: explanation paragraph → interactive example → "Try it" CTA → external doc link
4. Viewing "Teach Me" content increments `teachMeViews` counter (counts toward proficiency)
5. `Escape` key or click-outside collapses the accordion

**Manual Override:**
- Settings → Preferences → "UI Complexity" section
- Toggle: "Let OpenClaw adapt" (default on) vs "Set manually"
- If manual: slider from "Simplified" to "Full Power" (maps to 0.0–1.0)
- Per-feature overrides available in expandable "Advanced" section
- Keyboard shortcut: `Ctrl+Shift+U` toggles between adaptive and full-power globally

**Animations:**
- Disclosure transition: `framer-motion layout` with `duration: 0.3`, `ease: [0.25, 0.1, 0.25, 1]`
- Teach Me expand: `AnimatePresence` with `initial={{ height: 0, opacity: 0 }}`, `animate={{ height: 'auto', opacity: 1 }}`, `transition={{ duration: 0.25 }}`
- Unlock toast: slide-in from top-right, `duration: 0.4`, auto-dismiss after 4s with fade-out 0.3s
- New element highlight: `@keyframes pulseHighlight` — box-shadow pulse from `ring-2 ring-blue-400/50` to `ring-0`, 600ms

### 6.5 Wireframe Description

**Simplified Cron View (Level 0.0–0.3):**
```
┌─────────────────────────────────────────────────────┐
│  Schedule a Task                              [?]   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Run this task:                              │   │
│  │  ○ Every hour   ○ Every day   ○ Every week  │   │
│  │                                              │   │
│  │  At: [ 9:00 AM ▾ ]                          │   │
│  │  On: [ Monday  ▾ ] (if weekly)              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────┐          │
│  │ 💡 Teach me about scheduling →       │          │
│  └──────────────────────────────────────┘          │
│                                                     │
│  [ Cancel ]                    [ Save Schedule ]    │
└─────────────────────────────────────────────────────┘
```

**Standard Cron View (Level 0.3–0.8):**
```
┌─────────────────────────────────────────────────────┐
│  Schedule Configuration                       [?]   │
│                                                     │
│  Quick Pick:  [Hourly] [Daily] [Weekly] [Custom]   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Cron Expression: [ */15 * * * *          ] │   │
│  │  ↳ "Every 15 minutes"            [Validate] │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Next 5 runs:                                      │
│  • Sat Feb 21, 11:00 AM                            │
│  • Sat Feb 21, 11:15 AM                            │
│  • Sat Feb 21, 11:30 AM                            │
│  • Sat Feb 21, 11:45 AM                            │
│  • Sat Feb 21, 12:00 PM                            │
│                                                     │
│  ┌──────────────────────────────────────┐          │
│  │ 💡 Teach me about cron expressions → │          │
│  └──────────────────────────────────────┘          │
│                                                     │
│  [ Cancel ]                    [ Save Schedule ]    │
└─────────────────────────────────────────────────────┘
```

**Power Cron View (Level 0.8–1.0):**
```
┌─────────────────────────────────────────────────────────────────┐
│  Cron Scheduling                           [Templates] [Bulk]  │
│                                                                 │
│  Expression: [ */15 9-17 * * 1-5 ]  [Validate] [Copy]         │
│  ↳ "Every 15 min, 9AM-5PM, Mon-Fri"                           │
│                                                                 │
│  ┌──── Builder ─────┬──── Preview ──────┬──── History ────┐   │
│  │ Min  [ */15    ] │ Next 10 runs:     │ Last 20 runs:   │   │
│  │ Hour [ 9-17    ] │ • Feb 21 11:00 ✓ │ • Feb 21 10:45 │   │
│  │ Day  [ *       ] │ • Feb 21 11:15   │ • Feb 21 10:30 │   │
│  │ Mon  [ *       ] │ • Feb 21 11:30   │ • Feb 21 10:15 │   │
│  │ DOW  [ 1-5     ] │ • ...            │ • ...           │   │
│  │                  │                   │ Avg: 2.1s       │   │
│  │ [+Condition]     │ Timezone: MST ▾   │ Errors: 0       │   │
│  └──────────────────┴───────────────────┴─────────────────┘   │
│                                                                 │
│  [ Cancel ]   [ Save as Template ]        [ Save Schedule ]    │
└─────────────────────────────────────────────────────────────────┘
```

**Proficiency Settings Panel:**
```
┌────────────────────────────────────────────────────┐
│  UI Complexity Preferences                         │
│                                                    │
│  ◉ Let OpenClaw adapt (recommended)                │
│  ○ Set manually                                    │
│                                                    │
│  Feature Proficiency Levels:                       │
│  ┌──────────────────────────────────────────┐     │
│  │ Scheduling (cron)     ████████░░  0.78   │     │
│  │ Skills Management     ██████░░░░  0.55   │     │
│  │ Agent Configuration   ████░░░░░░  0.35   │     │
│  │ Node Management       ██░░░░░░░░  0.15   │     │
│  │ Workflow Builder       ░░░░░░░░░░  0.00   │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  ▸ Advanced: Per-feature overrides                 │
│                                                    │
│  [ Reset All to Beginner ]                         │
└────────────────────────────────────────────────────┘
```

### 6.6 Data Model & API Integration

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/proficiency` | Fetch all feature proficiency data for current user |
| `POST` | `/api/proficiency/sync` | Batch-sync client-side usage events (called every 60s or on page unload) |
| `PUT` | `/api/proficiency/override` | Set global or per-feature manual override |
| `DELETE` | `/api/proficiency/reset` | Reset proficiency for one feature or all |
| `GET` | `/api/proficiency/rules` | Fetch proficiency rules (for admin/debug) |

**Request/Response Shapes:**

```typescript
// GET /api/proficiency response
interface ProficiencyResponse {
  features: Record<string, {
    level: number;
    actionCount: number;
    uniqueActionTypes: string[];
    firstUsed: string | null;
    lastUsed: string | null;
    teachMeViews: number;
  }>;
  globalOverride: number | null;
  featureOverrides: Record<string, number>;
}

// POST /api/proficiency/sync request
interface ProficiencySyncRequest {
  events: Array<{
    featureKey: string;
    actionType: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
}
```

**Zustand Store Integration:**
- Store hydrated from `GET /api/proficiency` on app init (inside `ProficiencyProvider`)
- Client-side events buffered in array, flushed via `POST /api/proficiency/sync` every 60 seconds
- `beforeunload` listener triggers final sync flush via `navigator.sendBeacon`
- Global override stored in both Zustand and `localStorage` for instant reads

**Initial Feature Keys (4-5 key surfaces):**
1. `cron` — Cron scheduling
2. `skills` — Skill management & configuration
3. `agents` — Agent setup & configuration
4. `nodes` — Node pairing & management
5. `config` — Gateway/system configuration

### 6.7 Accessibility Considerations

- **ARIA Live Regions:** When UI elements appear/disappear due to proficiency changes, use `aria-live="polite"` to announce: "Additional scheduling options are now available"
- **Keyboard Navigation:** All disclosure levels must be fully keyboard-navigable. `TeachMeButton` is focusable with `Enter`/`Space` to toggle. `Tab` moves through all visible controls.
- **Screen Reader:** `DisclosureGate` renders nothing (not `display:none`) when below threshold — no hidden elements confuse screen readers. `TeachMePanel` uses `role="region"` with `aria-label="Learn about {featureName}"`
- **Focus Management:** When new UI elements appear after threshold crossing, do NOT auto-focus them (disruptive). The unlock toast is `role="status"`.
- **Color Contrast:** Proficiency level bars in settings use color + pattern (stripes for incomplete) for colorblind users. All text meets WCAG 2.1 AA (4.5:1 ratio).
- **Reduced Motion:** Wrap all framer-motion transitions in `useReducedMotion()` check. If prefers-reduced-motion, skip animations and show/hide instantly.
- **TeachMe Content:** Written at 8th-grade reading level. Uses structured headings inside the panel. Code examples have `aria-label` descriptions.

### 6.8 Phasing Plan

**Phase 1 — Foundation (1.5 weeks)**
- Build `useFeatureProficiencyStore` Zustand store with all actions
- Build `ProficiencyProvider` that hydrates from API
- Build `DisclosureGate` component (replaces `ComplexityGate`)
- Build `FeatureUsageTracker` middleware
- API endpoints: `GET /api/proficiency`, `POST /api/proficiency/sync`
- Migrate existing `ComplexityGate` usages (backward-compatible: map 3 tiers to 0.0/0.5/1.0)
- Unit tests for rules engine threshold computation
- **Deliverable:** Core system working, backward-compatible with existing 3-tier

**Phase 2 — First Surfaces (1.5 weeks)**
- Implement adaptive cron scheduling view (3 disclosure levels)
- Implement adaptive skills list view (2 disclosure levels)
- Build `TeachMeButton` and `TeachMePanel` components
- Write educational content for cron and skills
- Unlock toast notifications
- **Deliverable:** 2 feature areas fully adaptive with Teach Me

**Phase 3 — Settings & Polish (1 week)**
- Build Proficiency Settings panel (override controls, per-feature bars)
- Add `Ctrl+Shift+U` global shortcut
- Implement 3 more feature keys (agents, nodes, config)
- `ProficiencyDebugOverlay` for dev mode
- Reduced motion support
- **Deliverable:** 5 feature areas adaptive, full settings UI, accessible

**Phase 4 — Analytics & Refinement (1 week)**
- Server-side analytics: track proficiency distribution across users
- A/B testing hooks: compare adaptive vs static disclosure
- Tune thresholds based on real usage data
- Cross-device sync (proficiency follows the user)
- **Deliverable:** Data-driven tuning, analytics dashboard for product team

### 6.9 Open Questions & Risks

1. **Threshold Tuning:** Initial thresholds are guesses. Need real usage data to calibrate. Risk: too aggressive = users stuck in beginner; too lenient = overwhelming too fast. **Mitigation:** Ship with conservative thresholds, tune after 2 weeks of data.
2. **Feature Key Granularity:** Is `cron` one feature or should `cron.create`, `cron.edit`, `cron.bulk` be separate? Starting coarse, can refine later.
3. **Multi-device Sync Latency:** If user is power-user on desktop but opens mobile for first time, will they see beginner UI until sync? **Mitigation:** Sync on session init; use `globalOverride` as escape hatch.
4. **Content Authoring:** Who writes TeachMe content? Needs dedicated effort — 4-5 features × 3-5 topics each = 15-25 content pieces. **Mitigation:** Start with 2 features, template the format, assign to docs team.
5. **Performance:** Rules engine runs on every render for gated components. **Mitigation:** Memoize computed levels in Zustand selector; rules are simple threshold checks (< 1ms).
6. **Backward Compatibility:** Existing `ComplexityGate` users must not break. **Mitigation:** Phase 1 explicitly maintains backward compat by mapping old tiers to new levels.

---

## IDEA 7: Session Replay & Debug Timeline

### 7.1 Overview

Transform session debugging from reading flat text transcripts into a rich visual timeline experience. Every session event — user message, assistant response, tool call, sub-agent spawn, approval gate, error, thinking block — is plotted on a horizontal, zoomable timeline. Clicking any event opens a detail panel with full context including raw thinking, tool inputs/outputs, token counts, latency, and cumulative cost. A "debug mode" toggle reveals engineering-level metrics overlaid on the timeline, turning it into a powerful diagnostic tool for both end users and developers.

### 7.2 Technical Approach

**Framework & Libraries:**
- React 18+ with virtualized rendering for long sessions (hundreds of events)
- `@tanstack/react-virtual` for virtualizing event list in the detail panel
- `d3-scale` and `d3-zoom` for timeline scale calculations and zoom/pan behavior (not full D3 — just the math)
- `framer-motion` for panel transitions, event highlight animations
- `zustand` for session replay state (current position, playback state, zoom level, filters)
- `react-resizable-panels` (or Radix-based custom) for resizable timeline/detail split
- `react-syntax-highlighter` with `oneDark` theme for code/JSON display in detail panel
- `date-fns` for timestamp formatting and duration calculations
- CSS Modules + Tailwind for layout; CSS custom properties for timeline theming

**Rendering Strategy:**
- Timeline is a single horizontally-scrollable `<div>` with `overflow-x: auto`
- Events rendered as positioned `<div>` elements using `position: absolute` + `left` computed from timestamp
- Zoom controls adjust the time-to-pixel ratio (`msPerPixel` state variable)
- At high zoom: individual events visible with labels; at low zoom: events cluster into density indicators
- Detail panel is a fixed-height bottom or right panel (user-configurable split)
- Session data loaded in full on mount (sessions are finite, typically < 500 events)

**Data Flow:**
```
GET /api/sessions/:id/events → SessionReplayStore (Zustand)
  → TimelineRenderer reads events + zoom state → positioned event markers
  → Click event → setActiveEvent(id) → DetailPanel reads activeEvent
  → Debug toggle → overlay metrics layer on timeline
  → Playback controls → step through events sequentially with auto-scroll
```

### 7.3 Component Architecture

```
<SessionReplayPage>
  ├─ <SessionReplayHeader>
  │    ├─ <SessionSelector />              // Dropdown to pick session
  │    ├─ <SessionMetaBadges />            // Duration, event count, total cost, status
  │    ├─ <DebugModeToggle />              // Switch between normal and debug views
  │    └─ <ShareReplayButton />            // Copy shareable link
  │
  ├─ <ResizablePanelGroup direction="vertical">
  │    ├─ <ResizablePanel> <!-- Top: Timeline -->
  │    │    ├─ <TimelineToolbar>
  │    │    │    ├─ <PlaybackControls />    // Play/Pause, Step Forward/Back, Speed
  │    │    │    ├─ <ZoomControls />        // Zoom In/Out/Fit, zoom level indicator
  │    │    │    ├─ <TimelineFilters />     // Filter by event type checkboxes
  │    │    │    └─ <TimelineSearch />      // Search events by content
  │    │    ├─ <TimelineLane>
  │    │    │    ├─ <TimelineRuler />       // Time axis with tick marks
  │    │    │    ├─ <TimelineEventTrack lane="main">
  │    │    │    │    └─ <TimelineEvent />* // Individual event markers
  │    │    │    ├─ <TimelineEventTrack lane="tools">
  │    │    │    │    └─ <TimelineEvent />*
  │    │    │    ├─ <TimelineEventTrack lane="subagents">
  │    │    │    │    └─ <TimelineEvent />*
  │    │    │    ├─ <TimelinePlayhead />    // Current position indicator
  │    │    │    └─ <TimelineSelection />   // Click/drag selection range
  │    │    └─ <TimelineMinimap />          // Condensed overview of full session
  │    │
  │    ├─ <ResizableHandle />
  │    │
  │    └─ <ResizablePanel> <!-- Bottom: Detail -->
  │         └─ <EventDetailPanel>
  │              ├─ <EventDetailHeader />   // Event type icon, timestamp, duration
  │              ├─ <EventDetailTabs>
  │              │    ├─ <Tab label="Content">
  │              │    │    └─ <EventContentView />   // Message text, thinking, etc.
  │              │    ├─ <Tab label="Tool Calls">
  │              │    │    └─ <ToolCallDetailView />  // Input/output, latency
  │              │    ├─ <Tab label="Metrics">        // Debug mode only
  │              │    │    └─ <EventMetricsView />    // Tokens, cost, latency
  │              │    └─ <Tab label="Raw">
  │              │         └─ <RawEventJSON />        // Full raw event data
  │              └─ <EventNavigation />     // Previous/Next event buttons
```

**Key Components:**

| Component | Props | Responsibility |
|-----------|-------|----------------|
| `SessionReplayPage` | `sessionId: string` (from URL params) | Top-level page, fetches session data, provides layout |
| `TimelineLane` | `events: TimelineEvent[]`, `zoomLevel: number`, `scrollOffset: number` | Container for horizontally-scrollable timeline tracks |
| `TimelineEventTrack` | `lane: 'main' \| 'tools' \| 'subagents' \| 'approvals'`, `events: TimelineEvent[]` | Renders events for one lane/category |
| `TimelineEvent` | `event: SessionEvent`, `isActive: boolean`, `onClick: () => void`, `pixelOffset: number`, `width: number` | Single event marker — colored dot/bar with tooltip |
| `TimelineRuler` | `startTime: number`, `endTime: number`, `zoomLevel: number` | Time axis with graduated tick marks (auto-scales: seconds → minutes → hours) |
| `TimelinePlayhead` | `position: number` | Red vertical line showing current replay position |
| `TimelineMinimap` | `events: SessionEvent[]`, `viewportRange: [number, number]` | Density heatmap of full session; draggable viewport rectangle |
| `PlaybackControls` | none (reads from store) | Play/Pause, step forward/back, speed selector (0.5x, 1x, 2x, 5x) |
| `ZoomControls` | none (reads from store) | Zoom in (+), zoom out (-), fit all, zoom to selection |
| `EventDetailPanel` | `event: SessionEvent \| null` | Full detail view of selected event with tabbed content |
| `DebugModeToggle` | none (reads from store) | Toggles debug overlay: shows token counts, latency bars, cost accumulation line |
| `ToolCallDetailView` | `toolCall: ToolCallEvent` | Shows tool name, input params (syntax highlighted), output (collapsible), latency, status |
| `EventMetricsView` | `event: SessionEvent` | Token breakdown (input/output/thinking), cost in USD, latency histogram |

**Zustand Store — `useSessionReplayStore`:**

```typescript
interface SessionReplayState {
  // Data
  sessionId: string | null;
  sessionMeta: SessionMeta | null;
  events: SessionEvent[];
  isLoading: boolean;
  error: string | null;

  // Playback
  activeEventId: string | null;
  playbackState: 'idle' | 'playing' | 'paused';
  playbackSpeed: number;           // 0.5, 1, 2, 5
  playbackPosition: number;        // index into events array

  // View
  zoomLevel: number;               // msPerPixel — lower = more zoomed in
  scrollOffset: number;            // horizontal scroll in pixels
  debugMode: boolean;
  visibleLanes: Set<string>;       // which lanes are shown
  searchQuery: string;
  filteredEventTypes: Set<string>; // which event types to show

  // Actions
  loadSession: (sessionId: string) => Promise<void>;
  setActiveEvent: (eventId: string | null) => void;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  setPlaybackSpeed: (speed: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  zoomToSelection: (startTime: number, endTime: number) => void;
  setDebugMode: (enabled: boolean) => void;
  toggleLane: (lane: string) => void;
  setSearch: (query: string) => void;
  setFilteredEventTypes: (types: Set<string>) => void;
}
```

### 7.4 Interaction Patterns

**Navigation:**
- Horizontal scroll: trackpad/mouse wheel (horizontal) or click-and-drag on timeline
- Zoom: `Ctrl+scroll` (or pinch gesture on trackpad), or `+`/`-` keys when timeline focused
- Click event marker → select event, show in detail panel
- Double-click event → zoom to fit that event's duration
- Keyboard: `←`/`→` arrow keys step through events; `Space` toggles play/pause; `D` toggles debug mode

**Playback:**
- "Play" auto-advances through events at selected speed
- Timeline auto-scrolls to keep playhead visible (smooth scroll, 200ms transition)
- During playback, detail panel updates to show current event
- Pause with `Space` or clicking `Pause` button
- Step: `→` advances one event, `←` goes back one event

**Zoom Behavior:**
- Default: entire session fits in viewport (`zoomToFit`)
- Zoom in centers on mouse cursor position (or playhead if keyboard)
- Minimum zoom: 10ms per pixel (individual events clearly visible)
- Maximum zoom: entire session in viewport
- Minimap always shows full session; viewport indicator rectangle is draggable

**Timeline Lanes:**
- Main lane (top): user messages, assistant responses
- Tools lane: tool calls as duration bars (start → end)
- Sub-agents lane: sub-agent lifespans as colored bars
- Approvals lane: approval gates as diamond markers
- Lanes are toggleable; collapsed lanes show as thin 4px strips
- Vertical lane labels on left edge (fixed, don't scroll)

**Debug Mode Overlay:**
- Token count badges appear above each event marker
- Cost accumulation line chart overlaid on timeline (running total in $)
- Latency bars under each tool call (color-coded: green < 1s, yellow 1-5s, red > 5s)
- Total session metrics summary in top-right corner

**Animations:**
- Event selection: selected marker scales to 1.3x with `ring-2 ring-blue-500`, `duration: 150ms`
- Panel content swap: `framer-motion AnimatePresence` with 150ms fade
- Playhead movement: smooth CSS `transition: left 100ms linear` during playback
- Zoom: timeline content scales with `transition: transform 200ms ease-out`
- Lane collapse: height transition 200ms ease-in-out

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` | Step to previous event |
| `→` | Step to next event |
| `Shift+←` | Jump back 10 events |
| `Shift+→` | Jump forward 10 events |
| `Home` | Go to first event |
| `End` | Go to last event |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Zoom to fit |
| `D` | Toggle debug mode |
| `F` | Toggle fullscreen |
| `Ctrl+F` | Search events |
| `1`–`4` | Toggle lanes 1–4 |
| `Escape` | Deselect event / close search |

### 7.5 Wireframe Description

**Full Session Replay View:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Session Replay                                                         │
│  ┌──────────────────┐  Duration: 4m 32s │ Events: 47 │ Cost: $0.12    │
│  │ Session: abc-123 ▾│  Status: ● Completed          [Debug] [Share]  │
│  └──────────────────┘                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  [▶ Play] [⏮][⏭] Speed: [1x▾]   [🔍 Search]   [−][+][⊡] Zoom: 35%  │
│  Filter: [✓ Messages] [✓ Tools] [✓ Sub-agents] [✓ Approvals] [Errors] │
├─────────────────────────────────────────────────────────────────────────┤
│          │ 0:00    0:30    1:00    1:30    2:00    2:30    3:00   4:00 │
│          │ ┊       ┊       ┊       ┊       ┊       ┊       ┊      ┊   │
│ Messages │ ●───●      ●──────●        ●──●   ●────────●     ●    ●  │
│ Tools    │    ▓▓▓  ▓▓   ▓▓▓▓▓▓▓▓     ▓▓      ▓▓▓▓▓▓▓     ▓▓   ▓▓│
│ Agents   │         ════════════════                 ═══════════      │
│ Approvals│                        ◆                                   │
│          │              ▼ (playhead)                                   │
├──────────┴──────────────────────────────────────────────────────────────┤
│ Minimap: [░░░░░▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  │
├─────────────────────────────────────────────────────────────────────────┤
│  Event Detail                                              [← 12/47 →] │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🔧 Tool Call: mcp__openclaw-tools__exec       @ 1:02  (1.3s)  │   │
│  │                                                                 │   │
│  │ [Content] [Tool Calls] [Metrics] [Raw]                         │   │
│  │ ─────────────────────────────────────────                      │   │
│  │ Input:                                                          │   │
│  │ ┌─────────────────────────────────────────────────────────┐    │   │
│  │ │ {                                                        │    │   │
│  │ │   "command": "git status",                               │    │   │
│  │ │   "workdir": "/Users/openclaw/workspace"                 │    │   │
│  │ │ }                                                        │    │   │
│  │ └─────────────────────────────────────────────────────────┘    │   │
│  │ Output:                                                         │   │
│  │ ┌─────────────────────────────────────────────────────────┐    │   │
│  │ │ On branch main                                           │    │   │
│  │ │ nothing to commit, working tree clean                    │    │   │
│  │ └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Debug Mode Overlay (tokens + cost on timeline):**
```
│          │ 0:00    0:30    1:00    1:30    2:00    2:30    3:00       │
│          │ ┊       ┊       ┊       ┊       ┊       ┊       ┊         │
│ Tokens   │ 1.2k    850     3.4k    2.1k    950     4.2k   1.8k      │
│ Cost $   │ ╭─╮   ╭──╮   ╭─────╮  ╭─╮   ╭╮   ╭──────╮  ╭──╮       │
│ Accum    │ $0.01──$0.02──$0.05───$0.07──$0.08─$0.11───$0.12        │
│          │ ┊       ┊       ┊       ┊       ┊       ┊       ┊         │
│ Messages │ ●───●      ●──────●        ●──●   ●────────●     ●       │
│ Latency  │  ░▓░   ░░  ░▓▓▓▓░▓░     ░▓      ░▓▓░▓▓░     ░▓   ░▓   │
│          │  grn   grn    red         grn     yellow       grn  grn   │
```

### 7.6 Data Model & API Integration

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sessions` | List sessions (paginated, filterable by status/date/agent) |
| `GET` | `/api/sessions/:id` | Session metadata (duration, status, agent, event count) |
| `GET` | `/api/sessions/:id/events` | All events for session (ordered by timestamp) |
| `GET` | `/api/sessions/:id/events/:eventId` | Single event detail (for deep linking) |
| `GET` | `/api/sessions/:id/metrics` | Aggregated metrics (total tokens, cost, latency stats) |
| `WS` | `/ws/sessions/:id/events` | WebSocket for live sessions (stream new events in real-time) |

**Data Shapes:**

```typescript
interface SessionMeta {
  id: string;
  agentId: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;           // ISO timestamp
  endedAt: string | null;
  duration: number;            // milliseconds
  eventCount: number;
  totalTokens: number;
  totalCost: number;           // USD
  channel: 'slack' | 'discord' | 'web' | 'cli';
  labels: string[];
}

interface SessionEvent {
  id: string;
  sessionId: string;
  type: 'user_message' | 'assistant_message' | 'thinking' | 'tool_call' | 'tool_result' |
        'subagent_spawn' | 'subagent_complete' | 'approval_request' | 'approval_response' |
        'error' | 'system' | 'session_start' | 'session_end';
  timestamp: string;
  endTimestamp?: string;       // For duration events (tool calls, sub-agents)
  lane: 'main' | 'tools' | 'subagents' | 'approvals';

  // Content (varies by type)
  content?: string;            // Message text, error message
  thinking?: string;           // Model thinking block
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  subagentId?: string;
  subagentLabel?: string;
  approvalId?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';

  // Metrics
  metrics?: {
    inputTokens?: number;
    outputTokens?: number;
    thinkingTokens?: number;
    latencyMs?: number;
    costUsd?: number;
    model?: string;
  };
}

// Computed client-side
interface TimelinePosition {
  eventId: string;
  left: number;       // pixel offset from start
  width: number;      // pixel width (for duration events)
  lane: number;       // lane index (0-based)
}
```

**Integration with existing `chat.history`:**
- Current `chat.history` RPC returns flat transcript
- New `/api/sessions/:id/events` endpoint wraps and enriches this with event typing, timestamps, and metrics
- Gateway needs to emit structured events during session (tool call start/end, thinking start/end)
- WebSocket endpoint streams events for live/in-progress sessions

### 7.7 Accessibility Considerations

- **Screen Reader:** Timeline events have `role="listbox"` with each event as `role="option"`. Active event is `aria-selected="true"`. Description includes: type, time, content preview.
- **Keyboard Navigation:** Full keyboard support (see shortcuts table). Timeline is a single focusable region; arrow keys move between events. `Enter` selects event for detail view.
- **ARIA Labels:** Timeline lanes have `aria-label="Message events timeline"`, etc. Zoom controls: `aria-label="Zoom in"`, `aria-valuetext="Zoom level 35%"`.
- **Focus Management:** Selecting an event moves focus to detail panel header. `Escape` returns focus to timeline at same event.
- **Color Independence:** Event types distinguished by both color AND shape (● circle = message, ▓ bar = tool, ═ double-line = sub-agent, ◆ diamond = approval). Debug mode latency uses color + label text.
- **Reduced Motion:** Playback animation disabled; stepping through events still works. Panel transitions instant instead of animated.
- **High Contrast:** All timeline markers have minimum 3:1 contrast against track background. Selected event has visible focus ring in addition to color change.

### 7.8 Phasing Plan

**Phase 1 — Data Layer & Basic Timeline (2 weeks)**
- Build `/api/sessions/:id/events` endpoint enriching `chat.history`
- Define `SessionEvent` schema and event type taxonomy
- Build `useSessionReplayStore` Zustand store
- Build basic `TimelineLane` with positioned event markers (single lane, no zoom)
- Build `EventDetailPanel` with Content tab
- Basic click-to-select interaction
- **Deliverable:** View a completed session on a basic timeline, click events to see details

**Phase 2 — Multi-Lane, Zoom & Playback (1.5 weeks)**
- Implement multi-lane rendering (messages, tools, sub-agents, approvals)
- Implement `d3-scale` based zoom/pan with `ZoomControls`
- Implement `TimelineMinimap`
- Implement `PlaybackControls` with step/play/pause
- Implement `TimelineRuler` with auto-scaling tick marks
- Keyboard shortcuts
- **Deliverable:** Full timeline interaction — zoom, pan, playback, multi-lane

**Phase 3 — Debug Mode & Metrics (1.5 weeks)**
- Build `DebugModeToggle` and debug overlay (tokens, cost, latency)
- Build `EventMetricsView` and `ToolCallDetailView` with syntax highlighting
- Build `RawEventJSON` tab
- Cost accumulation line overlay
- Latency color-coding
- Implement `/api/sessions/:id/metrics` aggregation endpoint
- **Deliverable:** Full debug experience with metrics overlay

**Phase 4 — Live Sessions & Polish (1 week)**
- WebSocket integration for streaming events on live sessions
- Live playhead that auto-advances
- Search and filter functionality
- Share replay links (deep link to session + event)
- Performance optimization for large sessions (500+ events)
- **Deliverable:** Live session replay, search, sharing, production-ready

### 7.9 Open Questions & Risks

1. **Event Data Richness:** Current `chat.history` may not include all needed fields (thinking blocks, token counts per event, precise timestamps). **Risk:** May need gateway changes to emit richer events. **Mitigation:** Define minimum viable event schema; enhance incrementally.
2. **Session Size:** Very long sessions (1000+ events) could create performance issues with DOM-based timeline. **Mitigation:** Canvas-based rendering fallback for sessions > 500 events; or virtualize visible range only.
3. **Storage Cost:** Storing detailed events with tool inputs/outputs for every session = significant storage. **Mitigation:** Configurable retention; auto-prune events older than N days; store metrics separately from full content.
4. **Live Session WebSocket:** Need to ensure WS connection is stable and events arrive in order. **Mitigation:** Sequence numbers on events; client-side reorder buffer.
5. **Privacy:** Session replay might show sensitive data (API keys, credentials in tool outputs). **Mitigation:** Sensitive content detection and auto-redaction; configurable visibility per event type.
6. **Cost Calculation Accuracy:** Token-to-cost mapping varies by model and changes over time. **Mitigation:** Look up cost table by model ID at event time; store computed cost alongside event.

---

## IDEA 8: Unified Configuration Experience

### 8.1 Overview

Replace the current fragmented configuration landscape — manual `openclaw.json` editing, `openclaw config set` CLI commands, and a raw JSON editor in the Web UI — with a single, schema-driven form experience that serves as the authoritative configuration interface. The gateway's `config.schema` RPC returns a JSON Schema with UI hints (labels, help text, grouping, ordering); we build a recursive form renderer that generates type-appropriate form controls for every config value. Real-time validation, contextual help tooltips, undo/redo history, and visual diff on save create a configuration experience that is simultaneously powerful and safe.

### 8.2 Technical Approach

**Framework & Libraries:**
- React 18+ with `react-hook-form` (v7) for form state management, validation, and dirty tracking
- `@hookform/resolvers/zod` for connecting Zod schemas (derived from JSON Schema) to react-hook-form
- `zod` for client-side schema validation (convert JSON Schema → Zod at build or runtime)
- `json-schema-to-zod` utility for automated conversion (or custom transformer for OpenClaw-specific UI hints)
- `zustand` for configuration UI state (undo/redo stack, current vs saved values, schema cache)
- `diff` library (or custom) for computing JSON diff between current and pending changes
- Shadcn/Radix primitives: `Input`, `Select`, `Switch`, `Textarea`, `Accordion`, `Tooltip`, `Dialog`, `Tabs`, `Badge`
- `cmdk` (Command Menu) for quick-jump to any config field by name
- `framer-motion` for section expand/collapse, validation shake, save confirmation
- `monaco-editor` (lazy-loaded) for fallback "raw JSON" mode
- CSS Modules + Tailwind for layout

**Rendering Strategy:**
- Schema-driven recursive renderer: `SchemaFormRenderer` walks JSON Schema tree, emits appropriate form control per `type` + `format` + UI hints
- Grouping: UI hints provide `group` property → rendered as `Accordion` sections
- Ordering: UI hints provide `order` property → sorted within groups
- Nested objects: rendered as indented sub-sections or collapsible cards
- Arrays: rendered as sortable list with add/remove controls
- Sensitive fields (passwords, API keys): masked input with show/hide toggle, never sent back to client after initial set

**Data Flow:**
```
config.schema RPC → parse JSON Schema + UI hints → generate Zod schema
config.get RPC → current values → populate react-hook-form
User edits → react-hook-form state (with validation) → diff against original
Save → config.set RPC (changed fields only) → config.apply RPC → toast confirmation
Undo/Redo → Zustand stack of form snapshots
```

### 8.3 Component Architecture

```
<ConfigurationPage>
  ├─ <ConfigPageHeader>
  │    ├─ <Breadcrumb />                     // Settings > Configuration
  │    ├─ <ConfigSearchCommand />            // Cmd+K to search/jump to any field
  │    ├─ <UndoRedoControls />               // Undo/Redo buttons with count
  │    ├─ <ViewModeToggle />                 // Form view / Raw JSON view
  │    └─ <ConfigActionBar>
  │         ├─ <DiffPreviewButton />         // Shows pending changes count badge
  │         ├─ <ResetButton />               // Reset to saved values
  │         └─ <SaveButton />                // Save & Apply
  │
  ├─ <ConfigSidebar>                         // Left sidebar with section nav
  │    └─ <ConfigSectionNav>
  │         ├─ <SectionNavItem group="general" />
  │         ├─ <SectionNavItem group="agents" />
  │         ├─ <SectionNavItem group="channels" />
  │         ├─ <SectionNavItem group="models" />
  │         ├─ <SectionNavItem group="plugins" />
  │         ├─ <SectionNavItem group="security" />
  │         └─ <SectionNavItem group="advanced" />
  │
  ├─ <ConfigFormArea>                        // Main scrollable form area
  │    └─ <SchemaFormRenderer schema={jsonSchema} uiHints={hints}>
  │         ├─ <ConfigSection group="general">
  │         │    ├─ <ConfigField path="name" />
  │         │    ├─ <ConfigField path="port" />
  │         │    └─ <ConfigField path="logLevel" />
  │         ├─ <ConfigSection group="agents">
  │         │    ├─ <ConfigField path="agents.default.model" />
  │         │    ├─ <ConfigArrayField path="agents.list" />
  │         │    │    └─ <ConfigArrayItem />*
  │         │    └─ ...
  │         └─ ...
  │
  └─ <ConfigDiffDialog>                      // Modal showing pending changes diff
       ├─ <DiffViewer />                     // Side-by-side or unified diff view
       └─ <DialogActions>
            ├─ <Button>Cancel</Button>
            └─ <Button>Save & Apply</Button>
```

**Key Components:**

| Component | Props | Responsibility |
|-----------|-------|----------------|
| `ConfigurationPage` | — | Top-level page; loads schema, loads values, provides form context |
| `SchemaFormRenderer` | `schema: JSONSchema`, `uiHints: UIHintMap`, `control: Control` | Recursive renderer; walks schema tree, delegates to typed field renderers |
| `ConfigSection` | `group: string`, `label: string`, `description?: string`, `defaultOpen?: boolean` | Accordion section wrapping a group of fields |
| `ConfigField` | `path: string`, `schema: JSONSchemaProperty`, `uiHint?: UIHint` | Delegates to specific input based on type: `StringField`, `NumberField`, `BooleanField`, `EnumField`, `SecretField` |
| `StringField` | `path: string`, `label: string`, `help?: string`, `placeholder?: string`, `format?: string` | Shadcn `<Input>` with label, help tooltip, validation errors |
| `NumberField` | `path: string`, `label: string`, `help?: string`, `min?: number`, `max?: number`, `step?: number` | Shadcn `<Input type="number">` with constraints |
| `BooleanField` | `path: string`, `label: string`, `help?: string` | Shadcn `<Switch>` with label and description |
| `EnumField` | `path: string`, `label: string`, `help?: string`, `options: {value: string, label: string}[]` | Shadcn `<Select>` dropdown |
| `SecretField` | `path: string`, `label: string`, `help?: string`, `isSet: boolean` | Masked input, show/hide toggle, "Change" button if already set |
| `ObjectField` | `path: string`, `schema: JSONSchemaObject`, `uiHints: UIHintMap` | Renders nested object as indented card with child fields |
| `ArrayField` | `path: string`, `schema: JSONSchemaArray`, `uiHints: UIHintMap` | Sortable list of items with Add/Remove, uses `useFieldArray` |
| `ConfigArrayItem` | `index: number`, `path: string`, `schema: JSONSchema` | Single item in an array field; collapsible with drag handle |
| `ConfigSearchCommand` | — | `cmdk`-powered dialog; indexes all field labels/paths for instant jump |
| `UndoRedoControls` | — | Reads from undo/redo stack in Zustand; buttons with keyboard shortcuts |
| `DiffPreviewButton` | — | Badge shows count of changed fields; click opens `ConfigDiffDialog` |
| `ConfigDiffDialog` | `original: object`, `pending: object`, `onConfirm: () => void`, `onCancel: () => void` | Shows JSON diff of changes; confirm triggers save |
| `ViewModeToggle` | — | Switches between form renderer and `<MonacoEditor>` with raw JSON |

**Zustand Store — `useConfigStore`:**

```typescript
interface ConfigState {
  // Schema
  schema: JSONSchema | null;
  uiHints: Record<string, UIHint>;
  isSchemaLoaded: boolean;

  // Values
  savedValues: Record<string, unknown>;
  pendingValues: Record<string, unknown>;
  dirtyFields: Set<string>;

  // Undo/Redo
  undoStack: Record<string, unknown>[];
  redoStack: Record<string, unknown>[];
  maxUndoDepth: number;  // default 50

  // UI state
  activeSection: string | null;
  viewMode: 'form' | 'json';
  searchQuery: string;
  isDiffDialogOpen: boolean;
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: string | null;

  // Actions
  loadSchema: () => Promise<void>;
  loadValues: () => Promise<void>;
  setValue: (path: string, value: unknown) => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  resetToSaved: () => void;
  setActiveSection: (section: string) => void;
  setViewMode: (mode: 'form' | 'json') => void;
  getDiff: () => ConfigDiff;
}

interface UIHint {
  label: string;
  help?: string;
  group: string;
  order: number;
  format?: 'secret' | 'multiline' | 'url' | 'email' | 'path' | 'cron' | 'duration';
  placeholder?: string;
  deprecated?: boolean;
  deprecatedMessage?: string;
  condition?: { field: string; value: unknown };  // Show only when another field has specific value
}

interface ConfigDiff {
  added: { path: string; value: unknown }[];
  removed: { path: string; value: unknown }[];
  changed: { path: string; oldValue: unknown; newValue: unknown }[];
}
```

### 8.4 Interaction Patterns

**Form Editing Flow:**
1. Page loads → fetch schema (cached after first load) → fetch current values → populate form
2. User edits a field → real-time validation (Zod schema) → field border turns blue if dirty
3. Validation error → field border red, error message below, subtle shake animation (150ms)
4. Changed fields badge count updates in `DiffPreviewButton`
5. `Ctrl+S` / click Save → `ConfigDiffDialog` opens showing changes
6. Confirm in diff dialog → `config.set` + `config.apply` RPCs → success toast → dirty state cleared

**Undo/Redo:**
- Every field change pushes to undo stack (debounced: rapid typing batched into single undo step per 500ms pause)
- `Ctrl+Z` → undo last change; `Ctrl+Shift+Z` → redo
- Undo/Redo buttons show stack depth as tooltip
- Stack capped at 50 entries

**Search / Quick Jump:**
- `Ctrl+K` opens `ConfigSearchCommand` dialog (cmdk)
- Type to filter all config field labels and paths
- Select result → scroll to and focus that field; flash highlight animation (400ms yellow bg fade)
- Each search result shows: field label, current value preview, group name

**Section Navigation:**
- Left sidebar lists all config groups
- Click group → smooth scroll to section + highlight section header
- Active section updates as user scrolls (intersection observer)
- Mobile: sidebar collapses to hamburger menu

**Raw JSON Mode:**
- Toggle to "JSON" view → Monaco editor with current config
- Edits in Monaco validate against schema in real-time (red squiggles)
- Switching back to "Form" view applies Monaco changes to form
- Warning dialog if Monaco content has validation errors

**Animations:**
- Section expand/collapse: `framer-motion` `AnimatePresence` with height transition 250ms
- Validation error shake: `@keyframes shake { 0%, 100% { translateX(0) } 25% { translateX(-4px) } 75% { translateX(4px) } }` 150ms
- Dirty field indicator: left border fade to blue, 200ms
- Save success: brief green flash on SaveButton, 300ms
- Diff dialog: Radix Dialog with `framer-motion` scale-in from 0.95 to 1.0, 200ms

**Keyboard Shortcuts:**

| Key | Action |
|-----|--------|
| `Ctrl+S` | Save (opens diff dialog) |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+K` | Search/jump to field |
| `Escape` | Close dialog / cancel search |
| `Tab` / `Shift+Tab` | Move between fields |

### 8.5 Wireframe Description

**Configuration Page — Form View:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Settings > Configuration                [🔍 Ctrl+K] [↩ Undo][↪ Redo] │
│                                              [Form│JSON]  [3 changes] [Save] │
├────────────┬────────────────────────────────────────────────────────────┤
│            │                                                            │
│  Sections  │  General                                          ▾ open  │
│            │  ┌──────────────────────────────────────────────────────┐ │
│  • General │  │ Instance Name        ℹ️                               │ │
│  ○ Agents  │  │ ┌──────────────────────────────────────────────┐    │ │
│  ○ Channels│  │ │ my-openclaw-instance                         │    │ │
│  ○ Models  │  │ └──────────────────────────────────────────────┘    │ │
│  ○ Plugins │  │                                                      │ │
│  ○ Security│  │ Port                 ℹ️                               │ │
│  ○ Advanced│  │ ┌────────────┐                                      │ │
│            │  │ │ 3000       │   Range: 1024–65535                   │ │
│            │  │ └────────────┘                                      │ │
│            │  │                                                      │ │
│            │  │ Log Level            ℹ️                               │ │
│            │  │ ┌──────────────────────── ▾ ┐                       │ │
│            │  │ │ info                       │                       │ │
│            │  │ └────────────────────────────┘                       │ │
│            │  │                                                      │ │
│            │  │ Enable Telemetry     ℹ️                               │ │
│            │  │ [━━━━○           ] Off                               │ │
│            │  └──────────────────────────────────────────────────────┘ │
│            │                                                            │
│            │  Agents                                           ▸ closed │
│            │  ──────────────────────────────────────────────────────── │
│            │  Channels                                         ▸ closed │
│            │  ──────────────────────────────────────────────────────── │
│            │                                                            │
│            │  Models                                           ▾ open  │
│            │  ┌──────────────────────────────────────────────────────┐ │
│            │  │ Default Model        ℹ️                               │ │
│            │  │ ┌──────────────────────── ▾ ┐                       │ │
│            │  │ │ anthropic/claude-sonnet-4   │  ● dirty            │ │
│            │  │ └────────────────────────────┘                       │ │
│            │  │                                                      │ │
│            │  │ API Keys                                             │ │
│            │  │ ┌────────────────────────────────────────────┐      │ │
│            │  │ │ Anthropic API Key  ℹ️            [Change]  │      │ │
│            │  │ │ •••••••••••••••••                ✓ Set     │      │ │
│            │  │ │                                             │      │ │
│            │  │ │ OpenAI API Key     ℹ️            [Change]  │      │ │
│            │  │ │ •••••••••••••••••                ✓ Set     │      │ │
│            │  │ └────────────────────────────────────────────┘      │ │
│            │  └──────────────────────────────────────────────────────┘ │
└────────────┴────────────────────────────────────────────────────────────┘
```

**Diff Preview Dialog:**
```
┌──────────────────────────────────────────────────────────┐
│  Review Changes (3 fields modified)            [✕ Close] │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  models.defaultModel                              │   │
│  │  - anthropic/claude-opus-4                        │   │
│  │  + anthropic/claude-sonnet-4                      │   │
│  │                                                    │   │
│  │  general.logLevel                                 │   │
│  │  - debug                                          │   │
│  │  + info                                           │   │
│  │                                                    │   │
│  │  channels.slack.enabled                           │   │
│  │  - false                                          │   │
│  │  + true                                           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ⚠️  Applying changes will restart affected services.    │
│                                                          │
│         [ Cancel ]              [ Save & Apply ]         │
└──────────────────────────────────────────────────────────┘
```

### 8.6 Data Model & API Integration

**RPC Endpoints (existing):**

| RPC Method | Description |
|------------|-------------|
| `config.schema` | Returns JSON Schema + UI hints for all configuration |
| `config.get` | Returns current configuration values (sensitive fields redacted) |
| `config.set` | Sets one or more config values (partial update) |
| `config.apply` | Applies configuration changes (may trigger gateway restart) |

**Enhanced Request/Response Shapes:**

```typescript
// config.schema response
interface ConfigSchemaResponse {
  schema: JSONSchema7;     // Standard JSON Schema
  uiHints: Record<string, UIHint>;  // Keyed by JSON path (e.g., "general.port")
  version: string;         // Schema version for cache invalidation
}

// config.get response
interface ConfigGetResponse {
  values: Record<string, unknown>;  // Nested config object
  sensitiveFields: string[];        // Paths of fields that are set but redacted
  lastModified: string;             // ISO timestamp
  lastModifiedBy: string;           // Who last changed config
}

// config.set request
interface ConfigSetRequest {
  changes: Record<string, unknown>;  // Flat path → value map
  expectedVersion?: string;          // Optimistic concurrency check
}

// config.set response
interface ConfigSetResponse {
  success: boolean;
  appliedChanges: string[];     // Paths that were successfully set
  errors: { path: string; message: string }[];
  requiresRestart: boolean;
  newVersion: string;
}

// config.apply response
interface ConfigApplyResponse {
  success: boolean;
  restartedServices: string[];
  errors: string[];
}
```

**Zustand Integration:**
- Schema cached in store; invalidated on version change
- `config.get` response populates both `savedValues` and `pendingValues` (initially identical)
- Each field edit updates `pendingValues` and adds to `dirtyFields` set
- `save()` computes diff between `savedValues` and `pendingValues`, sends only changed fields via `config.set`
- On successful save, `savedValues` updated to match `pendingValues`, undo/redo stack cleared

### 8.7 Accessibility Considerations

- **Form Labels:** Every field has an associated `<label>` via `htmlFor`. Help text linked via `aria-describedby`.
- **Validation Errors:** Error messages use `aria-live="assertive"` so screen readers announce immediately. Fields with errors have `aria-invalid="true"`.
- **Section Navigation:** Sidebar uses `role="navigation"` with `aria-label="Configuration sections"`. Active section uses `aria-current="true"`.
- **Accordion Sections:** Use Radix `<Accordion>` which provides `aria-expanded`, `aria-controls` automatically.
- **Secret Fields:** Masked values announced as "API key is set" (not the asterisks). Show/hide toggle has `aria-label="Show API key value"` / `"Hide API key value"`.
- **Keyboard:** Full tab navigation through all form fields. `Ctrl+S` for save works from any field. `Ctrl+K` for search accessible globally.
- **Diff Dialog:** Dialog is modal with focus trap. Changes list is readable — each change narrated as "Field [name] changed from [old] to [new]".
- **Color:** Dirty field indicators (blue border) also have a "●" dot indicator for colorblind users. Error states have both red border and error icon + text.

### 8.8 Phasing Plan

**Phase 1 — Schema Renderer & Basic Form (2 weeks)**
- Build `SchemaFormRenderer` recursive component
- Implement all primitive field types: `StringField`, `NumberField`, `BooleanField`, `EnumField`
- Implement `ConfigSection` with Radix Accordion
- Connect to `config.schema` and `config.get` RPCs
- Basic react-hook-form integration with Zod validation
- Save flow: `config.set` → `config.apply`
- **Deliverable:** Working config form that renders from schema, validates, and saves

**Phase 2 — Complex Types & UX Polish (1.5 weeks)**
- `SecretField` with mask/unmask
- `ObjectField` for nested objects
- `ArrayField` with add/remove/reorder (drag-and-drop)
- Undo/Redo system (Zustand stack)
- Dirty field indicators
- Section sidebar navigation with scroll spy
- **Deliverable:** All config types renderable, undo/redo, polished navigation

**Phase 3 — Diff Preview & Advanced Features (1 week)**
- `ConfigDiffDialog` with change visualization
- `ConfigSearchCommand` (cmdk integration)
- Raw JSON mode with Monaco editor (lazy-loaded)
- Conditional field visibility (UI hint `condition` support)
- Deprecated field warnings
- **Deliverable:** Full feature set — diff preview, search, JSON mode, conditional fields

**Phase 4 — Integration & Hardening (1 week)**
- Optimistic concurrency (version checking on save)
- Restart warning when changes affect running services
- Config export/import (download/upload JSON)
- Responsive layout for smaller screens
- Full accessibility audit and remediation
- E2E tests with Playwright
- **Deliverable:** Production-ready, accessible, fully tested

### 8.9 Open Questions & Risks

1. **Schema Completeness:** Does `config.schema` currently return UI hints for ALL config fields? If partial, need fallback rendering (generic field with path as label). **Mitigation:** Audit schema coverage; generate missing UI hints from field names.
2. **Sensitive Field Handling:** How are secrets transmitted? Must never appear in client-side state or browser dev tools. **Mitigation:** Server returns `"***SET***"` for set secrets; only new values sent on change; HTTPS only.
3. **Restart Impact:** `config.apply` may restart gateway services. Users need clear warning. **Mitigation:** Diff dialog shows restart warning; debounce rapid saves.
4. **Conditional Dependencies:** Some fields depend on others (e.g., Slack webhook URL only relevant if Slack channel enabled). UI hint `condition` system needs to handle this. **Risk:** Complex dependency chains. **Mitigation:** Support simple single-field conditions first; complex chains in Phase 4.
5. **Schema Evolution:** Config schema changes between OpenClaw versions. Form must handle unknown fields gracefully. **Mitigation:** Render unknown fields as generic text inputs with path as label; warn about unrecognized fields.
6. **Monaco Bundle Size:** Monaco editor is ~2MB. **Mitigation:** Lazy-load only when user switches to JSON view; code-split with `React.lazy`.

---

## IDEA 9: Skill Creation IDE / Skill Builder

### 9.1 Overview

Build a visual skill creation environment within the OpenClaw Web UI that transforms skill authoring from a manual, file-system-based process into a guided, multi-panel IDE experience. The Skill Builder includes a template gallery for quick-start, a structured YAML frontmatter editor, a Markdown body editor with live preview, a test sandbox that invokes the skill against a test agent, and one-click publishing to ClawhHub. This dramatically lowers the barrier to skill creation while giving power users the full expressiveness of the SKILL.md format.

### 9.2 Technical Approach

**Framework & Libraries:**
- React 18+ with Suspense for lazy-loading heavy editor components
- `@monaco-editor/react` (lazy-loaded) for the Markdown body editor — syntax highlighting, autocomplete, line numbers
- Fallback: `react-textarea-autosize` + `react-markdown` for lightweight mode without Monaco
- `js-yaml` for parsing/stringifying YAML frontmatter
- `react-markdown` + `remark-gfm` for live preview rendering
- `zustand` for skill builder state (current skill, dirty tracking, test results)
- `framer-motion` for panel transitions, template gallery animations
- `react-resizable-panels` for the multi-panel IDE layout
- Shadcn/Radix: `Tabs`, `Select`, `Input`, `Textarea`, `Dialog`, `Badge`, `Tooltip`, `DropdownMenu`
- `zod` for frontmatter schema validation
- `react-hot-toast` for success/error notifications

**Rendering Strategy:**
- Three-panel layout: Left = structured frontmatter editor, Center = Markdown body editor, Right = live preview
- Panels resizable via drag handles; layout persisted in localStorage
- Template gallery is a modal overlay (Radix Dialog) shown on "New Skill"
- Test sandbox opens as a bottom panel (like a terminal/console) or slide-over
- Monaco editor lazy-loaded; placeholder shown while loading (~1s)

**Data Flow:**
```
Template selection → populate frontmatter + body defaults
  → User edits frontmatter (form fields) → YAML serialized internally
  → User edits Markdown body (Monaco) → live preview updates (debounced 300ms)
  → Save Draft → POST /api/skills/drafts (local storage for offline)
  → Test → POST /api/skills/test { skillContent, testPrompt } → stream results
  → Publish → POST /api/skills/publish → ClawhHub API
  → Reload → POST /rpc/gateway.skills.reload
```

### 9.3 Component Architecture

```
<SkillBuilderPage>
  ├─ <SkillBuilderHeader>
  │    ├─ <SkillNameInput />               // Editable skill name
  │    ├─ <SkillStatusBadge />             // Draft / Saved / Published
  │    ├─ <SkillActions>
  │    │    ├─ <SaveDraftButton />
  │    │    ├─ <TestSkillButton />
  │    │    ├─ <PublishButton />
  │    │    └─ <MoreActions>               // Export, Duplicate, Delete
  │    └─ <SkillVersionIndicator />
  │
  ├─ <ResizablePanelGroup direction="horizontal">
  │    ├─ <ResizablePanel minSize={20} defaultSize={30}>
  │    │    └─ <FrontmatterEditor>
  │    │         ├─ <FrontmatterSection label="Identity">
  │    │         │    ├─ <FieldInput path="name" />
  │    │         │    ├─ <FieldTextarea path="description" />
  │    │         │    ├─ <FieldInput path="version" />
  │    │         │    └─ <FieldInput path="author" />
  │    │         ├─ <FrontmatterSection label="Configuration">
  │    │         │    ├─ <FieldSelect path="model" options={modelList} />
  │    │         │    ├─ <FieldTagInput path="tags" />
  │    │         │    ├─ <FieldSelect path="thinking" options={thinkingLevels} />
  │    │         │    └─ <FieldToggle path="enabled" />
  │    │         ├─ <FrontmatterSection label="Parameters">
  │    │         │    └─ <ParameterListEditor path="parameters" />
  │    │         │         └─ <ParameterItem />*
  │    │         ├─ <FrontmatterSection label="Tools">
  │    │         │    └─ <ToolPermissionEditor path="tools" />
  │    │         └─ <FrontmatterSection label="Triggers">
  │    │              └─ <TriggerEditor path="triggers" />
  │    │
  │    ├─ <ResizableHandle />
  │    │
  │    ├─ <ResizablePanel minSize={30} defaultSize={40}>
  │    │    └─ <BodyEditor>
  │    │         ├─ <EditorToolbar>
  │    │         │    ├─ <FormatButtons />   // Bold, Italic, Code, Link, List
  │    │         │    ├─ <InsertMenu />      // Insert template snippet, variable ref
  │    │         │    └─ <EditorModeToggle /> // Monaco / Simple
  │    │         └─ <MonacoMarkdownEditor /> // or <SimpleMarkdownEditor>
  │    │
  │    ├─ <ResizableHandle />
  │    │
  │    └─ <ResizablePanel minSize={20} defaultSize={30}>
  │         └─ <PreviewPanel>
  │              ├─ <PreviewHeader>
  │              │    ├─ <PreviewModeToggle /> // Rendered / Raw SKILL.md / YAML
  │              │    └─ <CopyButton />        // Copy full SKILL.md content
  │              └─ <SkillPreviewRenderer>
  │                   ├─ <SkillFrontmatterPreview /> // Pretty-printed frontmatter
  │                   └─ <MarkdownPreview />         // Rendered body
  │
  ├─ <TestSandboxPanel>                    // Bottom panel, toggled by Test button
  │    ├─ <TestSandboxHeader>
  │    │    ├─ <TestAgentSelector />       // Select agent to test against
  │    │    └─ <TestStatus />             // Running / Passed / Failed
  │    ├─ <TestPromptInput />             // What to say to the agent with this skill
  │    ├─ <TestResultStream />            // Streaming response display
  │    └─ <TestMetrics />                 // Token count, latency, cost of test
  │
  └─ <TemplateGalleryDialog>              // Modal on "New Skill"
       ├─ <TemplateGalleryHeader>
       │    ├─ <TemplateSearch />
       │    └─ <TemplateCategoryFilter />  // All, Tools, Automation, Analysis, etc.
       └─ <TemplateGrid>
            └─ <TemplateCard />*           // Name, description, preview, "Use" button
```

**Key Components:**

| Component | Props | Responsibility |
|-----------|-------|----------------|
| `SkillBuilderPage` | `skillId?: string` (edit mode) | Top-level page; manages layout, loads existing skill if editing |
| `FrontmatterEditor` | `values: FrontmatterValues`, `onChange: (values) => void`, `errors: ValidationErrors` | Form-based structured editor for YAML frontmatter fields |
| `FrontmatterSection` | `label: string`, `children`, `defaultOpen?: boolean` | Collapsible section within frontmatter editor (Radix Accordion) |
| `FieldInput` | `path: string`, `label?: string`, `placeholder?: string` | Generic text input connected to frontmatter form state |
| `FieldTagInput` | `path: string`, `label?: string`, `suggestions?: string[]` | Tag input with autocomplete for comma-separated values (like tags) |
| `ParameterListEditor` | `path: string` | Editable list of skill parameters with name, type, description, required toggle |
| `ParameterItem` | `index: number`, `parameter: SkillParameter`, `onChange`, `onRemove` | Single parameter row with editable fields |
| `ToolPermissionEditor` | `path: string` | Multi-select for allowed tools with "All Tools" shortcut |
| `TriggerEditor` | `path: string` | Editor for trigger conditions (cron, event, webhook) |
| `MonacoMarkdownEditor` | `value: string`, `onChange: (value: string) => void` | Monaco editor configured for Markdown with OpenClaw snippets |
| `SimpleMarkdownEditor` | `value: string`, `onChange: (value: string) => void` | Lightweight textarea fallback (no Monaco) |
| `EditorToolbar` | — | Formatting buttons that insert Markdown syntax at cursor position |
| `PreviewPanel` | `frontmatter: FrontmatterValues`, `body: string` | Live-rendered preview of the complete SKILL.md |
| `SkillPreviewRenderer` | `content: string` | Renders full SKILL.md as it would appear (frontmatter table + body) |
| `TestSandboxPanel` | `skillContent: string` | Sends skill to test endpoint, streams response, shows metrics |
| `TemplateGalleryDialog` | `isOpen`, `onSelect: (template: SkillTemplate) => void` | Grid of skill templates with search/filter |
| `TemplateCard` | `template: SkillTemplate`, `onSelect: () => void` | Card showing template name, description, tag badges, use button |

**Zustand Store — `useSkillBuilderStore`:**

```typescript
interface SkillBuilderState {
  // Skill data
  skillId: string | null;           // null = new skill
  name: string;
  frontmatter: FrontmatterValues;
  body: string;                     // Markdown content
  status: 'new' | 'draft' | 'saved' | 'published';

  // Derived
  fullContent: string;              // Compiled SKILL.md (frontmatter + body)
  validationErrors: ValidationError[];
  isDirty: boolean;

  // Test sandbox
  testAgent: string | null;
  testPrompt: string;
  testResult: string | null;
  testStatus: 'idle' | 'running' | 'passed' | 'failed';
  testMetrics: { tokens: number; latencyMs: number; costUsd: number } | null;

  // UI
  activePanel: 'frontmatter' | 'body' | 'preview';
  isTemplateGalleryOpen: boolean;
  isTestPanelOpen: boolean;
  editorMode: 'monaco' | 'simple';

  // Actions
  setName: (name: string) => void;
  setFrontmatter: (values: Partial<FrontmatterValues>) => void;
  setBody: (body: string) => void;
  loadSkill: (skillId: string) => Promise<void>;
  loadTemplate: (template: SkillTemplate) => void;
  saveDraft: () => Promise<void>;
  publish: () => Promise<void>;
  runTest: () => Promise<void>;
  cancelTest: () => void;
  validate: () => ValidationError[];
  reset: () => void;
  compileContent: () => string;
}

interface FrontmatterValues {
  name: string;
  description: string;
  version: string;
  author: string;
  model?: string;
  thinking?: 'off' | 'low' | 'medium' | 'high';
  tags: string[];
  enabled: boolean;
  parameters: SkillParameter[];
  tools: string[] | 'all';
  triggers: SkillTrigger[];
  [key: string]: unknown;  // Extensible
}

interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  description: string;
  required: boolean;
  default?: unknown;
  options?: string[];  // For select type
}

interface SkillTrigger {
  type: 'cron' | 'event' | 'webhook' | 'command';
  value: string;
  description?: string;
}

interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  frontmatter: Partial<FrontmatterValues>;
  body: string;
  previewImage?: string;
}
```

### 9.4 Interaction Patterns

**New Skill Flow:**
1. Click "New Skill" → Template Gallery Dialog opens with animated grid (`framer-motion staggerChildren: 0.05`)
2. Browse/search templates → hover card for preview → click "Use This Template"
3. Template populates frontmatter and body → all three panels visible
4. User edits frontmatter fields (form inputs on left) → live preview updates on right (debounced 300ms)
5. User writes/edits Markdown body (center panel) → live preview updates
6. Periodic auto-save to localStorage (every 30s)
7. "Save Draft" → saves to server API → status badge changes to "Draft"

**Edit Existing Skill:**
- Navigate to skill list → click skill → SkillBuilderPage loads with `skillId`
- Existing SKILL.md parsed → frontmatter fields populated, body loaded in editor
- Same edit flow as new skill

**Test Flow:**
1. Click "Test Skill" → test panel slides up from bottom (250ms, `framer-motion`)
2. Select test agent from dropdown (defaults to current user's default agent)
3. Type test prompt → press Enter or click "Run Test"
4. Response streams in real-time (SSE or WebSocket)
5. On completion: status badge (✓ Passed / ✗ Failed), metrics shown
6. Can run multiple tests without closing panel

**Publish Flow:**
1. Click "Publish" → validation runs first
2. If validation errors → error toast + scroll to first error field
3. If valid → Publish dialog opens:
   - ClawhHub authentication status
   - Visibility: Public / Private / Unlisted
   - Changelog entry (optional)
   - "Publish to ClawhHub" button
4. On success → status badge "Published", link to ClawhHub page shown
5. Gateway skill reload triggered automatically

**Template Gallery:**
- Grid of cards (3 columns on desktop, 2 on tablet, 1 on mobile)
- Categories: "Getting Started", "Tool Skills", "Automation", "Analysis", "Communication", "Custom"
- Search filters by name, description, tags
- "Blank Skill" always first option (minimal template)
- Hover card: scale 1.02, subtle shadow elevation, 150ms transition

**Monaco Editor Features:**
- Language: Markdown with custom OpenClaw snippets
- Snippets: `skill:param` → inserts parameter template, `skill:trigger` → inserts trigger block
- Autocomplete for variable references: `{{param.name}}`, `{{agent.name}}`
- Keyboard shortcuts: `Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+K` link
- Minimap enabled for long skill documents
- Word wrap on by default

**Keyboard Shortcuts:**

| Key | Action |
|-----|--------|
| `Ctrl+S` | Save draft |
| `Ctrl+Shift+T` | Open test sandbox |
| `Ctrl+Shift+P` | Publish |
| `Ctrl+N` | New skill (opens template gallery) |
| `Ctrl+1` | Focus frontmatter panel |
| `Ctrl+2` | Focus body editor |
| `Ctrl+3` | Focus preview panel |
| `Ctrl+Shift+V` | Toggle preview mode (rendered/raw/YAML) |
| `Escape` | Close test panel / template gallery |

**Animations:**
- Panel resize: CSS `transition: flex-basis 0ms` (instant, handled by react-resizable-panels)
- Template gallery cards: staggered entrance `framer-motion` `initial={{ opacity: 0, y: 20 }}`, `animate={{ opacity: 1, y: 0 }}`, stagger 50ms
- Test panel: slide up `framer-motion` `initial={{ y: '100%' }}`, `animate={{ y: 0 }}`, 250ms ease-out
- Save indicator: pulse green dot next to status badge, 2 cycles, 400ms each
- Validation error: field label turns red + shake animation (150ms), scroll to first error

### 9.5 Wireframe Description

**Skill Builder — Full IDE Layout:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Skill Builder                                                              │
│  Name: [ My Custom Skill          ]  Status: ● Draft   v1.0.0             │
│                           [Save Draft] [🧪 Test] [🚀 Publish] [⋯ More]    │
├──────────────────┬────────────────────────────┬─────────────────────────────┤
│  FRONTMATTER     │  BODY (Markdown)           │  PREVIEW                   │
│                  │                             │                            │
│  ▾ Identity      │  [B][I][`][🔗][≡][📋]     │  [Rendered│Raw│YAML] [📋]  │
│  ┌────────────┐ │  ─────────────────────────  │                            │
│  │Name        │ │  1│ # My Custom Skill      │  ┌──────────────────────┐  │
│  │[My Custom ]│ │  2│                         │  │ name: My Custom Skill│  │
│  │            │ │  3│ You are a specialized   │  │ model: claude-sonnet  │  │
│  │Description │ │  4│ assistant that helps    │  │ tags: automation, ...│  │
│  │[A skill for│ │  5│ users with...           │  │ parameters: 2        │  │
│  │ doing X   ]│ │  6│                         │  └──────────────────────┘  │
│  │            │ │  7│ ## Instructions         │                            │
│  │Version     │ │  8│                         │  ────────────────────────  │
│  │[1.0.0     ]│ │  9│ When invoked:           │                            │
│  │            │ │ 10│ 1. First, analyze the   │  # My Custom Skill         │
│  │Author      │ │ 11│    input parameters     │                            │
│  │[David     ]│ │ 12│ 2. Then, execute the    │  You are a specialized     │
│  └────────────┘ │ 13│    appropriate tool      │  assistant that helps      │
│                  │ 14│ 3. Return formatted     │  users with...             │
│  ▾ Configuration │ 15│    results               │                            │
│  ┌────────────┐ │ 16│                         │  ## Instructions            │
│  │Model       │ │ 17│ ## Parameters           │                            │
│  │[claude-son▾│ │ 18│                         │  When invoked:              │
│  │            │ │ 19│ - `query`: The search   │  1. First, analyze the     │
│  │Tags        │ │ 20│   term to look up       │     input parameters       │
│  │[automation]│ │ 21│ - `format`: Output      │  2. Then, execute the      │
│  │[+ add tag ]│ │ 22│   format (json|text)    │     appropriate tool       │
│  │            │ │  ~│                         │  3. Return formatted        │
│  │Thinking    │ │   │                         │     results                 │
│  │[medium   ▾]│ │   │                         │                            │
│  │            │ │   │                         │                            │
│  │Enabled     │ │   │                         │                            │
│  │[━━━━━●] On│ │   │                         │                            │
│  └────────────┘ │   │                         │                            │
│                  │   │                         │                            │
│  ▾ Parameters    │   │                         │                            │
│  ┌────────────┐ │   │                         │                            │
│  │ query      │ │   │                         │                            │
│  │ type:string│ │   │                         │                            │
│  │ req: ✓     │ │   │                         │                            │
│  │ ──────────│ │   │                         │                            │
│  │ format    │ │   │                         │                            │
│  │ type:select│ │   │                         │                            │
│  │ req: ✗     │ │   │                         │                            │
│  │ [+ Add]   │ │   │                         │                            │
│  └────────────┘ │   │                         │                            │
│                  │   │                         │                            │
│  ▸ Tools         │   │                         │                            │
│  ▸ Triggers      │   │                         │                            │
├──────────────────┴───┴─────────────────────────┴─────────────────────────────┤
│  🧪 Test Sandbox                                              [▴ Collapse]  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Agent: [test-agent ▾]   Status: ● Running    Tokens: 1,234          │   │
│  │                                                                      │   │
│  │ Prompt: [ Search for React hooks documentation            ] [Run ▶] │   │
│  │                                                                      │   │
│  │ Response:                                                            │   │
│  │ ┌────────────────────────────────────────────────────────────────┐  │   │
│  │ │ I found the following React hooks documentation:               │  │   │
│  │ │                                                                │  │   │
│  │ │ 1. **useState** - State management hook...                     │  │   │
│  │ │ 2. **useEffect** - Side effect hook...                         │  │   │
│  │ │ █ (streaming...)                                               │  │   │
│  │ └────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Template Gallery Dialog:**
```
┌───────────────────────────────────────────────────────────────┐
│  Choose a Template                                    [✕]     │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ 🔍 Search templates...                                │   │
│  └───────────────────────────────────────────────────────┘   │
│  [All] [Getting Started] [Tools] [Automation] [Analysis]     │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 📄            │  │ 🔧            │  │ 🔄            │       │
│  │ Blank Skill   │  │ Tool Wrapper  │  │ Automation    │       │
│  │               │  │               │  │               │       │
│  │ Start from    │  │ Wrap a CLI    │  │ Scheduled     │       │
│  │ scratch       │  │ tool as skill │  │ workflow      │       │
│  │               │  │               │  │               │       │
│  │ [Use →]       │  │ [Use →]       │  │ [Use →]       │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 📊            │  │ 📨            │  │ 🧠            │       │
│  │ Data Analysis │  │ Notification  │  │ Research      │       │
│  │               │  │               │  │ Agent         │       │
│  │ Analyze data  │  │ Send alerts   │  │ Deep research │       │
│  │ and report    │  │ via channels  │  │ with sources  │       │
│  │               │  │               │  │               │       │
│  │ [Use →]       │  │ [Use →]       │  │ [Use →]       │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────────────────────────────────────────┘
```

### 9.6 Data Model & API Integration

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/skills` | List all skills (local + installed from ClawhHub) |
| `GET` | `/api/skills/:id` | Get skill details (parsed frontmatter + body) |
| `POST` | `/api/skills` | Create new skill |
| `PUT` | `/api/skills/:id` | Update existing skill |
| `DELETE` | `/api/skills/:id` | Delete skill |
| `GET` | `/api/skills/templates` | Get available templates |
| `POST` | `/api/skills/test` | Test a skill against an agent (streaming response) |
| `POST` | `/api/skills/publish` | Publish skill to ClawhHub |
| `POST` | `/api/skills/validate` | Server-side validation of skill content |
| `POST` | `/rpc/gateway.skills.reload` | Reload skills in gateway (after save/publish) |

**Data Shapes:**

```typescript
interface Skill {
  id: string;
  name: string;
  path: string;                // Filesystem path to SKILL.md
  frontmatter: FrontmatterValues;
  body: string;
  rawContent: string;          // Full SKILL.md content
  status: 'local' | 'published';
  publishedVersion?: string;
  clawhubUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface SkillTestRequest {
  skillContent: string;        // Full SKILL.md content to test
  agentId: string;
  prompt: string;
  timeout?: number;            // Max test duration in seconds
}

interface SkillTestResponse {
  status: 'success' | 'error';
  response: string;            // Agent's response
  metrics: {
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costUsd: number;
    toolCalls: number;
  };
  errors?: string[];
}

interface SkillPublishRequest {
  skillId: string;
  visibility: 'public' | 'private' | 'unlisted';
  changelog?: string;
}

interface SkillPublishResponse {
  success: boolean;
  clawhubUrl: string;
  publishedVersion: string;
}
```

### 9.7 Accessibility Considerations

- **Panel Navigation:** Each panel has `role="region"` with `aria-label` ("Frontmatter editor", "Body editor", "Preview"). `Ctrl+1/2/3` shortcuts move focus between panels.
- **Monaco Editor Accessibility:** Monaco has built-in screen reader support (`accessibilitySupport: 'on'`). Additional: `aria-label="Skill body Markdown editor"`.
- **Frontmatter Form:** All form fields have proper `<label>` associations. Validation errors announced via `aria-live`. Section accordions use Radix Accordion (built-in ARIA).
- **Template Gallery:** Grid uses `role="grid"` with `role="gridcell"` for cards. Arrow key navigation between cards. `Enter` to select.
- **Test Sandbox:** Streaming response has `aria-live="polite"` (announced in chunks, not character-by-character). Status changes announced: "Test started", "Test completed successfully".
- **Keyboard Navigation:** Full keyboard support for all actions. Tab order: header → frontmatter → body → preview → test panel. Escape closes dialogs and panels.
- **Focus Management:** Opening template gallery traps focus in dialog. Closing returns focus to "New Skill" button. Opening test panel moves focus to prompt input.
- **Color:** Template category filters don't rely on color alone; text labels always visible. Test status uses icon + text + color.

### 9.8 Phasing Plan

**Phase 1 — Basic Editor & Save (2 weeks)**
- Three-panel layout with `react-resizable-panels`
- `FrontmatterEditor` with Identity and Configuration sections (form fields)
- `SimpleMarkdownEditor` (textarea, no Monaco yet) for body
- `PreviewPanel` with `react-markdown` rendering
- YAML parsing/stringification with `js-yaml`
- Save/load skill via API endpoints
- Gateway skill reload on save
- Zod validation for frontmatter
- **Deliverable:** Create, edit, and save skills via Web UI with live preview

**Phase 2 — Templates & Rich Editing (1.5 weeks)**
- `TemplateGalleryDialog` with 6-8 starter templates
- `ParameterListEditor` with add/remove/reorder
- `ToolPermissionEditor` with multi-select
- `TriggerEditor` for cron/event/webhook triggers
- `EditorToolbar` with formatting buttons
- Monaco editor integration (lazy-loaded, behind feature flag)
- Auto-save to localStorage every 30s
- **Deliverable:** Template gallery, full frontmatter editing, Monaco option

**Phase 3 — Test Sandbox (1.5 weeks)**
- `TestSandboxPanel` with agent selector and prompt input
- Streaming response display via SSE
- Test metrics display (tokens, latency, cost)
- `POST /api/skills/test` endpoint
- Multiple test runs with history (last 5 tests)
- **Deliverable:** Test skills against agents directly in the builder

**Phase 4 — Publish & Polish (1 week)**
- ClawhHub publish flow (`POST /api/skills/publish`)
- Publish dialog with visibility, changelog
- Version management (bump major/minor/patch)
- Skill export/import (download/upload SKILL.md file)
- Duplicate skill functionality
- Keyboard shortcuts
- Mobile-responsive layout (stack panels vertically)
- **Deliverable:** Full publish workflow, polished experience

### 9.9 Open Questions & Risks

1. **Monaco Bundle Size:** ~2MB for full Monaco. **Mitigation:** Lazy-load behind feature flag; default to simple textarea; only load Monaco when user opts in or on desktop with fast connection.
2. **ClawhHub API:** Publish API may not exist yet or may require authentication flow. **Risk:** Phase 4 blocked. **Mitigation:** Design publish UI now; implement against mock; integrate real API when available.
3. **Gateway Skill Reload:** Does `gateway.skills.reload` work reliably? Could it disrupt running sessions? **Mitigation:** Reload only affects new sessions; existing sessions continue with old skill version. Test thoroughly.
4. **Template Maintenance:** Who creates and maintains templates? Stale templates are worse than none. **Mitigation:** Start with 6 curated templates; community-contributed templates in Phase 5.
5. **Test Sandbox Cost:** Each test invocation costs real tokens. Users might run excessive tests. **Mitigation:** Test uses cheapest available model by default; configurable; show cost estimate before running.
6. **Skill Validation Depth:** Client-side validation catches schema errors, but can't verify that tool references exist or that triggers are valid. **Mitigation:** Server-side validation endpoint performs deep validation before save.
7. **Concurrent Editing:** Two users editing the same skill simultaneously. **Mitigation:** Optimistic locking with `updatedAt` timestamp; warn if conflict detected on save.

---

## IDEA 10: Inline Documentation & Contextual Help System

### 10.1 Overview

Surface relevant documentation inline exactly where users need it, eliminating the context-switch of leaving the app to find answers. Hovering a config field shows a rich tooltip with explanation and doc link. Encountering an error shows a specific explanation with resolution steps. Clicking "Learn more" on any element opens a slide-over panel with the relevant documentation section — all without navigating away from the current page. With 642 existing doc files and config schema UI hints already providing label/help metadata, the system builds a content mapping layer that connects every UI element to its corresponding documentation, creating a self-documenting application.

### 10.2 Technical Approach

**Framework & Libraries:**
- React 18+ with `createPortal` for tooltip rendering outside component tree
- Radix `Tooltip`, `Popover`, `Sheet` (slide-over panel) primitives from Shadcn
- `react-markdown` + `remark-gfm` for rendering doc content in the slide-over panel
- `zustand` for help system state (active help context, panel open/closed, history)
- `fuse.js` for fuzzy search across doc content index
- `rehype-highlight` for syntax highlighting in doc code blocks
- Custom `DocContentProvider` that fetches and caches doc content on demand
- `framer-motion` for tooltip entrance, slide-over panel, error help expansion
- CSS Modules + Tailwind for tooltip/panel styling

**Rendering Strategy:**
- Help tooltips: Radix `Tooltip` with custom content renderer, positioned automatically
- Error help: Inline expandable section below error message, rendered with `AnimatePresence`
- Slide-over panel: Radix `Sheet` from right side, 400px wide, with scroll and search
- Doc content: Fetched on demand from `/api/docs/:path`, cached in memory (LRU cache, 50 entries)
- Content mapping: Static JSON map of UI element IDs → doc paths, loaded at app init

**Data Flow:**
```
UI Element (hover/click) → resolve elementId to docPath via ContentMap
  → Check DocCache → if miss, fetch from /api/docs/:path
  → Render content in Tooltip / SlideOverPanel / ErrorHelp
  → Track help views for analytics (POST /api/analytics/help-view)
```

**Doc Ingestion Pipeline:**
```
docs.openclaw.ai source files (Markdown)
  → Build-time: parse all 642 files → extract frontmatter, headings, sections
  → Generate content-map.json (elementId → docPath#section mapping)
  → Generate search-index.json (for fuse.js client-side search)
  → Deploy to /api/docs/* endpoint (or static CDN)
  → Nightly sync: detect changes in docs repo → rebuild indexes
```

### 10.3 Component Architecture

```
<App>
  └─ <HelpSystemProvider>                  // Context provider for help state
       ├─ <DocContentCache>               // In-memory LRU cache manager
       ├─ <SlideOverHelpPanel>            // Global slide-over panel (right side)
       │    ├─ <HelpPanelHeader>
       │    │    ├─ <HelpBreadcrumb />     // Doc path breadcrumb
       │    │    ├─ <HelpSearch />         // Search within docs
       │    │    └─ <CloseButton />
       │    ├─ <HelpPanelContent>
       │    │    ├─ <DocRenderer />        // Markdown → React rendering
       │    │    │    ├─ <DocHeading />*
       │    │    │    ├─ <DocParagraph />*
       │    │    │    ├─ <DocCodeBlock />*
       │    │    │    ├─ <DocImage />*
       │    │    │    └─ <DocLink />*      // Internal links navigate within panel
       │    │    └─ <RelatedDocs />        // "See also" links at bottom
       │    └─ <HelpPanelFooter>
       │         ├─ <HelpfulnessRating />  // 👍 👎 feedback
       │         ├─ <OpenInDocsButton />   // "Open full docs" → new tab
       │         └─ <HelpHistory />        // Back/forward within panel
       │
       └─ <Page>
            ├─ <HelpTooltip elementId="config.port">
            │    └─ <Input label="Port" />
            ├─ <HelpTooltip elementId="config.model">
            │    └─ <Select label="Model" />
            ├─ <ErrorWithHelp errorCode="E001">
            │    └─ <ErrorMessage />
            └─ <LearnMoreLink docPath="guides/skills" />
```

**Key Components:**

| Component | Props | Responsibility |
|-----------|-------|----------------|
| `HelpSystemProvider` | `children`, `contentMapUrl?: string` | Loads content map, provides help context to all children |
| `DocContentCache` | — | LRU cache (50 entries) for fetched doc content; invisible service component |
| `HelpTooltip` | `elementId: string`, `children`, `side?: 'top' \| 'right' \| 'bottom' \| 'left'`, `delay?: number` | Wraps any element with a rich help tooltip; resolves `elementId` to doc content |
| `HelpTooltipContent` | `elementId: string`, `title: string`, `description: string`, `docLink?: string` | Rendered inside tooltip: title, description, "Learn more →" link |
| `ErrorWithHelp` | `errorCode: string`, `errorMessage: string`, `children` | Wraps error display with expandable help section specific to the error |
| `ErrorHelpExpander` | `errorCode: string`, `isExpanded: boolean`, `onToggle: () => void` | Expandable section below error: explanation, resolution steps, doc link |
| `LearnMoreLink` | `docPath: string`, `section?: string`, `label?: string` | Inline "Learn more" link that opens slide-over panel to specific doc |
| `SlideOverHelpPanel` | — (reads from store) | Global slide-over panel (Radix Sheet) rendering doc content |
| `HelpPanelHeader` | `breadcrumb: string[]`, `onClose: () => void` | Header with breadcrumb path, search, close button |
| `HelpSearch` | `onSelect: (docPath: string) => void` | Fuse.js powered search input within the help panel |
| `DocRenderer` | `content: string`, `baseUrl?: string` | Converts Markdown doc content to React components |
| `DocHeading` | `level: 1-6`, `id: string`, `children` | Heading with anchor link; scrolls into view when targeted |
| `DocCodeBlock` | `language: string`, `code: string` | Syntax-highlighted code block with copy button |
| `DocLink` | `href: string`, `children` | Internal doc links navigate within panel; external open new tab |
| `RelatedDocs` | `currentPath: string`, `relatedPaths: string[]` | "See also" section at bottom of doc content |
| `HelpfulnessRating` | `docPath: string`, `onRate: (helpful: boolean) => void` | 👍/👎 buttons for doc quality feedback |
| `HelpHistory` | — (reads from store) | Back/forward navigation within panel doc history |
| `OpenInDocsButton` | `docPath: string` | Opens the full doc page on docs.openclaw.ai in a new tab |

**Zustand Store — `useHelpSystemStore`:**

```typescript
interface HelpSystemState {
  // Content Map
  contentMap: Record<string, ContentMapEntry>;
  errorMap: Record<string, ErrorHelpEntry>;
  isContentMapLoaded: boolean;

  // Panel
  isPanelOpen: boolean;
  currentDocPath: string | null;
  currentSection: string | null;
  panelHistory: { docPath: string; section?: string }[];
  panelHistoryIndex: number;

  // Search
  searchQuery: string;
  searchResults: DocSearchResult[];
  searchIndex: unknown;  // Fuse.js index

  // Cache
  docCache: Map<string, { content: string; fetchedAt: number }>;
  maxCacheSize: number;  // 50

  // Analytics
  helpViews: { elementId: string; timestamp: string }[];

  // Actions
  loadContentMap: () => Promise<void>;
  openPanel: (docPath: string, section?: string) => void;
  closePanel: () => void;
  navigatePanel: (docPath: string, section?: string) => void;
  panelBack: () => void;
  panelForward: () => void;
  search: (query: string) => void;
  clearSearch: () => void;
  fetchDoc: (docPath: string) => Promise<string>;
  getTooltipContent: (elementId: string) => TooltipContent | null;
  getErrorHelp: (errorCode: string) => ErrorHelpContent | null;
  trackHelpView: (elementId: string) => void;
  rateHelpfulness: (docPath: string, helpful: boolean) => void;
}

interface ContentMapEntry {
  elementId: string;            // UI element identifier
  title: string;                // Tooltip title
  description: string;          // Short description (1-2 sentences)
  docPath: string;              // Full doc path for slide-over
  docSection?: string;          // Specific section anchor
  keywords: string[];           // For search relevance
}

interface ErrorHelpEntry {
  errorCode: string;
  title: string;
  explanation: string;          // What went wrong
  resolutionSteps: string[];    // Step-by-step fix
  docPath?: string;             // Detailed doc link
  relatedErrors?: string[];     // Related error codes
}

interface DocSearchResult {
  docPath: string;
  title: string;
  excerpt: string;
  score: number;
  section?: string;
}

interface TooltipContent {
  title: string;
  description: string;
  hasMoreDocs: boolean;
  docPath?: string;
}

interface ErrorHelpContent {
  title: string;
  explanation: string;
  steps: string[];
  docPath?: string;
}
```

### 10.4 Interaction Patterns

**Help Tooltip Flow:**
1. User hovers over a UI element wrapped in `<HelpTooltip>` for 500ms (configurable delay)
2. Tooltip appears with: title, 1-2 sentence description, "Learn more →" link
3. Tooltip rendered via Radix `Tooltip` with smart positioning (avoids viewport edges)
4. Mouse moves to tooltip → tooltip stays open (Radix `delayDuration={500}`, `skipDelayDuration={300}`)
5. Click "Learn more →" → slide-over panel opens with full doc section
6. Tooltip dismisses on mouse leave or `Escape`

**Error Help Flow:**
1. Error appears in UI (API error, validation error, operation failure)
2. Below error message, subtle "Why did this happen? →" link appears
3. Click → expand inline section with: explanation paragraph, numbered resolution steps, "View docs →"
4. Expand animation: `framer-motion` height 0 → auto, 250ms
5. "View docs →" opens slide-over panel with detailed error documentation
6. Click again or `Escape` → collapse

**Slide-Over Panel Flow:**
1. Triggered from tooltip "Learn more", error help "View docs", or any `<LearnMoreLink>`
2. Panel slides in from right, 400px wide, pushing nothing (overlay with backdrop)
3. Backdrop: `bg-black/20`, click to close
4. Doc content loads (from cache or fetch) → rendered as formatted Markdown
5. Internal doc links (other doc pages referenced) navigate within the panel (push to history)
6. Back/Forward buttons navigate panel history (like a mini browser)
7. "Open full docs" button → opens docs.openclaw.ai in new tab
8. `Escape` or click backdrop → panel slides out

**Search Within Panel:**
1. Click search icon in panel header → search input appears
2. Type query → fuse.js fuzzy search across doc index
3. Results show below input: title, excerpt with match highlights, section
4. Click result → navigate panel to that doc
5. `Escape` clears search and returns to current doc
6. `↑`/`↓` arrows navigate search results, `Enter` selects

**Keyboard Shortcuts:**

| Key | Action |
|-----|--------|
| `F1` | Open help panel (contextual — opens doc for focused element if mapped) |
| `Escape` | Close help panel / dismiss tooltip / collapse error help |
| `Alt+←` | Panel: navigate back |
| `Alt+→` | Panel: navigate forward |
| `Ctrl+Shift+/` | Toggle help tooltips on/off globally |

**Animations:**
- Tooltip entrance: `framer-motion` `initial={{ opacity: 0, scale: 0.95 }}`, `animate={{ opacity: 1, scale: 1 }}`, 150ms
- Slide-over panel: Radix Sheet default slide animation from right, 250ms ease-out
- Error help expand: `framer-motion AnimatePresence` height 0 → auto, 250ms ease-out
- "Learn more" link hover: underline animates in from left, 150ms
- Search results: staggered fade-in, 50ms delay per result, 100ms duration

### 10.5 Wireframe Description

**Help Tooltip on Config Field:**
```
                         ┌─────────────────────────────────┐
                         │ Port                    ℹ️       │
                         │ ┌──────────────┐                │
                         │ │ 3000         │                │
                         │ └──────────────┘                │
                         └──────────┬──────────────────────┘
                                    │
                    ┌───────────────▼────────────────────┐
                    │  🔧 Gateway Port                    │
                    │                                     │
                    │  The TCP port the OpenClaw gateway  │
                    │  listens on for incoming requests.  │
                    │  Default: 3000. Range: 1024–65535.  │
                    │                                     │
                    │  Learn more →                       │
                    └─────────────────────────────────────┘
```

**Error with Inline Help:**
```
┌──────────────────────────────────────────────────────────────┐
│  ✗ Error: Agent "luis" failed to start                       │
│    Model "anthropic/claude-opus-5" not found                 │
│                                                              │
│    Why did this happen? ▾                                    │
│    ┌──────────────────────────────────────────────────────┐ │
│    │  The specified model identifier doesn't match any     │ │
│    │  available model in your configuration.               │ │
│    │                                                        │ │
│    │  To fix this:                                          │ │
│    │  1. Check the model name for typos                     │ │
│    │  2. Run `openclaw models list` to see available models│ │
│    │  3. Update the agent's model in Settings > Agents     │ │
│    │  4. Ensure your API key supports this model            │ │
│    │                                                        │ │
│    │  📖 View documentation →                               │ │
│    └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Slide-Over Help Panel:**
```
┌─── Main Application Page ──────────────┬──── Help Panel (400px) ─────────┐
│                                        │  ← → 🔍                    [✕]  │
│                                        │  Docs > Configuration > Port    │
│                                        │  ─────────────────────────────  │
│                                        │                                 │
│  (whatever page user is on)            │  # Gateway Port                 │
│                                        │                                 │
│  The UI remains fully visible          │  The gateway port determines    │
│  and interactive behind the            │  which TCP port the OpenClaw    │
│  semi-transparent backdrop.            │  gateway process binds to.      │
│                                        │                                 │
│                                        │  ## Default Value               │
│                                        │                                 │
│                                        │  `3000`                         │
│                                        │                                 │
│                                        │  ## Configuration               │
│                                        │                                 │
│                                        │  Set via CLI:                   │
│                                        │  ```bash                        │
│                                        │  openclaw config set port 8080  │
│                                        │  ```                            │
│                                        │                                 │
│                                        │  Or in `openclaw.json`:         │
│                                        │  ```json                        │
│                                        │  { "port": 8080 }              │
│                                        │  ```                            │
│                                        │                                 │
│                                        │  ## Important Notes             │
│                                        │                                 │
│                                        │  - Ports below 1024 require     │
│                                        │    elevated privileges           │
│                                        │  - Changing the port requires   │
│                                        │    a gateway restart             │
│                                        │                                 │
│                                        │  ─────────────────────────────  │
│                                        │  📎 See also:                   │
│                                        │  • Gateway Configuration Guide  │
│                                        │  • Network Setup                │
│                                        │  • Reverse Proxy Setup          │
│                                        │  ─────────────────────────────  │
│                                        │  Was this helpful? 👍 👎        │
│                                        │                                 │
│                                        │  [Open full docs ↗]            │
└────────────────────────────────────────┴─────────────────────────────────┘
```

**Help Search Within Panel:**
```
┌──── Help Panel ──────────────────────────┐
│  ← →                                [✕]  │
│  ┌─────────────────────────────────────┐ │
│  │ 🔍 cron scheduling                  │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  Search Results (5):                     │
│  ┌───────────────────────────────────┐  │
│  │ 📄 Cron Scheduling Guide          │  │
│  │    Set up recurring tasks with     │  │
│  │    **cron** expressions...         │  │
│  ├───────────────────────────────────┤  │
│  │ 📄 Cron Expression Reference      │  │
│  │    Complete reference for **cron** │  │
│  │    syntax and operators...         │  │
│  ├───────────────────────────────────┤  │
│  │ 📄 Agent Configuration > Schedule │  │
│  │    Configure agent **scheduling**  │  │
│  │    using cron triggers...          │  │
│  ├───────────────────────────────────┤  │
│  │ 📄 Heartbeat & Cron Tasks         │  │
│  │    Difference between heartbeats   │  │
│  │    and **cron** tasks...           │  │
│  ├───────────────────────────────────┤  │
│  │ 📄 Troubleshooting > Scheduling   │  │
│  │    Common **cron scheduling**      │  │
│  │    issues and fixes...             │  │
│  └───────────────────────────────────┘  │
│                                          │
│  Press ↑↓ to navigate, Enter to select  │
└──────────────────────────────────────────┘
```

### 10.6 Data Model & API Integration

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/docs/content-map` | Fetch UI element → doc path mapping |
| `GET` | `/api/docs/error-map` | Fetch error code → help content mapping |
| `GET` | `/api/docs/search-index` | Fetch fuse.js search index (pre-built) |
| `GET` | `/api/docs/:path` | Fetch individual doc content (Markdown) |
| `GET` | `/api/docs/:path/metadata` | Fetch doc metadata (title, related, section list) |
| `POST` | `/api/docs/feedback` | Submit helpfulness rating |
| `POST` | `/api/analytics/help-view` | Track help tooltip/panel views |

**Data Shapes:**

```typescript
// Content map (loaded once at app init)
interface ContentMap {
  version: string;
  lastUpdated: string;
  elements: Record<string, ContentMapEntry>;
  // Key is elementId like "config.port", "agents.model", "error.E001"
}

// Error map
interface ErrorMap {
  version: string;
  errors: Record<string, ErrorHelpEntry>;
  // Key is error code like "E001", "AGENT_START_FAILED", etc.
}

// Search index (loaded on first search)
interface DocSearchIndex {
  version: string;
  documents: Array<{
    path: string;
    title: string;
    headings: string[];
    excerpt: string;        // First 200 chars
    keywords: string[];
    sections: Array<{
      id: string;
      title: string;
      excerpt: string;
    }>;
  }>;
}

// Individual doc response
interface DocContent {
  path: string;
  title: string;
  content: string;          // Full Markdown content
  frontmatter: {
    title: string;
    description?: string;
    category?: string;
    tags?: string[];
    lastUpdated?: string;
  };
  relatedDocs: Array<{
    path: string;
    title: string;
  }>;
  sections: Array<{
    id: string;
    title: string;
    level: number;
  }>;
}

// Feedback request
interface DocFeedbackRequest {
  docPath: string;
  helpful: boolean;
  elementId?: string;       // Which UI element triggered the view
  comment?: string;         // Optional text feedback
}

// Analytics event
interface HelpViewEvent {
  elementId: string;
  viewType: 'tooltip' | 'error_help' | 'panel';
  docPath?: string;
  timestamp: string;
  durationMs?: number;      // How long user viewed the help
}
```

**Content Map Generation Pipeline:**

```typescript
// Build-time script: generate-content-map.ts
// Input: docs/ directory (642 files) + ui-element-registry.json (manual mapping)
// Output: content-map.json, error-map.json, search-index.json

interface UIElementRegistryEntry {
  elementId: string;
  docPath: string;
  docSection?: string;
  shortDescription: string;
  // Manually authored mapping
}

// Process:
// 1. Parse ui-element-registry.json for manual mappings
// 2. For unmapped elements with config schema UI hints:
//    auto-generate from hint.label + hint.help
// 3. Parse all doc files → extract headings, sections, frontmatter
// 4. Build fuse.js index from doc content
// 5. Output JSON files to /public/api/docs/
```

### 10.7 Accessibility Considerations

- **Tooltips:** Radix Tooltip handles ARIA automatically: `role="tooltip"`, `aria-describedby` on trigger element. Tooltips accessible via keyboard focus (not just hover).
- **Slide-Over Panel:** Radix Sheet provides `role="dialog"`, focus trap, `aria-label="Help documentation"`. Close via `Escape`, close button, or backdrop click.
- **Error Help Expander:** Uses `aria-expanded` on the toggle button, `aria-controls` pointing to expandable content. Content region has `role="region"`, `aria-label="Error explanation"`.
- **Search:** Search input has `aria-label="Search documentation"`. Results list has `role="listbox"`, each result `role="option"`. `aria-activedescendant` tracks keyboard-selected result.
- **Doc Content:** Rendered Markdown maintains heading hierarchy. Code blocks have `aria-label` describing the language. Images have alt text from Markdown.
- **Keyboard:** `F1` opens contextual help (standard convention). Tab through tooltip triggers. Arrow keys in search results. `Escape` closes everything.
- **Screen Reader:** "Learn more" links have `aria-label` with full context: "Learn more about gateway port configuration". Panel navigation announced: "Navigated to Cron Scheduling Guide".
- **Color:** Help icons (ℹ️) have both color and shape distinction. Error help section doesn't rely solely on red — uses icon + text.
- **Reduced Motion:** Slide-over appears instantly (no slide animation) when `prefers-reduced-motion` is active.

### 10.8 Phasing Plan

**Phase 1 — Tooltip System & Content Map (1.5 weeks)**
- Build `HelpTooltip` component wrapping Radix Tooltip
- Build `HelpTooltipContent` with title, description, "Learn more" link
- Create initial `content-map.json` for config fields (map from existing UI hints)
- Build `HelpSystemProvider` with content map loading
- Wire up `HelpTooltip` on all config form fields (Idea 8 integration)
- Build content map generation script (manual registry + auto from schema hints)
- **Deliverable:** Rich tooltips on all config fields with descriptions

**Phase 2 — Slide-Over Panel & Doc Rendering (1.5 weeks)**
- Build `SlideOverHelpPanel` with Radix Sheet
- Build `DocRenderer` (react-markdown with custom components)
- Build `DocContentCache` (LRU cache, 50 entries)
- Implement `/api/docs/:path` endpoint serving doc Markdown files
- Panel navigation (internal links, back/forward history)
- "Open full docs" external link
- Related docs section
- **Deliverable:** Click "Learn more" → slide-over panel with rendered doc content

**Phase 3 — Error Help & Search (1.5 weeks)**
- Build `ErrorWithHelp` and `ErrorHelpExpander` components
- Create `error-map.json` for top 20 most common errors
- Build `HelpSearch` with fuse.js integration
- Generate and serve `search-index.json`
- Search within panel with result navigation
- `F1` contextual help shortcut
- Helpfulness rating (👍/👎) with feedback endpoint
- **Deliverable:** Error-specific help, searchable docs, contextual F1 help

**Phase 4 — Pipeline & Analytics (1 week)**
- Automated doc ingestion pipeline (sync with docs.openclaw.ai repo)
- Nightly rebuild of content-map, error-map, search-index
- Help view analytics (track what users look up most)
- Analytics dashboard for content team (most viewed, most searched, lowest-rated)
- Expand content map to all UI surfaces (not just config)
- Content gap detection (UI elements without doc mapping)
- **Deliverable:** Automated pipeline, analytics, full coverage plan

### 10.9 Open Questions & Risks

1. **Content Map Maintenance:** Manual mapping of 642 docs to UI elements is significant effort. **Risk:** Mapping becomes stale as UI and docs evolve independently. **Mitigation:** Auto-generate from schema UI hints where possible; manual registry only for non-config elements. Build CI check that detects unmapped new UI elements.
2. **Doc Content Quality:** Existing docs may not be written for inline consumption (too long, too technical, missing practical examples). **Mitigation:** Start with config field tooltips (short descriptions already exist in UI hints). For slide-over panel, docs work as-is. Improve incrementally based on helpfulness ratings.
3. **Performance:** Loading 642 doc search index on first search could be slow. **Mitigation:** Pre-built fuse.js index is compact (~200KB for metadata only). Lazy-load on first search. Full doc content loaded on demand, not up-front.
4. **Doc Sync Freshness:** If docs.openclaw.ai updates, inline docs lag until pipeline runs. **Mitigation:** Nightly sync is sufficient; manual trigger available for urgent doc updates.
5. **Error Code Coverage:** OpenClaw may not have consistent error codes across all surfaces. **Mitigation:** Start with 20 most common errors (known from support tickets). Expand as error taxonomy improves.
6. **Bundle Size:** Fuse.js (~20KB) + react-markdown (~40KB) + remark plugins. **Mitigation:** Already using react-markdown elsewhere; fuse.js is small. Lazy-load search index. Total impact < 100KB.
7. **Content Mapping Granularity:** Should tooltips exist on every UI element or only complex/confusing ones? Too many = overwhelming; too few = unhelpful. **Mitigation:** Start with config fields and error messages. Expand based on analytics showing where users seek help most.

---

## Cross-Cutting Concerns (Ideas 6–10)

### Design System Consistency
All five ideas use the same Shadcn/Radix primitives, Tailwind tokens, and framer-motion animation curves. Shared constants:
- **Transition timing:** `ease: [0.25, 0.1, 0.25, 1]` (custom ease-out)
- **Fast transitions:** 150ms (tooltips, hover states, toggles)
- **Medium transitions:** 250ms (panels, sections, expanders)
- **Slow transitions:** 300-400ms (page-level transitions, complex animations)
- **Focus ring:** `ring-2 ring-blue-500 ring-offset-2` (consistent across all components)
- **Toast position:** top-right, stacked
- **Panel width:** 400px for slide-overs (help panel, teach-me panel)
- **Breakpoints:** sm: 640px, md: 768px, lg: 1024px, xl: 1280px

### Shared Infrastructure
- **Zustand stores:** All five features get their own store slices. Consider a root store with `combine()` for shared concerns (user preferences, feature flags).
- **API client:** All endpoints go through shared `apiClient` with auth, retry, error handling.
- **Feature flags:** All five features should be behind feature flags for phased rollout.
- **Analytics:** Shared analytics pipe (`POST /api/analytics/events`) for tracking feature usage across all five ideas.

### Integration Points
- **Idea 6 ↔ Idea 8:** Config form fields adapt complexity based on proficiency level.
- **Idea 6 ↔ Idea 10:** "Teach Me" content can pull from the doc content system.
- **Idea 7 ↔ Idea 9:** Test sandbox results in Skill Builder could link to session replay for debugging.
- **Idea 8 ↔ Idea 10:** Config fields have tooltips from the help system; config errors have inline help.
- **Idea 9 ↔ Idea 10:** Skill Builder surfaces relevant skill docs inline during authoring.


---

# TIER 3 — PLAN & PROTOTYPE

# Tier 3 — UI Implementation Specifications

> **Author:** Luis, Principal UX Engineer
> **Date:** 2026-02-21
> **Status:** Draft Specifications
> **Scope:** Ideas 11–15 (Tier 3 — High Ambition / Long Horizon)

These specifications cover the most ambitious UI features in the OpenClaw roadmap. Each requires significant engineering investment, cross-team coordination, and phased delivery. They represent the product's long-term differentiation.

---

## IDEA 11: Multi-Model A/B Testing & Comparison View

### 1. Overview

A dedicated interface for sending identical prompts to multiple LLM providers simultaneously and comparing outputs side-by-side with rich metadata. Users can evaluate response quality, latency, token usage, and cost across providers (Anthropic, OpenAI, Google, xAI, MiniMax, z.AI, OpenRouter) in a single view. An optional judge model can automatically score and rank outputs, enabling data-driven model selection for agent configurations.

### 2. Technical Approach

| Concern | Choice | Rationale |
|---------|--------|-----------|
| **Framework** | React 18+ with Suspense boundaries | Parallel streaming responses need concurrent rendering |
| **State Management** | Zustand store (`useComparisonStore`) | Lightweight, supports multiple independent slices for each model response |
| **Streaming** | Server-Sent Events (SSE) per model via existing Gateway API | Each model stream is independent; SSE allows progressive rendering |
| **Layout** | CSS Grid with `grid-template-columns: repeat(auto-fit, minmax(380px, 1fr))` | Fluid 1–4 column layout that adapts to model count |
| **Markdown Rendering** | `react-markdown` + `rehype-highlight` (shared with chat UI) | Consistent rendering across comparison panes |
| **Charts/Viz** | Recharts (bar charts for metadata comparison) | Already lightweight, tree-shakeable |
| **Diff View** | `diff-match-patch` library for optional text diff between outputs | Character-level diffing for precise comparison |
| **Animations** | Framer Motion for panel entry, stagger, reorder | Smooth UX when adding/removing models |

**Data Flow:**

```
User Input → ComparisonOrchestrator (client)
  ├─→ SSE Stream: Model A → ResponsePane A (progressive render)
  ├─→ SSE Stream: Model B → ResponsePane B (progressive render)
  ├─→ SSE Stream: Model C → ResponsePane C (progressive render)
  └─→ (all complete) → Optional JudgeModel evaluation → RankingOverlay
```

### 3. Component Architecture

```
<ComparisonWorkspace>                    // Top-level route wrapper
├── <ComparisonHeader>                   // Title, saved comparison selector, export button
├── <PromptInputPanel>                   // Shared prompt editor (Monaco or textarea)
│   ├── <SystemPromptToggle>             // Optional system prompt field
│   ├── <PromptEditor>                   // Rich text input with variable interpolation
│   └── <RunComparisonButton>            // Primary CTA — fires all models
├── <ModelSelectorBar>                   // Horizontal scrollable chip selector
│   ├── <ModelChip model provider isSelected onToggle />  // Individual model toggle
│   ├── <AddModelDropdown>               // Search + add from all available models
│   └── <PresetSelector>                 // Quick presets: "All Anthropic", "Budget Tier", "Frontier"
├── <ComparisonGrid>                     // CSS Grid container for response panes
│   └── <ResponsePane model status>      // One per selected model
│       ├── <PaneHeader>                 // Model name, provider icon, status badge
│       ├── <StreamingResponseBody>      // Markdown-rendered streaming content
│       ├── <MetadataFooter>             // Latency, tokens, cost, TTFT
│       └── <JudgeScoreBadge>            // Optional: score from judge model
├── <MetadataComparisonBar>              // Horizontal bar chart comparing all models
│   ├── <LatencyChart>                   // Bar chart: time to first token + total time
│   ├── <TokenChart>                     // Bar chart: input/output tokens per model
│   ├── <CostChart>                      // Bar chart: estimated cost per model
│   └── <QualityChart>                   // Bar chart: judge scores (if enabled)
├── <DiffTogglePanel>                    // Toggle to diff any two outputs
│   └── <DiffView leftModel rightModel>  // Side-by-side or inline diff
├── <JudgeConfigDrawer>                  // Slide-out config for judge model
│   ├── <JudgeModelSelector>             // Pick which model judges
│   ├── <JudgingCriteriaEditor>          // Custom rubric (accuracy, style, etc.)
│   └── <JudgePromptPreview>             // Preview the evaluation prompt
└── <ComparisonHistoryPanel>             // Saved past comparisons
    └── <ComparisonHistoryCard>          // Summary card for each past comparison
```

**Key TypeScript Interfaces:**

```typescript
interface ComparisonRun {
  id: string;
  prompt: string;
  systemPrompt?: string;
  models: ModelSelection[];
  results: ModelResult[];
  judgeConfig?: JudgeConfig;
  judgeResults?: JudgeResult[];
  createdAt: string;
  tags: string[];
}

interface ModelSelection {
  modelId: string;          // e.g. "anthropic/claude-opus-4-6"
  provider: Provider;       // 'anthropic' | 'openai' | 'google' | 'xai' | 'minimax' | 'zai' | 'openrouter'
  displayName: string;
  maxTokens?: number;
  temperature?: number;
}

interface ModelResult {
  modelId: string;
  status: 'pending' | 'streaming' | 'complete' | 'error';
  content: string;
  metadata: ResponseMetadata;
  error?: string;
}

interface ResponseMetadata {
  timeToFirstToken: number;   // ms
  totalLatency: number;       // ms
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;      // USD
  finishReason: string;
  modelVersion?: string;
}

interface JudgeConfig {
  judgeModelId: string;
  criteria: JudgingCriterion[];
  rubricPrompt: string;
}

interface JudgingCriterion {
  name: string;               // e.g. "Accuracy", "Helpfulness", "Style"
  weight: number;             // 0-1, must sum to 1
  description: string;
}

interface JudgeResult {
  modelId: string;
  overallScore: number;       // 0-100
  criterionScores: Record<string, number>;
  reasoning: string;
  rank: number;
}

type Provider = 'anthropic' | 'openai' | 'google' | 'xai' | 'minimax' | 'zai' | 'openrouter';
```

### 4. Interaction Patterns

**Primary Flow:**
1. User types/pastes prompt into `PromptInputPanel`
2. Selects 2–6 models from `ModelSelectorBar` (chips toggle on/off)
3. Clicks "Run Comparison" (`Cmd+Enter` shortcut)
4. All models stream simultaneously — panes fill progressively
5. Metadata bars animate in as each model completes
6. Optional: judge model evaluates and ranks once all complete

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Cmd+Enter` | Run comparison |
| `Cmd+Shift+D` | Toggle diff view |
| `Cmd+1` through `Cmd+6` | Focus on pane 1–6 |
| `Cmd+J` | Open judge config drawer |
| `Cmd+S` | Save comparison to history |
| `Cmd+E` | Export comparison (JSON/Markdown) |
| `Tab` / `Shift+Tab` | Navigate between panes |
| `Escape` | Close any open drawer/modal |

**Animations:**
- Pane entry: `framer-motion` stagger, each pane slides up with 50ms delay, `duration: 0.3s, ease: [0.25, 0.46, 0.45, 0.94]`
- Streaming text: character-level append with subtle fade-in (`opacity 0→1 over 100ms`)
- Metadata bars: spring animation on mount, `stiffness: 120, damping: 14`
- Judge scores: count-up animation from 0 to final score over 600ms
- Model chip selection: scale bounce `1.0 → 1.08 → 1.0` over 200ms with color fill transition

**Gestures (touch/trackpad):**
- Horizontal scroll on `ModelSelectorBar` via native scroll
- Pinch-to-zoom on individual response panes (useful for long outputs)
- Drag to reorder panes (react-beautiful-dnd or framer-motion layout)

### 5. Wireframe Description

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚡ Model Comparison                            [History ▾] [Export] [Save] │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ System Prompt (optional)  [▾ Show]                                     │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │                                                                         │ │
│ │  Enter your prompt here...                                              │ │
│ │                                                                         │ │
│ │                                                    [⌘↵ Run Comparison]  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Models: [● Claude Opus] [● GPT-4o] [● Gemini 2] [○ Grok] [+ Add Model]  │
│  Presets: [Frontier All] [Budget] [Anthropic Suite] [Custom...]            │
│                                                                             │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ │
│ │ 🟣 Claude Opus 4.6   │ │ 🟢 GPT-4o            │ │ 🔵 Gemini 2.0 Pro   │ │
│ │ ● Streaming...       │ │ ✓ Complete (2.3s)    │ │ ✓ Complete (1.8s)    │ │
│ ├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤ │
│ │                      │ │                      │ │                      │ │
│ │ The answer to your   │ │ Here's my response   │ │ Based on the query   │ │
│ │ question involves    │ │ to this prompt:      │ │ provided, I can      │ │
│ │ several key points   │ │                      │ │ offer the following  │ │
│ │ that I'll outline    │ │ First, let me...     │ │ analysis...          │ │
│ │ below...█            │ │                      │ │                      │ │
│ │                      │ │ Second, consider...  │ │ Key points:          │ │
│ │                      │ │                      │ │ 1. ...               │ │
│ │                      │ │                      │ │ 2. ...               │ │
│ ├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤ │
│ │ TTFT: 0.4s │ 312 tk  │ │ TTFT: 0.2s │ 287 tk  │ │ TTFT: 0.3s │ 301 tk  │
│ │ Cost: $0.018 │ ⭐ 94  │ │ Cost: $0.012 │ ⭐ 88  │ │ Cost: $0.008 │ ⭐ 91  │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │  📊 Comparison    [Latency] [Tokens] [Cost] [Quality]                  │ │
│ │  ────────────────────────────────────────────────                       │ │
│ │  Claude Opus  ████████████████████████░░░░░░  2.3s                     │ │
│ │  GPT-4o       ██████████████████░░░░░░░░░░░░  1.8s                     │ │
│ │  Gemini 2     ███████████████░░░░░░░░░░░░░░░  1.5s                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  [📄 Diff View: Compare Any Two ▾]    [🤖 Judge: Configure Auto-Eval ▸]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6. Data Model & API Integration

**Endpoints (Gateway API extensions):**

```
POST   /api/comparison/run
  Body: { prompt, systemPrompt?, models: ModelSelection[], judgeConfig? }
  Returns: { runId, streams: { modelId: streamUrl }[] }

GET    /api/comparison/stream/:runId/:modelId
  SSE stream — events: token, metadata, error, complete

POST   /api/comparison/judge/:runId
  Body: { judgeConfig }
  Returns: { judgeResults: JudgeResult[] }

GET    /api/comparison/history
  Query: { page, limit, search? }
  Returns: { comparisons: ComparisonRun[], total, page }

GET    /api/comparison/:runId
  Returns: ComparisonRun (full details)

DELETE /api/comparison/:runId

POST   /api/comparison/:runId/export
  Body: { format: 'json' | 'markdown' | 'csv' }
  Returns: file download

GET    /api/models/available
  Returns: { models: ModelInfo[] } — all configured models with pricing
```

**Zustand Store:**

```typescript
interface ComparisonStore {
  // Current comparison state
  prompt: string;
  systemPrompt: string;
  selectedModels: ModelSelection[];
  results: Record<string, ModelResult>;   // keyed by modelId
  judgeConfig: JudgeConfig | null;
  judgeResults: JudgeResult[];
  isRunning: boolean;
  activeRunId: string | null;

  // History
  history: ComparisonRun[];
  historyLoading: boolean;

  // UI state
  diffEnabled: boolean;
  diffLeftModel: string | null;
  diffRightModel: string | null;
  activeMetadataTab: 'latency' | 'tokens' | 'cost' | 'quality';
  judgeDrawerOpen: boolean;

  // Actions
  setPrompt: (prompt: string) => void;
  toggleModel: (model: ModelSelection) => void;
  runComparison: () => Promise<void>;
  cancelRun: () => void;
  runJudge: () => Promise<void>;
  saveComparison: () => Promise<void>;
  loadHistory: (page?: number) => Promise<void>;
  exportComparison: (format: 'json' | 'markdown' | 'csv') => Promise<void>;
}
```

**Local Storage:** Recent model selections and judge configs cached in `localStorage` for quick re-use.

### 7. Accessibility Considerations

- **ARIA Live Regions:** Each `ResponsePane` streaming body uses `aria-live="polite"` with `aria-atomic="false"` so screen readers announce new content without re-reading everything
- **ARIA Labels:** Each pane has `aria-label="Response from {modelName}"`, metadata sections have `aria-label="Performance metrics for {modelName}"`
- **Keyboard Navigation:** Full tab order through all panes; `Tab` moves between panes, `Arrow keys` navigate within a pane's content
- **Focus Management:** When comparison starts, focus moves to first response pane; when complete, focus moves to metadata comparison bar
- **Color Contrast:** Provider colors meet WCAG 2.1 AA (4.5:1 minimum); all charts use patterns in addition to colors for colorblind users
- **Screen Reader:** Chart data has text alternatives; bar charts include `aria-description` with the numeric values
- **Reduced Motion:** When `prefers-reduced-motion` is set, disable streaming character animation, use instant pane appearance instead of stagger
- **Status Announcements:** Model completion announced via `aria-live="assertive"` — e.g., "GPT-4o complete, 2.3 seconds, 287 tokens"

### 8. Phasing Plan

**Phase 1 — Core Comparison (3 weeks)**
- `PromptInputPanel` with basic textarea
- `ModelSelectorBar` with hardcoded model list
- `ComparisonGrid` with 2–4 panes
- Sequential (not yet parallel) model invocation
- Basic metadata display (latency, token count)
- **Deliverable:** Working comparison of 2–4 models with metadata

**Phase 2 — Streaming & Polish (2 weeks)**
- Parallel SSE streaming for all models simultaneously
- Framer Motion animations (stagger, streaming)
- `MetadataComparisonBar` with Recharts visualizations
- Cost estimation per model
- Save/load comparison history
- **Deliverable:** Production-quality streaming comparison with charts

**Phase 3 — Judge & Diff (2 weeks)**
- `JudgeConfigDrawer` with custom rubric editor
- Automatic judge evaluation on completion
- `DiffTogglePanel` with character-level diff
- Export to JSON/Markdown/CSV
- Model presets (Frontier, Budget, etc.)
- **Deliverable:** Full-featured comparison with AI-powered evaluation

**Phase 4 — Advanced Features (2 weeks)**
- Variable interpolation in prompts (test same prompt with different inputs)
- Batch comparison (run N prompts across models)
- Statistical aggregation across batch runs
- Integration with agent config — "Use winning model" button
- **Deliverable:** Power-user batch testing and agent integration

### 9. Open Questions & Risks

| # | Question / Risk | Impact | Mitigation |
|---|----------------|--------|------------|
| 1 | **Rate limits:** Simultaneous calls to 4–6 providers may hit rate limits | High | Implement per-provider rate limiting with exponential backoff; queue excess requests |
| 2 | **Cost guardrails:** Users could accidentally run expensive comparisons at scale | High | Show estimated cost before running; implement daily/monthly cost caps per user |
| 3 | **Streaming consistency:** Different providers have different SSE formats | Medium | Abstract behind unified stream adapter in Gateway; normalize events |
| 4 | **Judge model bias:** A model may score its own provider's outputs higher | Medium | Default to cross-provider judging; flag potential bias in UI |
| 5 | **Layout at 5–6 models:** Grid gets cramped on smaller screens | Medium | Auto-switch to tabbed view below 1200px viewport width; allow collapsing panes |
| 6 | **Token counting accuracy:** Estimated vs. actual tokens may differ by provider | Low | Show "estimated" label; use provider-reported tokens when available |
| 7 | **Privacy:** Prompt sent to multiple providers may have different data policies | High | Show privacy notice per provider; allow per-provider opt-out for sensitive prompts |

---

## IDEA 12: Agent Template Marketplace with Community Ratings

### 1. Overview

Transform the existing 12-template static gallery (Phase 3) into a full community-driven marketplace where users can browse, rate, review, fork, customize, and publish agent configurations. Templates encapsulate complete agent identities (SOUL.md + AGENTS.md + model selection + skills + workspace structure + example prompts), distinct from ClawhHub skills which represent capabilities. The marketplace enables a flywheel: users discover templates, customize them, and contribute back, growing the ecosystem organically.

### 2. Technical Approach

| Concern | Choice | Rationale |
|---------|--------|-----------|
| **Framework** | React 18+ (web), shared components with main OpenClaw UI | Consistent with existing stack |
| **State Management** | Zustand (`useMarketplaceStore`) + React Query for server state | React Query for caching/pagination, Zustand for UI state |
| **Search** | Algolia or Meilisearch (self-hosted) | Fast faceted search with typo tolerance |
| **Backend** | ClawhHub API extension (Node.js/Express) | Extends existing ClawhHub infrastructure |
| **Storage** | PostgreSQL (metadata, ratings, reviews) + S3 (template bundles) | Relational for queries, object storage for files |
| **Auth** | Existing OpenClaw auth + OAuth (GitHub, Google) | Leverage existing accounts |
| **Image Handling** | Cloudflare Images or imgproxy for template thumbnails | Responsive image transforms |
| **CSS** | Tailwind 4 with design tokens (shared with main app) | Consistent theming |
| **Animations** | Framer Motion for card interactions, page transitions | Fluid marketplace feel |

**Data Flow:**

```
ClawhHub Backend (PostgreSQL + S3)
  ↕ REST API
Marketplace Frontend (React)
  ├── Browse/Search → Algolia/Meilisearch index
  ├── Install → Gateway API → local agent config
  ├── Publish → Bundle local config → Upload to ClawhHub
  └── Rate/Review → ClawhHub API → PostgreSQL
```

### 3. Component Architecture

```
<MarketplaceLayout>                          // Top-level layout with sidebar + content
├── <MarketplaceSidebar>                     // Left sidebar (collapsible on mobile)
│   ├── <SearchInput>                        // Real-time search with debounce (300ms)
│   ├── <CategoryNav>                        // Category tree (Productivity, Dev, Creative, etc.)
│   │   └── <CategoryItem icon label count>  // Individual category with template count
│   ├── <FilterPanel>                        // Faceted filters
│   │   ├── <ProviderFilter>                 // Filter by primary model provider
│   │   ├── <RatingFilter>                   // Min star rating slider
│   │   ├── <SkillsFilter>                   // Required skills checkboxes
│   │   ├── <CostTierFilter>                 // Free / Budget / Premium
│   │   └── <SortSelector>                   // Popular, Recent, Top Rated, Most Forked
│   └── <PublishCTA>                         // "Publish Your Template" button
├── <MarketplaceContent>                     // Main content area
│   ├── <FeaturedBanner>                     // Curated featured templates carousel
│   │   └── <FeaturedCard template>          // Hero-sized template card
│   ├── <CategorySection category>           // Section per category
│   │   ├── <SectionHeader>                  // Category name + "View All" link
│   │   └── <TemplateCardGrid>              // Responsive grid of cards
│   │       └── <TemplateCard template>      // Individual template card
│   │           ├── <TemplateThumbnail>       // Preview image or generated icon
│   │           ├── <TemplateTitle>           // Name + verified badge
│   │           ├── <TemplateAuthor>          // Avatar + username
│   │           ├── <StarRating rating count> // Star display with count
│   │           ├── <TemplateTagList>         // Skill/category tags
│   │           └── <InstallButton>          // Quick install CTA
│   └── <PaginationControls>                 // Cursor-based pagination
├── <TemplateDetailPage>                     // Full template detail (route: /marketplace/:id)
│   ├── <TemplateDetailHeader>               // Name, author, rating, install count
│   │   ├── <InstallButton variant="large">  // Primary install CTA
│   │   ├── <ForkButton>                     // Fork to customize
│   │   └── <ShareButton>                    // Copy link / social share
│   ├── <TemplatePreviewTabs>                // Tabbed preview of template contents
│   │   ├── <Tab label="Overview">           // Rich description, screenshots
│   │   ├── <Tab label="SOUL.md">            // Rendered SOUL.md preview
│   │   ├── <Tab label="AGENTS.md">          // Rendered AGENTS.md preview
│   │   ├── <Tab label="Configuration">      // Model, skills, workspace structure
│   │   └── <Tab label="Example Prompts">    // Try-it-out prompt examples
│   ├── <TemplateReviewSection>              // Community reviews
│   │   ├── <ReviewSummary>                  // Rating distribution histogram
│   │   ├── <WriteReviewButton>              // Open review form
│   │   ├── <ReviewCard review>              // Individual review
│   │   │   ├── <ReviewAuthor>               // Avatar, name, date
│   │   │   ├── <ReviewStars>                // Star rating
│   │   │   ├── <ReviewBody>                 // Review text
│   │   │   └── <ReviewHelpful>              // "Was this helpful?" voting
│   │   └── <ReviewPagination>               // Load more reviews
│   ├── <RelatedTemplates>                   // "You might also like" section
│   └── <VersionHistory>                     // Past versions with changelogs
├── <PublishWizard>                           // Multi-step publish flow (modal/page)
│   ├── <PublishStep1_SelectAgent>           // Pick which local agent to publish
│   ├── <PublishStep2_EditMetadata>          // Name, description, category, tags, thumbnail
│   ├── <PublishStep3_ConfigureVisibility>   // Public/unlisted, license, pricing
│   ├── <PublishStep4_Preview>               // Preview how it will look in marketplace
│   └── <PublishStep5_Submit>                // Final confirmation + submit for review
└── <CustomizeDrawer>                        // Post-install customization sidebar
    ├── <AgentNameEditor>                    // Rename the installed agent
    ├── <ModelOverrideSelector>              // Swap the default model
    ├── <SkillToggleList>                    // Enable/disable included skills
    ├── <PersonalitySliders>                 // Adjust personality traits (if template supports)
    └── <SaveAndDeploy>                      // Apply customizations
```

**Key TypeScript Interfaces:**

```typescript
interface MarketplaceTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;           // Markdown
  author: TemplateAuthor;
  category: TemplateCategory;
  tags: string[];
  thumbnail: string;                 // URL
  screenshots: string[];             // URLs
  rating: RatingAggregate;
  installCount: number;
  forkCount: number;
  version: string;
  createdAt: string;
  updatedAt: string;
  license: 'mit' | 'cc-by' | 'proprietary' | 'unlicensed';
  visibility: 'public' | 'unlisted';
  verified: boolean;
  bundle: TemplateBundle;
  examplePrompts: string[];
  compatibleModels: string[];
  requiredSkills: string[];
}

interface TemplateBundle {
  soulMd: string;
  agentsMd: string;
  defaultModel: string;
  skills: string[];
  workspaceStructure: WorkspaceFile[];
  toolsMd?: string;
  memoryMd?: string;
}

interface WorkspaceFile {
  path: string;                       // Relative path
  content: string;
  description?: string;
}

interface TemplateAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  publishedCount: number;
  verified: boolean;
}

interface RatingAggregate {
  average: number;                    // 0-5
  count: number;
  distribution: [number, number, number, number, number]; // counts for 1-5 stars
}

interface Review {
  id: string;
  templateId: string;
  author: TemplateAuthor;
  rating: number;                     // 1-5
  title: string;
  body: string;
  createdAt: string;
  helpfulCount: number;
  userVoted: boolean | null;          // true=helpful, false=not, null=no vote
}

type TemplateCategory =
  | 'productivity'
  | 'development'
  | 'creative'
  | 'research'
  | 'communication'
  | 'data-analysis'
  | 'education'
  | 'entertainment'
  | 'business'
  | 'custom';
```

### 4. Interaction Patterns

**Browse Flow:**
1. User opens Marketplace from main nav
2. Featured templates carousel auto-plays (6s interval, pause on hover)
3. Scroll through categorized sections or use sidebar search/filters
4. Hover over `TemplateCard` → subtle lift (translateY -4px, shadow increase, 200ms)
5. Click card → navigate to `TemplateDetailPage` with shared element transition

**Install Flow:**
1. Click "Install" on card or detail page
2. Confirmation modal: "Install {name}? This will create agent {name} with model {model}."
3. Progress indicator during download + configuration
4. Success toast: "✅ {name} installed! [Open Agent] [Customize]"
5. Optional: `CustomizeDrawer` slides in for quick tweaks

**Publish Flow:**
1. Click "Publish Your Template" → `PublishWizard` opens
2. Step 1: Select from your local agents (card grid of your agents)
3. Step 2: Edit metadata (name, description, category, tags, upload thumbnail)
4. Step 3: Set visibility, license, pricing tier
5. Step 4: Preview marketplace listing
6. Step 5: Submit → enters moderation queue → notification when approved

**Fork Flow:**
1. Click "Fork" on any template
2. Template is installed + opened in edit mode
3. Banner: "Forked from {original}. Customize and publish your version!"
4. Edit any files (SOUL.md, AGENTS.md, etc.)
5. Publish as new template with "forked from" attribution

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `/` | Focus search input |
| `Cmd+I` | Install focused template |
| `Cmd+F` | Fork focused template |
| `Arrow keys` | Navigate template grid |
| `Enter` | Open focused template detail |
| `Escape` | Close modals/drawers, go back |
| `Cmd+P` | Open publish wizard |

**Animations:**
- Card hover: `translateY(-4px)`, `box-shadow` expansion, `200ms ease-out`
- Card grid load: stagger reveal, 30ms delay per card, fade + slide up
- Page transitions: shared element (thumbnail) morphs from card to detail hero, 350ms
- Install button: pulse animation on hover, success checkmark morph (300ms)
- Star rating: stars fill left-to-right with 80ms stagger on hover
- Featured carousel: crossfade with 500ms transition

### 5. Wireframe Description

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏪 Template Marketplace                     [My Templates] [Publish +]    │
├───────────────┬─────────────────────────────────────────────────────────────┤
│               │                                                             │
│  🔍 Search... │  ★ FEATURED                                                │
│               │  ┌─────────────────────────────────────────────────────┐    │
│  Categories   │  │  🧠 Research Analyst Pro              ★★★★★ (342)  │    │
│  ▸ All        │  │  "Deep research agent with multi-source synthesis"  │    │
│  ▸ Productivity│ │  By @xavier_ai · 2.1k installs                     │    │
│  ▸ Development│  │                          [Install] [Preview] [Fork] │    │
│  ▸ Creative   │  └─────────────────────────────────────────────────────┘    │
│  ▸ Research   │   ◄ ● ● ○ ○ ○ ►                                           │
│  ▸ Comms      │                                                             │
│  ▸ Data       │  📂 PRODUCTIVITY                                [View All] │
│               │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  Filters      │  │ 🖼️       │ │ 🖼️       │ │ 🖼️       │ │ 🖼️       │      │
│  ┌──────────┐ │  │ Email    │ │ Meeting  │ │ Task     │ │ Calendar │      │
│  │ Provider │ │  │ Composer │ │ Notes    │ │ Manager  │ │ Planner  │      │
│  │ ☐ Any    │ │  │ ★★★★☆  │ │ ★★★★★  │ │ ★★★☆☆  │ │ ★★★★☆  │      │
│  │ ☐ Claude │ │  │ 1.2k ↓  │ │ 890 ↓   │ │ 456 ↓   │ │ 678 ↓   │      │
│  │ ☐ GPT    │ │  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  │ ☐ Gemini │ │                                                             │
│  └──────────┘ │  💻 DEVELOPMENT                             [View All]     │
│  ┌──────────┐ │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Rating   │ │  │ 🖼️       │ │ 🖼️       │ │ 🖼️       │ │ 🖼️       │      │
│  │ ★★★★+ ▾ │ │  │ Code     │ │ PR       │ │ Debug    │ │ DevOps   │      │
│  └──────────┘ │  │ Reviewer │ │ Author   │ │ Detective│ │ Pilot    │      │
│  ┌──────────┐ │  │ ★★★★★  │ │ ★★★★☆  │ │ ★★★★☆  │ │ ★★★☆☆  │      │
│  │ Sort     │ │  │ 2.3k ↓  │ │ 1.1k ↓  │ │ 567 ↓   │ │ 234 ↓   │      │
│  │ Popular ▾│ │  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  └──────────┘ │                                                             │
│               │  [Load More...]                                             │
└───────────────┴─────────────────────────────────────────────────────────────┘
```

**Template Detail Page:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Marketplace                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     🧠 Research Analyst Pro                    v2.1.0 │ │
│  │  By @xavier_ai (verified ✓)                                          │ │
│  │  ★★★★★ 4.8 (342 ratings) · 2.1k installs · 89 forks                │ │
│  │  Tags: [research] [analysis] [multi-source] [academic]              │ │
│  │                                                                       │ │
│  │  [█ Install]  [⑂ Fork]  [↗ Share]  [♡ Favorite]                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  [Overview] [SOUL.md] [AGENTS.md] [Configuration] [Example Prompts]        │
│  ─────────────────────────────────────────────────────────────────────      │
│  │ Deep research agent that synthesizes information from multiple          │ │
│  │ sources, produces structured reports with citations, and maintains     │ │
│  │ a knowledge base across sessions.                                      │ │
│  │                                                                         │ │
│  │ **Included Skills:** web_search, file_read, file_write, browser        │ │
│  │ **Default Model:** Claude Opus 4.6                                     │ │
│  │ **Workspace:** /research, /reports, /knowledge_base                    │ │
│  ─────────────────────────────────────────────────────────────────────      │
│                                                                             │
│  📝 REVIEWS                                              [Write a Review]  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ★★★★★  5/5 distribution: █████████████████ 5★ (280)                  │ │
│  │                           ████████ 4★ (45)                            │ │
│  │                           ██ 3★ (12)    █ 2★ (3)    █ 1★ (2)        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 👤 @sarah_dev · ★★★★★ · 2 days ago                                  │ │
│  │ "Best research agent I've used. The multi-source synthesis is..."     │ │
│  │                                    👍 12 helpful · 👎 0 not helpful   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6. Data Model & API Integration

**Endpoints (ClawhHub API extension):**

```
# Browse & Search
GET    /api/marketplace/templates
  Query: { q?, category?, provider?, minRating?, sort?, page, limit }
  Returns: { templates: MarketplaceTemplate[], total, page, pages }

GET    /api/marketplace/templates/featured
  Returns: { templates: MarketplaceTemplate[] }

GET    /api/marketplace/templates/:id
  Returns: MarketplaceTemplate (full detail including bundle preview)

GET    /api/marketplace/templates/:id/bundle
  Returns: TemplateBundle (full file contents for install)

GET    /api/marketplace/categories
  Returns: { categories: { id, name, count }[] }

# Install & Fork
POST   /api/marketplace/templates/:id/install
  Returns: { success, agentName, agentPath }

POST   /api/marketplace/templates/:id/fork
  Returns: { success, forkedTemplateId, agentName }

# Reviews & Ratings
GET    /api/marketplace/templates/:id/reviews
  Query: { sort?, page, limit }
  Returns: { reviews: Review[], total }

POST   /api/marketplace/templates/:id/reviews
  Body: { rating, title, body }
  Returns: Review

POST   /api/marketplace/reviews/:reviewId/helpful
  Body: { helpful: boolean }

# Publishing
POST   /api/marketplace/templates
  Body: { bundle, metadata, visibility, license }
  Returns: { templateId, status: 'pending_review' }

PUT    /api/marketplace/templates/:id
  Body: { bundle?, metadata?, visibility? }
  Returns: MarketplaceTemplate

# User
GET    /api/marketplace/me/templates
  Returns: { published: MarketplaceTemplate[], installed: InstalledTemplate[] }

GET    /api/marketplace/me/favorites
  Returns: { templates: MarketplaceTemplate[] }

POST   /api/marketplace/templates/:id/favorite
DELETE /api/marketplace/templates/:id/favorite

# Moderation (admin)
GET    /api/marketplace/admin/queue
POST   /api/marketplace/admin/templates/:id/approve
POST   /api/marketplace/admin/templates/:id/reject
```

**Zustand Store:**

```typescript
interface MarketplaceStore {
  // Browse state
  templates: MarketplaceTemplate[];
  featured: MarketplaceTemplate[];
  categories: CategoryInfo[];
  totalResults: number;
  currentPage: number;
  loading: boolean;

  // Filters
  searchQuery: string;
  selectedCategory: TemplateCategory | null;
  selectedProvider: string | null;
  minRating: number;
  sortBy: 'popular' | 'recent' | 'top-rated' | 'most-forked';

  // Detail view
  selectedTemplate: MarketplaceTemplate | null;
  reviews: Review[];
  reviewsLoading: boolean;

  // User state
  myTemplates: MarketplaceTemplate[];
  myInstalled: InstalledTemplate[];
  myFavorites: Set<string>;

  // Actions
  search: (query: string) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  loadTemplates: (page?: number) => Promise<void>;
  loadFeatured: () => Promise<void>;
  loadTemplateDetail: (id: string) => Promise<void>;
  installTemplate: (id: string) => Promise<void>;
  forkTemplate: (id: string) => Promise<void>;
  submitReview: (id: string, review: Partial<Review>) => Promise<void>;
  toggleFavorite: (id: string) => void;
  publishTemplate: (data: PublishData) => Promise<void>;
}
```

### 7. Accessibility Considerations

- **Search:** `role="search"` on container, `aria-label="Search templates"`, live results announced via `aria-live="polite"` with debounce
- **Card Grid:** `role="list"` on grid, `role="listitem"` on cards; cards are focusable (`tabIndex={0}`)
- **Star Ratings:** Display: `aria-label="{n} out of 5 stars"`; Input: radio group with `aria-label="Rate this template"`, each star is a radio button
- **Keyboard Grid Navigation:** Arrow keys move between cards in grid, Enter opens detail, Space toggles favorite
- **Install Confirmation:** Focus trapped in modal, Escape to close, auto-focus on Cancel for safety
- **Carousel:** Pause button visible and focusable, `aria-roledescription="carousel"`, slide indicators as tab controls
- **Filter Panel:** Collapsible with `aria-expanded`, checkbox groups with `role="group"` and `aria-label`
- **Color:** All text meets WCAG AA 4.5:1; star ratings use filled vs. outlined (not just color); category badges have sufficient contrast
- **Publish Wizard:** Step indicator with `aria-current="step"`, clear progress narration for screen readers

### 8. Phasing Plan

**Phase 1 — Read-Only Marketplace (4 weeks)**
- Curated template listings (admin-published only)
- Browse, search, filter, sort
- Template detail page with previews
- One-click install into local OpenClaw
- **Deliverable:** Functional marketplace with ~50 curated templates

**Phase 2 — Community Features (3 weeks)**
- User accounts and profiles
- Star ratings and written reviews
- Favorites/bookmarks
- Install analytics (counts, trends)
- **Deliverable:** Community-rated marketplace

**Phase 3 — Publishing & Forking (4 weeks)**
- `PublishWizard` for submitting templates
- Fork mechanism with attribution
- Moderation queue (admin review before publishing)
- Version history and changelogs
- **Deliverable:** User-generated content flowing into marketplace

**Phase 4 — Advanced & Monetization (3 weeks)**
- Premium/paid templates (if applicable)
- Author analytics dashboard
- Recommendation engine ("users who installed X also installed Y")
- Template collections/bundles
- API for programmatic template management
- **Deliverable:** Self-sustaining marketplace ecosystem

### 9. Open Questions & Risks

| # | Question / Risk | Impact | Mitigation |
|---|----------------|--------|------------|
| 1 | **Content moderation:** How to handle offensive/malicious templates? | High | Automated scanning + manual review queue; community flagging; clear content policy |
| 2 | **Template versioning:** How to handle breaking changes when a template updates? | High | Semantic versioning; installed templates pinned to version; opt-in updates with changelog |
| 3 | **Intellectual property:** Users could publish templates mimicking others' work | Medium | Plagiarism detection via similarity scoring; DMCA-style takedown process |
| 4 | **Quality floor:** Low-quality templates could drown out good ones | Medium | Minimum requirements for publishing (description length, example prompts); quality signals in ranking |
| 5 | **ClawhHub dependency:** Marketplace depends on ClawhHub backend being ready | High | Build with API contracts early; can start with local JSON file as mock backend |
| 6 | **Template compatibility:** Templates may require specific OpenClaw versions or skills | Medium | Declare compatibility in manifest; warn on install if requirements not met |
| 7 | **Discovery cold start:** Empty marketplace feels dead | High | Seed with 50+ high-quality templates from team + early beta users before public launch |

---

## IDEA 13: Mobile-Native Companion App (React Native)

### 1. Overview

A dedicated iOS and Android companion app built with React Native that provides mobile-optimized monitoring, lightweight agent interaction, and critical approval workflows. The app focuses on what mobile does best: push notifications for time-sensitive approvals, quick chat, agent status at a glance, and one-tap approve/deny for pending exec commands. It's deliberately not a full desktop replacement — it's the "remote control" for your agent fleet.

### 2. Technical Approach

| Concern | Choice | Rationale |
|---------|--------|-----------|
| **Framework** | React Native 0.76+ with New Architecture (Fabric + TurboModules) | Cross-platform with native performance; team has React expertise |
| **Navigation** | React Navigation 7 (native stack + bottom tabs) | Industry standard, native transitions, deep linking support |
| **State Management** | Zustand + React Query (TanStack Query) | Consistent with web app; React Query for server state caching |
| **Push Notifications** | `@notifee/react-native` + `@react-native-firebase/messaging` | Notifee for local notifications/display, Firebase for FCM; APNS via Firebase |
| **Auth** | `react-native-keychain` for secure storage + biometric unlock | Secure token storage with Face ID / Touch ID / fingerprint |
| **Offline** | React Query persistence via `@tanstack/query-async-storage-persister` + MMKV | Offline-first with stale-while-revalidate |
| **Networking** | WebSocket for real-time status + REST for CRUD | WebSocket keeps agent status live; REST for actions |
| **Styling** | `nativewind` (Tailwind for React Native) | Shared design tokens with web app |
| **Animations** | `react-native-reanimated` 3 + `react-native-gesture-handler` | 60fps native animations, gesture-driven interactions |
| **Charts** | `victory-native` | React Native-native charting for status dashboard |
| **Build** | EAS Build (Expo Application Services) | Cloud builds, OTA updates, simplified app store deployment |
| **Testing** | Jest + React Native Testing Library + Detox (E2E) | Unit/integration + native E2E testing |

**Data Flow:**

```
OpenClaw Gateway API
  ├── WebSocket: /ws/status → Real-time agent status, session events, approval requests
  ├── REST: /api/* → Agent actions, chat, configuration
  └── Push: FCM/APNS → Background notifications for approvals, errors, completions

React Native App
  ├── WebSocket Manager (foreground) → Zustand store → UI updates
  ├── Push Handler (background) → Notification display → Deep link to action
  └── Offline Queue → MMKV → Sync on reconnect
```

### 3. Component Architecture

```
<App>                                        // Root with providers
├── <AuthGate>                               // Biometric/PIN auth wrapper
│   └── <BiometricPrompt>                    // Face ID / Touch ID / Fingerprint
├── <NavigationContainer>                    // React Navigation root
│   ├── <AuthStack>                          // Unauthenticated screens
│   │   ├── <LoginScreen>                    // Email/password + OAuth buttons
│   │   ├── <ServerConfigScreen>             // Gateway URL configuration
│   │   └── <BiometricSetupScreen>           // Enable biometric auth
│   └── <MainTabNavigator>                   // Bottom tab navigation (authenticated)
│       ├── <DashboardTab>                   // Tab 1: Agent overview
│       │   └── <DashboardScreen>
│       │       ├── <StatusSummaryCards>      // Grid: active, idle, error, pending counts
│       │       │   └── <StatusCard icon count label color />
│       │       ├── <ActiveSessionsList>     // Scrollable list of running sessions
│       │       │   └── <SessionCard session onTap />
│       │       │       ├── <AgentAvatar agent />
│       │       │       ├── <SessionInfo>    // Agent name, duration, current task
│       │       │       └── <SessionBadge status />
│       │       ├── <PendingApprovalsBanner> // Prominent banner when approvals waiting
│       │       │   └── <ApprovalCard approval onApprove onDeny />
│       │       └── <RecentActivityFeed>     // Timeline of recent events
│       │           └── <ActivityItem event />
│       ├── <ApprovalsTab>                   // Tab 2: Pending approvals
│       │   └── <ApprovalsScreen>
│       │       ├── <ApprovalFilterBar>      // Filter: all, exec, file, network
│       │       └── <ApprovalList>
│       │           └── <ApprovalDetailCard approval>
│       │               ├── <ApprovalHeader> // Agent name, timestamp, urgency
│       │               ├── <CommandPreview> // Syntax-highlighted command/action
│       │               ├── <ContextInfo>    // Why the agent wants to do this
│       │               └── <ApprovalActions>
│       │                   ├── <ApproveButton> // Green, primary
│       │                   ├── <DenyButton>    // Red, secondary
│       │                   └── <DeferButton>   // Gray, "ask me later"
│       ├── <ChatTab>                        // Tab 3: Quick chat
│       │   └── <ChatStack>
│       │       ├── <AgentListScreen>        // List of agents to chat with
│       │       │   └── <AgentRow agent lastMessage onTap />
│       │       └── <ChatScreen agent>       // Individual chat
│       │           ├── <ChatMessageList>    // Virtualized message list
│       │           │   ├── <UserMessage message />
│       │           │   ├── <AgentMessage message />
│       │           │   └── <SystemMessage message />
│       │           ├── <TypingIndicator />  // Agent is thinking...
│       │           └── <ChatInput>          // Text input + send + voice
│       │               ├── <TextInput>
│       │               ├── <VoiceButton>    // Hold-to-speak
│       │               └── <SendButton>
│       ├── <AgentsTab>                      // Tab 4: Agent management
│       │   └── <AgentsStack>
│       │       ├── <AgentGridScreen>        // Grid of all configured agents
│       │       │   └── <AgentTile agent>
│       │       │       ├── <AgentAvatar />
│       │       │       ├── <AgentName />
│       │       │       ├── <AgentStatus />  // Online/offline/error dot
│       │       │       └── <QuickActions>   // Chat, restart, pause
│       │       └── <AgentDetailScreen agent>
│       │           ├── <AgentInfoCard>      // Model, skills, uptime
│       │           ├── <SessionHistoryList> // Recent sessions
│       │           ├── <AgentMetricsChart>  // Token usage, costs (7-day)
│       │           └── <AgentActionBar>     // Start, stop, restart, configure
│       └── <SettingsTab>                    // Tab 5: Settings
│           └── <SettingsScreen>
│               ├── <ServerConnection>       // Gateway URL, connection status
│               ├── <NotificationPrefs>      // Per-type notification toggles
│               ├── <BiometricToggle>        // Enable/disable biometric lock
│               ├── <ThemeSelector>          // Light/dark/auto
│               ├── <CacheManagement>        // Clear cache, offline data size
│               └── <AboutSection>           // Version, licenses, support
└── <GlobalOverlays>
    ├── <ApprovalOverlay>                    // Slide-up overlay for urgent approvals
    ├── <ConnectionStatusBar>               // Top banner when WebSocket disconnected
    └── <ToastContainer>                     // Success/error toasts
```

**Key TypeScript Interfaces:**

```typescript
interface AgentStatus {
  agentId: string;
  name: string;
  displayName: string;
  avatarUrl?: string;
  status: 'active' | 'idle' | 'error' | 'offline';
  currentSession?: SessionSummary;
  lastActivity: string;
  model: string;
  skills: string[];
}

interface SessionSummary {
  sessionId: string;
  agentId: string;
  startedAt: string;
  duration: number;          // seconds
  messageCount: number;
  status: 'running' | 'waiting' | 'complete' | 'error';
  lastMessage?: string;      // truncated preview
  channel: string;
}

interface PendingApproval {
  id: string;
  agentId: string;
  agentName: string;
  type: 'exec' | 'file_write' | 'file_delete' | 'network' | 'other';
  command?: string;
  description: string;
  context: string;           // Why the agent wants to do this
  urgency: 'low' | 'medium' | 'high';
  createdAt: string;
  expiresAt?: string;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokenCount?: number;
    toolCalls?: string[];
  };
}

interface ActivityEvent {
  id: string;
  agentId: string;
  type: 'session_start' | 'session_end' | 'approval_granted' | 'approval_denied'
       | 'error' | 'milestone' | 'tool_call';
  summary: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface NotificationPreferences {
  approvals: boolean;
  errors: boolean;
  completions: boolean;
  milestones: boolean;
  quietHoursStart?: string;  // "22:00"
  quietHoursEnd?: string;    // "07:00"
  urgentOverridesQuietHours: boolean;
}
```

### 4. Interaction Patterns

**App Launch Flow:**
1. App opens → biometric prompt (Face ID / Touch ID)
2. On success → Dashboard with real-time agent status
3. WebSocket connects immediately, data hydrates from offline cache first
4. Stale data is replaced as WebSocket events arrive (no loading spinner for cached data)

**Approval Flow (Critical Path):**
1. Push notification arrives: "🔴 Agent Xavier wants to run: `rm -rf /tmp/build`"
2. User taps notification → deep links to `ApprovalDetailCard`
3. Card shows: command, context, agent name, timestamp
4. Swipe right to approve (green trail animation, haptic success)
5. Swipe left to deny (red trail animation, haptic warning)
6. Or tap buttons: [✅ Approve] [❌ Deny] [⏰ Defer]
7. Confirmation haptic + toast: "Approved ✓"

**Quick Chat Flow:**
1. Tap Chat tab → see list of agents with last message preview
2. Tap agent → opens chat, loads recent messages from cache + fetches new
3. Type message → send → streaming response renders progressively
4. Long press on message → copy, share, view metadata

**Gestures:**
| Gesture | Context | Action |
|---------|---------|--------|
| Swipe right on approval | Approval card | Approve |
| Swipe left on approval | Approval card | Deny |
| Pull to refresh | Any list | Refresh data |
| Long press on agent | Agent grid | Quick actions popover |
| Swipe down on chat | Chat screen | Dismiss keyboard |
| 3D Touch / Haptic Touch | Agent tile | Preview agent detail |
| Shake device | Any screen | Send feedback / report bug |

**Animations (react-native-reanimated):**
- Tab transitions: native stack push/pop (iOS) / shared element (Android Material)
- Approval swipe: `interpolate` position to scale + opacity of approve/deny icons, spring back on incomplete swipe. Threshold: 40% screen width
- Status cards: `withSpring` count-up animation on load, `stiffness: 100, damping: 15`
- Activity feed: `FadeInDown` entering animation, 50ms stagger per item
- Chat messages: `SlideInRight` for user, `SlideInLeft` for agent, 200ms duration
- Connection status bar: `SlideInUp` / `SlideOutUp` with 300ms spring
- Skeleton loading: `LinearGradient` shimmer animation at 1.5s cycle

### 5. Wireframe Description

**Dashboard Screen:**
```
┌─────────────────────────────┐
│ 📱 OpenClaw              ⚙️ │
├─────────────────────────────┤
│                             │
│  ┌──────┐ ┌──────┐        │
│  │  3   │ │  1   │        │
│  │Active│ │Pending│        │
│  │  🟢  │ │  🟡  │        │
│  └──────┘ └──────┘        │
│  ┌──────┐ ┌──────┐        │
│  │  2   │ │  0   │        │
│  │ Idle │ │Error │        │
│  │  ⚪  │ │  🔴  │        │
│  └──────┘ └──────┘        │
│                             │
│  ⚠️ 1 PENDING APPROVAL      │
│  ┌─────────────────────────┐│
│  │ Xavier wants to run:    ││
│  │ > git push origin main  ││
│  │ [✅ Approve] [❌ Deny]  ││
│  └─────────────────────────┘│
│                             │
│  📋 Recent Activity         │
│  ├─ 🟢 Luis started session│
│  │  2 min ago              │
│  ├─ ✅ Tim completed task  │
│  │  8 min ago              │
│  ├─ 💬 Stephan sent msg   │
│  │  15 min ago             │
│  └─ 🔄 Xavier restarted   │
│     22 min ago             │
│                             │
├─────────────────────────────┤
│ 🏠  🔔  💬  🤖  ⚙️       │
│Dash Appr Chat Agents Set   │
└─────────────────────────────┘
```

**Chat Screen:**
```
┌─────────────────────────────┐
│ ← Luis (Active 🟢)      ⋮ │
├─────────────────────────────┤
│                             │
│         ┌──────────────────┐│
│         │ Can you check    ││
│         │ the latest PR    ││
│         │ for the auth     ││
│         │ changes?     You ││
│         └──────────────────┘│
│                             │
│ ┌──────────────────────┐    │
│ │ I'll review PR #247  │    │
│ │ for the auth module. │    │
│ │ Looking at it now... │    │
│ │                Luis  │    │
│ └──────────────────────┘    │
│                             │
│ ┌──────────────────────┐    │
│ │ Done! The PR looks   │    │
│ │ good. I found 2      │    │
│ │ minor issues:        │    │
│ │ 1. Missing null...   │    │
│ │ 2. Token expiry...   │    │
│ │                Luis  │    │
│ └──────────────────────┘    │
│                             │
│                             │
├─────────────────────────────┤
│ ┌───────────────────┐ 🎤 ↑ │
│ │ Type a message... │       │
│ └───────────────────┘       │
└─────────────────────────────┘
```

**Approval Detail (Swipeable):**
```
┌─────────────────────────────┐
│ ← Approvals           1 of 3│
├─────────────────────────────┤
│                             │
│  ← ❌ DENY    APPROVE ✅ → │
│                             │
│  ┌─────────────────────────┐│
│  │ 🤖 Xavier              ││
│  │ 2 minutes ago  · HIGH   ││
│  ├─────────────────────────┤│
│  │                         ││
│  │  Wants to execute:      ││
│  │  ┌───────────────────┐  ││
│  │  │ git push origin   │  ││
│  │  │ main --force      │  ││
│  │  └───────────────────┘  ││
│  │                         ││
│  │  Context:               ││
│  │  "Completing the deploy ││
│  │  of hotfix #312 for     ││
│  │  the auth regression.   ││
│  │  Force push needed      ││
│  │  because of rebased     ││
│  │  commits."              ││
│  │                         ││
│  │  Session: deploy-hotfix ││
│  │  Duration: 4m 32s       ││
│  │                         ││
│  └─────────────────────────┘│
│                             │
│  [✅ Approve] [❌ Deny]     │
│  [⏰ Remind in 5 min]       │
│                             │
├─────────────────────────────┤
│ 🏠  🔔  💬  🤖  ⚙️       │
└─────────────────────────────┘
```

### 6. Data Model & API Integration

**Endpoints (Gateway API — mobile extensions):**

```
# Auth
POST   /api/auth/login
  Body: { email, password } or { oauthToken, provider }
  Returns: { accessToken, refreshToken, user }

POST   /api/auth/refresh
  Body: { refreshToken }
  Returns: { accessToken, refreshToken }

# Push Registration
POST   /api/push/register
  Body: { platform: 'ios' | 'android', token: string, preferences: NotificationPreferences }

PUT    /api/push/preferences
  Body: NotificationPreferences

DELETE /api/push/register
  Body: { token }

# Dashboard
GET    /api/mobile/dashboard
  Returns: { statusCounts, activeAgents: AgentStatus[], pendingApprovals, recentActivity }

# Agents
GET    /api/agents
  Returns: { agents: AgentStatus[] }

GET    /api/agents/:id
  Returns: AgentStatus (detailed)

GET    /api/agents/:id/sessions
  Query: { page, limit }
  Returns: { sessions: SessionSummary[] }

POST   /api/agents/:id/restart
POST   /api/agents/:id/pause
POST   /api/agents/:id/resume

# Approvals
GET    /api/approvals/pending
  Returns: { approvals: PendingApproval[] }

POST   /api/approvals/:id/approve
POST   /api/approvals/:id/deny
  Body: { reason?: string }

POST   /api/approvals/:id/defer
  Body: { remindInMinutes: number }

# Chat
GET    /api/agents/:id/messages
  Query: { before?, limit }
  Returns: { messages: ChatMessage[] }

POST   /api/agents/:id/messages
  Body: { content: string }
  Returns: SSE stream of response

# WebSocket
WS     /ws/mobile
  Events IN:  agent_status, session_update, approval_new, approval_expired,
              activity_event, chat_message
  Events OUT: subscribe_agents, unsubscribe_agents
```

**Local Storage (MMKV):**

```typescript
interface OfflineCache {
  dashboard: {
    data: DashboardData;
    cachedAt: number;
  };
  agents: {
    data: AgentStatus[];
    cachedAt: number;
  };
  chatHistory: Record<string, {
    messages: ChatMessage[];
    cachedAt: number;
  }>;
  pendingActions: QueuedAction[];  // Actions taken while offline
}

interface QueuedAction {
  id: string;
  type: 'approve' | 'deny' | 'chat_send' | 'agent_restart';
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
}
```

### 7. Accessibility Considerations

- **VoiceOver / TalkBack:** All interactive elements have `accessibilityLabel` and `accessibilityHint`; custom components use `accessibilityRole`
- **Dynamic Type (iOS) / Font Scaling (Android):** All text uses relative sizing; layouts flex to accommodate up to 200% text size; test at all Dynamic Type settings
- **Approval Swipe:** Alternative tap buttons always visible (swipe is enhancement, not requirement); `accessibilityActions` for approve/deny
- **Color:** Status indicators use icons + color (not color alone): 🟢 Active, 🟡 Pending, 🔴 Error, ⚪ Idle
- **Haptics:** Paired with visual/auditory feedback, not sole indicator
- **Reduced Motion:** Respect `AccessibilityInfo.isReduceMotionEnabled()`; replace animations with instant transitions
- **Screen Reader Navigation:** Logical heading hierarchy with `accessibilityRole="header"`; group related content with `accessible={true}` on containers
- **Touch Targets:** Minimum 44x44pt (iOS) / 48x48dp (Android) for all interactive elements
- **Focus Order:** Logical tab order following visual layout; approval actions announced clearly: "Approve button. Double tap to approve command: git push origin main"
- **High Contrast:** Support iOS "Increase Contrast" and Android "High contrast text" settings

### 8. Phasing Plan

**Phase 1 — Core Shell + Dashboard (4 weeks)**
- React Native project setup with EAS
- Auth flow (login, biometric, secure token storage)
- WebSocket connection to Gateway
- Dashboard screen with status cards + activity feed
- Bottom tab navigation structure
- iOS TestFlight + Android Internal Testing
- **Deliverable:** Installable app with real-time dashboard

**Phase 2 — Approvals + Push (3 weeks)**
- Push notification infrastructure (FCM + APNS via Firebase)
- Approval list and detail screens
- Swipe gestures for approve/deny
- Deep linking from push notification to approval
- Notification preferences screen
- **Deliverable:** Mobile approval workflow (core value proposition)

**Phase 3 — Chat + Agent Management (3 weeks)**
- Agent list and detail screens
- Chat interface with streaming responses
- Agent actions (start, stop, restart)
- Offline caching with MMKV + React Query persistence
- Session history viewing
- **Deliverable:** Lightweight chat and agent monitoring

**Phase 4 — Polish + App Store (3 weeks)**
- Performance optimization (Hermes, lazy loading, image caching)
- Comprehensive E2E tests (Detox)
- App Store screenshots and metadata
- App Store review process (Apple + Google)
- OTA update infrastructure (EAS Update)
- Widget support (iOS: Lock Screen widget for agent status)
- **Deliverable:** Public App Store release

### 9. Open Questions & Risks

| # | Question / Risk | Impact | Mitigation |
|---|----------------|--------|------------|
| 1 | **Apple App Store review:** App may be flagged for "remote code execution" via agents | High | Clear documentation of app purpose; emphasize monitoring/chat (not arbitrary code exec); human-in-the-loop framing |
| 2 | **Push reliability:** FCM/APNS delivery is best-effort, not guaranteed | Medium | WebSocket as primary real-time channel; push as backup; in-app polling fallback every 30s when foregrounded |
| 3 | **Offline approve:** User approves offline, but by the time it syncs, approval may have expired | Medium | Show "approval may have expired" warning for cached approvals; server validates freshness |
| 4 | **React Native maintenance:** RN ecosystem moves fast; dependency rot | Medium | Pin to stable versions; Expo/EAS reduces native dependency management; plan quarterly update cycles |
| 5 | **Scope creep to desktop replacement:** Users will want more features on mobile | High | Strict "companion" framing in product positioning; explicit "desktop only" labels for complex features |
| 6 | **WebSocket battery drain:** Always-on WebSocket connection may drain battery | Medium | Implement connection lifecycle tied to app state; disconnect in background, rely on push; reconnect on foreground |
| 7 | **Biometric bypass:** Jailbroken/rooted devices may bypass biometric auth | Low | Server-side token expiry regardless of client auth; certificate pinning; jailbreak detection (optional) |

---

## IDEA 14: Theming Engine & Design Token Customization

### 1. Overview

A comprehensive theming system that goes beyond simple light/dark mode, allowing users to fully customize the OpenClaw UI through design token manipulation. Users can choose from curated theme presets (Violet, Midnight Blue, Forest Green, Warm Amber, High-Contrast) or build custom themes by adjusting accent colors, background tones, border radii, typography, and density. Themes are saveable, shareable, and publishable to the marketplace. Built on Tailwind 4's CSS custom property foundation.

### 2. Technical Approach

| Concern | Choice | Rationale |
|---------|--------|-----------|
| **Token System** | CSS Custom Properties (native) managed via Tailwind 4 `@theme` | Zero-JS runtime cost; instant application; works with SSR |
| **Token Categories** | Color, spacing, radius, typography, density, shadow, motion | Comprehensive but manageable set |
| **Color Generation** | OKLCH color space + `culori` library | Perceptually uniform; better for generating accessible palettes from single accent |
| **Theme Storage** | JSON token files → CSS custom properties at runtime | Portable, serializable, can be stored in DB or shared as files |
| **Theme Editor** | Custom React UI with real-time preview | No third-party editor dependency; full control over UX |
| **Persistence** | Per-user: localStorage + API sync; shared themes: ClawhHub/Marketplace | Instant local apply with cloud backup |
| **Contrast Checking** | `wcag-contrast` library for real-time WCAG 2.1 AA/AAA validation | Prevent users from creating inaccessible themes |
| **Animations** | CSS transitions on custom property changes (300ms ease) | Smooth theme switching without layout thrash |

**Token Architecture:**

```
Design Tokens (JSON)
  ↓ (build step or runtime)
CSS Custom Properties (--oc-*)
  ↓ (Tailwind 4 @theme)
Tailwind Utility Classes
  ↓ (component usage)
Rendered UI
```

**Runtime Application:**

```typescript
// Theme application is pure CSS — no React re-renders needed
function applyTheme(tokens: ThemeTokens): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(flattenTokens(tokens))) {
    root.style.setProperty(`--oc-${key}`, value);
  }
}
```

### 3. Component Architecture

```
<ThemeProvider tokens={activeTheme}>            // Context provider, applies CSS vars
├── <ThemeEditorDrawer>                         // Slide-out theme editor panel
│   ├── <ThemeEditorHeader>                     // Title, close, save, reset buttons
│   ├── <PresetSelector>                        // Curated preset grid
│   │   └── <PresetCard preset isActive>        // Mini preview of each preset
│   │       └── <PresetPreviewSwatch>           // Color swatches showing the palette
│   ├── <TokenEditorSections>                   // Accordion sections for token categories
│   │   ├── <ColorSection>                      // Expandable
│   │   │   ├── <AccentColorPicker>             // Primary accent with OKLCH picker
│   │   │   │   ├── <HueWheel>                  // Circular hue selector
│   │   │   │   ├── <ChromaSlider>              // Saturation slider
│   │   │   │   └── <LightnessSlider>           // Lightness slider
│   │   │   ├── <PalettePreview>                // Generated palette from accent (50-950 scale)
│   │   │   ├── <BackgroundColorPicker>         // Background tint
│   │   │   ├── <SurfaceColorPicker>            // Surface/card backgrounds
│   │   │   ├── <TextColorPicker>               // Primary + secondary text
│   │   │   └── <ContrastChecker>               // Real-time WCAG compliance indicators
│   │   │       └── <ContrastPair fg bg ratio pass /> // Individual pair check
│   │   ├── <TypographySection>                 // Expandable
│   │   │   ├── <FontFamilySelector>            // Dropdown with font previews
│   │   │   │   └── <FontPreviewRow font>       // "The quick brown fox" in that font
│   │   │   ├── <FontSizeScale>                 // Base size slider (12-18px) + scale ratio
│   │   │   ├── <FontWeightSelector>            // Light/Regular/Medium/Semi/Bold defaults
│   │   │   └── <LineHeightSelector>            // Compact/Normal/Relaxed
│   │   ├── <SpacingSection>                    // Expandable
│   │   │   ├── <DensitySelector>               // Compact / Default / Comfortable
│   │   │   └── <SpacingScalePreview>           // Visual preview of spacing scale
│   │   ├── <ShapeSection>                      // Expandable
│   │   │   ├── <BorderRadiusSlider>            // 0px (sharp) to 16px (rounded)
│   │   │   ├── <BorderWidthSelector>           // None / Thin / Medium
│   │   │   └── <ShadowIntensitySlider>         // None / Subtle / Medium / Prominent
│   │   └── <MotionSection>                     // Expandable
│   │       ├── <AnimationSpeedSelector>        // Instant / Fast / Normal / Relaxed
│   │       └── <ReducedMotionToggle>           // Force reduced motion
│   ├── <LivePreviewPanel>                      // Mini preview of UI with current tokens
│   │   ├── <PreviewChat>                       // Simulated chat messages
│   │   ├── <PreviewSidebar>                    // Simulated sidebar nav
│   │   ├── <PreviewButtons>                    // Button variants
│   │   └── <PreviewCards>                      // Card components
│   └── <ThemeActions>                          // Bottom action bar
│       ├── <SaveThemeButton>                   // Save to user themes
│       ├── <ExportThemeButton>                 // Export as JSON / CSS
│       ├── <ShareThemeButton>                  // Generate shareable link
│       └── <PublishToMarketplace>              // Publish theme to marketplace
├── <ThemeSwitcher>                             // Quick switcher in app header
│   ├── <CurrentThemePill>                      // Shows active theme name + swatch
│   └── <ThemeDropdown>                         // Quick select from saved themes
│       ├── <ThemeOption theme>                 // Name + preview swatches
│       └── <OpenEditorLink>                    // "Customize..." link
└── <ThemeMarketplaceSection>                   // Section in marketplace for themes
    └── <ThemeGalleryCard theme>                // Theme preview card
        ├── <ThemePreviewImage>                 // Full UI screenshot with theme applied
        ├── <ThemeSwatchRow>                    // Key colors as dots
        ├── <ThemeName>
        └── <InstallThemeButton>
```

**Key TypeScript Interfaces:**

```typescript
interface ThemeTokens {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version: string;
  base: 'light' | 'dark';           // Which mode this theme is for
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  shape: ShapeTokens;
  motion: MotionTokens;
}

interface ColorTokens {
  // Primary accent (source color — palette generated from this)
  accent: string;                    // OKLCH: "oklch(0.65 0.25 270)"
  accentPalette: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950, string>;

  // Backgrounds
  bgPrimary: string;                // App background
  bgSecondary: string;              // Sidebar, panels
  bgTertiary: string;               // Cards, elevated surfaces
  bgInverse: string;                // Inverse backgrounds

  // Surfaces
  surfaceDefault: string;
  surfaceHover: string;
  surfaceActive: string;
  surfaceSelected: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  textLink: string;

  // Borders
  borderDefault: string;
  borderSubtle: string;
  borderStrong: string;
  borderFocus: string;               // Focus ring color

  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;

  // Code
  codeBg: string;
  codeText: string;
}

interface TypographyTokens {
  fontFamily: string;                 // e.g. "'Inter', system-ui, sans-serif"
  fontFamilyMono: string;             // e.g. "'JetBrains Mono', monospace"
  fontSizeBase: number;               // px, e.g. 14
  fontSizeScale: number;              // ratio, e.g. 1.25 (major third)
  fontWeightNormal: number;           // 400
  fontWeightMedium: number;           // 500
  fontWeightSemibold: number;         // 600
  fontWeightBold: number;             // 700
  lineHeightTight: number;            // 1.25
  lineHeightNormal: number;           // 1.5
  lineHeightRelaxed: number;          // 1.75
  letterSpacing: string;              // '-0.01em' | '0' | '0.01em'
}

interface SpacingTokens {
  density: 'compact' | 'default' | 'comfortable';
  baseUnit: number;                   // px, e.g. 4
  scale: number[];                    // multipliers: [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16]
}

interface ShapeTokens {
  borderRadius: {
    none: string;                     // '0px'
    sm: string;                       // '4px'
    md: string;                       // '8px'
    lg: string;                       // '12px'
    xl: string;                       // '16px'
    full: string;                     // '9999px'
  };
  borderWidth: {
    none: string;
    thin: string;                     // '1px'
    medium: string;                   // '2px'
  };
  shadow: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

interface MotionTokens {
  durationFast: string;               // '100ms'
  durationNormal: string;             // '200ms'
  durationSlow: string;               // '350ms'
  easeDefault: string;                // 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  easeIn: string;
  easeOut: string;
  easeInOut: string;
  reduceMotion: boolean;
}

// Curated presets
type ThemePresetId =
  | 'default-light'
  | 'default-dark'
  | 'violet-light'
  | 'violet-dark'
  | 'midnight-blue'
  | 'forest-green-light'
  | 'forest-green-dark'
  | 'warm-amber-light'
  | 'warm-amber-dark'
  | 'high-contrast-light'
  | 'high-contrast-dark';
```

### 4. Interaction Patterns

**Theme Switching Flow:**
1. Click `ThemeSwitcher` in app header → dropdown shows saved themes
2. Hover over theme → 200ms preview delay → UI temporarily applies that theme
3. Click to confirm selection → theme persists
4. Mouse leaves dropdown without clicking → reverts to active theme

**Theme Editor Flow:**
1. Click "Customize..." in theme dropdown → `ThemeEditorDrawer` slides in from right (350ms)
2. Start with preset or current theme
3. Adjust any token → instant real-time preview (CSS custom properties = no re-render)
4. `ContrastChecker` shows live WCAG compliance: ✅ AA / ✅ AAA / ⚠️ Fail
5. Click "Save" → name the theme → stored locally + synced to cloud
6. Click "Share" → generates URL with encoded theme tokens
7. Click "Publish" → submits to marketplace theme gallery

**Color Picker Interaction:**
1. Click accent color swatch → OKLCH color picker opens
2. Drag on `HueWheel` (circular) → hue changes, palette regenerates in real-time
3. `ChromaSlider` adjusts saturation (left=gray, right=vivid)
4. `LightnessSlider` adjusts lightness
5. Full palette (50-950) auto-generates from accent using OKLCH interpolation
6. Individual palette stops can be overridden manually (click to unlock, edit, lock)

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+T` | Toggle theme editor drawer |
| `Cmd+Shift+L` | Quick toggle light/dark |
| `Cmd+Shift+[` / `]` | Cycle through saved themes |
| `Escape` | Close editor drawer |
| `Cmd+Z` | Undo last token change (in editor) |
| `Cmd+Shift+Z` | Redo |
| `Cmd+S` (in editor) | Save current theme |

**Animations:**
- Theme switch: all CSS custom properties transition with `transition: all 300ms ease-in-out` on `:root`
- Editor drawer: slide in from right, 350ms with spring ease
- Color picker: hue wheel rotation with inertia gesture
- Preset card hover: scale to 1.05, 150ms
- Contrast checker: smooth color transition on pass/fail indicator, 200ms
- Palette generation: cascade animation left-to-right across swatches, 30ms stagger

### 5. Wireframe Description

**Theme Editor Drawer:**
```
┌─────────────────────────────────┬──────────────────────────────────────────┐
│                                 │  🎨 Theme Editor              [✕ Close] │
│                                 ├──────────────────────────────────────────┤
│                                 │                                          │
│                                 │  PRESETS                                 │
│                                 │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│    Main Application             │  │██████│ │▓▓▓▓▓▓│ │░░████│ │██░░██│   │
│    Content Area                 │  │ Def  │ │Violet│ │Midnt │ │Forest│   │
│    (live preview of changes)    │  │Light │ │      │ │ Blue │ │Green │   │
│                                 │  └──────┘ └──────┘ └──────┘ └──────┘   │
│    Theme changes apply          │  ┌──────┐ ┌──────┐                      │
│    instantly here as user       │  │██████│ │██░░██│                      │
│    adjusts tokens               │  │Amber │ │Hi-Con│                      │
│                                 │  └──────┘ └──────┘                      │
│                                 │                                          │
│                                 │  ▼ COLORS                               │
│                                 │  ┌──────────────────────────────────┐   │
│                                 │  │ Accent Color    [●] #7C3AED     │   │
│                                 │  │                                  │   │
│                                 │  │     ╭─────────────╮             │   │
│                                 │  │    ╱   Hue Wheel   ╲            │   │
│                                 │  │   │    ●(drag)      │           │   │
│                                 │  │    ╲               ╱            │   │
│                                 │  │     ╰─────────────╯             │   │
│                                 │  │                                  │   │
│                                 │  │ Chroma ├────●────────────┤      │   │
│                                 │  │ Light  ├──────────●──────┤      │   │
│                                 │  │                                  │   │
│                                 │  │ Palette:                         │   │
│                                 │  │ [50][100][200][300][400][500]    │   │
│                                 │  │ [600][700][800][900][950]        │   │
│                                 │  │                                  │   │
│                                 │  │ Background   [●] #0F0F13        │   │
│                                 │  │ Surface      [●] #1A1A23        │   │
│                                 │  │ Text Primary [●] #F4F4F5        │   │
│                                 │  └──────────────────────────────────┘   │
│                                 │                                          │
│                                 │  Contrast: ✅ AA (7.2:1) ✅ AAA (7.2:1)│
│                                 │                                          │
│                                 │  ▸ TYPOGRAPHY                           │
│                                 │  ▸ SPACING & DENSITY                    │
│                                 │  ▸ SHAPE & BORDERS                      │
│                                 │  ▸ MOTION                               │
│                                 │                                          │
│                                 │  ┌──────────────────────────────────┐   │
│                                 │  │ [Save] [Export] [Share] [Publish]│   │
│                                 │  └──────────────────────────────────┘   │
└─────────────────────────────────┴──────────────────────────────────────────┘
```

**Theme Switcher (Header Dropdown):**
```
┌─────────────────────────────────────────────────────┐
│  OpenClaw        [🎨 Violet Dark ▾]    [Settings]   │
│                  ┌───────────────────────┐           │
│                  │ ● Default Light       │           │
│                  │ ● Default Dark    ✓   │           │
│                  │ ● Violet              │           │
│                  │ ● Midnight Blue       │           │
│                  │ ● Forest Green        │           │
│                  │ ● Warm Amber          │           │
│                  │ ● High Contrast       │           │
│                  │ ─────────────────     │           │
│                  │ 🎨 My Custom Theme    │           │
│                  │ ─────────────────     │           │
│                  │ ✏️  Customize...       │           │
│                  └───────────────────────┘           │
└─────────────────────────────────────────────────────┘
```

### 6. Data Model & API Integration

**Endpoints:**

```
# Theme CRUD
GET    /api/themes
  Returns: { presets: ThemeTokens[], userThemes: ThemeTokens[] }

GET    /api/themes/:id
  Returns: ThemeTokens

POST   /api/themes
  Body: ThemeTokens
  Returns: { id, ...ThemeTokens }

PUT    /api/themes/:id
  Body: Partial<ThemeTokens>
  Returns: ThemeTokens

DELETE /api/themes/:id

# Active theme
GET    /api/user/preferences/theme
  Returns: { activeThemeId, mode: 'light' | 'dark' | 'auto' }

PUT    /api/user/preferences/theme
  Body: { activeThemeId, mode }

# Sharing
POST   /api/themes/:id/share
  Returns: { shareUrl, shareCode }

GET    /api/themes/shared/:code
  Returns: ThemeTokens

# Marketplace
POST   /api/marketplace/themes
  Body: { theme: ThemeTokens, metadata }
  Returns: MarketplaceThemeEntry
```

**Zustand Store:**

```typescript
interface ThemeStore {
  // Active state
  activeThemeId: string;
  activeTokens: ThemeTokens;
  mode: 'light' | 'dark' | 'auto';
  resolvedMode: 'light' | 'dark';   // Resolved from 'auto' based on system pref

  // Available themes
  presets: ThemeTokens[];
  userThemes: ThemeTokens[];

  // Editor state
  editorOpen: boolean;
  editorDraft: ThemeTokens | null;
  editorUndoStack: ThemeTokens[];
  editorRedoStack: ThemeTokens[];
  contrastResults: ContrastResult[];

  // Preview
  previewThemeId: string | null;     // For hover preview in dropdown

  // Actions
  setActiveTheme: (id: string) => void;
  setMode: (mode: 'light' | 'dark' | 'auto') => void;
  openEditor: (baseTheme?: ThemeTokens) => void;
  closeEditor: () => void;
  updateDraftToken: (path: string, value: string | number) => void;
  undoEditor: () => void;
  redoEditor: () => void;
  saveDraft: (name: string) => Promise<void>;
  exportTheme: (format: 'json' | 'css') => void;
  shareTheme: (id: string) => Promise<string>;
  importTheme: (data: string | ThemeTokens) => void;
  previewTheme: (id: string | null) => void;
  checkContrast: (tokens: ThemeTokens) => ContrastResult[];
}

interface ContrastResult {
  pair: string;              // e.g. "textPrimary on bgPrimary"
  foreground: string;
  background: string;
  ratio: number;
  passAA: boolean;
  passAAA: boolean;
  passAALarge: boolean;
}
```

**CSS Custom Property Mapping (Tailwind 4 @theme):**

```css
@theme {
  /* Auto-mapped from ThemeTokens */
  --oc-color-accent-50: oklch(var(--oc-accent-50));
  --oc-color-accent-100: oklch(var(--oc-accent-100));
  /* ... through 950 */

  --oc-color-bg-primary: var(--oc-bg-primary);
  --oc-color-bg-secondary: var(--oc-bg-secondary);
  --oc-color-bg-tertiary: var(--oc-bg-tertiary);

  --oc-color-text-primary: var(--oc-text-primary);
  --oc-color-text-secondary: var(--oc-text-secondary);

  --oc-font-family: var(--oc-font-family);
  --oc-font-size-base: var(--oc-font-size-base);

  --oc-radius-sm: var(--oc-radius-sm);
  --oc-radius-md: var(--oc-radius-md);
  --oc-radius-lg: var(--oc-radius-lg);

  --oc-duration-fast: var(--oc-duration-fast);
  --oc-duration-normal: var(--oc-duration-normal);
}
```

### 7. Accessibility Considerations

- **WCAG Enforcement:** Theme editor shows real-time contrast ratios for all text/background pairs; warns (⚠️) on AA failure, blocks publish on critical failures
- **High-Contrast Preset:** Dedicated high-contrast theme exceeding AAA (7:1+) for all pairs; always available regardless of user preference
- **Forced Colors:** Respect `forced-colors: active` media query; fall back to system colors when Windows High Contrast mode is active
- **Color Picker:** Keyboard navigable: arrow keys on hue wheel (1° increments, Shift for 10°), Tab between controls, Enter to confirm
- **Screen Reader:** Token changes announced: "Accent color changed to violet, contrast ratio 7.2 to 1, passes double A and triple A"
- **Prefers Color Scheme:** "Auto" mode respects `prefers-color-scheme` media query; updates in real-time when system changes
- **Reduced Motion:** Theme editor's `MotionSection` includes toggle that maps to `prefers-reduced-motion` enforcement
- **Focus Indicators:** Focus ring color (`borderFocus`) always validated against background for visibility (minimum 3:1 contrast)

### 8. Phasing Plan

**Phase 1 — Token Foundation + Presets (2 weeks)**
- Define complete token schema (`ThemeTokens` interface)
- Implement CSS custom property application layer
- Create 6 curated presets (default light/dark + 4 themed)
- `ThemeSwitcher` dropdown in header
- Light/dark/auto mode toggle
- **Deliverable:** Theme switching between presets with smooth transitions

**Phase 2 — Theme Editor (3 weeks)**
- `ThemeEditorDrawer` with all token sections
- OKLCH color picker with palette generation
- Typography, spacing, shape, motion editors
- Real-time contrast checker
- Undo/redo stack
- Live preview panel
- **Deliverable:** Full theme customization with real-time preview

**Phase 3 — Persistence & Sharing (2 weeks)**
- Save user themes to account
- Export as JSON / CSS file
- Import from file or URL
- Shareable theme links (encoded in URL)
- Per-user theme preference sync across devices
- **Deliverable:** Persistent, shareable custom themes

**Phase 4 — Marketplace Integration (1 week)**
- Publish themes to marketplace
- Browse/install community themes
- Theme preview in marketplace cards
- **Deliverable:** Community theme ecosystem

### 9. Open Questions & Risks

| # | Question / Risk | Impact | Mitigation |
|---|----------------|--------|------------|
| 1 | **Token coverage:** Not all components may consume CSS custom properties consistently | High | Audit all components during Phase 1; create migration guide for any hardcoded values |
| 2 | **Performance with many tokens:** Setting 100+ CSS custom properties at once | Low | Batch updates in `requestAnimationFrame`; benchmark shows negligible impact (<1ms) |
| 3 | **Font loading:** Custom font families require web font loading, causing FOUT | Medium | Use `font-display: swap`; preload popular fonts; limit font options to pre-loaded set initially |
| 4 | **Third-party component theming:** Shadcn/Radix components need to respect tokens | Medium | Shadcn already uses CSS variables; audit and map all Radix primitive styles to tokens |
| 5 | **OKLCH browser support:** Older browsers don't support OKLCH natively | Low | Use `culori` to generate fallback hex values; OKLCH has 95%+ browser support in 2026 |
| 6 | **Density changes breaking layouts:** Compact/comfortable modes may break component sizing | Medium | Comprehensive visual regression testing at all density levels; define min/max constraints |
| 7 | **Theme accessibility validation:** Users may create inaccessible themes and not notice | High | Block saving themes that fail critical AA contrast checks; show prominent warnings |

---

## IDEA 15: Visual Workflow Builder (Node-Based Agent Orchestration)

### 1. Overview

A node-based visual canvas for designing, debugging, and managing multi-agent workflows, inspired by tools like n8n, Make, and Unreal Blueprints but purpose-built for AI agent orchestration. Users drag-and-drop nodes representing agents, triggers, conditions, and actions onto an infinite canvas, connecting them with edges that represent delegation, message flows, and data pipes. Conditions can be LLM-evaluated (e.g., "if the research quality is good enough"), making this the first truly AI-native workflow builder. This is the most ambitious feature in the entire roadmap, estimated at 3–6 months.

### 2. Technical Approach

| Concern | Choice | Rationale |
|---------|--------|-----------|
| **Canvas Library** | React Flow v12 (`@xyflow/react`) | Industry-standard React node graph library; handles pan/zoom, edge routing, minimap, selection |
| **Framework** | React 18+ with Suspense | Complex UI needs concurrent features; lazy-load node config panels |
| **State Management** | Zustand (`useWorkflowStore`) with Immer middleware | Complex nested state (nodes, edges, positions) benefits from immutable updates via Immer |
| **Persistence** | JSON workflow definition → PostgreSQL + version history | Workflows are JSON documents; Git-style versioning for undo/branching |
| **Execution Engine** | Server-side workflow runtime (Node.js) communicating via WebSocket | Workflows execute server-side; client receives real-time status updates |
| **Node Config** | React Hook Form + Zod validation per node type | Type-safe forms with validation for each node's configuration schema |
| **Code Editor** | Monaco Editor (embedded) for condition expressions and custom scripts | Full IDE experience for LLM prompts and code conditions |
| **Minimap** | React Flow built-in minimap | Navigation for large workflows |
| **Layout** | `dagre` or `elkjs` for auto-layout | Automatic graph layout for imported/generated workflows |
| **Animations** | Framer Motion (UI) + React Flow edge animations (flow visualization) | Animated edges showing data flow during execution |
| **Undo/Redo** | Custom command pattern with Zustand middleware | Fine-grained undo for every canvas action |
| **Collaboration** | WebSocket + CRDT (Yjs) for real-time multi-user editing (Phase 4) | Future: multiple users editing same workflow |
| **CSS** | Tailwind 4 + CSS Modules for node components | Scoped styles for custom nodes to avoid conflicts |

**Workflow Definition Schema:**

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: WorkflowVariable[];
  settings: WorkflowSettings;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;                      // Type-specific configuration
  dimensions?: { width: number; height: number };
}

type NodeType =
  | 'trigger-cron'
  | 'trigger-webhook'
  | 'trigger-event'
  | 'trigger-manual'
  | 'agent-invoke'
  | 'agent-delegate'
  | 'condition-llm'
  | 'condition-code'
  | 'condition-branch'
  | 'action-message'
  | 'action-exec'
  | 'action-file'
  | 'action-http'
  | 'action-wait'
  | 'action-approval'
  | 'transform-map'
  | 'transform-filter'
  | 'transform-merge'
  | 'output-notify'
  | 'output-store'
  | 'output-webhook'
  | 'group';                           // Visual grouping container

interface WorkflowEdge {
  id: string;
  source: string;                      // Source node ID
  sourceHandle: string;                // Output handle ID (e.g., 'success', 'failure', 'default')
  target: string;                      // Target node ID
  targetHandle: string;                // Input handle ID
  label?: string;
  animated?: boolean;
  data?: {
    condition?: string;                // Edge condition expression
    dataMapping?: Record<string, string>; // Map source outputs to target inputs
  };
}

interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  defaultValue: unknown;
  description: string;
}

interface WorkflowSettings {
  maxConcurrency: number;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  errorHandling: 'stop' | 'continue' | 'fallback';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
}
```

**Node-Specific Data Types:**

```typescript
// Agent Invoke node
interface AgentInvokeData {
  agentId: string;
  agentName: string;
  model?: string;                      // Override default model
  prompt: string;                      // Can reference {{variables}} and {{inputs}}
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: string[];                    // Available tool names
  outputVariable: string;             // Variable name to store result
}

// LLM Condition node
interface LLMConditionData {
  evaluationPrompt: string;            // "Is this research quality sufficient?"
  model: string;                       // Which model evaluates
  outputType: 'boolean' | 'category';  // true/false or multi-branch
  categories?: string[];               // If category: ["excellent", "good", "poor"]
  temperature: number;                 // Lower for more deterministic
}

// Code Condition node
interface CodeConditionData {
  language: 'javascript' | 'python';
  code: string;                        // Must return boolean or string
  inputVariables: string[];            // Available variables in scope
}

// Cron Trigger node
interface CronTriggerData {
  schedule: string;                    // Cron expression
  timezone: string;
  description: string;                 // Human-readable schedule description
  enabled: boolean;
}

// Action nodes
interface MessageActionData {
  channel: string;                     // Slack, Discord, etc.
  channelId: string;
  message: string;                     // Template with {{variables}}
  mentionUsers?: string[];
}

interface ExecActionData {
  command: string;
  workdir?: string;
  timeout?: number;
  requireApproval: boolean;
}

interface HttpActionData {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  body?: string;
  outputVariable: string;
}
```

### 3. Component Architecture

```
<WorkflowBuilderLayout>                      // Full-screen layout
├── <WorkflowToolbar>                        // Top toolbar
│   ├── <BreadcrumbNav>                      // Home > Workflows > "My Workflow"
│   ├── <WorkflowNameEditor>                 // Inline editable name
│   ├── <UndoRedoButtons>                    // Undo (Cmd+Z) / Redo (Cmd+Shift+Z)
│   ├── <ZoomControls>                       // Zoom in/out/fit/100%
│   ├── <AutoLayoutButton>                   // Auto-arrange nodes (dagre)
│   ├── <ExecutionControls>                  // [▶ Run] [⏸ Pause] [⏹ Stop]
│   ├── <VersionSelector>                    // Version dropdown with history
│   └── <SettingsButton>                     // Workflow-level settings
├── <WorkflowCanvas>                         // Main canvas area
│   ├── <ReactFlowProvider>
│   │   ├── <ReactFlow>                      // Core canvas with pan/zoom
│   │   │   ├── <CustomNodes>                // Registered custom node types
│   │   │   │   ├── <TriggerNode data>       // Orange accent — entry points
│   │   │   │   │   ├── <NodeIcon>           // Trigger-type-specific icon
│   │   │   │   │   ├── <NodeLabel>          // Node name
│   │   │   │   │   ├── <NodeStatus>         // Execution status indicator
│   │   │   │   │   ├── <OutputHandle>       // Connection point (bottom/right)
│   │   │   │   │   └── <NodeBadge>          // Config summary (e.g., "Every 5 min")
│   │   │   │   ├── <AgentNode data>         // Purple accent — agent invocations
│   │   │   │   │   ├── <AgentAvatar>        // Agent's avatar/icon
│   │   │   │   │   ├── <NodeLabel>
│   │   │   │   │   ├── <ModelBadge>         // Which model
│   │   │   │   │   ├── <NodeStatus>
│   │   │   │   │   ├── <InputHandle>        // Top/left
│   │   │   │   │   └── <OutputHandle>       // Bottom/right
│   │   │   │   ├── <ConditionNode data>     // Yellow accent — branching logic
│   │   │   │   │   ├── <DiamondShape>       // Diamond-shaped node
│   │   │   │   │   ├── <NodeLabel>
│   │   │   │   │   ├── <ConditionPreview>   // Truncated condition text
│   │   │   │   │   ├── <InputHandle>
│   │   │   │   │   ├── <TrueHandle label="Yes">
│   │   │   │   │   └── <FalseHandle label="No">
│   │   │   │   ├── <ActionNode data>        // Blue accent — actions
│   │   │   │   │   ├── <NodeIcon>
│   │   │   │   │   ├── <NodeLabel>
│   │   │   │   │   ├── <NodeStatus>
│   │   │   │   │   ├── <InputHandle>
│   │   │   │   │   └── <OutputHandle>
│   │   │   │   ├── <TransformNode data>     // Green accent — data transforms
│   │   │   │   │   ├── <NodeIcon>
│   │   │   │   │   ├── <NodeLabel>
│   │   │   │   │   ├── <InputHandle>        // Can have multiple inputs
│   │   │   │   │   └── <OutputHandle>
│   │   │   │   ├── <OutputNode data>        // Teal accent — outputs/sinks
│   │   │   │   │   ├── <NodeIcon>
│   │   │   │   │   ├── <NodeLabel>
│   │   │   │   │   └── <InputHandle>
│   │   │   │   └── <GroupNode>              // Dashed border container for grouping
│   │   │   │       ├── <GroupHeader>
│   │   │   │       └── <GroupResizeHandle>
│   │   │   ├── <CustomEdges>
│   │   │   │   ├── <DefaultEdge>            // Bezier curve with arrow
│   │   │   │   ├── <AnimatedEdge>           // Dashed animation showing data flow
│   │   │   │   ├── <ConditionalEdge>        // Edge with label (Yes/No/category)
│   │   │   │   └── <ErrorEdge>              // Red edge for error paths
│   │   │   ├── <Background variant="dots">  // Dot grid background
│   │   │   ├── <MiniMap>                    // Bottom-right minimap
│   │   │   └── <Controls>                   // Zoom controls overlay
│   │   └── <ConnectionLine>                 // Visual feedback while dragging new edge
│   └── <CanvasContextMenu>                  // Right-click context menu
│       ├── Add Node → (submenu by category)
│       ├── Paste
│       ├── Select All
│       ├── Auto Layout
│       └── Zoom to Fit
├── <NodePalette>                            // Left sidebar — draggable node library
│   ├── <PaletteSearch>                      // Filter nodes by name
│   ├── <PaletteCategory label="Triggers">
│   │   ├── <PaletteItem icon="🕐" label="Cron" nodeType="trigger-cron">
│   │   ├── <PaletteItem icon="🔗" label="Webhook" nodeType="trigger-webhook">
│   │   ├── <PaletteItem icon="⚡" label="Event" nodeType="trigger-event">
│   │   └── <PaletteItem icon="▶️" label="Manual" nodeType="trigger-manual">
│   ├── <PaletteCategory label="Agents">
│   │   ├── <PaletteItem icon="🤖" label="Invoke Agent" nodeType="agent-invoke">
│   │   └── <PaletteItem icon="📤" label="Delegate" nodeType="agent-delegate">
│   ├── <PaletteCategory label="Conditions">
│   │   ├── <PaletteItem icon="🧠" label="LLM Evaluate" nodeType="condition-llm">
│   │   ├── <PaletteItem icon="💻" label="Code Check" nodeType="condition-code">
│   │   └── <PaletteItem icon="🔀" label="Branch" nodeType="condition-branch">
│   ├── <PaletteCategory label="Actions">
│   │   ├── <PaletteItem icon="💬" label="Send Message" nodeType="action-message">
│   │   ├── <PaletteItem icon="⚙️" label="Execute" nodeType="action-exec">
│   │   ├── <PaletteItem icon="📁" label="File Op" nodeType="action-file">
│   │   ├── <PaletteItem icon="🌐" label="HTTP Request" nodeType="action-http">
│   │   ├── <PaletteItem icon="⏳" label="Wait/Delay" nodeType="action-wait">
│   │   └── <PaletteItem icon="✋" label="Approval Gate" nodeType="action-approval">
│   ├── <PaletteCategory label="Transform">
│   │   ├── <PaletteItem icon="🔄" label="Map" nodeType="transform-map">
│   │   ├── <PaletteItem icon="🔍" label="Filter" nodeType="transform-filter">
│   │   └── <PaletteItem icon="🔗" label="Merge" nodeType="transform-merge">
│   └── <PaletteCategory label="Output">
│       ├── <PaletteItem icon="🔔" label="Notify" nodeType="output-notify">
│       ├── <PaletteItem icon="💾" label="Store" nodeType="output-store">
│       └── <PaletteItem icon="↗️" label="Webhook Out" nodeType="output-webhook">
├── <NodeConfigPanel>                        // Right sidebar — selected node config
│   ├── <ConfigPanelHeader>                  // Node type icon + name + delete button
│   ├── <NodeNameEditor>                     // Editable node label
│   ├── <NodeConfigForm>                     // Type-specific configuration
│   │   ├── (varies by node type)
│   │   ├── <AgentInvokeConfig>              // Agent selector, prompt editor, model, tools
│   │   │   ├── <AgentSelector>              // Dropdown of available agents
│   │   │   ├── <PromptTemplateEditor>       // Monaco editor with variable autocomplete
│   │   │   ├── <ModelOverrideSelect>
│   │   │   ├── <ToolSelector>               // Multi-select of allowed tools
│   │   │   └── <OutputVariableName>
│   │   ├── <LLMConditionConfig>             // Model, prompt, output type
│   │   │   ├── <EvaluationPromptEditor>     // Monaco editor
│   │   │   ├── <ModelSelector>
│   │   │   ├── <OutputTypeToggle>           // Boolean vs. Category
│   │   │   └── <CategoryEditor>             // Add/remove category labels
│   │   └── <CronTriggerConfig>              // Cron expression builder
│   │       ├── <CronExpressionInput>
│   │       ├── <CronPresetButtons>          // "Every 5 min", "Hourly", "Daily"
│   │       ├── <CronHumanReadable>          // "Runs every day at 9:00 AM"
│   │       └── <TimezoneSelector>
│   ├── <InputOutputSchema>                  // Shows input/output data shape
│   └── <NodeTestButton>                     // "Test this node" with mock inputs
├── <ExecutionPanel>                         // Bottom panel — execution log/debug
│   ├── <ExecutionPanelHeader>               // Run status, duration, toggle expand
│   ├── <ExecutionTimeline>                  // Horizontal timeline of node executions
│   │   └── <TimelineNode nodeId status duration />
│   ├── <ExecutionLog>                       // Scrollable log of execution events
│   │   └── <LogEntry timestamp nodeId level message />
│   ├── <NodeOutputInspector>                // View output data of selected node
│   │   └── <JsonTreeView data />
│   └── <ExecutionControls>                  // Step through, breakpoints
│       ├── <StepButton>                     // Execute one node at a time
│       ├── <BreakpointToggle>               // Set breakpoint on selected node
│       └── <VariableWatcher>                // Watch workflow variables
└── <WorkflowSettingsModal>                  // Workflow-level settings
    ├── <GeneralSettings>                    // Name, description, tags
    ├── <ExecutionSettings>                  // Concurrency, timeout, retry, error handling
    ├── <VariablesEditor>                    // Define workflow variables
    ├── <VersionHistory>                     // View/restore previous versions
    └── <DangerZone>                         // Delete workflow
```

### 4. Interaction Patterns

**Building a Workflow:**
1. Drag node from `NodePalette` onto canvas (ghost preview follows cursor)
2. Drop → node appears with default config → `NodeConfigPanel` opens on right
3. Configure the node (fill in agent, prompt, condition, etc.)
4. Drag from output handle of one node to input handle of another → edge created
5. Edge snaps to valid handles with magnetic attraction (within 20px)
6. Invalid connections rejected with red flash + shake animation

**Execution Flow:**
1. Click "▶ Run" → workflow executes from trigger nodes
2. Active node: pulsing green border animation
3. Completed node: green checkmark badge
4. Failed node: red X badge + error tooltip
5. Edges animate: dashed flow animation in direction of data movement
6. `ExecutionPanel` slides up from bottom showing real-time logs
7. Click any node during/after execution → see its input/output data

**Debug Flow:**
1. Right-click node → "Set Breakpoint" (red dot appears on node)
2. Run workflow → execution pauses at breakpoint
3. Inspect variables in `VariableWatcher`
4. Click "Step" to execute one node at a time
5. Click "Continue" to resume normal execution

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected nodes/edges |
| `Cmd+C` / `Cmd+V` | Copy/paste nodes |
| `Cmd+D` | Duplicate selected nodes |
| `Cmd+A` | Select all |
| `Cmd+G` | Group selected nodes |
| `Cmd+Shift+G` | Ungroup |
| `Cmd+Enter` | Run workflow |
| `Cmd+.` | Stop execution |
| `Cmd+Shift+F` | Zoom to fit all nodes |
| `Space+drag` | Pan canvas (alternative to middle-click) |
| `Cmd++` / `Cmd+-` | Zoom in/out |
| `Cmd+0` | Zoom to 100% |
| `F5` | Run from selected node |
| `F9` | Toggle breakpoint on selected node |
| `F10` | Step to next node |
| `/` | Open node search palette (command palette style) |
| `Tab` | Cycle through nodes in execution order |
| `Escape` | Deselect all / close panels |

**Animations:**
- Node drag from palette: ghost at 50% opacity follows cursor, canvas shows drop zone highlight
- Node placement: spring animation `scale(0.8) → scale(1.05) → scale(1.0)`, 250ms
- Edge creation: bezier curve draws progressively as user drags, magnetic snap at 20px proximity with subtle pulse
- Execution active: node border pulses green (0.8s cycle), `box-shadow` glow animation
- Data flow: dashed edge animation `stroke-dashoffset` cycles, 2s per loop, direction matches flow
- Node error: shake animation (`translateX ±4px, 3 cycles, 300ms`) + red glow
- Panel transitions: `ExecutionPanel` slides up from bottom (300ms spring), `NodeConfigPanel` slides in from right (250ms)
- Group creation: nodes slide into group boundary, dashed border animates in (400ms)
- Auto-layout: nodes animate to new positions simultaneously, 500ms with ease-out
- Minimap: real-time viewport indicator follows canvas pan/zoom

### 5. Wireframe Description

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 🔀 Workflows > Research Pipeline v3        [↩️][↪️] [🔍+][-][Fit] [▶ Run] [⚙️] │
├────────────┬─────────────────────────────────────────────────────┬──────────────┤
│            │                                                     │              │
│ NODE PALETTE│                    CANVAS                          │ NODE CONFIG  │
│            │                                                     │              │
│ 🔍 Search..│     ┌─────────────┐                                │ 🤖 Research  │
│            │     │ 🕐 TRIGGER  │                                │    Agent     │
│ ▼ Triggers │     │ Every 1 hour│                                │              │
│  🕐 Cron   │     │      ✅     │                                │ Agent:       │
│  🔗 Webhook│     └──────┬──────┘                                │ [Xavier ▾]   │
│  ⚡ Event  │            │                                       │              │
│  ▶️ Manual │            ▼                                       │ Prompt:      │
│            │     ┌─────────────┐                                │ ┌──────────┐ │
│ ▼ Agents   │     │ 🤖 RESEARCH │                                │ │Research  │ │
│  🤖 Invoke │     │   AGENT     │─ ─ ─ ─ ─ ─ ─ ●← (selected)  │ │the topic │ │
│  📤 Delegate│    │   ● Active  │                                │ │{{topic}} │ │
│            │     └──────┬──────┘                                │ │and...    │ │
│ ▼ Conditions│           │                                       │ └──────────┘ │
│  🧠 LLM   │            ▼                                       │              │
│  💻 Code   │     ┌─────────────┐                                │ Model:       │
│  🔀 Branch │     │ 🧠 QUALITY  │                                │ [Opus 4.6 ▾] │
│            │     │   CHECK     │                                │              │
│ ▼ Actions  │     │  ◇ LLM Eval│                                │ Tools:       │
│  💬 Message│     └───┬────┬────┘                                │ ☑ web_search │
│  ⚙️ Exec  │    Yes  │    │  No                                 │ ☑ file_read  │
│  📁 File   │         │    │                                     │ ☐ browser    │
│  🌐 HTTP  │         ▼    ▼                                     │              │
│  ⏳ Wait   │  ┌────────┐ ┌────────┐                             │ Output var:  │
│  ✋ Approve│  │💬 POST │ │🤖 RETRY│                             │ [research_  │
│            │  │TO SLACK│ │ AGENT  │                             │  result]     │
│ ▼ Transform│  │        │ │        │                             │              │
│  🔄 Map   │  └────────┘ └───┬────┘                             │ [Test Node]  │
│  🔍 Filter │                 │                                  │              │
│  🔗 Merge │                 └──→ (back to Quality Check)       │              │
│            │                                                     │              │
│ ▼ Output  │                                          ┌──────┐  │              │
│  🔔 Notify │                                         │MINIMAP│  │              │
│  💾 Store  │                                         │ ·  ·  │  │              │
│  ↗️ Webhook│                                         │  · ·  │  │              │
│            │                                          └──────┘  │              │
├────────────┴────────────────────────────────────────────────────┴──────────────┤
│ ▲ EXECUTION LOG                                              [Expand] [Clear]  │
│ ┌──────────────────────────────────────────────────────────────────────────────┐│
│ │ ● [10:30:01] Trigger fired (cron)                                           ││
│ │ ● [10:30:02] Research Agent started — model: claude-opus-4-6                ││
│ │ ● [10:30:15] Research Agent completed — 1,247 tokens — $0.034              ││
│ │ ● [10:30:16] Quality Check evaluating — model: claude-haiku                ││
│ │ ● [10:30:17] Quality Check: "excellent" → routing to POST TO SLACK         ││
│ │ ► [10:30:17] Sending message to #research-feed...                          ││
│ └──────────────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────────┘
```

### 6. Data Model & API Integration

**Endpoints:**

```
# Workflow CRUD
GET    /api/workflows
  Query: { page, limit, search?, status? }
  Returns: { workflows: WorkflowSummary[], total }

POST   /api/workflows
  Body: WorkflowDefinition
  Returns: WorkflowDefinition (with id)

GET    /api/workflows/:id
  Returns: WorkflowDefinition

PUT    /api/workflows/:id
  Body: Partial<WorkflowDefinition>
  Returns: WorkflowDefinition

DELETE /api/workflows/:id

# Versioning
GET    /api/workflows/:id/versions
  Returns: { versions: WorkflowVersion[] }

GET    /api/workflows/:id/versions/:version
  Returns: WorkflowDefinition (at that version)

POST   /api/workflows/:id/versions/:version/restore
  Returns: WorkflowDefinition (restored)

# Execution
POST   /api/workflows/:id/run
  Body: { variables?: Record<string, unknown>, fromNodeId?: string }
  Returns: { executionId }

POST   /api/workflows/:id/executions/:execId/pause
POST   /api/workflows/:id/executions/:execId/resume
POST   /api/workflows/:id/executions/:execId/stop
POST   /api/workflows/:id/executions/:execId/step

GET    /api/workflows/:id/executions
  Query: { page, limit, status? }
  Returns: { executions: ExecutionSummary[] }

GET    /api/workflows/:id/executions/:execId
  Returns: ExecutionDetail

# Real-time
WS     /ws/workflow/:id/execution/:execId
  Events: node_started, node_completed, node_error, edge_activated,
          variable_changed, execution_complete, execution_error, log_entry

# Node testing
POST   /api/workflows/:id/nodes/:nodeId/test
  Body: { mockInputs: Record<string, unknown> }
  Returns: { output: unknown, logs: LogEntry[], duration: number }

# Templates / Import
GET    /api/workflow-templates
  Returns: { templates: WorkflowTemplate[] }

POST   /api/workflows/import
  Body: { format: 'json' | 'yaml', data: string }
  Returns: WorkflowDefinition

POST   /api/workflows/:id/export
  Body: { format: 'json' | 'yaml' }
  Returns: file download
```

**Zustand Store:**

```typescript
interface WorkflowStore {
  // Current workflow
  workflow: WorkflowDefinition | null;
  isDirty: boolean;
  saving: boolean;

  // Canvas state (synced with React Flow)
  nodes: Node[];                       // React Flow node objects
  edges: Edge[];                       // React Flow edge objects
  selectedNodes: string[];
  selectedEdges: string[];
  viewport: { x: number; y: number; zoom: number };

  // Undo/Redo
  undoStack: WorkflowDefinition[];
  redoStack: WorkflowDefinition[];

  // UI state
  paletteOpen: boolean;
  configPanelOpen: boolean;
  configPanelNodeId: string | null;
  executionPanelOpen: boolean;
  executionPanelHeight: number;        // Resizable

  // Execution state
  activeExecution: ExecutionState | null;
  executionLogs: LogEntry[];
  nodeStatuses: Record<string, NodeExecutionStatus>;
  nodeOutputs: Record<string, unknown>;
  breakpoints: Set<string>;

  // Actions
  loadWorkflow: (id: string) => Promise<void>;
  saveWorkflow: () => Promise<void>;
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  removeNodes: (ids: string[]) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  addEdge: (edge: Omit<WorkflowEdge, 'id'>) => void;
  removeEdges: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  selectNode: (id: string) => void;
  autoLayout: () => void;
  runWorkflow: (variables?: Record<string, unknown>) => Promise<void>;
  stopExecution: () => void;
  pauseExecution: () => void;
  stepExecution: () => void;
  toggleBreakpoint: (nodeId: string) => void;
  testNode: (nodeId: string, mockInputs: Record<string, unknown>) => Promise<void>;
  groupSelectedNodes: () => void;
  duplicateSelectedNodes: () => void;
  exportWorkflow: (format: 'json' | 'yaml') => void;
  importWorkflow: (data: string) => void;
}

interface NodeExecutionStatus {
  status: 'idle' | 'queued' | 'running' | 'success' | 'error' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: string;
  retryCount?: number;
}

interface ExecutionState {
  executionId: string;
  status: 'running' | 'paused' | 'completed' | 'error' | 'stopped';
  startedAt: string;
  completedAt?: string;
  currentNodeId?: string;
  variables: Record<string, unknown>;
}

interface LogEntry {
  timestamp: string;
  nodeId?: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
}
```

### 7. Accessibility Considerations

- **Canvas Navigation:** Full keyboard navigation of the node graph: `Tab` cycles nodes in topological order, `Arrow keys` move between connected nodes following edges, `Enter` opens node config
- **Screen Reader:** Canvas has `role="application"` with `aria-label="Workflow canvas with {n} nodes and {m} connections"`; each node is announced with type, name, and connection count
- **Node Focus:** Focused node has high-contrast focus ring (3px solid, `borderFocus` token color); focus visible even at low zoom levels
- **Alternative View:** Provide a table/list alternative to the canvas for screen reader users: sortable table with columns [Node Name, Type, Connections, Status, Config Summary]
- **Edge Descriptions:** Edges described in node context: "Research Agent, connected to Quality Check via success output"
- **Execution Status:** Real-time status changes announced via `aria-live="polite"`: "Research Agent completed successfully in 13 seconds"
- **Keyboard Drag:** Hold `Shift+Arrow` to move selected nodes by 10px increments; `Ctrl+Arrow` for 1px fine adjustment
- **Color + Shape:** Node types distinguished by color AND icon AND shape (triggers=rounded rectangle, conditions=diamond, agents=rectangle with avatar, actions=rectangle); status uses icon + color (✅/❌/⏳)
- **Zoom Accessibility:** Text remains readable at all zoom levels (minimum effective font size 10px even at 50% zoom)
- **Palette:** Drag-and-drop has keyboard alternative: select node type, press `Enter`, node placed at canvas center or next to selected node
- **Reduced Motion:** Execution animations replaced with static status badges when `prefers-reduced-motion` is set

### 8. Phasing Plan

**Phase 1 — Canvas Foundation (6 weeks)**
- React Flow setup with custom node types (Trigger, Agent, Condition, Action)
- Node palette with drag-and-drop onto canvas
- Edge creation between nodes
- Basic node config panel (simple forms, no Monaco)
- Save/load workflow definitions (JSON)
- Auto-layout with dagre
- Minimap + zoom controls
- Undo/redo
- **Deliverable:** Working visual editor for building static workflow definitions

**Phase 2 — Execution Engine (6 weeks)**
- Server-side workflow execution engine
- WebSocket real-time execution status
- Execution panel with logs and timeline
- Node status visualization (running, complete, error)
- Edge animation showing data flow direction
- Variable system (define, use in templates, watch)
- Node output inspector
- Basic error handling (stop on error / continue)
- **Deliverable:** Workflows that actually run and show real-time progress

**Phase 3 — Advanced Nodes & Debugging (4 weeks)**
- LLM Condition node with natural language evaluation
- Code Condition node with Monaco editor
- Transform nodes (Map, Filter, Merge)
- Approval Gate node (integrates with mobile app)
- Breakpoint debugging (set breakpoints, step through)
- Node testing with mock inputs
- Retry policies and advanced error handling
- Workflow versioning with diff view
- **Deliverable:** Full node library with AI-native conditions and debugging

**Phase 4 — Polish & Advanced Features (4 weeks)**
- Group nodes for visual organization
- Workflow templates/marketplace
- Copy/paste/duplicate nodes
- Import/export (JSON/YAML)
- Keyboard accessibility overhaul
- Performance optimization for large workflows (100+ nodes)
- Collaborative editing (Yjs CRDT) — stretch goal
- Integration with existing cron/sub-agent systems
- **Deliverable:** Production-ready workflow builder

### 9. Open Questions & Risks

| # | Question / Risk | Impact | Mitigation |
|---|----------------|--------|------------|
| 1 | **Execution engine complexity:** Building a reliable workflow runtime is a major backend effort | Critical | Start with sequential execution, add parallel/branching incrementally; consider adopting Temporal.io as execution backend |
| 2 | **LLM condition reliability:** LLM-evaluated conditions may be non-deterministic | High | Low temperature default (0.1); require category-based outputs (not free text); show confidence scores; allow fallback to code conditions |
| 3 | **Performance at scale:** React Flow performance degrades beyond ~200 nodes | Medium | Implement virtualization for off-screen nodes; group nodes to reduce visible count; lazy-load node configs |
| 4 | **Error cascading:** One failed node can have complex downstream effects | High | Clear error propagation visualization (red path highlighting); comprehensive error handling config per node; circuit breaker pattern |
| 5 | **Scope creep:** This feature could expand indefinitely (custom node SDK, third-party integrations, etc.) | High | Strict phase gating; MVP = core nodes + basic execution; advanced features gated behind user demand signals |
| 6 | **Learning curve:** Node-based UIs have a steep learning curve for non-technical users | Medium | Workflow templates for common patterns; guided tutorial (interactive walkthrough); natural language workflow generation ("Create a workflow that...") |
| 7 | **Conflict with existing systems:** Workflows overlap with existing cron/sub-agent features | Medium | Position workflows as the visual layer ON TOP of existing systems; workflows compile down to existing primitives |
| 8 | **Real-time sync complexity:** Multi-user collaborative editing is extremely hard | Low (Phase 4) | Start single-user; collaborative is a stretch goal; if implemented, use Yjs which handles conflict resolution |
| 9 | **Cost control:** Workflows with LLM conditions can be expensive to run frequently | High | Show estimated cost before running; per-workflow cost caps; execution budgets; "dry run" mode that simulates without API calls |
| 10 | **Testing workflows:** Complex workflows are hard to test without real data | Medium | Mock input system for each node; "test mode" that uses cached/mock responses; snapshot testing of workflow outputs |

---

## Summary & Prioritization Recommendation

| Idea | Effort | Value | Risk | Recommended Start |
|------|--------|-------|------|-------------------|
| **14: Theming Engine** | 8 weeks | Medium | Low | **Start first** — lowest risk, builds on existing foundation, delights users |
| **11: Model A/B Testing** | 9 weeks | High | Medium | **Start second** — unique differentiator, leverages existing multi-provider support |
| **12: Template Marketplace** | 14 weeks | High | Medium | **Quarter 2** — needs ClawhHub backend; seed content first |
| **13: Mobile Companion** | 13 weeks | High | High | **Quarter 2–3** — app store review risk; push infra needed |
| **15: Visual Workflow Builder** | 20+ weeks | Very High | Very High | **Quarter 3–4** — most ambitious; start with Phase 1 canvas only |

All five ideas represent significant product differentiation. The theming engine and model comparison view can ship incrementally and deliver value quickly. The marketplace, mobile app, and workflow builder are platform plays that compound over time but require sustained investment.

---

# Cross-Cutting Notes

## Shared Infrastructure

Several ideas share underlying infrastructure that should be built once:

1. **WebSocket Event Integration** — Ideas 1, 2, 4, 7, 15 all consume gateway WebSocket events. A unified `useGatewayEvents` hook with typed event subscriptions prevents duplication.
2. **Graph/Canvas Libraries** — Ideas 2 and 15 both need React Flow. Build the graph infrastructure once with Idea 2, extend for Idea 15.
3. **Schema-Driven Forms** — Ideas 1, 8, 9, 14 all need dynamic form generation from schemas. The config form renderer (Idea 8) should be generic enough to reuse.
4. **Monaco Editor** — Ideas 8, 9, 15 all benefit from Monaco. Lazy-load it once as a shared chunk.
5. **Slide-Over Panels** — Ideas 7, 10, 12, 14 all use slide-over/drawer patterns. Standardize on Radix Sheet with consistent widths and animations.
6. **Design Token System** — Idea 14 (theming) underpins the visual foundation for all other ideas. Consider building it early even if "deferred" in priority.

## Recommended Build Order

Given dependencies and shared infrastructure:

1. **Empty States** (Idea 5) — 1 week, immediate polish win
2. **Unified Config** (Idea 8) — builds schema-driven forms used by others
3. **Onboarding Tour** (Idea 1) — uses schema forms from Idea 8
4. **Mission Control Dashboard** (Idea 4) — establishes WebSocket patterns
5. **Command Palette 2.0** (Idea 3) — incremental extension of existing
6. **Inline Docs** (Idea 10) — enhances everything built so far
7. **Progressive Disclosure 2.0** (Idea 6) — refines existing proficiency system
8. **Agent Topology** (Idea 2) — establishes graph rendering
9. **Session Replay** (Idea 7) — complex but high-value debugging
10. **Skill Builder** (Idea 9) — ecosystem investment
11–15: Sequence based on Q2-Q3 priorities

---

*This document is a living spec. Each idea should be broken into implementation tickets before work begins. Specs should be updated as implementation reveals new constraints or opportunities.*

—Luis, Principal UX Engineer
