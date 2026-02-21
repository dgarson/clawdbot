# Tab Consolidation & Navigation Structure

> Complete specification for consolidating 10 agent tabs into 4 while preserving all features

---

## Executive Summary

This document specifies the complete navigation structure for the Clawdbrain web UI redesign, consolidating 10 agent-level tabs into 4 for improved usability while preserving 100% of features and configurability.

### Key Changes

| Metric | Before | After | Impact |
|--------|--------|-------|--------|
| Top-level tabs | 10 | 4 (3 for Casual tier) | 60% reduction |
| Clicks to feature | 1 | 1-2 (max +1 for accordion) | Minimal increase |
| Cognitive load | High | Progressive by tier | Significant reduction |
| Features preserved | 52 | 52 | 100% |
| Mobile usability | Poor | Good | Major improvement |

---

## Navigation Hierarchy

### Two-Level Navigation System

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                    COMPLETE APP LAYOUT                                                         ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                               ║
║  ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐  ║
║  │                                                                                                        │  ║
║  │  ┌──────────────┐  ┌──────────────────────────────────────────────────────────────────────────────┐   │  ║
║  │  │              │  │                                                                              │   │  ║
║  │  │   SIDEBAR    │  │                           MAIN CONTENT AREA                                  │   │  ║
║  │  │              │  │                                                                              │   │  ║
║  │  │  ┌────────┐  │  │  ┌────────────────────────────────────────────────────────────────────────┐ │   │  ║
║  │  │  │  LOGO  │  │  │  │  ← Back to Agents                                                      │ │   │  ║
║  │  │  └────────┘  │  │  │                                                                        │ │   │  ║
║  │  │              │  │  │  ┌──────────────────────────────────────────────────────────────────┐ │ │   │  ║
║  │  │  ──────────  │  │  │  │  ┌────────┐                                                      │ │ │   │  ║
║  │  │              │  │  │  │  │   RH   │  Research Helper                                     │ │ │   │  ║
║  │  │  Agents      │  │  │  │  │   ●    │  Research Analyst              [Chat] [Edit] [⋮]    │ │ │   │  ║
║  │  │  Workstreams │  │  │  │  └────────┘  ● Online                                            │ │ │   │  ║
║  │  │  Rituals     │  │  │  └──────────────────────────────────────────────────────────────────┘ │ │   │  ║
║  │  │  Memories    │  │  │                                                                        │ │   │  ║
║  │  │  Goals       │  │  │  ┌────────────────────────────────────────────────────────────────┐   │ │   │  ║
║  │  │              │  │  │  │  Overview  │  Work  │  Activity  │  Chat  │  Configure         │   │ │   │  ║
║  │  │              │  │  │  └────────────────────────────────────────────────────────────────┘   │ │   │  ║
║  │  │              │  │  │                                                                        │ │   │  ║
║  │  │              │  │  │  ┌──────────────────────────────────────────────────────────────────┐ │ │   │  ║
║  │  │              │  │  │  │                                                                  │ │ │   │  ║
║  │  │              │  │  │  │                     [Selected Tab Content]                       │ │ │   │  ║
║  │  │              │  │  │  │                                                                  │ │ │   │  ║
║  │  │              │  │  │  └──────────────────────────────────────────────────────────────────┘ │ │   │  ║
║  │  │              │  │  └────────────────────────────────────────────────────────────────────────┘ │   │  ║
║  │  │  ──────────  │  └──────────────────────────────────────────────────────────────────────────────┘   │  ║
║  │  │              │                                                                                      │  ║
║  │  │  ┌────────┐  │                                                                                      │  ║
║  │  │  │ ● ● ● │  │  ◄── Status Indicators (Gateway, Providers, etc.)                                    │  ║
║  │  │  │Status │  │                                                                                      │  ║
║  │  │  └────────┘  │                                                                                      │  ║
║  │  │              │                                                                                      │  ║
║  │  │  ┌────────┐  │                                                                                      │  ║
║  │  │  │⚙ Sett │  │  ◄── Settings (System-wide)                                                          │  ║
║  │  │  └────────┘  │                                                                                      │  ║
║  │  │              │                                                                                      │  ║
║  │  │  ┌────────┐  │                                                                                      │  ║
║  │  │  │👤 Acct │  │  ◄── Account / Logout                                                               │  ║
║  │  │  └────────┘  │                                                                                      │  ║
║  │  │              │                                                                                      │  ║
║  │  └──────────────┘                                                                                      │  ║
║  │                                                                                                        │  ║
║  └────────────────────────────────────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                                               ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Level 1: Sidebar Navigation (Global)

