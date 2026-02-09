# Web UX Improvements — Round 2 (Revised)

> Revised audit of the React web app (`apps/web/src/`). Scoped to `apps/web/src/` and `src/` only; Lit layer (`ui/*`) excluded.
>
> This revision removes items already implemented, surfaces bugs/flaws found during audit, and adds newly identified UX improvements.

---

## Status of Original Report Items

| #   | Original Item                       | Status                                                                                                                                                              |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Shared EmptyState component         | **Still needed** — no shared component exists                                                                                                                       |
| 2   | Shared ErrorState component         | **Implemented** — `components/composed/ErrorState.tsx` exists with inline/card variants and pre-configured `errorMessages`                                          |
| 3   | Consolidate date formatters         | **Partially done** — `lib/format.ts` exists but only 6 files use it; 16+ files still define local formatters and 40+ use inline `toLocaleDateString()`/`Intl` calls |
| 4   | Adopt PageHeader across routes      | **Not adopted** — `components/layout/PageHeader.tsx` exists with breadcrumb support but zero routes import it                                                       |
| 5   | Home panel visual hierarchy         | **Implemented** — QuickChatBox spans full width, ApprovalsInbox uses `border-warning/40 bg-warning/5` accent, dashboard panels are visually recessive               |
| 6   | Extract shared animation variants   | **Still needed** — no `lib/animations.ts`; 16+ files define identical `containerVariants`/`itemVariants`                                                            |
| 7   | Reduce AgentCard density            | **Still heavy** — 310 LOC, ~90 Tailwind classes, 5 motion animations, gradient + glow + ping                                                                        |
| 8   | Deduplicate agent detail formatters | **Still duplicated** — `$agentId.tsx` defines local `formatDate()` and `formatRelativeTime()`                                                                       |
| 9   | Fix mobile conversation layout      | **Still broken** — flex row with `max-w-md` sidebar + `flex-1` main; no responsive stacking                                                                         |
| 10  | Replace raw `<button>` elements     | **Still present** — 2 files use raw `<button>` instead of `<Button>` component                                                                                      |
| 11  | Deduplicate workstream utils        | **Still duplicated** — `WorkstreamCard.tsx` and `$workstreamId.tsx` both define `formatDueDate()`, `getOwnerInitials()`, `statusConfig`                             |
| 12  | Reduce WorkstreamCard weight        | **Still heavy** — 457 LOC, ~127 Tailwind classes, 8 motion animations, 3 variants                                                                                   |
| 13  | Mobile navigation                   | **Still missing** — sidebar is `hidden md:flex`; no bottom tab bar, hamburger, or drawer below `md`                                                                 |
| 14  | Breadcrumbs on nested routes        | **Partially done** — `/agents/$agentId` and `/workstreams/$workstreamId` have back buttons; session routes and agentic view have no breadcrumbs                     |
| 15  | Shared status color tokens          | **Still needed** — 10+ files define their own `statusConfig` objects with inconsistent color mappings                                                               |

**Items fully resolved and removed from this revision:** #2 (ErrorState) and #5 (home hierarchy).

---

## Bugs & Flaws Found During Audit

### Bug 1: Hardcoded Simulated AI Response in Production Route

**File:** `routes/conversations/$id.tsx` (lines 66-73)
**Severity:** High

The `handleSubmit` function sends the user's message then uses `setTimeout` to inject a fake assistant response:

```tsx
setTimeout(async () => {
  await sendMessage.mutateAsync({
    conversationId: id,
    role: "assistant",
    content:
      "I received your message and I'm processing it. This is a simulated response for the demo.",
  });
}, 1000);
```

This is demo/test code left in a production route. Users will see a misleading bot response. The `async` callback inside `setTimeout` is also an anti-pattern — if the component unmounts during the 1s delay, the mutation fires against stale context.

**Fix:** Remove the simulated response block entirely; rely on the real backend response pipeline.

