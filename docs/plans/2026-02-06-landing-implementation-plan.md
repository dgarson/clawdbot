# Landing Page Implementation Plan

**Date:** 2026-02-06
**Branch:** `claude/plan-ui-ux-improvements-YwGBy`
**Applies to:** `apps/web/*` (TanStack Router, Tailwind CSS 4, shadcn/ui)

This plan synthesizes the four design documents into a phased implementation roadmap:

- `2026-02-06-landing-design-system.md` (tokens, components, content rhythm)
- `2026-02-06-landing-route-page-ux.md` (page structure and content)
- `2026-02-06-landing-trust-accessibility.md` (safety messaging, a11y)
- `2026-02-06-landing-motion-performance.md` (animations, perf optimization)

---

## Overview

The `/landing` page is a **public product tour** that renders without Gateway connection, unlock, or onboarding guards. It follows a deliberate narrative arc: **value → proof → how it works → safety → breadth → reassurance → CTA**.

---

## Phase 1: Infrastructure (Route, Guards, Theme Scoping)

### 1.1 — Create the `/landing` route

- Create `apps/web/src/routes/landing/index.tsx`
- Use `createFileRoute("/landing")` with TanStack Router
- Renders a single `<LandingPage />` component that composes all sections

### 1.2 — Bypass all guards for `/landing`

- In `apps/web/src/routes/__root.tsx`:
  - Add `"/landing"` to `FULLSCREEN_PATHS` (skips AppShell)
  - Check for `/landing` before entering the guard chain (GatewayAuthGuard, OnboardingGuard, UnlockGuard) and render `<Outlet />` directly
- In `apps/web/src/components/OnboardingGuard.tsx`: add `/landing` to `SKIP_PATHS`
- In `apps/web/src/features/security/components/unlock/UnlockGuard.tsx`: add `/landing` to skip logic

### 1.3 — Scoped landing theme CSS (Option B)

- Create `apps/web/src/routes/landing/landing-theme.css`
- Define `.landing-theme` wrapper class with:
  - Overridden CSS variables (slightly cooler/indigo-shifted for brand differentiation)
  - Landing-specific decorative tokens: `--lp-aurora`, `--lp-mesh`, `--lp-glow`, `--lp-glass-bg`, `--lp-glass-border`
- Import this CSS in the landing route
- Wrap the landing page root `<div>` with `className="landing-theme"`

### 1.4 — Landing-specific animation keyframes

- In the same CSS file, define:
  - `@keyframes lp-float` — slow transform drift for floating cards
  - `@keyframes lp-aurora-drift` — slow transform shift for background pseudo-element
  - `[data-reveal]` / `[data-reveal="visible"]` transition styles for scroll reveals
  - All wrapped in `@media (prefers-reduced-motion: reduce)` to disable

---

## Phase 2: Reusable Section Primitives

All primitives live in `apps/web/src/routes/landing/components/`.

### 2.1 — `LandingSection`

- Wrapper component for consistent section rhythm
- Props: `id` (for anchor nav), `className`, `alternate` (toggle background surface), `children`
- Applies: `py-16 sm:py-20 lg:py-24`, `px-4 sm:px-6 lg:px-8`, `max-w-6xl mx-auto`
- When `alternate=true`: applies `bg-card/50` surface variant

### 2.2 — `LandingSectionHeader`

- Standardized section header block
- Props: `label?`, `headline`, `subhead?`, `learnMoreHref?`, `learnMoreLabel?`
- Typography: h2 for headline, body for subhead
- Applies `gap-3` spacing between elements

### 2.3 — `LandingCard` variants

- **Standard**: `bg-card border border-border rounded-xl p-6`
- **Elevated**: adds `shadow-lg`
- **Glass**: uses `--lp-glass-bg` and `--lp-glass-border`, with `backdrop-filter: blur(12px)` guarded by `@supports` and fallback to standard card

### 2.4 — `LandingButton`

- Extends shadcn `Button` with:
  - Primary variant with glow pseudo-element (`::before` with `--lp-glow`)
  - Hover: `translateY(-1px)` + glow opacity increase (transform-only)
  - Focus visible styles

### 2.5 — `StatusChip`

- Small status indicator for timeline/mock entries
- Variants: `done` (`--success`), `in-progress` (`--primary`), `waiting` (`--warning`)
- Always includes icon + label text (never color-only)

### 2.6 — `DeliverablePreviewCard`

- Glass card showing a realistic product artifact
- Contains: title, heading+bullet excerpt, metadata line, "View example" action

---

## Phase 3: Core Page Sections (Top Half)

### 3.1 — `LandingHeader` (sticky nav)

- Translucent sticky header with subtle border-bottom
- Left: Clawdbrain wordmark (links to `/landing` top)
- Middle (desktop): 4 anchor links — "How it works", "Safety", "Capabilities", "FAQ"
- Right: Primary CTA "Open Console" → navigates to `/`
- Mobile: collapse anchors into a Sheet/drawer
- "Skip to content" link on `:focus`

### 3.2 — `HeroSection`

- **Headline**: "Your work moves forward—even when you step away"
- **Subhead**: "Turn an idea into a plan, a draft, or a decision-ready summary. You stay in control of anything sensitive."
- **CTA row**: Primary "Open Console" + Secondary "Watch a quick tour"
- **Trust microline**: 3 small bullets — "Approvals for sensitive actions", "Pause anytime", "Clear activity history"
- **Visual**: `DeliverablePreviewCard` with "Competitor research summary"
- **Background**: Static aurora gradient + optional slow transform drift
- **Decorative**: 2-3 floating cards with keyframe float loops

