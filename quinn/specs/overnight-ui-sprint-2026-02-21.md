# Overnight UI Sprint — 2026-02-21
**Author:** Luis (Principal UX Engineer)  
**Repo:** dgarson/clawdbot  
**Branch base:** luis/ui-redesign  
**App path:** /Users/openclaw/openclaw-ui-redesign/apps/web/  
**Stack:** Vite 7.3 + React 19 + TanStack Router + Radix/Shadcn + TanStack Query + Framer Motion

**Build command:** `cd /Users/openclaw/openclaw-ui-redesign/apps/web && pnpm build`  
**All commits:** use `git commit --no-verify` (pre-commit hook has a known lint issue unrelated to our work)

---

## Task 1: Interactive Onboarding Wizard (live RPC)

### Goal
Replace the current onboarding wizard (which renders but doesn't connect to gateway) with a fully live, RPC-connected onboarding flow. This is the #1 activation lever — the difference between "I set up OpenClaw and it felt real" vs. "I filled out a form."

### What to build
File: `src/routes/onboarding/index.tsx` (update) and `src/components/domain/onboarding/OnboardingWizard.tsx` (update)

5-step wizard, each step makes real gateway calls:
1. **Welcome** — check `gateway.status` (show live uptime). "Your gateway is running!" vs. "Connect your gateway first."
2. **Identity** — call `config.get`, prefill name/timezone from existing config. Call `config.set` on save.
3. **Channels** — call `channels.status` to show which channels are connected. Mark each (Slack ✓, Discord ✗, etc.). "Connect Slack" button links to settings.
4. **First Agent** — show existing agents from `agents.list`. If none, offer to create one. On create: call `config.set` to write agent entry.
5. **First Chat** — render a live `QuickChatBox` hooked to the first available agent. User sends a message, sees a real response. Wizard ends "You're live."

### Component list
- `OnboardingWizard` (refactor) — wire each step to gateway
- `GatewayStatusStep` — live status check with animated pulse
- `ChannelStatusStep` — channel grid with live `channels.status` data
- `FirstAgentStep` — agent picker + inline create form
- `FirstChatStep` — embedded live chat component

### Gateway calls
- `gateway.status` → Step 1
- `config.get` / `config.set` → Steps 2, 4
- `channels.status` → Step 3
- `agents.list` → Step 4
- Standard message send → Step 5

### Key UX notes
- Each step shows a loading state while RPC is in-flight
- If gateway is not connected, show a clear "start here" path (run `openclaw gateway start`)
- Progress is persisted in localStorage so users can resume

---

## Task 2: ⌘K Command Palette Expansion (NL intent + full action vocab)

### Goal
Extend the existing `CommandPalette` component at `src/components/composed/CommandPalette.tsx` with Phase 2 capabilities: full action vocabulary and basic natural language intent parsing.

### What to build
The existing palette handles navigation and theme/mode toggles. Extend it with:

**New action groups:**
- **Agents** — "Create agent", "View agent graph", "Pause all agents", quick-launch per agent
- **Sessions** — "New session with [agent]", "View recent sessions", "Kill all stalled sessions"
- **Skills** — "Install skill [name]", "List installed skills"
- **Gateway** — "Check gateway status", "View logs", "View analytics", "Restart gateway"
- **Cron** — "Run heartbeat now", "View cron jobs", "Add cron job"
- **Navigation** — All 29 routes accessible by name

**NL intent parsing (Phase 2):**
- Input that doesn't match known commands gets parsed for intent
- "create agent that monitors GitHub" → open `/agents/new` with `github monitor` pre-seeded in the chat input
- "show me today's cost" → navigate to `/analytics#cost`
- "why is [agent] stalled?" → navigate to `/agent-status` filtered to that agent
- Pattern matching (no LLM call — rules-based, same approach as chat builder)

**Keyboard shortcuts:**
- `⌘K` or `Ctrl+K` opens palette (already wired)
- Arrow keys navigate, Enter selects (verify working)
- `>` prefix for actions (vs. pure search)
- Tab to cycle through result groups

### Files to update
- `src/components/composed/CommandPalette.tsx` — add action groups + NL parser
- `src/providers/ShortcutsProvider.tsx` — verify all shortcuts registered
- New: `src/lib/palette-intent.ts` — NL intent matching logic

---

## Task 3: Agent Builder Visual Config Editor

### Goal
A drag-and-drop visual interface for configuring agent personas, capabilities, memory settings, and channel bindings. Must produce valid config that writes to gateway via `config.set`.

### What to build
New route: `src/routes/agents/$agentId/configure.tsx` (or enhance the existing `$agentId` tabs)

Tab: "Configure" — a visual editor with live preview panel (JSON/YAML on the right).

**Sections:**
1. **Identity** — name, role, emoji/avatar picker, description textarea
2. **Model** — model selector card grid (with cost/speed indicators), thinking level slider (off/low/medium/high), temperature slider
3. **Memory** — toggle: use workspace files / vector memory / episodic memory. File checklist: which workspace files load into context (SOUL.md, AGENTS.md, etc.)
4. **Capabilities** — checkbox grid: tools the agent can use. Grouped by category (filesystem, browser, messaging, code, etc.)
5. **Channel Bindings** — which channels this agent listens on. Toggle per channel.
6. **Persona** — SOUL.md editor (Monaco if available, textarea fallback). Preview renders the markdown.

**Config output:**
Each edit triggers a debounced `config.set` call that writes to the live gateway config. Show save indicator ("Saved ✓" or "Saving…").

Also support export as YAML for manual editing.

### Files to create/update
- `src/routes/agents/$agentId/configure.tsx` (new tab or route)
- `src/components/domain/agents/AgentVisualConfigurator.tsx`
- `src/components/domain/agents/ModelPicker.tsx` (reuse/extend from existing)
- `src/components/domain/agents/ToolCapabilitiesGrid.tsx`
- `src/lib/api/agent-config.ts` — config read/write helpers

---

## Task 4: Skill Marketplace Browser

### Goal
Browse, search, and one-click install skills from the ClawhHub skill directory. Show skill metadata: author, description, version, tags, ratings. Hook into `openclaw skill install` CLI via exec tool.

### What to build
Update/replace `src/routes/skills/index.tsx` with a full marketplace experience.

**Layout:**
- Left: category/tag filter sidebar
- Center: skill cards grid (Browse tab) or list (Installed tab)  
- Right: skill detail slide-in panel on selection

**Tabs:**
1. **Installed** — skills currently installed (`ls ~/openclaw/skills/` + `~/.openclaw/skills/`)
2. **Browse** — fetch from `https://clawhub.com` skill directory (or a static registry if no API)
3. **Updates** — skills with newer versions available

**Skill card shows:** name, author, description (2 lines), version, tags, install count, star rating (if available)

**Detail panel shows:** full description, README preview, changelog, compatible OpenClaw versions, install button

**Install flow:**
- Button: "Install" → spawns `exec` with `openclaw skill install [name]`
- Shows progress: installing... → ✓ Installed
- Uninstall: `openclaw skill remove [name]`

**Search:** Real-time filter across installed skills; search query passed to ClawhHub API for browse

### Files to update/create
- `src/routes/skills/index.tsx` (major rewrite)
- `src/components/domain/skills/SkillMarketplaceCard.tsx`
- `src/components/domain/skills/SkillDetailPanel.tsx`
- `src/hooks/queries/useSkills.ts` (fetch installed + browse list)
- `src/lib/api/skills.ts` — install/remove via exec + skill list from filesystem

---

## Task 5: Memory Browser

### Goal
Visual exploration of per-agent memory. Show memory entries with timestamps, relevance scores, and content previews. Allow manual delete and tag operations. Essential for debugging "why does my agent think X?"

### What to build
New route: `src/routes/memories/browser/index.tsx` (or enhance existing `/memories` route with agent-scoped memory view)

**Layout:**
- Top: agent selector + search bar
- Left: memory type tabs (Workspace Files / Daily Logs / Vector Entries / Episodic)
- Center: memory entry list with relevance scores
- Right: entry detail panel (full content, metadata, actions)

**Memory types to surface:**
1. **Workspace Files** — list all files in agent workspace, show last-modified, file size, preview first 500 chars. Open in Monaco editor for editing.
2. **Daily Logs** — `memory/YYYY-MM-DD.md` files, chronological list, searchable content
3. **Vector Entries** — if vector memory is available, show indexed chunks with embedding metadata
4. **Long-term MEMORY.md** — dedicated editor view

**Operations per entry:**
- View full content
- Edit in-place (for workspace files)
- Delete (with confirmation)
- Tag / annotate
- "Force into context" (copy content to clipboard for manual injection)

**Gateway calls:**
- `agents.files.list` → list workspace files
- `agents.files.get` → read file content
- `agents.files.set` → save edits
- Delete: `agents.files.delete` (or equivalent)
- Memory search: `memory.search(agentId, query)` if available

### Files to create
- `src/routes/memories/browser/index.tsx` (new)
- `src/components/domain/memories/MemoryBrowser.tsx`
- `src/components/domain/memories/WorkspaceFileList.tsx`
- `src/components/domain/memories/MemoryEntryDetail.tsx`

---

## Task 6: Smart Notification Center

### Goal
Unified, triage-able alert panel for the entire system. Group alerts by severity and agent. Mark as read, dismiss, investigate. Desktop notification bridge via browser Notifications API.

### What to build
New component: `src/components/composed/NotificationCenter.tsx`
New route: `src/routes/notifications/index.tsx` (full-page view)
Panel: accessible via bell icon in top nav header

**Alert types:**
- Cost alert (>75% / >100% daily budget)
- Session stalled (no activity >30min)
- Tool error surge (>20% error rate in 5min)
- Cron job failed
- Node unreachable
- Agent errored (health changed to 'errored')
- Model fallback triggered
- Session compacted

**UI features:**
- Bell icon with unread count badge in top nav
- Slide-in panel on bell click (not a full page)
- Full-page route `/notifications` for triage queue
- Group by: severity / agent / time
- Actions per alert: "Investigate" (deep-link to relevant section), "Dismiss", "Mark all read"
- Filter: All / Unread / High severity only
- Desktop notification request on first visit (browser Notifications API)

**Storage:** Alerts stored in Zustand store (in-memory); persisted to localStorage with 24h TTL

**Data sources:**
- WebSocket event stream filtered for alert-worthy events
- Polling-based anomaly detection for cost/error patterns

### Files to create
- `src/components/composed/NotificationCenter.tsx` — slide-in panel
- `src/routes/notifications/index.tsx` — full page triage
- `src/stores/useNotificationStore.ts` — Zustand store for alert state
- `src/lib/notifications/alert-detector.ts` — anomaly detection logic
- Update: `src/components/layout/Sidebar.tsx` or top nav — add bell icon

---

## Task 7: Rich Multi-Channel Message Composer

### Goal
A single, polished composer UI that can send messages to any connected channel from the web UI. Channel selector, media attachment, markdown preview, and scheduled send.

### What to build
New component: `src/components/composed/MessageComposer.tsx`
Available from: Quick Chat on home page (enhanced), new "Compose" button in nav, and as a modal accessible via ⌘⇧M shortcut.

**Features:**
- **Channel selector** — dropdown of connected channels (Slack workspaces, Discord servers, Telegram bots, etc.) with channel/recipient selector per platform
- **Agent selector** — which agent sends this (or "as me" if not agent-sourced)
- **Composer textarea** — Markdown with live preview toggle (split view: editor left / rendered right)
- **Toolbar** — Bold, italic, code, code block, link, image attachment
- **Media attach** — drag-and-drop or click-to-attach images/files (where channel supports it)
- **Scheduled send** — datetime picker: "Send now" or "Send at [time]" (via cron job)
- **Send history** — last 10 sent messages with delivery status

**Gateway calls:**
- `channels.list` → populate channel selector
- `message.send(channel, target, text, attachments)` → send message
- `cron.add` → scheduled send (create one-shot cron job)

### Files to create
- `src/components/composed/MessageComposer.tsx`
- `src/components/composed/MessageComposerModal.tsx` — modal wrapper
- `src/hooks/mutations/useMessageSend.ts`
- `src/hooks/queries/useChannelList.ts`
- Update: `src/components/layout/` — add Compose button to header
- Update: `src/routes/index.tsx` — enhance QuickChatBox to use composer

---

## Task 8: Node Device Dashboard

### Goal
Show all paired node devices: connectivity status, battery level, capabilities, last-seen. Allow one-click camera snap and screen record from the web UI.

### What to build
Overhaul `src/routes/nodes/index.tsx` — the existing route exists but likely has minimal real functionality.

**Node card shows:**
- Device name + platform (macOS, iOS, Android, Linux, Pi)
- Connectivity status: Online (green) / Offline (red) / Sleeping (amber)
- Last seen: relative timestamp ("2 min ago")
- Battery level: if available (iOS/Android)
- Capabilities chips: camera / screen / location / microphone
- IP address / network (in power user mode)

**Actions per node:**
- 📷 Camera Snap — calls `nodes.camera_snap(deviceId)` → shows photo in modal
- 🖥 Screen Record — calls `nodes.screen_record(deviceId)` → download video
- 📍 Get Location — calls `nodes.location_get(deviceId)` → show on map or lat/lon
- 🔔 Send Notification — notification text input → `nodes.notify(deviceId, text)`
- 🔌 Disconnect — remove node pairing

**Pairing flow:**
- "Add Node" button → shows pairing QR code (from `nodes.pending`) with approve/reject
- Auto-refresh pending list every 5s while pairing modal is open

**Layout:**
- Grid of node cards (responsive: 1-col mobile, 2-col tablet, 3-col desktop)
- "Add Node" button in header
- Pending approvals banner at top if any

### Files to update
- `src/routes/nodes/index.tsx` (major enhancement)
- `src/components/domain/nodes/NodeCard.tsx` (new or enhance)
- `src/components/domain/nodes/NodePairingModal.tsx` (new)
- `src/components/domain/nodes/CameraSnapModal.tsx` (new)
- `src/hooks/queries/useNodes.ts` (new or enhance)

---

## Task 9: Session Timeline View

### Goal
A visual, scrub-able timeline for a single session. Shows tool calls as duration bars, thinking blocks, sub-agent spawns, and cost accumulation. The "flight recorder" for understanding what an agent actually did.

### What to build
New view accessible from: Session Inspector in `/analytics`, agent detail page, and `/sessions/$sessionKey` route.

**Route:** `src/routes/sessions/$sessionKey.tsx` (new) — or as a modal/panel on session click

**Timeline layout:**
- X-axis: time (absolute or relative from session start)
- Y-axis: lanes
  - Lane 1: Message turns (user/assistant alternating, with token count)
  - Lane 2: Tool calls (colored bars by tool type, width = duration)
  - Lane 3: Thinking blocks (gray shaded regions)
  - Lane 4: Sub-agent spawns (fork icons with child session links)
  - Lane 5: Cost accumulation (area chart)

**Interactions:**
- Hover over any element → tooltip with details (tool name, input/output preview, duration, cost)
- Click tool call bar → expand detail card showing full tool input/output
- Click sub-agent spawn → navigate to child session timeline
- Zoom in/out on time axis (mouse wheel or pinch)
- Filter toggle: show/hide tool calls / thinking / spawns

**Data source:**
- Parse session JSONL transcript client-side (read via `agents.files.get` or sessions API)
- Structure: extract tool_use blocks, thinking blocks, spawn events

**Component approach:**
Use CSS transforms + absolute positioning for the timeline (not a charting library). Each element is positioned by timestamp offset.

### Files to create
- `src/routes/sessions/$sessionKey/index.tsx` (new route)
- `src/components/domain/sessions/SessionTimeline.tsx` — core timeline component
- `src/components/domain/sessions/TimelineLane.tsx` — lane renderer
- `src/components/domain/sessions/ToolCallBar.tsx` — individual tool call element
- `src/lib/sessions/parse-transcript.ts` — JSONL → timeline data structure
- Update: `/analytics` session inspector → link to timeline route

---

## Task 10: Theme System + Accessibility Audit

### Goal
Implement proper dark/light/system theme switching with CSS custom properties throughout. Then run a systematic accessibility audit and fix all P0 violations.

### What to build

**Part A: Theme System**
- Extend existing `dark`/`light` theme to support `system` (auto-detect from `prefers-color-scheme`)
- Audit all hardcoded colors in components — replace with CSS variables
- Add `theme-transition` class for smooth 200ms transitions on theme switch
- Theme switcher accessible from: settings page, command palette, keyboard shortcut (`T` toggle)
- Persist choice in localStorage AND apply immediately on page load (before React hydrates) to prevent flash

CSS variables to audit and standardize:
```css
--background, --foreground, --card, --card-foreground, --primary, --primary-foreground,
--secondary, --muted, --muted-foreground, --border, --input, --ring,
--destructive, --accent, --popover, --sidebar-background, --sidebar-border
```

**Part B: Accessibility Audit**
Run systematic checks on all 29 routes. Fix all P0 issues:

P0 violations to find and fix:
1. **Missing focus indicators** — all interactive elements must have visible `:focus-visible` ring
2. **Color contrast** — text on background must meet WCAG AA (4.5:1 for body, 3:1 for large text)
3. **Missing alt text** — all `<img>` elements need descriptive alt
4. **Missing ARIA labels** — buttons without text content need `aria-label`
5. **Form field labels** — every input needs an associated `<label>` or `aria-label`
6. **Keyboard traps** — modal dialogs must trap focus correctly and release on close
7. **Semantic HTML** — lists should use `<ul>`/`<li>`, navigation should use `<nav>`, headings in correct order
8. **Skip navigation link** — verify existing skip-nav is visible on focus (should already exist from prior work)

P1 violations (fix if time allows):
- `role="button"` on non-button elements
- Missing `lang` attribute on `<html>`
- Duplicate IDs

**Tooling:** Use `axe-core` programmatically or browser extension to generate violation list. Fix violations starting from most-used routes (home, agents, conversations).

### Files to update
- `src/styles/globals.css` — CSS variable system
- `src/stores/useUIStore.ts` — add `system` as valid theme option + media query listener
- `src/components/layout/ThemeSwitcher.tsx` — three-way toggle (light/dark/system)
- All component files with hardcoded colors (audit needed)
- `src/providers/` — add `ThemeProvider` if not already present

---

## Agent Spawn Instructions (for all tasks)

Each coding agent should:
1. Check out a worktree from `luis/ui-redesign`:
   ```bash
   git worktree add -b luis/[task-name] /tmp/openclaw/[task-name] luis/ui-redesign
   ```
2. Run `pnpm install` if `node_modules` doesn't exist in the worktree (usually not needed — symlinked from monorepo root)
3. Build the feature
4. Run `pnpm build` to verify no TypeScript errors
5. Commit with `git commit --no-verify -m "feat(ui): [description] ([task name])"`
6. Push: `git push origin luis/[task-name]`
7. Notify Luis: `openclaw system event --text "Done: [summary]" --mode now`

### Important constraints
- **Never** modify shared config files (`package.json`, `pnpm-lock.yaml`, `tsconfig.json`) without checking for conflicts
- All new components go in the appropriate domain directory under `src/components/domain/`
- All new routes use the file-based TanStack Router pattern (create both `.tsx` and `.lazy.tsx` files)
- Use existing UI primitives from `src/components/ui/` (Button, Card, Badge, etc. from Shadcn/Radix)
- Follow existing patterns: `useOptionalGateway()` for gateway access, TanStack Query for data fetching
- Icons from Lucide React only
- Tailwind v4 classes only (no arbitrary CSS unless necessary)
