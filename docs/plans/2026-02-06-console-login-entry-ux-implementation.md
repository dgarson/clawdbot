# Console and Login Entry UX - Implementation Plan

**Date:** 2026-02-06
**Source:** `docs/plans/2026-02-06-console-login-entry-ux.md`
**Scope:** `apps/web/` only (React + TanStack Router + shadcn/Tailwind)

This plan breaks the UX spec into concrete, ordered implementation tasks with file-level detail.

---

## Overview of Changes

| #   | Workstream                                           | Key Files                                        | Complexity  |
| --- | ---------------------------------------------------- | ------------------------------------------------ | ----------- |
| 1   | Add `/landing` route (public marketing page)         | New route + component + guard updates            | Medium      |
| 2   | Update guards to skip `/landing`                     | 3 existing files                                 | Low         |
| 3   | Disable gateway auto-connect/streaming on `/landing` | `__root.tsx`                                     | Low         |
| 4   | Update fullscreen route list for `/landing`          | `__root.tsx`                                     | Trivial     |
| 5   | Redesign `/unlock` as "Console Access" page          | `UnlockScreen.tsx` + new components              | Medium-High |
| 6   | Add Beginner/Advanced mode toggle on `/` home        | `useUIStore.ts` already has `powerUserMode`      | Low         |
| 7   | Redesign `/` home page layout                        | `routes/index.tsx` + new/updated home components | High        |
| 8   | Restructure sidebar navigation                       | `Sidebar.tsx`                                    | Medium      |

---

## Workstream 1: Add `/landing` Route (Public Marketing Page)

### Goal

Create a fully public, fullscreen marketing page at `/landing` that works without a Gateway connection. No auth, no unlock, no onboarding redirects.

### Tasks

#### 1.1 Create the route file

- **Create:** `apps/web/src/routes/landing/index.tsx`
- Use `createFileRoute("/landing/")`
- Render a `LandingPage` component

#### 1.2 Create the LandingPage component

- **Create:** `apps/web/src/components/domain/landing/LandingPage.tsx`
- **Create:** `apps/web/src/components/domain/landing/index.ts` (barrel export)
- Fullscreen layout (no AppShell) with:
  - **Hero section:** Headline about Clawdbrain's value proposition, CTA to `/unlock` or `/onboarding`
  - **Feature highlights:** 3-4 cards covering key capabilities (task automation, approvals, agents, memory)
  - **Trust section:** Security/safety bullets (approval gates, clear history, pause anytime)
  - **Footer:** Links to docs, help, getting started
- Responsive: stacked on mobile, multi-column on desktop
- No gateway dependency - all static/client-side content

#### 1.3 Update guards (see Workstream 2)

#### 1.4 Update fullscreen paths (see Workstream 4)

### Dependencies

- None (can be built independently)

---

## Workstream 2: Update Guards to Skip `/landing`

### Goal

Ensure `/landing` bypasses all three guard layers (OnboardingGuard, UnlockGuard, GatewayAuthGuard).

### Tasks

#### 2.1 OnboardingGuard

- **Edit:** `apps/web/src/components/OnboardingGuard.tsx`
- Add `"/landing"` to `SKIP_PATHS` array (line 9-13)
- Before:
  ```ts
  const SKIP_PATHS = ["/onboarding", "/health", "/debug"] as const;
  ```
- After:
  ```ts
  const SKIP_PATHS = ["/onboarding", "/health", "/debug", "/landing"] as const;
  ```

#### 2.2 UnlockGuard (via security-config)

- **Edit:** `apps/web/src/features/security/lib/security-config.ts`
- Add `"/landing"` to `UNLOCK_SKIP_PATHS` array (line 23-28)
- Before:
  ```ts
  export const UNLOCK_SKIP_PATHS = ["/unlock", "/onboarding", "/health", "/debug"] as const;
  ```
- After:
  ```ts
  export const UNLOCK_SKIP_PATHS = [
    "/unlock",
    "/onboarding",
    "/health",
    "/debug",
    "/landing",
  ] as const;
  ```

#### 2.3 GatewayAuthGuard