### 3.3 — `HowItWorksSection`

- 3 cards in responsive grid (`grid-cols-1 md:grid-cols-3`)
  1. **Connect** — "Link the places you already work (files, messages, tools)."
  2. **Set guardrails** — "Choose what needs approval and what can run automatically."
  3. **Review and ship** — "Get drafts and decisions ready to send, publish, or schedule."
- Expandable "See advanced options" per card
- Anchored as `id="how-it-works"`

### 3.4 — `PersonalizationSection`

- Headline + body paragraph about adaptive learning
- Profile-style card with neutral preference labels
- "See what's remembered" drill-in link

### 3.5 — `AlwaysOnSection`

- Headline + subhead about continuous progress
- Timeline/activity feed mock with `StatusChip` entries
- "View activity history" drill-in link

### 3.6 — `ControlSection`

- Headline + body about autonomy with supervision
- Dashboard mock: approval gates, pause toggle, activity log
- Anchored as `id="safety"`

---

## Phase 4: Remaining Sections (Bottom Half)

### 4.1 — `CapabilitiesSection` (bento grid)

- 6 tiles in `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
  1. Research and compare
  2. Draft and refine
  3. Plan and break down work
  4. Keep context
  5. Automate safe chores
  6. Integrate where you work
- Anchored as `id="capabilities"`

### 4.2 — `ExamplesSection`

- 3-up grid with `DeliverablePreviewCard` instances
  1. "Competitive summary"
  2. "Draft ready to send (approval required)"
  3. "Weekly status brief"
- "See how this is made" expandable drawer per card

### 4.3 — `FAQSection`

- 8-question accordion (shadcn Accordion / Radix)
- Anchored as `id="faq"`

### 4.4 — `SocialProofSection`

- 2-3 short testimonial cards with concrete deliverable mentions

### 4.5 — `FinalCTASection`

- Full-width, headline + large centered CTA

### 4.6 — `LandingFooter`

- Compact footer with anchor links, Open Console, optional docs link

---

## Phase 5: Motion & Performance

### 5.1 — `useRevealOnScroll` hook

- IntersectionObserver for `[data-reveal]` elements; reveal once, then unobserve
- Reduced motion: immediately set all to visible

### 5.2 — `useParallaxLite` hook (optional, desktop only)

- Enabled only on pointer:fine + wide viewport + no reduced-motion
- rAF-throttled, IntersectionObserver-gated

### 5.3 — Aurora background

- Static gradient stack as default; optional pseudo-element drift (20-40s)

### 5.4 — Floating card animations

- CSS keyframe loops with varied duration/phase per card

### 5.5 — Performance optimizations

- `content-visibility: auto` on below-the-fold sections
- `contain: layout paint` on large sections
- Glass limited to 2 elements max, with `@supports` fallback

---

## Phase 6: Accessibility & Polish

### 6.1 — Semantic structure

- Single `<h1>`, proper heading hierarchy, landmark roles, `<nav>`, `<main>`

### 6.2 — Keyboard navigation

- All elements Tab-reachable, skip-to-content link, accordion keyboard support

### 6.3 — Reduced motion

- All motion disabled via CSS media query + JS `matchMedia`

### 6.4 — Color and contrast

- No color-only info, glass fallback for readability

### 6.5 — Touch targets

- Minimum 44x44px for all interactive elements

---

## File Structure

```
apps/web/src/routes/landing/
  index.tsx                     # Route definition
  landing-theme.css             # Scoped theme + decorative tokens + keyframes
  LandingPage.tsx               # Composes all sections
  components/
    LandingHeader.tsx           # Sticky nav + mobile menu
    LandingSection.tsx          # Reusable section wrapper
    LandingSectionHeader.tsx    # Label + headline + subhead
    LandingCard.tsx             # Standard / Elevated / Glass card variants
    LandingButton.tsx           # Primary w/ glow + secondary
    StatusChip.tsx              # Done / In progress / Waiting chips
    DeliverablePreviewCard.tsx  # Proof artifact card
    HeroSection.tsx
    HowItWorksSection.tsx
    PersonalizationSection.tsx
    AlwaysOnSection.tsx
    ControlSection.tsx
    CapabilitiesSection.tsx
    ExamplesSection.tsx
    FAQSection.tsx
    SocialProofSection.tsx
    FinalCTASection.tsx
    LandingFooter.tsx
  hooks/
    useRevealOnScroll.ts
    useParallaxLite.ts
    useReducedMotion.ts
```

## Key Architectural Decisions

| Decision          | Choice                                            | Rationale                                       |
| ----------------- | ------------------------------------------------- | ----------------------------------------------- |
| Theme approach    | Option B (scoped `.landing-theme`)                | Brand differentiation without touching console  |
| Guard bypass      | Check pathname before guard chain in `__root.tsx` | Clean separation; `/landing` never hits gateway |
| Animation library | CSS keyframes + vanilla hooks                     | Self-contained; avoids extra bundle cost        |
| Glass fallback    | `@supports` + higher-opacity solid bg             | Readability on all browsers                     |
| Parallax          | Desktop-only, rAF-throttled, opt-in               | Progressive enhancement over keyframe floats    |
| Accordion (FAQ)   | shadcn Accordion (Radix)                          | Already in project, accessible OOTB             |
| Mobile nav        | shadcn Sheet                                      | Already in project, handles focus trap          |