**Purpose:** Navigate between major app areas

**Location:** Persistent left sidebar (collapsible on mobile)

**Sections:**

1. **Primary Navigation (Top)**
   - Agents → `/agents`
   - All Workstreams → `/workstreams`
   - All Rituals → `/rituals`
   - All Memories → `/memories`
   - All Goals → `/goals`

2. **System Controls (Bottom)**
   - Status Indicators (expandable)
   - Settings → `/settings`
   - Account → `/you`

### Level 2: Agent Tabs (Context-Specific)

**Purpose:** Navigate within a specific agent

**Location:** Horizontal tabs when viewing `/agents/$agentId`

**Tab Order (Left to Right by Frequency):**

```
┌───────────────────────────────────────────────────────────────────┐
│  Overview  │  Work  │  Activity  │  Chat  │  Configure            │
└───────────────────────────────────────────────────────────────────┘
```

**Rationale for ordering:**
- **Overview** — Primary entry point, agent summary
- **Work** — Common action: viewing/managing workstreams & rituals
- **Activity** — Frequently checked: logs and session history
- **Chat** — Quick access to conversation (or redirects to session)
- **Configure** — Rightmost = power user territory, discovered progressively

---

## Complete Feature Mapping

### Tab Consolidation: Before → After

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                              FEATURE PRESERVATION MAPPING                                                      ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                               ║
║  OLD TAB              │ NEW LOCATION                              │ HOW TO ACCESS                            ║
║  ─────────────────────┼───────────────────────────────────────────┼──────────────────────────────────────────║
║  Overview             │ Overview tab                              │ Direct (unchanged)                       ║
║  Soul                 │ Overview tab → Identity & Personality     │ Scroll down in Overview                  ║
║  Workstreams          │ Work tab → Workstreams section            │ Work tab, first section                  ║
║  Rituals              │ Work tab → Rituals section                │ Work tab, second section                 ║
║  Tools                │ Configure tab → Tools section             │ Configure tab, expanded section          ║
║  Behavior             │ Configure tab → Behavior section          │ Configure tab, first section             ║
║  Memory               │ Configure tab → Memory section            │ Configure tab, collapsed accordion       ║
║  Availability         │ Configure tab → Availability section      │ Configure tab, collapsed accordion       ║
║  Advanced             │ Configure tab → Advanced section          │ Configure tab, bottom accordion          ║
║  Activity             │ Activity tab                              │ Direct (unchanged)                       ║
║                                                                                                               ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### Complete Feature Inventory (52 features)

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                              COMPLETE FEATURE INVENTORY                                                        ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                               ║
║  ✓ = Preserved in new structure                                                                               ║
║  ★ = Enhanced in new structure                                                                                ║
║                                                                                                               ║
║  AGENT IDENTITY                          │  BEHAVIOR & MODEL                                                  ║
║  ────────────────────────────────────────┼────────────────────────────────────────────────────────────────   ║
║  ✓ Name                                  │  ✓ Creativity (temperature)                                       ║
║  ✓ Role                                  │  ✓ Response length (maxTokens)                                    ║
║  ✓ Description                           │  ✓ Streaming toggle                                               ║
║  ✓ Avatar                                │  ✓ Speed vs Depth                                                 ║
║  ✓ Status (online/paused/offline)        │  ✓ Model override                                                 ║
║  ★ Personality (was separate Soul tab)   │  ✓ Provider override                                              ║
║  ★ Custom instructions (merged into ID)  │  ✓ Raw parameters (top_p, top_k, etc.)                            ║
║                                          │                                                                   ║
║  TOOLS & PERMISSIONS                     │  MEMORY                                                           ║
║  ────────────────────────────────────────┼────────────────────────────────────────────────────────────────   ║
║  ✓ Toolset presets                       │  ✓ Memory enabled toggle                                          ║
║  ✓ Custom toolset creation               │  ✓ Memory depth                                                   ║
║  ✓ Per-tool toggles                      │  ✓ Cleanup mode (pruning)                                         ║
║  ✓ Per-tool permissions (R/W/X)          │  ✓ Memory lifespan                                                ║
║  ✓ Allow list                            │  ✓ Compaction toggle + threshold                                  ║
║  ✓ Deny list                             │  ✓ Memory search toggle + provider                                ║
║  ✓ Elevated mode settings                │                                                                   ║
║                                          │                                                                   ║
║  AVAILABILITY & SCHEDULING               │  ADVANCED / SYSTEM                                                ║
║  ────────────────────────────────────────┼────────────────────────────────────────────────────────────────   ║
║  ✓ Quiet hours picker                    │  ✓ Runtime selection (Pi / CCSDK)                                 ║
║  ✓ Auto-pause toggle                     │  ✓ CCSDK provider selection                                       ║
║  ✓ Time zone                             │  ✓ Sandbox toggle + scope                                         ║
║  ✓ Per-agent heartbeat schedule          │  ✓ Workspace access folders                                       ║
║  ✓ Heartbeat target                      │  ✓ Sub-agent model defaults                                       ║
║  ✓ Heartbeat prompt override             │  ✓ Sub-agent max concurrent                                       ║
║                                          │  ✓ Raw JSON configuration editor                                  ║
║                                          │  ✓ Validate / Apply / Reset / Export / Import                     ║
║                                          │                                                                   ║
║  WORK ITEMS                              │  ACTIVITY                                                         ║
║  ────────────────────────────────────────┼────────────────────────────────────────────────────────────────   ║
║  ✓ Workstream list                       │  ✓ Activity log with filters                                      ║
║  ✓ Workstream creation                   │  ✓ Activity detail panel                                          ║
║  ✓ Workstream DAG view                   │  ✓ Session history                                                ║
║  ✓ Ritual list                           │  ✓ Session resume                                                 ║
║  ✓ Ritual creation                       │  ✓ Export activity                                                ║
║  ✓ Ritual scheduling                     │                                                                   ║
║  ✓ Goals list                            │                                                                   ║
║  ✓ Goal progress tracking                │                                                                   ║
║                                          │                                                                   ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════════════   ║
║                                                                                                               ║
║  TOTAL FEATURES: 52                                                                                           ║
║  PRESERVED:      52 (100%)                                                                                    ║
║  REMOVED:         0 (0%)                                                                                      ║
║  ENHANCED:        2 (Personality merged into Overview, Custom instructions merged)                            ║
║                                                                                                               ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Detailed Tab Specifications

