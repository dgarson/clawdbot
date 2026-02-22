# Information Architecture

> Navigation structure, page hierarchy, and routing

**Canonical URL/state model:** `apps/web/ux-opus-design/16-STATE-NAV-AND-COMMAND-PALETTE.md`

---

## Site Map

```
Clawdbrain Web App
│
├── /                           # Dashboard / Home
│
├── /agents                     # Agent Management
│   └── /agents/$agentId        # Agent Detail
│       ├── Basics tab          ← NEW (90% controls)
│       ├── More tab            ← Groups advanced/detail surfaces
│       └── Full view (Expert Mode or per-page override)
│           ├── Overview tab
│           ├── Behavior tab
│           ├── Tools tab
│           ├── Memory tab
│           ├── Availability tab
│           ├── Advanced tab
│           ├── Workstreams tab
│           ├── Rituals tab
│           ├── Soul tab
│           └── Activity tab
│
├── /settings                   # System Configuration
│   ├── Model & Provider        # System-wide AI settings
│   ├── Agents                  # Agent defaults
│   ├── Toolsets                # Reusable permission sets
│   ├── Channels                # Messaging integrations
│   ├── Gateway                 # Gateway configuration
│   ├── Connections             # Third-party services
│   ├── Health                  # System status
│   ├── Advanced                # Power user settings
│   └── Usage                   # Metrics and billing
│
├── /you                        # User Profile
│   ├── Profile                 # Personal info
│   └── Preferences             # UI preferences
│
├── /conversations              # Chat Interface
│   └── /conversations/$id      # Conversation detail
│       └── /agentic            # Agentic workflow view
│
├── /workstreams               # Workstream Management
│   └── /workstreams/$id
│
├── /goals                     # Goal tracking
├── /memories                  # Memory browser
├── /rituals                   # Scheduled routines
├── /jobs                      # Background jobs
│
├── /onboarding               # First-time setup
└── /debug                    # Developer tools
```

---

## Primary Navigation

### Desktop Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Logo]  Clawdbrain                                    [?] [User Avatar] │
├──────────────┬──────────────────────────────────────────────────────────┤
│              │                                                          │
│  MAIN        │                                                          │
│  ○ Dashboard │               Page Content Area                          │
│  ● Agents    │                                                          │
│  ○ Convers.. │                                                          │
│              │                                                          │
│  MANAGE      │                                                          │
│  ○ Workstr.. │                                                          │
│  ○ Goals     │                                                          │
│  ○ Rituals   │                                                          │
│              │                                                          │
│  ───────────-│                                                          │
│  ○ Settings  │                                                          │
│  ○ Profile   │                                                          │
│              │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
```

Note: Mobile UX is explicitly out of scope for this `apps/web/` plan. If/when a dedicated mobile app exists, it should have its own IA and interaction model rather than inheriting the web UI.

---

## Settings Navigation

### Desktop Settings Sidebar

```
Settings
├── CONFIGURATION
│   ├── Model & Provider    ← Primary system config
│   ├── Agents              ← Agent defaults
│   ├── Toolsets            ← Reusable permissions
│   └── Channels            ← Messaging setup
│
├── INFRASTRUCTURE
│   ├── Gateway             ← Gateway config
│   ├── Connections         ← Third-party integrations
│   └── Health              ← System status
│
└── ADVANCED
    ├── Advanced            ← Power user options
    └── Usage               ← Metrics
```

---

## Agent Detail Navigation

### Simple View (Default) Tab Bar

```
┌─────────────────────────────────────────────────────────────────┐
│ [←] Agent Name                          View: Simple/Full      │
└─────────────────────────────────────────────────────────────────┘
│ [Basics] [More]                                                │
└─────────────────────────────────────────────────────────────────┘
```

Simple view intent:
- **Basics**: 90% controls (identity/purpose/tools summary + behavior quick controls + quiet hours + configuration summary).
- **More**: the rest, grouped into sections (advanced settings, activity/logs, specialized feature surfaces).

### Full View (Expert Mode or Per-Page Override) Tab Bar

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [←] Agent Name                          View: Full  (Expert available)   │
└──────────────────────────────────────────────────────────────────────────┘
│ [Basics] [More] [Overview] [Behavior] [Tools] [Memory] [Availability] ... │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tab IDs and Visibility Rules (Canonical)

This table defines what `?tab=` means, and how it renders under Simple vs Full.

| Tab ID | Simple View | Full View | Notes |
|--------|------------|-----------|-------|
| `basics` | ✅ Primary tab | ✅ Primary tab | Composition surface (non-technical default) |
| `more` | ✅ Primary tab | ✅ Primary tab | Composition surface with deep links |
| `overview` | 🔶 Accessible via More section or Command Palette | ✅ Visible | Full-view-only surface |
| `behavior` | 🔶 Accessible via Basics quick section or Command Palette | ✅ Visible | Full-view-only surface; Basics includes quick controls |
| `tools` | 🔶 Accessible via Basics summary / More link / Command Palette | ✅ Visible | Full-view-only surface; Tools tab exists today |
| `memory` | 🔶 Accessible via More section or Command Palette | ✅ Visible | Full-view-only surface (planned) |
| `availability` | 🔶 Accessible via More section or Command Palette | ✅ Visible | Full-view-only surface (planned) |
| `advanced` | 🔶 Accessible via More section or Command Palette | ✅ Visible | Full-view-only surface (planned) |
| `activity` | 🔶 Accessible via More section or Command Palette | ✅ Visible | Full-view-only surface; Activity tab exists today |
| `workstreams` | 🔶 Accessible via More section | ✅ Visible | Existing feature tab (today) |
| `rituals` | 🔶 Accessible via More section | ✅ Visible | Existing feature tab (today) |
| `soul` | 🔶 Accessible via More section | ✅ Visible | Existing feature tab (today) |

Implementation note: In Simple view, non-primary tabs can render inside More (or as a nested section) while still honoring their shareable `?tab=` ids.

---

## Page Templates

### List Page (Agents, Workstreams, etc.)

```
┌─────────────────────────────────────────────────────────────────┐
│ Page Title                                    [+ Create] [⋮]   │
│ Subtitle / description text                                     │
├─────────────────────────────────────────────────────────────────┤
│ [Search...........................] [Filter ▼] [Sort ▼]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Card 1          │  │ Card 2          │  │ Card 3          │ │
│  │                 │  │                 │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ Card 4          │  │ + Add New       │                      │
│  │                 │  │                 │                      │
│  └─────────────────┘  └─────────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Detail Page (Agent Detail, etc.)

