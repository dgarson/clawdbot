# UX Work Queue — OpenClaw Horizon

**Project:** `apps/web-next` (Vite + React + Tailwind, dark theme)
**Goal:** 10-12 views done by 7:30 AM MST Feb 22
**Sprint Status:** ✅ EXCEEDED — 19 views + full P2 shell polish
**Last Updated:** 2026-02-22 12:10 AM MST

## Build Status
```
✓ built in 1.36s  — 0 TypeScript errors
```

---

## Views (All 16 Done)

| View | Status |
|------|--------|
| ProviderAuthManager | ✅ |
| AgentDashboard | ✅ |
| ChatInterface | ✅ |
| AgentBuilderWizard | ✅ |
| CronScheduleBuilder | ✅ |
| AgentSoulEditor | ✅ |
| AgentIdentityCard | ✅ |
| ModelSelector | ✅ |
| SkillsMarketplace | ✅ |
| SessionExplorer | ✅ |
| UsageDashboard | ✅ |
| OnboardingFlow | ✅ |
| SettingsDashboard | ✅ |
| NodeManager | ✅ |
| AgentConfigReview | ✅ |
| WorkspaceFileBrowser | ✅ |
| NotificationCenter | ✅ |
| ApiKeysManager | ✅ |

---

## P2 Polish — All Done

### ✅ App Shell Overhaul
- Cmd+K command palette (fuzzy search, ↑↓ Enter, recent views, Alt+1–9 badges)
- Alt+1–9 keyboard shortcuts for first 9 views
- Alt+← / Alt+→ history back/forward navigation
- [ / ] to collapse/expand sidebar
- Top header bar with breadcrumb + back/forward buttons + search trigger
- Mobile responsive sidebar (hamburger, overlay, backdrop blur)
- Skip-nav accessibility link
- ViewErrorBoundary with try-again recovery
- ARIA roles throughout (nav, aria-current, aria-modal, aria-label)

### ✅ Keyboard Shortcut Help Modal (`src/components/KeyboardShortcutsModal.tsx`)
- Press `?` to open, Escape to close
- Shows all shortcuts with kbd styling
- Groups: Navigation, Command Palette, Global

### ✅ Global Toast System (`src/components/Toast.tsx`)
- ToastProvider + useToast hook
- success / error / info / warning variants
- Auto-dismiss (4s), manual dismiss, max 5 stacked
- Slide-in from right animation

### ✅ View Transitions
- CSS animate-slide-in on key prop change per view
- Smooth 0.3s translateY+fade on every navigation

### ✅ Skeleton Loading States (`src/components/Skeleton.tsx`)
- 6 variants: DashboardSkeleton, TableSkeleton, CardGridSkeleton, ChatSkeleton, ContentSkeleton, Skeleton base
- Per-view mapping in SKELETON_MAP
- Shows appropriate layout skeleton while lazy chunks load

---

## P2 Polish — Additional Completed

### ✅ Adaptive UX / ProficiencyStore + ComplexityGate (8:04 PM MST)
- `src/stores/proficiencyStore.tsx` — React Context + localStorage (no new deps)
  - 4 levels: beginner → intermediate → advanced → expert
  - Auto-promotion via interaction count thresholds (20 / 60 / 150)
  - visitView() tracks explored areas (worth 2 interactions each)
  - manuallySet flag prevents auto-promotion from overriding user preference
  - Full TypeScript, no `any`, stable useCallback deps
- `src/components/ComplexityGate.tsx` — gating component
  - `<ComplexityGate minLevel="advanced">` pattern
  - `teaser` prop shows subtle unlock hint when level not met
  - Convenience wrappers: IntermediateFeature, AdvancedFeature, ExpertFeature
- `src/components/ProficiencyBadge.tsx` — sidebar footer widget
  - Shows current level with emoji + auto/manual + action count
  - Click-to-open popover: select any level manually
  - Progress bars toward next auto-promotion threshold
  - Reset button to restart progression
- App.tsx integration: ProficiencyProvider wraps app, badge in sidebar footer,
  navigate() calls visitView() + recordInteraction() on every navigation

## View #17 (Creative Invention — 10:18 PM MST)

### ✅ NotificationCenter (`src/views/NotificationCenter.tsx`) — commit `f97de28` (11:15 PM MST)
- Master/detail layout: filter list (left) + full detail panel (right)
- Severity chips: All / Critical / Warning / Success / Info
- Filters: read state + category dropdown + Cmd+F search
- Stats bar: per-severity live counts
- Actions: mark read, mark all read, clear read, pin, dismiss, primary action CTA
- Detail panel: agent card, meta, event timeline, actionable button
- Live event injection every 45s (aria-live polite)
- Pinned items sort to top; 12 realistic seed events
- Full a11y: aria-selected, aria-pressed, aria-label, focus-visible rings throughout
- Build: ✓ 0 TS errors, 1.58s, 16.65 kB / gzip 4.82 kB

### ✅ AgentPulseMonitor (`src/views/AgentPulseMonitor.tsx`)
- Mission-control real-time view for all active agents
- Agent card grid with sparkline, status pulse dot, current task
- Activity feed (role=log, aria-live=polite) with live event simulation
- Detail panel: stats grid, bar chart, relationship graph, model badge
- Status filter chips + live/pause toggle
- Full keyboard accessibility throughout
- Commit `f1d6125` — 17 total views in Horizon UI

### ✅ Accessibility Audit — WCAG 2.1 AA fixes (commit `f1d6125`)
- AgentBuilderWizard: htmlFor+id on Agent Name + Role inputs
- CronScheduleBuilder: htmlFor+id on Job Name; sr-only label + aria-label on custom cron input
- SessionExplorer: <span onClick> → <button type=button> with aria-label + focus-visible ring
- Clean build: ✓ 0 TS errors, 1.45s

## View #19 (Creative Invention — 12:10 AM Feb 22 MST)

### ✅ ApiKeysManager (`src/views/ApiKeysManager.tsx`) — commit `e738631`
- **API Keys tab:** master/detail, active/revoked/expired status filter chips,
  search bar, masked key display, revoke/rotate/delete actions,
  28-bar usage sparkline, per-scope badge listing, meta grid (created/expires/IP/calls)
- **Webhooks tab:** delivery stats (total/success rate/last fired), signing secret
  copy-to-clipboard, pause/resume/delete, event subscriptions, failing-state alert banner
- **Create Key modal:** name + expiry picker (30/90/365/never) + scope selector
  grouped by category (Agents/Sessions/Models/Nodes/Cron/Files/Admin), admin warning,
  one-time key reveal step with copy-to-clipboard
- **Create Webhook modal:** name, endpoint URL, event multi-select pill tags
- **Security UX:** admin scope warning, "copy now or lose it" reveal flow, security notice banner
- Build: ✓ 0 TS errors, 1.47s, 30.88 kB / gzip 6.98 kB

---

## Remaining P2 (lower priority)

| Task | Priority |
|------|----------|
| Gateway RPC integration | P2 — blocked on backend contract |

---

## Build Timeline
- 4:05 PM: Scaffolded
- ~4:45 PM: 16 views done, clean build
- 5:15 PM: App shell overhaul (palette, shortcuts, header, mobile)
- 5:20 PM: Keyboard shortcuts modal
- 5:25 PM: Toast system + view transitions
- 5:30 PM: Skeleton loaders
- 5:35 PM: History back/forward navigation
