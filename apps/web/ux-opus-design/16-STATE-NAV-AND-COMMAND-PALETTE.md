# State, Navigation, and Command Palette (apps/web)

This document standardizes:
- The URL/state model for the web app (what is shareable in URLs vs local-only UI state).
- The search/jump information architecture (IA) via a dedicated **Configuration Command Palette**.

**Canonical keys/terms:** `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`

## 1) URL + State Model (Canonical)

Rule: **If a view is a “sub-view” of a page (tabs/sections), represent it consistently via query params.**

### Shareable URL State (must round-trip)

| Surface | State | Representation | Example |
|--------|-------|----------------|---------|
| Agent detail | Selected tab | `?tab=<id>` | `/agents/abc123?tab=tools` |
| Agent detail | Selected activity item | `?tab=activity&activityId=<id>` | `/agents/abc123?tab=activity&activityId=evt_123` |
| Settings | Selected section | `?section=<id>` | `/settings?section=model-provider` |
| Settings | Search/filter in a section (if applicable) | `?q=` and/or `?filter=` | `/settings?section=connections&q=google` |

Design constraint:
- Do **not** mix multiple patterns for the same class of state (e.g. don’t use hash fragments for tabs if other tabs use `?tab=`).

Canonical agent tab ids (design intent):
- Primary: `basics`, `more`
- Full view (Expert Mode): `overview`, `behavior`, `tools`, `memory`, `availability`, `advanced`, `activity`, plus existing feature tabs.

### Deep Links While in Simple View (Canonical Recommendation)

If a user deep-links to a Full-view tab while they are currently in Simple view (e.g. `/agents/abc123?tab=tools`):
- Do **not** force-switch the user into Full view automatically.
- Render the requested surface inside **More** (or an equivalent nested section container) while still honoring the same `?tab=` id.
- Show a single, explicit affordance: `Open in Full view` (switches view mode locally for this page).

This avoids duplicating component definitions: the same `AgentToolsTab` / `AgentActivityTab` components can be mounted either as:
- full-page tab content (Full view), or
- nested content inside More (Simple view).

### Local-Only UI State (not shareable; persisted optionally)

| State | Storage | Notes |
|------|---------|------|
| Accordion expanded/collapsed | Session/local store | Keep stable during a session; don’t pollute URLs |
| Draft values during editing | Local component state | Must survive transient network errors |
| Expert Mode toggle | `useUIStore.powerUserMode` | Persisted preference |
| View mode override (Simple/Full) | Local component state | Per-page override; defaults from Expert Mode; does not persist |
| Last visited agent/tab (optional) | Session | Only if it doesn’t break shareable URL state |

## 2) Navigation IA (Search/Jump)

The app must support both:
- **Browse** (sidebar + pages + tabs)
- **Jump** (power-user search across destinations and settings)

Jump is implemented as a dedicated command palette structure: **Configuration Command Palette**.

## 3) Configuration Command Palette (Design Spec)

### Goals
- Jump to any config surface in <= 2 keystrokes.
- Provide a “power user fast lane” without exposing extra complexity to non-power users.
- Make expert features discoverable by intent (users actively search), not by cluttering the UI.

### Entry Points
- Global shortcut: `Cmd+K` / `Ctrl+K`
- Button: “Search / Jump” in Settings and Agent header areas
- Context menu: “Jump to setting…” (optional)

### Command Structure (Canonical Categories)

Commands should be grouped by category and support fuzzy search.

1) **Navigation**
   - Go to Agents
   - Go to Settings
   - Go to Conversations
   - Go to Connections
   - Go to Toolsets

2) **Agents**
   - Open Agent: `<agent name>`
   - Open Agent: `<agent name> → Basics`
   - Open Agent: `<agent name> → More`
   - Open Agent Tab (Full view): `<agent name> → Overview/Behavior/Tools/Memory/Availability/Advanced/Activity`
   - Duplicate Agent (power)
   - Export Agent Config (power)

3) **Settings**
   - Open Settings Section: Model & Provider / Channels / Gateway / Connections / Toolsets / Advanced / Usage
   - Toggle Expert Mode (power)
   - (Optional) Toggle View Mode is not required on Settings pages in MVP; prefer Expert Mode + collapsible Advanced sections

4) **Providers**
   - Connect Provider: OpenAI/Anthropic/Gemini/OpenRouter/Z.AI/Azure OpenAI/Bedrock/Vertex AI
   - Test Provider Connection: `<provider>`

5) **Toolsets**
   - Create Toolset
   - Edit Toolset: `<toolset name>`

6) **Help**
   - “What is System Brain?”
   - “What is Heartbeat?”
   - “What is Elevated mode?”
   - “How do toolsets work?”

### Deep-Link Requirements

Each command must map to a stable route and query-param state:
- Agent commands: `/agents/:agentId?tab=<tab>`
- Settings commands: `/settings?section=<section>`

### Power User Enhancements (when Expert Mode is ON)
- Show technical config paths in command subtitles (e.g. `agents.defaults.model.primary`).
- Offer “Copy CLI equivalent” actions where meaningful (e.g., provider connect/pairing).
