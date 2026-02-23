# Storybook Plan (apps/web)

This repo’s UX plan expects a component sandbox for building and reviewing configuration components in isolation. Storybook is the recommended approach.

This file documents **how a future agent should generate Storybook setup** (autonomously where possible, asking for clarification only when needed).

## Why We Need This

- Review key configuration components without running the whole app.
- Iterate on a11y (keyboard focus, labels, error rendering) and visual regressions.
- Make “doc drift” less likely by turning specs into executable examples.

## Current State (as of 2026-02-01)

- `apps/web/package.json` does not include Storybook dependencies or scripts.
- The docs reference Storybook as a desired deliverable; it must be created.

## Setup Approach (Agent Instructions)

### Step 1: Detect existing setup

Autonomously:
- search for `.storybook/` under `apps/web/`
- search for `storybook` scripts in `apps/web/package.json`

If found, use it. If not, proceed.

### Step 2: Choose the minimum viable Storybook stack

Default recommendation (unless project constraints say otherwise):
- Storybook for React + Vite
- Tailwind integration (reuse app CSS)

Clarifying questions to ask only if needed:
1) Should Storybook live under `apps/web/.storybook/` or as a workspace-level tool?
2) Should we prefer Storybook or a lighter alternative (e.g., Ladle) for faster local iteration?

### Step 3: Initialize

Suggested command (agent can run once approved):
- `pnpm -C apps/web dlx storybook@latest init --builder vite`

### Step 4: Integrate styling and aliases

Autonomously:
- ensure Tailwind styles load (import `apps/web/src/index.css` or equivalent in Storybook preview)
- ensure TS path aliases (`@/…`) resolve (vite/tsconfig alignment)

### Step 5: Add stories for MVP surfaces

Minimum story set:
- `SystemDefaultToggle` variants (inherited/overridden/group/unsupported)
- `FriendlySlider` (presets + disabled + error)
- Provider auth forms (secret masking + error states)
- “Save failed” banner + recovery actions

### Step 6: Document “source of truth”

Storybook stories should link back to:
- `apps/web/ux-opus-design/17-DEPENDENCIES-AND-SHARED-UX-PRIMITIVES.md` (validation/error spec)
- `apps/web/ux-opus-design/COPY.md` (copy source)

