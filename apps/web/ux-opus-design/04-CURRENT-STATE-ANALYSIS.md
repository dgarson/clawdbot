# Current State Analysis

> What already exists in `apps/web/`

This document catalogs the existing implementation to identify what can be reused, extended, or needs replacement.

**Verified against code:** 2026-02-01
**Canonical keys/terms:** `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`

---

## Architecture Overview

```
apps/web/
├── src/
│   ├── components/
│   │   ├── domain/          # Feature-specific components
│   │   │   ├── agents/      # Agent UI (cards, tabs, wizards)
│   │   │   ├── settings/    # Settings sections (24 files, 440KB)
│   │   │   ├── config/      # Configuration forms (20 files)
│   │   │   ├── tools/       # Tool configuration components
│   │   │   ├── chat/        # Chat interface
│   │   │   └── ...          # Other domains
│   │   ├── composed/        # Composed/assembled components
│   │   └── ui/              # Base UI components (shadcn)
│   ├── routes/              # TanStack Router file-based routing
│   ├── hooks/               # React hooks (queries, mutations)
│   ├── stores/              # Zustand state stores
│   ├── integrations/        # External integrations (OpenClaw)
│   └── lib/                 # Utilities and API layer
├── ux-agent-config/         # Original design docs
└── docs/plans/              # Implementation plans
```

---

## Routing Structure

**Framework:** TanStack React Router (file-based)

| Route | Component | Status |
|-------|-----------|--------|
| `/agents` | Agent list | ✅ Complete |
| `/agents/$agentId` | Agent detail (tabs) | ✅ Complete |
| `/settings` | System settings | ✅ Complete |
| `/you` | User profile | ✅ Complete |
| `/conversations/$id` | Chat view | ✅ Complete |
| `/conversations/$id/agentic` | Agentic workflow | ✅ Complete |
| `/workstreams/$id` | Workstream details | ✅ Complete |
| `/goals`, `/memories`, etc. | Feature pages | ✅ Complete |
| `/debug` | Developer tools | ✅ Complete |
| `/onboarding` | Setup wizard | ✅ Complete |

---

## Settings Domain (`components/domain/settings/`)

### Navigation

| Component | Lines | Description | Status |
|-----------|-------|-------------|--------|
| `SettingsConfigNav.tsx` | ~200 | Desktop sidebar nav | ✅ Complete |
| `SettingsConfigMobileNav.tsx` | ~150 | Mobile horizontal tabs | ✅ Complete |
| `SettingsNav.tsx` | ~100 | Legacy navigation | ⚠️ May be deprecated |
| `ProfileNav.tsx` | ~80 | Profile section nav | ✅ Complete |

### Section Components

| Component | Lines | Description | Status |
|-----------|-------|-------------|--------|
| `ModelProviderSection.tsx` | 1,399 | Provider configuration (includes System Brain, Heartbeat, and Global Behavior behind Expert Mode) | ✅ Substantial |
| `HealthSection.tsx` | ~300 | System health dashboard | ✅ Complete |
| `AIProviderSection.tsx` | ~400 | AI provider setup | ✅ Complete |
| `GatewaySection.tsx` | ~250 | Gateway config | ✅ Complete |
| `ChannelsSection.tsx` | ~350 | Messaging channels | ✅ Complete |
| `AgentsSection.tsx` | ~200 | Agent management | ✅ Complete |
| `ToolsetsSection.tsx` | ~300 | Toolset presets (built-in + custom) | ✅ Complete |
| `ToolsetEditor.tsx` | ~250 | Toolset editor | ✅ Complete |
| `ConnectionsSection.tsx` | ~800 | Third-party integrations | ✅ Complete |
| `AdvancedSection.tsx` | ~150 | Advanced settings | ✅ Complete |
| `UsageSection.tsx` | ~200 | Usage metrics | ✅ Complete |

---

## Agent Domain (`components/domain/agents/`)

### Agent List & Cards

