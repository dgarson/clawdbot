# WORKSTREAM: Horizon UI — Complete

**Owner:** Luis (UX Lead)
**Megabranch:** `feat/horizon-ui-complete`
**Repo:** `git/clawdbot/` (Luis's workspace clone)
**Started:** 2026-02-22
**Target:** Ready for David's review within 24h of kickoff
**Status:** 🔴 Active — sprints in progress

---

## Background

Luis shipped 287 views in the first Horizon sprint (PR #61 merged, PR #72 open with views #268–287).
This workstream covers everything remaining to make Horizon UI a complete, shippable product.

---

## Milestone Plan

### M1 — Mission Control Dashboard (Real-Time Observability)

**Priority:** P0 (independently converged with Amadeus — highest cross-agent alignment)

- Active sessions panel with live token streaming
- Tool calls in-flight display
- Pending approvals queue
- Error/alert feed via WebSocket
- Agent health grid with live status

### M2 — Agent Relationship Topology Visualization

**Priority:** P0 ("Demo gold. No competitor has this.")

- Zoomable interactive graph (React Flow or D3)
- Who spawns whom, delegation chains
- Live message flow updates via spawn events
- Animate active sessions

### M3 — Guided Interactive Onboarding Tour

**Priority:** P0 (Luis's #1 adoption lever — "single highest-leverage")

- Live RPC-connected walkthrough: gateway → channels → first agent → live chat
- Real-time validation at each step
- Replace static onboarding wizard

### M4 — Discovery UI Completion (Remaining Mode A views)

**Priority:** P1

- DiscoveryRunHistory (paginated past runs)
- AgentCapabilityMatrix (agents × capabilities grid)
- FindingDetailModal (evidence, sources, confidence)
- CostForecastChart (projected cost SVG line chart)
- DiscoveryRunExport (JSON/CSV/Markdown)
- DiscoveryRunMonitor live data wiring (unblocked when Gateway RPC merges)

### M5 — Universal Command Palette (⌘K 2.0)

**Priority:** P1

- NL intent parsing for natural language actions
- Expanded action vocab (all routes, agents, skills, sessions)
- Keyboard-first power-user surface

### M6 — Contextual Empty States

**Priority:** P1

- 19+ routes get educational, actionable empty states with CTAs
- Zero-data experiences that teach instead of frustrate

### M7 — Keyboard Navigation & Accessibility (WCAG 2.1 AA)

**Priority:** P1 (enterprise + legal risk)

- Full keyboard nav, skip links, ARIA labels, focus management
- Works with Reed's accessibility mandate

### M8 — Notification Center & Alert Management

**Priority:** P2

- Unified in-app hub with filtering, grouping, snooze
- Wire to agent events, PR status, cost alerts

### M9 — Adaptive Layout & Responsive Design

**Priority:** P2

- Mobile-first, breakpoint grid, touch targets
- Full responsive across all 287+ views

### M10 — Dark Mode + Theming System

**Priority:** P2

- Full design token system: light/dark/custom themes
- Applied across all views

---

## Sprint Order

Sprints run in immediate succession — Luis does not pause between them.

```
Sprint 1: M1 Mission Control + M2 Topology       (highest impact, demo-critical)
Sprint 2: M3 Onboarding Tour                      (adoption critical)
Sprint 3: M4 Discovery completion                 (unblock Mode A backlog)
Sprint 4: M5 ⌘K + M6 Empty States                (DX + activation polish)
Sprint 5: M7 Accessibility                        (a11y pass across all views)
Sprint 6: M8-M10 Notifications + Responsive + Themes  (P2 completion)
```

---

## Review Gate (Before PR to David)

When ALL sprints are done:

1. **Luis** — full self-review: build clean, 0 TS errors, all routes navigable
2. **Quinn** — UX review: onboarding tour, topology viz, empty states, ⌘K flow
3. **Reed** — Accessibility audit: WCAG 2.1 AA pass on all new surfaces

Review findings must be addressed before the PR is opened for David's review.

---

## Shared References

- `_shared/MEGA_BRANCHES.md` — registered as `feat/horizon-ui-complete`
- `_shared/workstreams/horizon-ui/WORKSTREAM.md` — this file
- `luis/UX_WORK_QUEUE.md` — sprint tracking (Luis updates after each milestone)
- `luis/HEARTBEAT.md` — drives sprint continuation automatically

---

## Progress Log

| Sprint | Milestone               | Status         | Commit/PR    |
| ------ | ----------------------- | -------------- | ------------ |
| 1      | M1 Mission Control      | 🔴 Not started | —            |
| 1      | M2 Topology Viz         | 🔴 Not started | —            |
| 2      | M3 Onboarding Tour      | 🔴 Not started | —            |
| 3      | M4 Discovery completion | 🔴 Not started | —            |
| 4      | M5 ⌘K + M6 Empty States | 🔴 Not started | —            |
| 5      | M7 Accessibility        | 🔴 Not started | —            |
| 6      | M8-M10 Polish           | 🔴 Not started | —            |
| —      | **Review gate**         | 🔴 Pending     | Quinn + Reed |
| —      | **PR for David**        | 🔴 Pending     | —            |