### Overview Tab

**Route:** `/agents/$agentId?tab=overview` (default)

**Purpose:** High-level agent summary and quick access to common actions

**Sections:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  OVERVIEW TAB LAYOUT                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Agent Header Card (from old Overview)                                       │
│  ├── Avatar, Name, Role, Status                                              │
│  ├── Primary actions: [Chat] [Edit] [⋮ More]                                 │
│  └── Meta: Created date, Last active, Task count                             │
│                                                                              │
│  Identity & Personality (from old Soul tab)                                  │
│  ├── Description                                                             │
│  ├── Personality traits                                                      │
│  ├── Communication style                                                     │
│  └── Custom instructions                                                     │
│                                                                              │
│  Configuration Summary Card (NEW)                                            │
│  ├── Progress bar: % using defaults vs customized                            │
│  ├── Category cards: Behavior, Tools, Memory, Availability                   │
│  ├── Each shows: [↑ Default] or [✎ Custom] badge                             │
│  └── Actions: [Reset all] [View full config →]                               │
│                                                                              │
│  Recent Conversations                                                        │
│  └── Last 3-5 chat sessions with quick resume                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Visibility by Tier:**
- **Casual:** Overview only (no Configure tab exists)
- **Engaged:** Full overview with Configuration Summary Card
- **Expert:** Same as Engaged, plus technical metadata in header

---

### Work Tab

**Route:** `/agents/$agentId?tab=work`

**Purpose:** Organize and manage agent's workstreams, rituals, and goals

