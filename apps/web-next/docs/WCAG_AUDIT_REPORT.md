# WCAG 2.1 AA Remediation Report — Horizon M7

**Auditor:** Reed (Accessibility Specialist, Product & UI Squad)  
**Date:** 2026-02-23  
**Branch:** `reed/horizon-m7-wcag-remediation`  
**Target:** WCAG 2.1 Level AA

---

## Summary

| File | Status | Violations Found | Violations Fixed |
|------|--------|-----------------|-----------------|
| `MissionControlDashboard.tsx` | ✅ Remediated | 18 | 18 |
| `AgentTopologyMap.tsx` | ✅ Remediated | 14 | 14 |
| `FindingDetailModal.tsx` | ⚠️ File not found | — | — |
| `DiscoveryRunHistory.tsx` | ⚠️ File not found | — | — |

**Build status:** ✅ Passing (also fixed pre-existing TS errors in `AgentOutputDiffViewer.tsx`)

---

## File 1: `MissionControlDashboard.tsx`

### Violations Found

**1.1 Perceivable — Images/Icons**
- All Lucide icons in panel headers (`Activity`, `Terminal`, `AlertTriangle`, `CheckCircle`, `Radio`, `Clock`, `Layers`, `Users`, `Zap`, `ChevronUp`) rendered without `aria-hidden="true"` — screen readers announced them as unlabelled images.
- `PulseDot` animated spans had no `aria-hidden` — decorative pulsing animation was exposed to AT.
- `SeverityIcon` variants (`XCircle`, `AlertCircle`, `AlertTriangle`, `Info`) were purely decorative from the AT perspective — no accessible label despite carrying critical severity information.
- Agent emoji spans in session rows were exposed to AT without `aria-hidden`.
- Separator dots (`·`) announced as punctuation by AT.

**1.2 Perceivable — Color only**
- `SessionStatusBadge`: dot color was not hidden from AT — if a user had the text stripped, the dot color alone would differentiate status. (The text label was present, but the dot was also announced, creating noise.)
- `ToolCallsPanel` status: `CheckCircle` (complete) and `XCircle` (error) had no accessible labels — relied on color alone for AT users.

**2.1 Operable — Focus Indicators**
- `AlertFeed` filter buttons lacked `focus-visible:ring-2` — no visible keyboard focus indicator.
- Approve/Deny buttons in `PendingApprovalsPanel` lacked `focus-visible:ring-2`.

**2.2 Operable — Skip Link**
- No skip link at top of view — keyboard users had to Tab through the entire header before reaching content.

**2.3 Operable — Accessible Button Names**
- Approve/Deny buttons had generic text but no `aria-label` linking them to the specific action/approval. A user hearing "Approve" with no context couldn't act safely.

**3.1 Understandable — Filter State**
- `AlertFeed` filter buttons had no `aria-pressed` — screen readers couldn't determine which filter was active.
- No `role="group"` on the filter button group.

**4.1 Robust — Landmark Roles**
- No `<main>` landmark — AT users couldn't navigate directly to primary content.
- No `id` for skip link target.
- Panel sections had no `role="region"` or `aria-label` — landmark navigation ineffective.
- Alert feed container lacked `role="log"` and `aria-live` — live event updates never announced to AT.
- Live status bar (updates every 3s) had no `aria-live` region.
- `SessionStatusBadge` lacked `role="status"`.

### Fixes Applied

- ✅ Added `<a href="#mcd-main" className="sr-only focus:not-sr-only ...">Skip to main content</a>` at top of render
- ✅ Wrapped entire view in `<main id="mcd-main">` landmark
- ✅ `PulseDot`: `aria-hidden="true"` on outer `<span>` (all internal spans decorative)
- ✅ `StatCard` icon: `aria-hidden="true"` — label text is the accessible name
- ✅ `SessionStatusBadge`: `role="status"` on outer span; `aria-hidden="true"` on dot span
- ✅ `ToolBadge` icon: `aria-hidden="true"` — tool name text carries the label
- ✅ `SeverityIcon`: `role="img"` + `aria-label="Critical/Error/Warning/Info"` on each icon variant
- ✅ `ToolCallsPanel` status icons: `CheckCircle` → `aria-label="Complete"`, `XCircle` → `aria-label="Error"`, both with `role="img"`
- ✅ Running pulse dot in ToolCallsPanel: `aria-hidden="true"` (text "live" carries the label)
- ✅ All `Clock` decorative icons: `aria-hidden="true"`
- ✅ `ChevronUp` in LiveStatusBar sub: `aria-hidden="true"`
- ✅ Agent emoji spans: `aria-hidden="true"`
- ✅ Separator `·` spans: `aria-hidden="true"`
- ✅ Empty-state icons (`Layers`, `CheckCircle`): `aria-hidden="true"`
- ✅ `AlertFeed` filter buttons: `aria-pressed={filter === f.key}` + `focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none`
- ✅ Filter group: `role="group" aria-label="Filter events"`
- ✅ Approve/Deny buttons: `aria-label` with full action description; icon `aria-hidden="true"`; `focus-visible:ring-2`
- ✅ Alert feed content: `role="log" aria-live="polite" aria-label="System events"`
- ✅ LiveStatusBar wrapper: `aria-live="polite" aria-label="Live system status"`
- ✅ Panel wrappers converted to `<section aria-label="...">` semantic elements

