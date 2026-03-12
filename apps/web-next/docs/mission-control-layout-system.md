# Mission Control — Visual Design & Layout System

**Work item:** `dgarson/clawdbot#bs-ux-4-design`  
**Status:** Design system spec ready for implementation  
**Coordination target:** `bs-ux-4` in-review (`origin/quinn/horizon-m1-mission-control`)

## 1) Design goals

Mission Control is an **operator-first, real-time dashboard**. The UI system optimizes for:

1. **Decision speed** — critical signals visible in <3 seconds.
2. **State legibility** — status is color + shape + text, not color-only.
3. **Real-time confidence** — users can tell if data is live, stale, or offline.
4. **Progressive density** — mobile remains readable; desktop supports high throughput.

## 2) Layout system

### Grid foundation

- Base grid: **12 columns** (desktop), reducing to 8 (tablet) and 4 (mobile)
- Gutter scale: 12 / 16 / 20 px
- Margin scale: 12 / 20 / 24 px
- Row heights: 72 (compact), 96 (standard), 132 (expanded)

### Breakpoint behavior

- **sm (0–767):** single-stack priority flow (critical widgets first)
- **md (768–1023):** two-column balanced layout
- **lg (1024–1439):** triad operator layout
- **xl (1440+):** triad + optional secondary rail

### Canonical widget placement (aligned to bs-ux-4)

1. **Live KPI bar** — full width row
2. **Active Sessions** — primary large card
3. **Tool Calls** — secondary rail card
4. **Pending Approvals** — secondary rail card
5. **Alert Feed** — full-width event rail (or 9-col + side rail on xl)

## 3) Widget card design spec

All Mission Control cards share these base rules:

- Radius: `md` (12px)
- Default padding: `16px`; dense variant `12px`
- Border: subtle 1px semantic border
- Elevation: card shadow + hover elevation shift
- Header structure:
  - Left: icon + title
  - Right: state indicator and optional action
- Body structure:
  - Key metric row
  - Secondary context row
  - Event/list/chart region
- Footer (optional): timestamp + drill-down action

### Card states

- `default`
- `hover`
- `selected`
- `degraded` (warning)
- `critical`
- `empty`
- `loading` (skeleton)

## 4) Color, type, and spacing tokens

Token source files:

- `apps/web-next/src/design-system/mission-control.tokens.ts`
- `apps/web-next/src/design-system/mission-control.specs.ts`

### Color system

Includes mode-aware semantic tokens for:

- Canvas/surfaces (base + elevated)
- Borders (subtle + strong)
- Text hierarchy (primary/secondary/muted)
- Focus states
- Status palette (success/warning/error/info/neutral)
- Realtime accents (pulse/stream/queue)

### Typography

- UI family: Inter/system stack
- Mono family: JetBrains Mono/system mono stack
- Scale: 12, 13, 14, 16, 20, 24
- Weight: 400/500/600/700
- Line-height tuned for compact telemetry surfaces

### Spacing & shape

- 4px base spacing scale
- Radii: 8, 12, 16, 20, pill
- Motion: 120/200/320ms with standard + entrance easings

## 5) Dark mode + light mode policy

Mission Control is **dark-first**. Light mode is parity-complete but secondary.

Rules:

- Use semantic tokens only (no hard-coded hex in components)
- Maintain WCAG AA contrast for key text + status badges
- Keep severity meaning stable across themes
- Preserve hierarchy via elevation + border contrast, not hue only

## 6) Real-time data visualization patterns

Patterns are standardized in `missionControlVisualizationPatterns`:

- **Sparkline** for short-window trends (5–30m)
- **Segmented health bars** for utilization/capacity
- **Event timeline** for alerts and operator handoffs
- **Status pills** for session/tool/approval state
- **Realtime pulse** with reduced-motion fallback

### Refresh strategy guidance

- KPI and list-based realtime surfaces: 1–3s
- Sparklines: 5s sampling cadence
- Timeline append: event-driven, virtualized list for scale

## 7) Implementation notes for bs-ux-4 integration

To align with the in-review Mission Control implementation:

1. Keep existing information architecture from `MissionControlDashboard.tsx`.
2. Replace ad-hoc utility color classes with semantic token mappings.
3. Apply standardized grid spans from `missionControlWidgetSpecs`.
4. Introduce consistent card primitives (`CardShell`, `CardHeader`, `StateBadge`).
5. Add token snapshot tests once the dashboard is wired.

## 8) Deliverables checklist

- [x] Dashboard grid/layout system defined
- [x] Widget card design specifications defined
- [x] Color, typography, spacing tokens defined
- [x] Dark mode + light mode semantic support defined
- [x] Responsive breakpoints documented
- [x] Real-time visualization patterns documented