**Sections:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WORK TAB LAYOUT                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Workstreams Section (from old Workstreams tab)                              │
│  ├── Header: Workstreams (3)                       [+ Create workstream]     │
│  ├── Workstream Cards                                                        │
│  │   ├── Q4 Research Project                                                 │
│  │   │   ├── Status: In Progress                                             │
│  │   │   ├── Tasks: 5 active, 12 completed                                   │
│  │   │   └── Last activity: 2 hours ago                                      │
│  │   └── ...                                                                 │
│  └── ▸ Workstream DAG View (Expert tier only)                                │
│                                                                              │
│  Rituals Section (from old Rituals tab)                                      │
│  ├── Header: Rituals (2)                            [+ Create ritual]        │
│  ├── Ritual Cards                                                            │
│  │   ├── Daily News Digest                                                   │
│  │   │   ├── Schedule: Every day at 8:00 AM                                  │
│  │   │   ├── Last run: Today, 8:02 AM                                        │
│  │   │   └── Status: ● Active                                                │
│  │   └── ...                                                                 │
│  └── Ritual Calendar View (optional)                                         │
│                                                                              │
│  Goals Section (Engaged+ tier)                                               │
│  ├── Header: Goals (4)                               [+ Add goal]            │
│  └── Goal Cards with progress indicators                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Visibility by Tier:**
- **Casual:** Hidden (no workstreams/rituals created yet)
- **Engaged:** Workstreams + Rituals
- **Expert:** Workstreams + Rituals + Goals + DAG view

---

### Activity Tab

**Route:** `/agents/$agentId?tab=activity`

**Purpose:** View activity logs and session history

**Sections:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ACTIVITY TAB LAYOUT                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Activity Log                                                                │
│  ├── Filter: [All ▼] [Today ▼]                            [Export]          │
│  ├── Activity Items (infinite scroll)                                        │
│  │   ├── 10:32 AM — Completed research on AI market trends                   │
│  │   ├── 10:15 AM — Tool call: web_search("AI market 2026")                  │
│  │   ├── 10:14 AM — Started task from workstream "Q4 Research"               │
│  │   └── ...                                                                 │
│  └── Activity Detail Panel (on click)                                        │
│                                                                              │
│  Session History                                                             │
│  ├── Session Cards                                                           │
│  │   ├── "AI Market Research" — 2 hours ago, 45 min                          │
│  │   ├── "Quarterly Report Draft" — Yesterday, 1.5 hours                     │
│  │   └── ...                                                                 │
│  └── [View all sessions →]                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Visibility by Tier:** Same for all tiers (core feature)

---

### Chat Tab

**Route:** `/agents/$agentId?tab=chat`

**Purpose:** Quick access to chat (may redirect to active session)

**Behavior:**
- If active session exists: redirect to `/agents/$agentId/session/$sessionKey`
- If no active session: show "Start new conversation" with recent prompts
- May be replaced by inline chat view in future iterations

**Visibility by Tier:** Same for all tiers (core feature)

---

### Configure Tab

**Route:** `/agents/$agentId?tab=configure`

**Purpose:** All agent-specific configuration settings

**Sections (Accordion-based):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONFIGURE TAB LAYOUT                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ▾ Behavior Section (expanded by default)                 [↑ Using defaults]│
│  │                                                                           │
│  │  [✓] Use system default for all behavior                                 │
│  │                                                                           │
│  │  Creativity (temperature)                                                 │
│  │  └── Slider: Precise ──────●────── Creative                               │
│  │                                                                           │
│  │  Response Length (maxTokens)                                              │
│  │  └── Chips: [Concise] [●Balanced] [Detailed]                             │
│  │                                                                           │
│  │  Streaming Replies                                                        │
│  │  └── Toggle: [ON]                                                         │
│  │                                                                           │
│  │  ▸ Advanced Behavior (collapsed)                        [Expert only]     │
│  │     ├── Speed vs Depth                                                    │
│  │     ├── Model Override                                                    │
│  │     ├── Provider Override                                                 │
│  │     └── Raw parameters (top_p, top_k, stop_sequences)                     │
│  │                                                                           │
│  ▾ Tools Section (expanded by default)                    [✎ Research Mode] │
│  │                                                                           │
│  │  Toolset Selector: [Research Mode ▼]                                      │
│  │  Quick Toggles: [ON] Web  [ON] Files  [ON] Docs  [OFF] Code               │
│  │                                                                           │
│  │  ▸ Advanced Tool Settings (collapsed)                   [Expert only]     │
│  │     ├── Per-tool permissions (R/W/X)                                      │
│  │     ├── Allow list                                                        │
│  │     ├── Deny list                                                         │
│  │     └── Elevated mode settings                                            │
│  │                                                                           │
│  ▸ Memory Section (collapsed by default)                  [↑ Using defaults]│
│  │                                                                           │
│  │  Memory Enabled: [ON]                                                     │
│  │  Memory Depth: [Short] [●Balanced] [Deep]                                 │
│  │                                                                           │
│  │  ▸ Advanced Memory (collapsed)                          [Expert only]     │
│  │     ├── Cleanup mode                                                      │
│  │     ├── Memory lifespan                                                   │
│  │     ├── Compaction toggle + threshold                                     │
│  │     └── Memory search provider                                            │
│  │                                                                           │
│  ▸ Availability Section (collapsed by default)            [◐ 1 customized]  │
│  │                                                                           │
│  │  Quiet Hours: [10:00 PM] ──────── [8:00 AM]                               │
│  │  Auto-pause: [✓]                                                          │
│  │  Time Zone: America/Los_Angeles (PST)                                     │
│  │                                                                           │
│  │  ▸ Advanced Availability (collapsed)                    [Expert only]     │
│  │     ├── Per-agent heartbeat schedule                                      │
│  │     ├── Heartbeat target                                                  │
│  │     └── Heartbeat prompt override                                         │
│  │                                                                           │
│  ▸ Advanced Section (collapsed, Expert tier only)         [↑ Using defaults]│
│  │                                                                           │
│  │  Runtime Override: ○ System ○ Pi ○ CCSDK                                  │
│  │  Sandbox: [ON] + Scope + Folders                                          │
│  │  Sub-agent Defaults                                                       │
│  │  Raw Configuration Editor                                                 │
│  │                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Visibility by Tier:**
- **Casual:** Hidden (all settings use defaults)
- **Engaged:** Behavior, Tools, Memory (basic), Availability (basic)
- **Expert:** All sections + Advanced subsections + Raw config