- The GatewayAuthGuard doesn't have per-path skip logic; it's controlled by the `enabled` prop.
- The `/landing` route will bypass it because the gateway hooks are disabled for `/landing` paths (Workstream 3), and `/landing` is fullscreen so it renders outside the guard chain when properly handled.
- **Alternative approach (simpler):** In `__root.tsx`, move the fullscreen check _above_ the GatewayAuthGuard so fullscreen routes (including `/landing`) skip the guard entirely. This is the cleanest approach.

### Dependencies

- Workstream 1 (route must exist for testing)

---

## Workstream 3: Disable Gateway Auto-Connect + Streaming on `/landing`

### Goal

Prevent gateway WebSocket connections, stream handlers, and event sync from running on `/landing`.

### Tasks

#### 3.1 Update `__root.tsx` guard/hook logic

- **Edit:** `apps/web/src/routes/__root.tsx`
- Add path-based check: if `location.pathname.startsWith("/landing")`, disable gateway hooks
- Modify the `gatewayEnabled` computation:
  ```ts
  const isLandingPage = location.pathname.startsWith("/landing");
  const gatewayEnabled = !isLandingPage && (!isDev || useLiveGateway);
  ```
- This ensures `useGatewayStreamHandler` and `useGatewayEventSync` are disabled on `/landing`
- The GatewayAuthGuard also receives `enabled={gatewayEnabled}`, so it will pass through

#### 3.2 Restructure guard nesting for fullscreen routes

- **Edit:** `apps/web/src/routes/__root.tsx`
- Current nesting: `GatewayAuthGuard → OnboardingGuard → UnlockGuard → (AppShell or Outlet)`
- For fullscreen routes, render `<Outlet />` **before** the guard chain to completely bypass guards:
  ```tsx
  {
    isFullscreen ? (
      <Outlet />
    ) : (
      <GatewayAuthGuard enabled={gatewayEnabled}>
        <OnboardingGuard>
          <UnlockGuard>
            <AppShell>
              <Outlet />
            </AppShell>
          </UnlockGuard>
        </OnboardingGuard>
      </GatewayAuthGuard>
    );
  }
  ```
- **Important:** `/unlock` and `/onboarding` still need the SecurityProvider context (they access `useSecurity()`), so they must remain inside providers but outside guards. The SecurityProvider is in `main.tsx`, not in `__root.tsx`, so this is safe.

### Dependencies

- Workstream 2 (guard skip paths as fallback safety)

---

## Workstream 4: Update Fullscreen Route List

### Goal

Add `/landing` to `FULLSCREEN_PATHS` so it renders without AppShell.

### Tasks

#### 4.1 Update FULLSCREEN_PATHS

- **Edit:** `apps/web/src/routes/__root.tsx`
- Before:
  ```ts
  const FULLSCREEN_PATHS = ["/onboarding", "/unlock"] as const;
  ```
- After:
  ```ts
  const FULLSCREEN_PATHS = ["/onboarding", "/unlock", "/landing"] as const;
  ```

### Dependencies

- None

---

## Workstream 5: Redesign `/unlock` as "Console Access" Page

### Goal

Transform the current minimal unlock card into a 2-column "Console Access" page with connection help, unlock form, troubleshooting, and a link to `/landing`.

### Tasks

#### 5.1 Create new Console Access layout

- **Edit:** `apps/web/src/features/security/components/unlock/UnlockScreen.tsx`
- Replace the current single-card centered layout with a 2-column desktop layout:
  - **Left column (education + trust):**
    - Headline: "Open your console"
    - Subhead: "Connect, unlock, and pick up where you left off--without losing control of what runs."
    - Trust bullets: approval gates, clear history, pause/stop anytime
    - "See the full tour" link to `/landing`
  - **Right column (action):**
    - Stepper UI: Connect -> Unlock -> Enter Console
    - Connection status + Gateway URL (editable)
    - Unlock form (existing `UnlockForm` + `TwoFactorVerify`)
    - "Start with guided setup" CTA linking to `/onboarding`

#### 5.2 Create ConnectionStep component

- **Create:** `apps/web/src/features/security/components/unlock/ConnectionStep.tsx`
- Shows Gateway URL (editable input)
- Connection status indicator (connected/disconnected/connecting)
- "How to start the Gateway" collapsible inline help
- "Troubleshoot" drawer/accordion with common issues:
  - Wrong URL/port
  - Gateway not running
  - Auth required
  - Network issues