### Remaining Items (Require Design Input)

- **Contrast — `text-zinc-500` on `bg-zinc-950`**: The `text-zinc-500` (#71717a on #09090b) achieves approximately 3.9:1 contrast ratio — marginally below the 4.5:1 AA threshold for small text. Updating these to `text-zinc-400` (#a1a1aa) raises the ratio to ~5.8:1. Recommend a design-pass to audit and standardize muted text tokens.
- **Token counters (`↑` / `↓`)**: Arrow characters may not be adequately announced by all AT. Consider wrapping in `<abbr title="input tokens">` / `<abbr title="output tokens">`.

---

## File 2: `AgentTopologyMap.tsx`

### Violations Found

**1.1 Perceivable — Images/Icons**
- Lucide icons in toolbar (`Users`, `Wifi`, `WifiOff`, `RotateCcw`) rendered without `aria-hidden`.
- `LegendItem` color swatches (div/svg) rendered without `aria-hidden`.
- `MessageSquare` icon in `DetailPanel` without `aria-hidden`.
- SVG node label `<text>` elements without `aria-hidden` — redundant with the accessible label on the `<g>` element.
- Status indicator dots on SVG nodes (green/grey) communicated status by color only with no text alternative.

**1.2 Perceivable — Color only**
- SVG node status dots: `fill={active ? '#10b981' : '#52525b'}` — pure color with no text label visible to AT.
- `DetailPanel` status dot: same issue.

**2.1 Operable — SVG Keyboard Access**
- All SVG `<g>` nodes had `onClick` but no `tabIndex`, `role`, or `onKeyDown` — completely inaccessible to keyboard users. Tab navigation bypassed the entire graph.
- No keyboard equivalent for node inspection (was mouse-click only).

**2.2 Operable — Focus Indicators**
- Live/Paused toggle button: no `focus-visible:ring`.
- Reset View button: no `focus-visible:ring`.
- `DetailPanel` close button: no `focus-visible:ring`.

**2.3 Operable — Keyboard Trap**
- `DetailPanel` once opened had no keyboard mechanism to close — no Escape key handler.

**2.4 Operable — Skip Link**
- No skip link.

**3.1 Understandable — Button Labels**
- `DetailPanel` close button: icon-only (`<X>`) with no `aria-label` — AT announced "button" with no description.
- Live/Paused toggle: no `aria-pressed` — AT couldn't determine current live state.
- Live/Paused toggle: no `aria-label` describing what the button does.

**4.1 Robust — Landmark Roles**
- No `<main>` landmark.
- SVG had no `role` — AT treated it as an image (no interaction possible) or ignored it.
- `DetailPanel` had no landmark role or label.
- `progressbar` on token load bar had no ARIA progressbar semantics.

### Fixes Applied

- ✅ Added skip link `<a href="#atm-main" ...>` at top of render
- ✅ Wrapped view in `<main id="atm-main">` landmark
- ✅ Toolbar wrapped in `<nav aria-label="Topology toolbar">`
- ✅ SVG: `role="application" aria-label="Agent Topology Map — Tab to navigate nodes, Enter or Space to inspect"`
- ✅ `NodeShape`: `tabIndex={0}`, `role="button"`, `aria-label="{name}, {type}, {active|idle}[, selected]"`, `aria-pressed={selected}`, `onKeyDown` (Enter/Space triggers click)
- ✅ `focusedId` state added — focused node shows violet glow ring distinct from selected purple ring
- ✅ SVG edges `<g>`: `aria-hidden="true"` — decorative connections
- ✅ SVG grid background `<rect>`: `aria-hidden="true"`
- ✅ SVG node status dots: `aria-hidden="true"` — status is in the `aria-label` on the `<g>`
- ✅ SVG node `<text>` labels: `aria-hidden="true"` — redundant with `<g>` aria-label
- ✅ Node type count overlay: `aria-hidden="true"` — information conveyed via legend
- ✅ `DetailPanel`: `<aside role="complementary" aria-label="Details for {node.name}">`
- ✅ `DetailPanel` close button: `aria-label="Close details panel"`, `aria-hidden="true"` on `<X>` icon, `focus-visible:ring-2`
- ✅ `DetailPanel` status dot: `aria-hidden="true"` — status text label follows
- ✅ `DetailPanel` avatar initial div: `aria-hidden="true"`
- ✅ Token load bar: `role="progressbar" aria-valuenow aria-valuemin aria-valuemax aria-label`
- ✅ Live/Paused toggle: `aria-pressed={isLive}`, `aria-label="Pause live updates"/"Resume live updates"`, `focus-visible:ring-2`
- ✅ Reset View button: `focus-visible:ring-2`
- ✅ Escape key handler: `useEffect` closes `DetailPanel` when `selectedNode` is active
- ✅ Legend items: `aria-hidden="true"` on color swatches; label text remains
- ✅ Legend list: `role="list" aria-label="Node type legend"` with `role="listitem"` wrappers
- ✅ Session count badge: `role="status" aria-label="{n} of {total} sessions active"`
- ✅ All toolbar icons (`Users`, `Wifi`, `WifiOff`, `RotateCcw`, `MessageSquare`): `aria-hidden="true"`

### Remaining Items (Require Design Input)

- **Full SVG graph focus order**: Tab order through SVG nodes follows DOM order (insertion order), which is `luis → xavier → amadeus → ...`. A logical reading order (e.g., left-to-right, then workers, then crons) would require reordering the `MOCK_NODES` array or adding explicit tabindex values — a UX decision.
- **SVG focus outline**: Keyboard focus ring on SVG `<g>` elements is implemented via the scale transform (scale 1.18 + glow on focus). Native CSS `outline` doesn't apply to SVG elements in all browsers. The current approach provides a visible indicator. For additional robustness, a dedicated CSS rule (`:focus-visible g { ... }`) could be added to the global stylesheet.

---

## File 3: `FindingDetailModal.tsx`

**Status: ⚠️ File not found**

This file does not exist on `feat/horizon-ui-complete`. No audit or remediation was possible.

The closest existing view is `FindingRemediationTracker.tsx` and `DiscoveryFindingsSearch.tsx`. If `FindingDetailModal.tsx` is planned for a future milestone, it should be audited at creation time. Recommend pre-populating it with the accessible modal pattern:
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Escape key to close
- Focus trap within the dialog
- Focus return to trigger element on close

---

## File 4: `DiscoveryRunHistory.tsx`

**Status: ⚠️ File not found**

This file does not exist on `feat/horizon-ui-complete`. The closest existing view is `DiscoveryRunMonitor.tsx`.

When `DiscoveryRunHistory.tsx` is created, key patterns to bake in from the start:
- `<main>` landmark + skip link
- History table: `role="grid"` or `<table>` with `<caption>`, `scope="col"` headers
- Status column: text label not just color dot
- Pagination: `aria-label="Pagination"` on nav, `aria-current="page"` on active page

---

## Pre-existing Build Fix: `AgentOutputDiffViewer.tsx`

**Issue:** The branch had 11 TypeScript errors in `AgentOutputDiffViewer.tsx` blocking the build entirely (unrelated to this audit task):
- 9 non-existent lucide-react exports imported: `Stopwatch`, `Alarm`, `Notification`, `NotificationOff`, `RSS`, `Broadcast`, `Tape`, `Cassette`, `Vinyl` — all removed (unused).
- `Map` from lucide-react shadowed the JavaScript built-in `Map` constructor, causing `new Map(...)` at lines 740–741 to fail TS type-checking — fixed by renaming the import to `Map as MapIcon`.

**Fix applied:** Removed 9 invalid imports and aliased `Map → MapIcon`. Build now passes cleanly.

---

## WCAG 2.1 AA Coverage Matrix

| Criterion | MissionControl | AgentTopology |
|-----------|---------------|---------------|
| 1.1.1 Non-text Content | ✅ Fixed | ✅ Fixed |
| 1.3.1 Info and Relationships | ✅ Fixed | ✅ Fixed |
| 1.4.3 Contrast (Minimum) | ⚠️ Partial (see notes) | ✅ (dark theme sufficient) |
| 2.1.1 Keyboard | ✅ Fixed | ✅ Fixed |
| 2.1.2 No Keyboard Trap | N/A | ✅ Fixed |
| 2.4.1 Bypass Blocks | ✅ Fixed | ✅ Fixed |
| 2.4.3 Focus Order | ✅ | ⚠️ Partial (see notes) |
| 2.4.7 Focus Visible | ✅ Fixed | ✅ Fixed |
| 4.1.2 Name, Role, Value | ✅ Fixed | ✅ Fixed |
| 4.1.3 Status Messages | ✅ Fixed | ✅ Fixed |