### Bug 2: Missing Error Boundary on Agentic Conversation Route

**File:** `routes/conversations/$id/agentic.tsx` (lines 33-35)
**Severity:** Medium

This route definition lacks `errorComponent: RouteErrorFallback`, unlike every other route file. An unhandled error in the agentic workflow view will crash to a white screen instead of showing the standard error fallback.

**Fix:** Add `errorComponent: RouteErrorFallback` to the route definition.

### Bug 3: Missing Null Safety on Conversation Creation

**File:** `routes/conversations/index.tsx` (lines 32-41)
**Severity:** Medium

`handleSelectAgent` calls `createConversation.mutateAsync(...)` and immediately navigates using `newConversation.id` without checking if the response is defined. If the mutation returns `undefined` or errors silently, the app navigates to `/conversations/undefined`.

**Fix:** Guard with `if (newConversation?.id)` before navigating.

### Bug 4: Hardcoded Delay Constants in Agentic View

**File:** `routes/conversations/$id/agentic.tsx` (lines 137, 163, 192, 208)
**Severity:** Low

Multiple hardcoded `setTimeout` delays (`500ms`, `700ms`, `800ms`, `1000ms`) appear to be demo scaffolding. These create artificial latency rather than responding to real event timing.

### Bug 5: Inconsistent Loading States Across Routes

**Severity:** Medium

| Route                            | Loading Pattern                        |
| -------------------------------- | -------------------------------------- |
| `routes/index.tsx` (Home)        | No skeleton — blank until data arrives |
| `routes/conversations/index.tsx` | No page-level skeleton                 |
| `routes/jobs/index.tsx`          | Plain text "Loading..."                |
| Most other routes                | Proper skeleton grids                  |

Three routes break the skeleton pattern that 10 other routes follow, creating a jarring experience when navigating between pages.

---

## Revised Improvement List