#### 5.3 Create StepIndicator component

- **Create:** `apps/web/src/features/security/components/unlock/StepIndicator.tsx`
- Visual stepper: Connect -> Unlock -> Enter Console
- Highlights current step, shows completed steps with checkmark

#### 5.4 Mobile layout

- Stacked sections with action first:
  1. Connection + unlock actions
  2. "Why Clawdbrain" summary
  3. "Tour" link + help links
- Use Tailwind responsive classes (`md:grid-cols-2`, etc.)

### Dependencies

- Workstream 1 (for `/landing` link)
- Uses existing `UnlockForm`, `TwoFactorVerify` components (no changes needed)

---

## Workstream 6: Add Beginner/Advanced Mode Toggle

### Goal

Expose the existing `powerUserMode` toggle on the home page header and/or user menu, with clear labeling.

### Tasks

#### 6.1 Existing infrastructure

- **Already exists:** `useUIStore.ts` has `powerUserMode: boolean` and `setPowerUserMode()` action
- **Already exists:** `Sidebar.tsx` conditionally shows "Power User" section based on `powerUserMode`
- No store changes needed

#### 6.2 Create BeginnerAdvancedToggle component

- **Create:** `apps/web/src/components/composed/ModeToggle.tsx`
- Small toggle switch with labels "Simple" / "Advanced" (or icon-based)
- Reads/writes `powerUserMode` from `useUIStore`
- Compact design suitable for placement in home header or user menu

#### 6.3 Place the toggle

- **Edit:** `apps/web/src/routes/index.tsx` (home page)
- Add the toggle to the header strip (top-right of greeting area)
- Also consider adding to sidebar footer or settings

### Dependencies

- None (store already supports this)

---

## Workstream 7: Redesign `/` Home Page Layout

### Goal

Transform the home page from a dashboard grid into an outcome-oriented console with: primary composer, suggested starters, recent work, and approvals inbox.

### Tasks

#### 7.1 Restructure home page layout

- **Edit:** `apps/web/src/routes/index.tsx`
- New layout structure:
  - **Top strip:** Greeting + date + status indicator (gateway, unlock, pending approvals) + mode toggle
  - **Primary action:** "Start a task" composer (enhanced QuickChatBox)
  - **Suggested starters:** 6-9 outcome tiles (Beginner mode only or always visible)
  - **Recent work:** 3 recent items with "Resume" + "View all" (workstreams/conversations)
  - **Approvals inbox card:** Prominent card when there are pending approvals
  - **Dashboard panels:** TeamAgentGrid, GoalProgress, etc. (shown in Advanced mode, or below the fold)

#### 7.2 Enhance QuickChatBox as primary composer

- **Edit:** `apps/web/src/components/domain/home/QuickChatBox.tsx`
- Add rotating placeholder suggestions ("Plan a trip", "Write a proposal", "Research competitors")
- Optional "What will you deliver?" field (collapsed by default, advanced)
- Make it visually prominent (larger, centered)

#### 7.3 Create SuggestedStarters component

- **Create:** `apps/web/src/components/domain/home/SuggestedStarters.tsx`
- 6-9 outcome-oriented tiles: "Research", "Draft", "Plan", "Automate", "Review", "Summarize"
- Each tile opens a guided prompt (2-3 questions + "Run" button)
- Grid layout: 3 columns on desktop, 2 on tablet, 1 on mobile

#### 7.4 Create RecentWork component

- **Create:** `apps/web/src/components/domain/home/RecentWork.tsx`
- Show 3 most recent items (workstreams or conversations)
- Each item has: title, timestamp, status, "Resume" action button
- "View all" link that navigates to `/conversations` or `/workstreams`

#### 7.5 Create ApprovalsInbox component

- **Create:** `apps/web/src/components/domain/home/ApprovalsInbox.tsx`
- Prominent card (impossible to miss) when there are pending approvals
- Shows count of pending approvals
- Click navigates to approvals surface
- Uses existing approval query hooks

#### 7.6 Create StatusIndicator component

- **Create:** `apps/web/src/components/domain/home/StatusIndicator.tsx`
- Small inline indicator showing: gateway connection status, unlock state, pending approvals count
- Placed in the top strip next to greeting