```
┌─────────────────────────────────────────────────────────────────┐
│ [←] Agent Name                              [Actions ▼] [⋮]    │
│ Status: ● Active   •   Role: Research Assistant                │
├─────────────────────────────────────────────────────────────────┤
│ [Overview] [Behavior] [Tools] [Memory] [Availability] [Adv..]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Section Title                                             │ │
│  │ Helper text                                               │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │                                                           │ │
│  │ Form controls...                                          │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Another Section                                           │ │
│  │ ...                                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Settings Section Page

```
┌─────────────────────────────────────────────────────────────────┐
│ Settings > Model & Provider                                     │
├────────────────┬────────────────────────────────────────────────┤
│                │                                                │
│ CONFIGURATION  │  Section Title                        [Save]  │
│ ● Model & Prov │  Helper text                                  │
│ ○ Agents       │  ┌────────────────────────────────────────┐   │
│ ○ Toolsets     │  │ Card 1                                 │   │
│ ○ Channels     │  │ ...                                    │   │
│                │  └────────────────────────────────────────┘   │
│ INFRASTRUCTURE │                                                │
│ ○ Gateway      │  ┌────────────────────────────────────────┐   │
│ ○ Connections  │  │ Card 2                                 │   │
│ ○ Health       │  │ ...                                    │   │
│                │  └────────────────────────────────────────┘   │
│ ADVANCED       │                                                │
│ ○ Advanced     │                                                │
│ ○ Usage        │                                                │
│                │                                                │
└────────────────┴────────────────────────────────────────────────┘
```

---

## URL Patterns

### Routes

| Pattern | Page | Parameters |
|---------|------|------------|
| `/` | Dashboard | — |
| `/agents` | Agent list | — |
| `/agents/:agentId` | Agent detail | `agentId` |
| `/agents/:agentId?tab=<tabId>` | Agent tab | `agentId`, `tab` query |
| `/settings` | Settings index | — |
| `/settings?section=model-provider` | Settings section | `section` query |
| `/conversations/:id` | Conversation | `id` |
| `/conversations/:id/agentic` | Agentic mode | `id` |

### Deep Linking

All settings sections and agent tabs should support direct linking:

```
/settings?section=toolsets           # Jump to toolsets
/agents/abc123?tab=basics            # Jump to the Basics tab
/agents/abc123?tab=more              # Jump to the More tab
/agents/abc123?tab=tools             # Full view: jump to agent tools tab
/agents/abc123?tab=advanced          # Jump to agent advanced tab
```

Design constraint:
- Use **query params** consistently for “sub-views” such as tabs and settings sections. Avoid mixing in hash fragments for these.

---

## Breadcrumbs

| Page | Breadcrumb |
|------|------------|
| Agent detail | Agents > Agent Name |
| Agent tab | Agents > Agent Name > Tab |
| Settings section | Settings > Section Name |
| Workstream detail | Workstreams > Workstream Name |

---

## State Persistence

### URL State (Shareable)
- Current tab
- Settings section
- Search/filter parameters
- Sort order

### Local State (Not in URL)
- Sidebar collapsed
- Accordion expanded states
- Expert mode toggle

### Session State (Persisted)
- Recent agents visited
- Recently used settings sections
- Draft form values (before save)

---

## Search/Jump IA (Power User)

The web app must support a first-class “jump to destination/setting” flow via a dedicated Configuration Command Palette:
- `apps/web/ux-opus-design/16-STATE-NAV-AND-COMMAND-PALETTE.md`