Items already implemented (#2 ErrorState, #5 home hierarchy) are removed. Remaining items are re-numbered and updated to reflect current state. New items are added at the end.

### A. Cross-Cutting / Shared Infrastructure

#### 1. Shared EmptyState Component (from original #1)

**Status:** Not implemented. Every view reinvents empty states:

- `AgentConfig.tsx`: motion.div with Bot icon
- `MemoryList.tsx`: motion.div with Brain icon, custom `emptyMessage` prop
- `GoalList.tsx`: motion.div with emoji (🎯), status-aware messages
- `TeamAgentGrid.tsx`: simple text-only (no icon)
- `HealthDashboard.tsx`: raw `<p>` tag
- 7 main route pages: each with unique styling

Create `<EmptyState icon={...} title="..." description="..." action={...} />` in `components/composed/`.

**UX impact:** Pattern recognition — users learn one visual language for "nothing here yet."

#### 2. Consolidate Date/Time Formatters (from original #3)

**Status:** `lib/format.ts` exists and exports `formatRelativeTime`, `formatRelativeTimeFromISO`, `formatDuration`, `formatCost`, `formatCostPrecise`, `formatTokenCount`, `shortenSessionKey`. Only 6 files import from it.

**Still duplicating locally (16 files):**

- `ConversationItem.tsx` — local `formatRelativeTime()` (line 18)
- `RecentWork.tsx` — local `formatRelativeTime()` (line 22)
- `RecentMemoriesPanel.tsx` — local `formatDate()` (line 38)
- `$agentId.tsx` — local `formatDate()` + `formatRelativeTime()` (lines 165, 175)
- `$workstreamId.tsx` — local `formatDueDate()` (line 96)
- `WorkstreamCard.tsx` — local `formatDueDate()` (line 72)
- `RitualDetailPanel.tsx` — local `formatDate()` + `formatRelativeTime()` (lines 126-149)
- `RitualCard.tsx` — multiple inline `toLocaleDateString()` calls
- `jobs/index.tsx` — local `formatRelativeTime()` (line 230)
- `ExportConversationsDialog.tsx` — local `formatRelativeTime()` (line 90)
- `ChatSettingsPanel.tsx` — local `formatDate()` via `Intl.DateTimeFormat`
- `GoalDetailPanel.tsx` — local `formatDate()` via `toLocaleDateString()`
- `MemoryDetailPanel.tsx` — local `formatDate()` via `toLocaleDateString()`
- `SessionActivityFeed.tsx` — local `formatRelativeTime()` (line 103)
- `session-helpers.ts` — exports its own `formatRelativeTime()` (line 6)
- `routes/index.tsx` — local `formatDate()` (line 40)

**Additionally, 40+ files** use inline `toLocaleDateString()`/`Intl.DateTimeFormat` directly without any abstraction.

Issues observed: capitalization inconsistency ("Just now" vs "just now"), differing thresholds (some show "just now" up to 30s, others up to 60s), locale handling (some hardcode `en-US`, some use browser default).

**Action:** Add `formatDate()` and `formatDueDate()` to `lib/format.ts`. Replace all 16 local implementations. Grep for remaining inline calls and extract where practical.

**UX impact:** Timestamps look identical everywhere. Effort: Low.

#### 3. Adopt PageHeader Across All Routes (from original #4)

**Status:** `components/layout/PageHeader.tsx` exists with breadcrumb support (`Breadcrumb[]` prop with `label` + `href`), title, description, and right-side actions slot. Zero routes use it.

Current header implementations per route:

- `agents/index.tsx`: `text-3xl font-bold` in a flex row
- `workstreams/index.tsx`: `text-2xl font-bold` with icon
- `goals/index.tsx`: `text-2xl font-bold` with Target icon
- `memories/index.tsx`: `text-2xl font-bold` with Brain icon
- `rituals/index.tsx`: `text-2xl font-bold` with Calendar icon
- `decisions/index.tsx`: `text-2xl font-bold` with Scale icon
- Home: `text-2xl font-semibold` (different weight)

Title sizing is mostly consistent (`text-2xl`) except agents (`text-3xl`) and home (`text-2xl font-semibold` vs `font-bold`).

**Action:** Adopt `PageHeader` in all route files. Set consistent title sizing via the component.

**UX impact:** Visual consistency + free breadcrumb navigation on nested routes. Effort: Low-Med.

#### 4. Extract Shared Stagger Animation Variants (from original #6)

**Status:** No `lib/animations.ts` exists. 16+ files define identical animation variant objects.

Files with duplicated `containerVariants`/`itemVariants`:

- `TeamAgentGrid.tsx` (staggerChildren: 0.1)
- `UpcomingRitualsPanel.tsx` (0.08)
- `GoalProgressPanel.tsx` (0.08)
- `RecentMemoriesPanel.tsx` (0.08)
- `ActiveWorkstreamsSection.tsx` (0.08)
- `SuggestedStarters.tsx` (0.04, inline)
- `MemoryList.tsx` (0.05)
- `RitualList.tsx` (0.08)
- `routes/index.tsx` (0.1)
- `routes/goals/index.tsx` (0.1)
- `routes/memories/index.tsx` (0.08)
- `routes/rituals/index.tsx` (0.08)

**Action:** Create `lib/animations.ts` with presets (`STAGGER_FAST: 0.04`, `STAGGER_NORMAL: 0.08`, `STAGGER_SLOW: 0.1`) and standard `slideUp`, `fadeIn`, `scaleIn` item variants.

**UX impact:** DRY (~40 lines removed per file), prevents timing drift. Effort: Low.

#### 5. Standardize Status Color Tokens (from original #15)

**Status:** 10+ files define independent `statusConfig` objects:

| File                      | Status Types                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `StatusBadge.tsx`         | online, offline, busy, paused, error, success, warning, pending                     |
| `WorkflowStatusBadge.tsx` | idle, thinking, executing, waiting_approval, waiting_input, paused, complete, error |
| `AgentStatusRow.tsx`      | active, stalled, idle, errored                                                      |
| `AgentCard.tsx`           | online, offline, busy, paused                                                       |
| `GoalCard.tsx`            | active, completed, archived                                                         |
| `GoalDetailPanel.tsx`     | active, in_progress, not_started, completed, paused, archived                       |
| `RitualDetailPanel.tsx`   | active, paused, completed, failed                                                   |
| `WorkstreamCard.tsx`      | active, paused, completed, archived                                                 |
| `TaskNode.tsx`            | todo, in_progress, review, done, blocked                                            |
| `ChannelCard.tsx`         | connected, not_configured, error, connecting, unsupported                           |

Inconsistencies: "active" maps to `green-500` in some files, `bg-green-500` in others, and `text-green-600` in yet others. Some configs include `bgColor`, others use `color` only.

**Action:** Create `lib/status-colors.ts` with a semantic status-to-color mapping. Domain-specific configs can extend it but should pull base colors from the shared source.

**UX impact:** "Active" always renders the same green everywhere. Effort: Low.

### B. Agents Views

#### 6. Reduce AgentCard Expanded Variant Density (from original #7)

**Status:** 310 LOC, ~90 Tailwind classes, 5 Framer Motion animation blocks.

Current expanded variant renders: gradient accent line (`from-primary via-accent to-primary`), glow effect on hover, ping-animated status dot (2 instances), blur-glow avatar (`blur-md` backdrop), name, role, description, tag pills with stagger animation, 4 action buttons (View Session, New Session, Chat, Settings), and "last active" footer.

**Action:** Remove gradient accent and glow. Replace ping-animated status dot with static dot. Remove avatar blur glow. Move description and tags to detail view. Consolidate to 2-3 action buttons in one row.

**UX impact:** Scanability in grids of 6+. Effort: Med.

#### 7. Deduplicate Agent Detail Formatters (from original #8)

**Status:** `routes/agents/$agentId.tsx` defines local `formatDate()` (line 165) and `formatRelativeTime()` (line 175) that duplicate `lib/format.ts`.

**Action:** Replace with imports from `lib/format.ts`.

**UX impact:** Consistency. Effort: Low (5 min).

### C. Conversations

#### 8. Fix Mobile Conversation Layout (from original #9)

**Status:** `routes/conversations/index.tsx` lines 45-50:

```tsx
<div className="flex h-full -mx-4 -my-6 sm:-mx-6 lg:-mx-8">
  <motion.aside className="w-full max-w-md border-r border-border bg-card/50">
  ...
  <main className="flex-1 flex items-center justify-center p-8">
```

Both sidebar (`max-w-md` = 448px) and main content render side-by-side on all screen sizes. No responsive classes hide either section on mobile.

**Action:** Below `md`: show only conversation list full-width; selecting a conversation navigates to the detail route. Hide the welcome/empty state on mobile.

**UX impact:** Conversations are currently unusable on narrow screens. Effort: Med.

#### 9. Replace Raw `<button>` Elements (from original #10)

**Status:** 2 files still use raw `<button>`:

1. `routes/conversations/index.tsx` line 79: "Start New Chat" — raw `<button>` with hand-written Tailwind classes, missing focus ring, no `aria-label`
2. `routes/conversations/$id.tsx` line 137: "Back to conversations" — raw `<button>` link

Both miss the design system's focus rings, size tokens, and variant styles from `components/ui/button.tsx`.

**Action:** Replace with `<Button>` component using appropriate `variant` and `size` props.

**UX impact:** Interaction consistency. Effort: Low (10 min).

### D. Workstreams

#### 10. Deduplicate WorkstreamCard and Detail Shared Code (from original #11)

**Status:** `WorkstreamCard.tsx` (lines 42-99) and `$workstreamId.tsx` (lines 96-113) both define:

- `statusConfig` — identical status-to-color/icon mapping
- `formatDueDate()` — identical date logic
- `getOwnerInitials()` / `getAgentInitials()` — identical initials extraction

**Action:** Move `formatDueDate` into `lib/format.ts`. Extract `statusConfig` and initials helpers into `lib/workstream-utils.ts`.

**UX impact:** Code consistency, single source of truth. Effort: Low.

#### 11. Reduce WorkstreamCard Expanded Variant Weight (from original #12)

**Status:** 457 LOC, ~127 Tailwind classes, 8 motion animation blocks, 3 variants (minimal/compact/expanded).

Expanded variant renders: gradient accent, glow, icon rotation on hover, blur backdrop, progress bar, tag pills with animation, segmented task status bar (5 colored segments), owner card with role, 2 action buttons, dropdown menu.

**Action:** Remove gradient accent and glow. Keep progress bar as primary visual. Move tags to hover tooltip or detail view. Simplify task status to a single summary metric.

**UX impact:** Reduces visual fatigue in lists of 10+ workstreams. Effort: Med.

### E. Navigation & Layout

#### 12. Add Mobile Navigation (from original #13)

**Status:** Sidebar uses `hidden md:flex` in `AppShell.tsx`. Below `md` breakpoint, there is zero navigation. Users on mobile cannot reach any page.

The codebase already has mobile-friendly patterns in settings (`SettingsMobileNav` with horizontal scrolling tabs, `min-h-[44px]` touch targets, gradient fade indicators) that could inform the design.

**Action:** Add a fixed bottom tab bar below `md` (Home, Chat, Approvals, Agents, More) using the existing `Sheet` component for the "More" overflow menu.

**UX impact:** Critical — app is non-functional on mobile without this. Effort: High.

#### 13. Add Breadcrumbs to Remaining Nested Routes (from original #14)

**Status:** Partially done.

- `/agents/$agentId`: Has back button (ArrowLeft), no true breadcrumbs
- `/agents/$agentId/session/$sessionKey`: No breadcrumbs, no explicit back button (SessionHeader handles it)
- `/workstreams/$workstreamId`: Has back button, no true breadcrumbs
- `/conversations/$id`: Back via ChatHeader callback, no breadcrumbs
- `/conversations/$id/agentic`: No back button, no breadcrumbs

**Action:** Wire up `PageHeader` with proper `breadcrumbs` array on all nested routes. Example: `Agents > Agent Name > Session abc123`.

**UX impact:** Orientation in deep views. Effort: Low-Med.

### F. Newly Identified Improvements

#### 14. Increase ErrorState Adoption

**Status:** `ErrorState.tsx` exists with inline/card variants and pre-configured `errorMessages`, but only 4 files use it. 30+ files implement custom error handling with bare text, ad-hoc icons, or no retry button.

Files not using ErrorState that should:

- `TeamAgentGrid.tsx` — text-only "Failed to load agents"
- `RecentMemoriesPanel.tsx` — text-only "Failed to load memories"
- `UpcomingRitualsPanel.tsx` — text-only error
- `routes/jobs/index.tsx` — text-only error
- `routes/conversations/index.tsx` — no error handling
- `routes/index.tsx` (Home) — no error handling
- All home dashboard panels with inline error text

**Action:** Replace ad-hoc error UIs with `<ErrorState>` using appropriate `errorMessages` presets and `onRetry` handlers.

**UX impact:** Trust and recoverability — consistent error UI with clear actions. Effort: Med.

#### 15. Add Skeleton Loading to Home Route and Conversations

**Status:** 10 of 13 routes use skeleton loading properly. Three routes break the pattern:

| Route                            | Current                              | Expected                               |
| -------------------------------- | ------------------------------------ | -------------------------------------- |
| `routes/index.tsx` (Home)        | Blank until data → motion animations | Skeleton grid matching panel layout    |
| `routes/conversations/index.tsx` | No page-level skeleton               | List skeleton for conversation sidebar |
| `routes/jobs/index.tsx`          | Plain text "Loading..."              | `CardSkeleton` or `ListItemSkeleton`   |

**Action:** Add skeleton states matching each route's final layout shape.

**UX impact:** Perceived performance — users see structure immediately instead of blank/text. Effort: Low.

#### 16. Consistent Breadcrumb-style Back Navigation

**Status:** Three different back-navigation patterns coexist:

1. Explicit `ArrowLeft` buttons — agents detail, workstreams detail
2. Component-encapsulated callbacks — conversations (via ChatHeader), session (via SessionHeader)
3. No back navigation — agentic workflow view

**Action:** Standardize on `PageHeader` breadcrumbs for all nested routes. Remove ad-hoc back buttons.

**UX impact:** Navigation predictability. Effort: Low-Med.

---

## Revised Impact Summary

| #   | Improvement                             | Scope                     | Primary UX Benefit               | Effort  |
| --- | --------------------------------------- | ------------------------- | -------------------------------- | ------- |
| 1   | Shared EmptyState component             | All views                 | Pattern recognition, consistency | Med     |
| 2   | Consolidate date formatters (16+ files) | All views                 | Timestamp consistency            | Low     |
| 3   | Adopt PageHeader everywhere             | All views                 | Navigation, visual consistency   | Low-Med |
| 4   | Shared animation variants               | 16+ files                 | DRY, timing consistency          | Low     |
| 5   | Shared status color tokens              | 10+ files                 | Semantic color consistency       | Low     |
| 6   | Reduce AgentCard density                | Agents list               | Scanability, performance         | Med     |
| 7   | Deduplicate agent detail formatters     | Agent detail              | Consistency                      | Low     |
| 8   | Fix mobile conversation layout          | Conversations             | Mobile usability                 | Med     |
| 9   | Replace raw `<button>` elements         | Conversations             | Interaction consistency          | Low     |
| 10  | Deduplicate workstream utils            | Workstreams               | Code/visual consistency          | Low     |
| 11  | Reduce WorkstreamCard weight            | Workstreams list          | Visual fatigue reduction         | Med     |
| 12  | Mobile navigation                       | All views                 | **Critical — broken on mobile**  | High    |
| 13  | Breadcrumbs on nested routes            | Detail views              | Orientation, navigation          | Low-Med |
| 14  | Increase ErrorState adoption            | 30+ files                 | Trust, recoverability            | Med     |
| 15  | Skeleton loading on 3 routes            | Home, conversations, jobs | Perceived performance            | Low     |
| 16  | Consistent back navigation              | Detail views              | Navigation predictability        | Low-Med |

## Bug Fix Summary

| #   | Bug                                      | File                            | Severity | Fix                                      |
| --- | ---------------------------------------- | ------------------------------- | -------- | ---------------------------------------- |
| B1  | Hardcoded fake AI response in production | `conversations/$id.tsx`         | High     | Remove simulated response block          |
| B2  | Missing error boundary                   | `conversations/$id/agentic.tsx` | Medium   | Add `errorComponent: RouteErrorFallback` |
| B3  | Null safety on conversation creation     | `conversations/index.tsx`       | Medium   | Guard `newConversation?.id`              |
| B4  | Demo delay constants                     | `conversations/$id/agentic.tsx` | Low      | Remove or flag as demo code              |
| B5  | Loading state inconsistency              | 3 routes                        | Medium   | Add skeleton loading                     |

## Top Priorities

1. **Bug B1** — Fake AI response in production code (high severity, immediate fix)
2. **#12 Mobile navigation** — App is non-functional on phones
3. **Bug B2/B3** — Missing error boundary + null safety (medium severity)
4. **#2 Date formatter consolidation** — 16 local duplicates + 40 inline calls
5. **#14 ErrorState adoption** — 30+ files with ad-hoc error handling
6. **#1 Shared EmptyState** — Reinvented in every view