#### 7.7 Conditional layout based on mode

- In Beginner mode (default, `!powerUserMode`):
  - Emphasize: composer, starters, recent work, approvals
  - De-emphasize: TeamAgentGrid, GoalProgress, Rituals, Memories
- In Advanced mode (`powerUserMode`):
  - Show all panels including agent chooser, toolset, memory scope
  - Show richer dashboards and quick links

#### 7.8 Update home barrel export

- **Edit:** `apps/web/src/components/domain/home/index.ts`
- Add exports for new components

### Dependencies

- Workstream 6 (mode toggle)
- Existing query hooks for approvals, workstreams, conversations

---

## Workstream 8: Restructure Sidebar Navigation

### Goal

Reorganize the sidebar to match the recommended IA grouping from the UX spec.

### Tasks

#### 8.1 Restructure navigation groups

- **Edit:** `apps/web/src/components/layout/Sidebar.tsx`
- New grouping:
  - **Primary nav (always visible):**
    - Home (`/`)
    - Chat (`/conversations`) - relabeled from "Conversations" for simplicity
    - Approvals (new entry point - route TBD, could be `/approvals` or a modal)
    - Activity (work history - could link to `/workstreams` or new `/activity` route)
  - **Explore section (collapsed by default in Beginner mode):**
    - Agents (`/agents`)
    - Workstreams (`/workstreams`)
    - Automations (`/automations`)
    - Goals (`/goals`)
    - Memories (`/memories`)
    - Nodes (`/nodes`)
  - **Power User section (hidden unless `powerUserMode`):**
    - Debug (`/debug`)
    - Graph (`/debug/graph`)
    - Filesystem (`/filesystem`)
    - Jobs (`/jobs`)
  - **Bottom nav (unchanged):**
    - Agent Sessions Indicator
    - Gateway Status Indicator
    - Workspace Switcher
    - Settings + Connections

#### 8.2 Progressive disclosure in Beginner mode

- In Beginner mode (`!powerUserMode`):
  - "Explore" section collapsed by default
  - Primary nav emphasizes outcomes (Home, Chat, Approvals, Activity)
  - Visually de-emphasize "Explore" items (lighter text weight or smaller icons)
- In Advanced mode (`powerUserMode`):
  - "Explore" section expanded by default
  - "Power User" section visible and expanded

#### 8.3 Rename "Conversations" to "Chat"

- **Edit:** `apps/web/src/components/layout/Sidebar.tsx`
- Change label from "Conversations" to "Chat" for non-power users
- The route `/conversations` stays the same

#### 8.4 Add "Approvals" and "Activity" nav items

- Add Approvals entry to primary nav (uses `ShieldCheck` or `CheckCircle` icon)
- Add Activity entry to primary nav (uses `Activity` or `Clock` icon)
- Route targets: `/approvals` (if route exists) or fallback to relevant section

#### 8.5 Merge "Your Brain" + "Team" into "Explore"

- Current separate sections "Your Brain" (Goals, Memories, You) and "Team" (Agents, Agent Status, Workstreams, Rituals, Automations) merge into a single "Explore" section
- Remove "Agent Status" from primary explore (keep in Power User or as a sub-nav of Agents)
- Move "You" to Settings or keep in Explore
- Move "Rituals" into Explore

### Dependencies

- Workstream 6 (mode toggle for conditional display)

---

## Implementation Order (Recommended)

The workstreams have minimal inter-dependencies. Recommended order:

```
Phase 1 - Foundation (can be parallel):
  [4] Update FULLSCREEN_PATHS         (trivial, 1 line)
  [2] Update guard skip paths          (low, 3 lines across 2 files)
  [3] Disable gateway on /landing      (__root.tsx restructure)
  [6] Beginner/Advanced toggle         (new component + store already exists)

Phase 2 - New surfaces:
  [1] Create /landing route + page     (new route + marketing components)
  [5] Redesign /unlock                 (new layout + ConnectionStep + Stepper)

Phase 3 - Console redesign:
  [7] Redesign / home page             (new components + layout restructure)
  [8] Restructure sidebar              (navigation IA changes)
```

Phase 1 items are independent and can all be done in parallel. Phase 2 items depend on Phase 1. Phase 3 depends on Phase 1 (specifically the mode toggle).