| Component | Description | Status |
|-----------|-------------|--------|
| `AgentCard.tsx` | Individual agent display | ✅ Complete |
| `agent-status-card.tsx` | Status indicator | ✅ Complete |
| `CreateAgentWizard.tsx` | Multi-step creation | ✅ Complete |
| `NewSessionDialog.tsx` | Start session | ✅ Complete |

### Agent Detail Tabs

| Tab | Component | Description | Status |
|-----|-----------|-------------|--------|
| Overview | `AgentOverviewTab.tsx` | Identity, purpose | ✅ Complete |
| Workstreams | `AgentWorkstreamsTab.tsx` | Assigned workstreams | ✅ Complete |
| Rituals | `AgentRitualsTab.tsx` | Scheduled routines | ✅ Complete |
| Tools | `AgentToolsTab.tsx` | Tool permissions + toolset selector with read-only mode when using a toolset | ✅ Complete |
| Soul | `AgentSoulTab.tsx` | Personality config | ✅ Complete |
| Activity | `AgentActivityTab.tsx` | Activity log (31KB) | ✅ Complete |
| **Behavior** | — | Creativity, response length | ❌ Missing |
| **Memory** | — | Memory depth, pruning | ❌ Missing |
| **Availability** | — | Quiet hours, heartbeat | ❌ Missing |
| **Advanced** | — | Runtime, sandbox, raw | ❌ Missing |

---

## Configuration Domain (`components/domain/config/`)

| Component | Lines | Description | Status |
|-----------|-------|-------------|--------|
| `AgentConfig.tsx` | ~400 | Agent CRUD interface | ✅ Complete |
| `AgentFormModal.tsx` | ~850 | Create/edit form | ✅ Complete |
| `ModelProviderConfig.tsx` | ~300 | Provider config | ✅ Complete |
| `ModelProviderSelector.tsx` | ~150 | Provider dropdown | ✅ Complete |
| `ChannelConfig.tsx` | ~1000 | Channel setup | ✅ Complete |
| `GatewayConfig.tsx` | ~200 | Gateway settings | ✅ Complete |
| `HealthDashboard.tsx` | ~800 | System health | ✅ Complete |
| `DynamicConfigForm.tsx` | ~200 | Generated forms | ✅ Complete |
| `ConfigField.tsx` | ~150 | Field input | ✅ Complete |

---

## Tools Domain (`components/domain/tools/`)

| Component | Description | Status |
|-----------|-------------|--------|
| `types.ts` | Tool type definitions | ✅ Complete |
| `tool-data.ts` | Tool metadata | ✅ Complete |
| `ToolAccessConfig.tsx` | Main tool config | ✅ Complete |
| `ToolCategorySection.tsx` | Collapsible category | ✅ Complete |
| `ToolPermissionRow.tsx` | Individual toggle | ✅ Complete |

---

## State Management

### Zustand Stores (`stores/`)

| Store | State | Status |
|-------|-------|--------|
| `useAgentStore` | `agents[]`, `selectedAgentId` | ✅ Complete |
| `useUIStore` | `sidebarCollapsed`, `theme`, `powerUserMode`, `useLiveGateway` | ✅ Complete |
| `useSessionStore` | Session state | ✅ Complete |
| `useConversationStore` | Conversation state | ✅ Complete |
| `useWorkspaceStore` | Workspace state | ✅ Complete |

### Query Hooks (`hooks/queries/`)

| Hook | Purpose | Status |
|------|---------|--------|
| `useAgents` | Fetch agents list | ✅ Complete |
| `useAgent` | Single agent detail | ✅ Complete |
| `useSessions` | Session queries | ✅ Complete |
| `useChannels` | Available channels | ✅ Complete |
| `useConfig` | Full system config | ✅ Complete |
| `useGateway` | Gateway status | ✅ Complete |
| `useModels` | Models by provider | ✅ Complete |
| `useGoals`, `useMemories`, etc. | Feature queries | ✅ Complete |

### Mutation Hooks (`hooks/mutations/`)