**Accordion Rules:**

| Section | Casual | Engaged | Expert |
|---------|--------|---------|--------|
| Visible | No | Yes | Yes |
| Behavior - default expanded | - | Yes | Yes |
| Behavior - has Advanced | - | No | Yes |
| Tools - default expanded | - | Yes | Yes |
| Tools - has Advanced | - | No | Yes |
| Memory - default expanded | - | No | No |
| Memory - has Advanced | - | No | Yes |
| Availability - default expanded | - | No | No |
| Availability - has Advanced | - | No | Yes |
| Advanced section visible | - | No | Yes |

---

## Navigation State Management

### URL Structure

```
/agents                           # Agent list
/agents/$agentId                  # Agent detail (defaults to ?tab=overview)
/agents/$agentId?tab=overview     # Overview
/agents/$agentId?tab=work         # Work items
/agents/$agentId?tab=activity     # Activity log
/agents/$agentId?tab=chat         # Chat (may redirect)
/agents/$agentId?tab=configure    # Configuration
/agents/$agentId?tab=configure&section=behavior       # Deep link to section
/agents/$agentId/session/$sessionKey                  # Active chat session
```

### Tab Visibility Logic

```typescript
// Pseudo-code for tab visibility
function getVisibleTabs(agent: Agent, tier: PersonaTier): Tab[] {
  const baseTabs = [
    { id: 'overview', label: 'Overview', alwaysVisible: true },
    { id: 'activity', label: 'Activity', alwaysVisible: true },
    { id: 'chat', label: 'Chat', alwaysVisible: true },
  ];

  const conditionalTabs = [
    {
      id: 'work',
      label: 'Work',
      visible: tier !== 'casual' || (agent.workstreams.length > 0 || agent.rituals.length > 0)
    },
    {
      id: 'configure',
      label: 'Configure',
      visible: tier !== 'casual'
    },
  ];

  return [...baseTabs, ...conditionalTabs.filter(t => t.visible)];
}
```

---

## Responsive Design

### Desktop (≥1024px)