---

## Files Changed Summary

### New Files

| File                                                                  | Purpose                         |
| --------------------------------------------------------------------- | ------------------------------- |
| `apps/web/src/routes/landing/index.tsx`                               | `/landing` route definition     |
| `apps/web/src/components/domain/landing/LandingPage.tsx`              | Marketing/tour page             |
| `apps/web/src/components/domain/landing/index.ts`                     | Barrel export                   |
| `apps/web/src/components/composed/ModeToggle.tsx`                     | Beginner/Advanced toggle        |
| `apps/web/src/components/domain/home/SuggestedStarters.tsx`           | Outcome-oriented starter tiles  |
| `apps/web/src/components/domain/home/RecentWork.tsx`                  | Recent work with Resume actions |
| `apps/web/src/components/domain/home/ApprovalsInbox.tsx`              | Pending approvals card          |
| `apps/web/src/components/domain/home/StatusIndicator.tsx`             | Gateway/unlock/approvals status |
| `apps/web/src/features/security/components/unlock/ConnectionStep.tsx` | Gateway connection step         |
| `apps/web/src/features/security/components/unlock/StepIndicator.tsx`  | Visual stepper UI               |

### Modified Files

| File                                                                | Change                                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/web/src/routes/__root.tsx`                                    | Add `/landing` to FULLSCREEN_PATHS, disable gateway on landing, restructure guard nesting |
| `apps/web/src/components/OnboardingGuard.tsx`                       | Add `/landing` to SKIP_PATHS                                                              |
| `apps/web/src/features/security/lib/security-config.ts`             | Add `/landing` to UNLOCK_SKIP_PATHS                                                       |
| `apps/web/src/features/security/components/unlock/UnlockScreen.tsx` | 2-column Console Access redesign                                                          |
| `apps/web/src/routes/index.tsx`                                     | Outcome-oriented home layout with mode support                                            |
| `apps/web/src/components/domain/home/QuickChatBox.tsx`              | Enhanced composer with rotating placeholders                                              |
| `apps/web/src/components/domain/home/index.ts`                      | Add new component exports                                                                 |
| `apps/web/src/components/layout/Sidebar.tsx`                        | New IA grouping, progressive disclosure                                                   |
| `apps/web/src/components/composed/ModeToggle.tsx`                   | (new)                                                                                     |

### Unchanged Files (no modifications needed)

| File                                                                       | Reason                                   |
| -------------------------------------------------------------------------- | ---------------------------------------- |
| `apps/web/src/stores/useUIStore.ts`                                        | `powerUserMode` already exists and works |
| `apps/web/src/features/security/components/unlock/UnlockForm.tsx`          | Reused as-is inside new layout           |
| `apps/web/src/features/security/components/two-factor/TwoFactorVerify.tsx` | Reused as-is inside new layout           |
| `apps/web/src/components/layout/AppShell.tsx`                              | No changes needed                        |
| `apps/web/src/providers/GatewayProvider.tsx`                               | No changes needed                        |

---

## Testing Strategy

- **Guard tests:** Verify `/landing` path is skipped by all guards
- **Fullscreen test:** Verify `/landing` renders without AppShell
- **Gateway isolation:** Verify no WebSocket connections on `/landing`
- **Mode toggle:** Verify `powerUserMode` toggle persists and affects home + sidebar
- **Unlock flow:** Verify 2-step (connect + unlock) flow works, stepper advances correctly
- **Home layout:** Verify beginner vs advanced mode shows correct panels
- **Responsive:** Verify mobile layouts for `/unlock` (stacked) and `/landing` (fullscreen)
- **Navigation:** Verify sidebar grouping matches spec for both modes

---

## Open Questions / Decisions Needed

1. **Approvals route:** Does `/approvals` exist as a route, or should the sidebar link to a section within an existing page?
2. **Activity route:** Should we create `/activity` or link to `/workstreams`?
3. **Starter tile guided prompts:** How complex should the guided prompt UI be? Simple modal with 2-3 inputs, or a multi-step wizard?
4. **Command palette (`Cmd+K`):** The spec mentions it for power users - is this already implemented, or is it a separate workstream?
5. **"You" page:** Keep in Explore section or move to Settings?