| Hook | Purpose | Status |
|------|---------|--------|
| `useAgentMutations` | Agent CRUD + status | ✅ Complete |
| `useConfigMutations` | Config patch | ✅ Complete |
| Feature mutations | Goals, memories, etc. | ✅ Complete |

---

## Integrations (`integrations/`)

### OpenClaw Integration

| Export | Purpose | Status |
|--------|---------|--------|
| `OpenClawProvider` | Gateway connection | ✅ Complete |
| `useOpenClawEvents` | Event bus access | ✅ Complete |
| `useOpenClawGateway` | Gateway client | ✅ Complete |
| `useOpenClawEvent` | Typed event subscription | ✅ Complete |
| `useOpenClawWorkflow` | Workflow tracking | ✅ Complete |

**Event Types Supported:**
- `gateway:connected`, `gateway:disconnected`
- `tool_call`, `tool_result`, `complete`, `error`
- `session:created`, `session:resumed`, `session:ended`
- `agent:thinking`, `agent:streaming`

---

## API Layer (`lib/api/`)

| Module | Purpose | Status |
|--------|---------|--------|
| `config.ts` | Config get/patch | ✅ Complete |
| `gateway-client.ts` | WebSocket/HTTP client | ✅ Complete |
| `sessions.ts` | Session API | ✅ Complete |
| `types.ts` | Type definitions | ✅ Complete |

---

## UI Component Library

**Base:** shadcn/ui components

Available in `components/ui/`:
- Button, Input, Select, Checkbox, Toggle
- Card, Dialog, Sheet, Tabs
- Form, Label, Textarea
- Accordion, Collapsible
- Tooltip, Popover
- Table, DataTable
- And more...

---

## Key Observations

### Strengths

1. **Solid foundation** — Routing, state, API layer are mature
2. **Component library** — shadcn/ui provides consistent base
3. **Settings infrastructure** — ModelProviderSection already covers runtime, System Brain, heartbeat, fallbacks, and global behavior (advanced)
4. **Tool system** — Toolsets + per-agent tool configuration patterns exist and are reusable
5. **Real-time ready** — OpenClaw integration enables live updates
6. **Power user navigation** — Command palette + keyboard shortcuts infrastructure exists (treat as a first-class surface in future UX docs)

### Gaps

1. **Missing agent panels** — Behavior, Memory, Availability, Advanced
2. **Missing Basics/More composition surfaces** — The UX plan requires Simple view defaults (Basics + More) layered on top of existing agent tabs.
3. **No friendly labels** — Technical terms throughout
4. **No per-agent override UX** — Core “use system default” pattern for per-agent settings is not yet implemented
5. **Provider capability gating** — UI needs a capability declaration per model/runtime to show only supported power knobs
6. **No doc-grade edge case inventory** — Must be tracked explicitly (see `apps/web/ux-opus-design/EDGE-CASES.md`)

### Technical Debt

1. **Duplicate nav components** — Legacy `SettingsNav` vs new `SettingsConfigNav`
2. **Large files** — Several 800+ line components could be split
3. **Inconsistent patterns** — Some sections use different form approaches

---

## Reusability Assessment

### Can Reuse As-Is

- All shadcn/ui base components
- Zustand stores (extend, don't replace)
- Query/mutation hooks (extend)
- OpenClaw integration
- Tool domain components

### Can Extend

- `AgentConfig.tsx` — Add panels
- `ModelProviderSection.tsx` — Add System Brain, Heartbeat
- Agent detail tabs — Add new tabs

### Need to Create

- `AgentBasicsTab.tsx` (composition)
- `AgentMoreTab.tsx` (composition)
- `AgentBehaviorPanel.tsx`
- `AgentMemoryPanel.tsx`
- `AgentAvailabilityPanel.tsx`
- `AgentAdvancedPanel.tsx`
- `SystemDefaultToggle.tsx` (reusable)
- `src/lib/terminology.ts` (label mappings)

---

## Edge Cases (Tracked Separately)

We intentionally do not solve all edge cases in the MVP plan docs, but we must not lose them:
- `apps/web/ux-opus-design/EDGE-CASES.md`
