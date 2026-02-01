# OpenClaw Control UI - UX Specification

## Overview

This document captures the **high-level user experience goals** for the OpenClaw Control UI redesign. The intent is to guide a complete rewrite using React, Tailwind CSS, Shadcn/ui, and Radix primitives.

**Key principle:** This spec describes *what users need to accomplish* and *how information should be organized*, not how the current UI implements it.

---

## Design Philosophy

### Core Principles

1. **Information density over decoration** - Users are technical; show relevant data without excessive whitespace or ornamental UI
2. **Progressive disclosure** - Show essential information first; advanced options available but not prominent
3. **Real-time feedback** - Connection status, operation progress, and errors should be immediately visible
4. **Keyboard-first** - Power users should be able to navigate without a mouse
5. **Dark-mode primary** - Dark theme is the default; light theme available

### Visual Language

- **Typography**: Clean sans-serif for UI, monospace for code/logs/technical values
- **Color**: Restrained palette with semantic colors (success/warning/error/info)
- **Spacing**: Consistent scale (4px base unit)
- **Borders**: Subtle, used to separate regions not decorate
- **Animation**: Minimal, purposeful (loading states, transitions)

---

## Information Architecture

### Primary Navigation Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  Gateway Status Indicator    [Theme] [Settings]     │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Navigation  │              Main Content Area               │
│              │                                              │
│  ○ Chat      │                                              │
│              │                                              │
│  CONTROL     │                                              │
│  ○ Overview  │                                              │
│  ○ Channels  │                                              │
│  ○ Sessions  │                                              │
│  ○ Cron      │                                              │
│              │                                              │
│  AGENT       │                                              │
│  ○ Skills    │                                              │
│  ○ Nodes     │                                              │
│              │                                              │
│  SYSTEM      │                                              │
│  ○ Config    │                                              │
│  ○ Logs      │                                              │
│  ○ Debug     │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### View Groups

| Group | Purpose | Views |
|-------|---------|-------|
| **Chat** | Direct agent interaction | Chat |
| **Control** | Gateway and channel management | Overview, Channels, Sessions, Cron |
| **Agent** | Agent capabilities | Skills, Nodes |
| **System** | Configuration and debugging | Config, Logs, Debug |

---

## View Specifications

### 1. Chat View

**Purpose:** Direct conversation with the agent for quick interventions and testing.

**User Goals:**
- Send messages to the agent
- View conversation history
- See real-time streaming responses
- Inspect tool calls and their outputs
- Attach files/images

**Layout:**
```
┌────────────────────────────────┬─────────────────────┐
│                                │                     │
│     Conversation Thread        │   Tool Inspector    │
│                                │   (collapsible)     │
│     [Messages...]              │                     │
│                                │   - Tool name       │
│                                │   - Input/Output    │
│                                │   - Execution time  │
│                                │                     │
├────────────────────────────────┴─────────────────────┤
│  [Attachments] [Input field...              ] [Send] │
└──────────────────────────────────────────────────────┘
```

**Key Interactions:**
- Message input with markdown support
- Drag-and-drop file attachments
- Abort in-progress responses
- Click tool calls to inspect details in sidebar
- Session selector (optional header)

**States:**
- Empty (no messages)
- Loading history
- Ready
- Sending/Streaming
- Error

---

### 2. Overview View

**Purpose:** Gateway health dashboard and connection management.