```
┌────────────────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌────────────────────────────────────────────────────┐ │
│  │ SIDEBAR  │  │                MAIN CONTENT                        │ │
│  │          │  │                                                    │ │
│  │ Agents   │  │  ┌────────────────────────────────────────────┐   │ │
│  │ Work...  │  │  │  Agent Header                             │   │ │
│  │ Rituals  │  │  └────────────────────────────────────────────┘   │ │
│  │ Memories │  │                                                    │ │
│  │ Goals    │  │  ┌────────────────────────────────────────────┐   │ │
│  │          │  │  │ Overview│Work│Activity│Chat│Configure     │   │ │
│  │          │  │  └────────────────────────────────────────────┘   │ │
│  │ ──────── │  │                                                    │ │
│  │ Status   │  │  ┌────────────────────────────────────────────┐   │ │
│  │ Settings │  │  │                                            │   │ │
│  │ Account  │  │  │           Tab Content                      │   │ │
│  │          │  │  │                                            │   │ │
│  └──────────┘  │  └────────────────────────────────────────────┘   │ │
│                └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Tablet (768px - 1023px)

- Sidebar collapses to icon-only or hamburger menu
- Tabs remain horizontal but may wrap
- Two-column layouts become single-column

### Mobile (<768px)

```
┌──────────────────────────┐
│  ☰  Agent Name        ⚙️  │  ← Hamburger + quick settings
├──────────────────────────┤
│  Agent Header (compact)  │
├──────────────────────────┤
│ ┌──────────────────────┐ │  ← Horizontal scrollable tabs
│ │ Over│Work│Act│Chat│Cfg│ │
│ └──────────────────────┘ │
├──────────────────────────┤
│                          │
│  [Stacked tab content]   │
│                          │
└──────────────────────────┘
```

**Mobile Sidebar (Drawer):**
```
┌──────────────────────────┐
│  📋 Agents               │
│  📊 Workstreams          │
│  🔄 Rituals              │
│  🧠 Memories             │
│  🎯 Goals                │
│  ────────────────────────│
│  ● Gateway connected     │
│  ● 2 providers active    │
│  ⚙️ Settings              │
│  👤 Account              │
│     [Logout]             │
└──────────────────────────┘
```

---

## Sidebar vs Configure Tab Distinction

A critical distinction that users must understand:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    SIDEBAR SETTINGS vs CONFIGURE TAB                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  SIDEBAR ⚙️ Settings (System-wide)      │  CONFIGURE TAB (Per-agent)         ║
║  ────────────────────────────────────────┼─────────────────────────────────  ║
║                                          │                                   ║
║  URL: /settings                          │  URL: /agents/$agentId?tab=config ║
║                                          │                                   ║
║  Purpose: Default settings for ALL       │  Purpose: Override defaults for   ║
║           agents                         │           THIS agent              ║
║                                          │                                   ║
║  Contains:                               │  Contains:                        ║
║  • Model & Provider defaults             │  • Behavior overrides             ║
║  • Global toolset presets                │  • Toolset selection              ║
║  • Channel configuration                 │  • Memory settings                ║
║  • Gateway settings                      │  • Availability                   ║
║  • System Brain                          │  • Advanced (runtime, sandbox)    ║
║  • Heartbeat                             │                                   ║
║  • Health dashboard                      │                                   ║
║                                          │                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Implementation Checklist

### Phase 1: Core Navigation Structure

- [ ] Create consolidated tab component
- [ ] Implement tab visibility by tier
- [ ] Add URL-based tab selection
- [ ] Update routing for new tab structure

### Phase 2: Tab Content Migration

- [ ] Migrate Soul content into Overview
- [ ] Create Configuration Summary Card
- [ ] Consolidate Configure tab with accordions
- [ ] Merge Workstreams + Rituals into Work tab

### Phase 3: Responsive Layouts

- [ ] Desktop layout (sidebar + tabs)
- [ ] Tablet layout (collapsible sidebar)
- [ ] Mobile layout (drawer + scrollable tabs)

### Phase 4: Tier-Based Visibility

- [ ] Implement tier-aware tab visibility
- [ ] Implement accordion visibility rules
- [ ] Add "Unlock features" prompts for Casual tier

### Phase 5: Polish

- [ ] Add transitions between tabs
- [ ] Implement keyboard shortcuts
- [ ] Add loading states
- [ ] Test accessibility

---

## Related Documents

- `20-INHERITANCE-CLARITY-BADGES.md` — Badge system for defaults vs customizations
- `21-PERSONA-PROGRESSION-SYSTEM.md` — Tier system controlling visibility
- `22-HIGH-IMPACT-UX-PATTERNS.md` — Consolidated tabs as high-impact pattern
- `03-DESIGN-PRINCIPLES.md` — Progressive disclosure principles
- `06-INFORMATION-ARCHITECTURE.md` — Overall IA
- `08-AGENT-CONFIGURATION-DESIGN.md` — Original agent config design