**User Goals:**
- See if gateway is connected and healthy
- View key metrics (uptime, sessions, next cron)
- Configure gateway URL and authentication
- Quick-access to common actions

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Connection Status Card                             │
│  ┌─────────────────────────────────────────────────┐│
│  │ ● Connected to gateway.local:18789              ││
│  │   Uptime: 2d 4h 12m | Sessions: 3 active        ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ Gateway URL      │  │ Authentication           │ │
│  │ [ws://...]       │  │ Token: [••••••••]        │ │
│  │                  │  │ [Connect]                │ │
│  └──────────────────┘  └──────────────────────────┘ │
│                                                     │
│  Quick Stats                                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │Sessions│ │Channels│ │  Cron  │ │ Skills │       │
│  │   3    │ │  5/7   │ │ 2m ago │ │ 12 on  │       │
│  └────────┘ └────────┘ └────────┘ └────────┘       │
└─────────────────────────────────────────────────────┘
```

**States:**
- Disconnected (show connection form)
- Connecting
- Connected (show dashboard)
- Error (show error + retry)

---

### 3. Channels View

**Purpose:** Configure and monitor messaging channel connections.

**User Goals:**
- See status of all channels at a glance
- Enable/disable channels
- Configure channel-specific settings
- Complete channel setup flows (QR codes, tokens, etc.)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Channels                               [Refresh]   │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ WhatsApp     ● Connected    [Configure] [•••]  ││
│  │ +1234567890                                     ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │ Telegram     ● Connected    [Configure] [•••]  ││
│  │ @mybotname                                      ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │ Discord      ○ Disconnected [Setup]    [•••]   ││
│  │ Not configured                                  ││
│  └─────────────────────────────────────────────────┘│
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

**Channel-Specific Flows:**
- **WhatsApp**: QR code scanning, logout
- **Telegram**: Bot token entry
- **Discord**: Bot token entry, server selection
- **Slack**: OAuth flow or token entry
- **Signal**: Device linking
- **iMessage**: Enable/disable, requires macOS
- **Nostr**: Key management, relay config

**States per channel:**
- Not configured
- Configuring (setup in progress)
- Connected
- Disconnected (was configured, now offline)
- Error

---

### 4. Sessions View

**Purpose:** Inspect and manage active agent sessions.

**User Goals:**
- See all active sessions
- View session metadata (agent, channel, start time)
- Adjust per-session settings
- End sessions

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Sessions                    [Filter] [Refresh]     │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ Session abc123                                  ││
│  │ Agent: default | Channel: WhatsApp | 2h ago    ││
│  │ Messages: 24 | Last: "What's the weather?"     ││
│  │                                   [View] [End] ││
│  └─────────────────────────────────────────────────┘│
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

---

### 5. Cron View

**Purpose:** Schedule recurring agent tasks.

**User Goals:**
- Create/edit/delete scheduled jobs
- See next run times
- View run history
- Enable/disable jobs

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Scheduled Jobs                         [+ New Job] │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ Daily Summary           ● Enabled               ││
│  │ "Send me a daily summary of..."                 ││
│  │ Every day at 9:00 AM | Next: in 4 hours        ││
│  │                              [Edit] [History]  ││
│  └─────────────────────────────────────────────────┘│
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

**Job Form Fields:**
- Name
- Prompt/message
- Schedule (cron expression or human-readable)
- Target channel/session
- Enabled toggle

---

### 6. Skills View

**Purpose:** Manage agent capabilities and API integrations.

**User Goals:**
- See available skills
- Enable/disable skills
- Configure API keys for skills that need them
- View skill status (working/broken)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Skills                           [Filter: ______]  │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ Web Search           ● Enabled    ✓ Working    ││
│  │ Search the web using Tavily API                 ││
│  │ API Key: [••••••••••••••]         [Test]       ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │ Code Execution       ○ Disabled                 ││
│  │ Execute code in sandboxed environment           ││
│  │                                    [Enable]     ││
│  └─────────────────────────────────────────────────┘│
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

---

### 7. Nodes View

**Purpose:** Manage paired devices and their capabilities.

**User Goals:**
- See connected nodes/devices
- View device capabilities
- Pair/unpair devices
- Configure what commands each node can execute

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Paired Devices                        [+ Pair New] │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ MacBook Pro (local)    ● Online                 ││
│  │ Last seen: just now                             ││
│  │ Capabilities: shell, filesystem, browser        ││
│  │                           [Configure] [Unpair] ││
│  └─────────────────────────────────────────────────┘│
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

---

### 8. Config View

**Purpose:** Edit gateway configuration.

**User Goals:**
- View current configuration
- Edit settings via form or raw JSON
- Validate before saving
- Apply changes (may require restart)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Configuration              [Form | Raw]   [Save]   │
│                                                     │
│  ┌───────────────┬─────────────────────────────────┐│
│  │ Sections      │                                 ││
│  │               │  Model Settings                 ││
│  │ ○ Model       │  ┌─────────────────────────────┐││
│  │ ○ Gateway     │  │ Provider: [Anthropic    ▼] │││
│  │ ○ Channels    │  │ Model:    [claude-3-opus ▼] │││
│  │ ○ Security    │  │ API Key:  [••••••••••••••]  │││
│  │ ○ Advanced    │  └─────────────────────────────┘││
│  │               │                                 ││
│  └───────────────┴─────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Modes:**
- Form mode: Structured editing with validation
- Raw mode: JSON editor with syntax highlighting

---

### 9. Logs View

**Purpose:** View gateway logs for debugging.

**User Goals:**
- See recent log entries
- Filter by level (debug/info/warn/error)
- Search log content
- Auto-follow new entries
- Export logs

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Logs  [Debug][Info][Warn][Error]  [Search: ____]   │
│                                    [Auto-follow ✓]  │
│  ┌─────────────────────────────────────────────────┐│
│  │ 14:23:01 INFO  Gateway started on :18789        ││
│  │ 14:23:02 INFO  WhatsApp connected               ││
│  │ 14:23:15 DEBUG Message received from +1234...   ││
│  │ 14:23:16 WARN  Rate limit approaching           ││
│  │ 14:24:01 ERROR Connection lost to Telegram      ││
│  │ ...                                             ││
│  └─────────────────────────────────────────────────┘│
│                                          [Export]   │
└─────────────────────────────────────────────────────┘
```

---

### 10. Debug View

**Purpose:** Advanced debugging and manual RPC calls.

**User Goals:**
- View internal gateway state
- Make manual RPC calls
- See health metrics
- View event stream

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Debug Tools                                        │
│                                                     │
│  Gateway Health                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ Status: healthy | Memory: 128MB | CPU: 2%      ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  Manual RPC                                         │
│  ┌─────────────────────────────────────────────────┐│
│  │ Method: [________________]                      ││
│  │ Params: [                                      ]││
│  │         [                                      ]││
│  │                                       [Execute]││
│  │ Result: {...}                                   ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  Event Stream                          [Clear]      │
│  ┌─────────────────────────────────────────────────┐│
│  │ 14:23:01 presence.update {...}                  ││
│  │ 14:23:02 channel.connected {...}                ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

---

## Responsive Behavior

### Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Desktop | > 1100px | Sidebar + content |
| Tablet | 600-1100px | Collapsible sidebar or top nav |
| Mobile | < 600px | Bottom nav or hamburger menu |

### Mobile Considerations

- Navigation becomes bottom tab bar or hamburger
- Cards stack vertically
- Chat input stays at bottom
- Tool inspector becomes full-screen overlay
- Tables become cards or lists

---

## Component Patterns

### Common Components Needed

1. **Card** - Container with title, optional subtitle, content area
2. **StatusBadge** - Colored indicator (connected/disconnected/error)
3. **DataTable** - Sortable, filterable table
4. **Form** - Input groups with validation
5. **Modal/Dialog** - For confirmations, forms, detail views
6. **Toast** - Transient notifications
7. **Tabs** - Content switching within a view
8. **Dropdown** - Select menus, action menus
9. **Switch/Toggle** - Boolean settings
10. **Input** - Text, password, textarea, with validation states
11. **Button** - Primary, secondary, destructive, ghost variants
12. **Skeleton** - Loading placeholders
13. **EmptyState** - When no data exists

### Shadcn/ui Components to Use

From shadcn/ui, leverage:
- `Button`, `Input`, `Textarea`, `Select`
- `Card`, `Dialog`, `Sheet` (for mobile sidebars)
- `Tabs`, `Table`
- `Toast` (via Sonner)
- `Form` (with React Hook Form + Zod)
- `Switch`, `Checkbox`
- `Badge`, `Avatar`
- `Command` (for search/command palette)
- `Skeleton`

---

## State Management Approach

### Recommended Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React App                        │
│  ┌─────────────────────────────────────────────────┐│
│  │              React Query / TanStack Query       ││
│  │              (server state: API data)           ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │              Zustand or Context                 ││
│  │              (client state: UI, theme, etc.)    ││
│  └─────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────┐│
│  │              WebSocket Hook                     ││
│  │              (real-time updates)                ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### State Categories

1. **Server state** (React Query): Channels, sessions, config, logs, etc.
2. **Client state** (Zustand/Context): Theme, sidebar collapsed, active tab
3. **Form state** (React Hook Form): Input values, validation
4. **Real-time state** (WebSocket): Streaming responses, presence, health

---

## Routing

Use React Router or TanStack Router with hash-based routing for compatibility:

```
/              → Chat (default)
/overview      → Overview
/channels      → Channels
/channels/:id  → Channel detail/config
/sessions      → Sessions
/sessions/:id  → Session detail
/cron          → Cron jobs
/cron/new      → New cron job form
/cron/:id      → Edit cron job
/skills        → Skills
/nodes         → Nodes
/config        → Config
/logs          → Logs
/debug         → Debug
```

---

## Accessibility Requirements

1. **Keyboard navigation**: All interactive elements focusable and operable
2. **Screen reader**: Proper ARIA labels, roles, and live regions
3. **Color contrast**: WCAG AA minimum (4.5:1 for text)
4. **Focus indicators**: Visible focus rings
5. **Reduced motion**: Respect `prefers-reduced-motion`
6. **Error messages**: Associated with inputs, announced

---

## Performance Considerations

1. **Code splitting**: Lazy load views
2. **Virtual scrolling**: For logs and long lists
3. **Debounced inputs**: For search/filter
4. **Optimistic updates**: For quick feedback
5. **WebSocket reconnection**: With exponential backoff
6. **Skeleton loading**: Instead of spinners where possible

---

## Migration Notes

### What to Preserve from Current UI

1. **Design tokens**: Colors, spacing, typography scale are reasonable
2. **Information architecture**: 4 groups, 10+ views structure works
3. **WebSocket protocol**: Gateway communication stays the same
4. **Hash-based routing**: For compatibility

### What to Discard

1. **Lit/Web Components**: Replace with React
2. **Monolithic state**: Replace with proper state management
3. **Inline styles**: Replace with Tailwind utilities
4. **Manual CSS**: Replace with Shadcn components
5. **Props drilling**: Replace with context/stores
6. **Complex type casting**: Proper TypeScript from the start

---

## Next Steps

1. **Set up React + Vite + TypeScript project**
2. **Configure Tailwind + Shadcn/ui**
3. **Implement layout shell** (navigation, routing)
4. **Build common components** (Card, StatusBadge, etc.)
5. **Implement WebSocket hook** (reuse protocol from current UI)
6. **Build views one by one**, starting with Overview and Chat
7. **Add theme support** (dark/light)
8. **Test responsive behavior**
9. **Integrate with gateway** (may run alongside old UI initially)
