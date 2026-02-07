# Landing and Access Surfaces: Design System Notes (Tokens, Components, Content Rhythm)

**Date:** 2026-02-06  
**Applies to:** `apps/web/*` (Tailwind v4 + shadcn tokens)

This document defines a design system layer for:

- `/landing` (public product tour)
- `/unlock` (console access screen)

The goal is “premium but calm”: non-power users feel safe and oriented; power users feel speed and precision.

---

## 1) Guiding principles

1. **Clarity beats cleverness.** Headlines describe outcomes, not metaphors.
2. **One primary action per viewport.** Secondary actions exist but never compete visually.
3. **Progressive disclosure.** Advanced details are available without being demanded.
4. **Motion is subordinate to readability.** Use it to guide attention, not to decorate.

---

## 2) Theming approach (avoid global token collisions)

`apps/web` already uses CSS variables (`--background`, `--foreground`, `--primary`, etc.) and Tailwind maps them to utilities.

For `/landing` and `/unlock`, prefer one of these approaches:

### Option A (recommended): reuse existing theme variables

Pros: consistent across console and marketing, minimal CSS.  
Cons: less ability to “brand” `/landing` separately.

### Option B: scoped “landing theme” wrapper (best for brand variation)

Wrap the landing route in a container class (e.g., `.landing-theme`) and override a small subset of variables inside that scope:

- `--background`, `--card`, `--border`
- `--primary`, `--accent`, `--ring`
- optionally `--success` and `--warning` for status chips

This keeps the rest of the console untouched.

Example (illustrative — tune values to match the desired brand):

```css
/* Apply on the /landing root container (and optionally on /unlock) */
.landing-theme {
  /* Dark, slightly cool neutral base */
  --background: oklch(0.12 0.02 270);
  --foreground: oklch(0.96 0.01 270);

  --card: oklch(0.16 0.02 270);
  --card-foreground: oklch(0.96 0.01 270);

  --border: oklch(0.24 0.02 270);
  --ring: oklch(0.7 0.18 275);

  /* Primary accent (indigo-ish) */
  --primary: oklch(0.7 0.18 275);
  --primary-foreground: oklch(0.12 0.02 270);

  /* Secondary accent (violet-ish) */
  --accent: oklch(0.68 0.16 305);
  --accent-foreground: oklch(0.96 0.01 270);

  /* Semantic accents used for chips/status */
  --success: oklch(0.7 0.16 170);
  --warning: oklch(0.78 0.14 85);
}
```

---

## 3) Landing-specific decorative tokens (small, scoped set)

Even if you reuse the app theme, `/landing` benefits from a few dedicated tokens for gradients and glows. Keep them scoped to `.landing-theme`.

Suggested token set:

- `--lp-aurora`: background radial/linear gradient mix (static)
- `--lp-mesh`: subtle overlay gradient (static or transform-only drift)
- `--lp-glow`: color used for a single soft glow effect (use sparingly)
- `--lp-glass-bg`: translucent background for “glass” cards
- `--lp-glass-border`: slightly brighter border for “glass” cards

Usage constraints:

- At most one glow-heavy element per viewport.
- Never animate `filter` or `backdrop-filter`.

Example tokens (scoped):

```css
.landing-theme {
  --lp-aurora:
    radial-gradient(
      80% 60% at 50% -10%,
      color-mix(in oklab, var(--primary) 35%, transparent) 0%,
      transparent 70%
    ),
    radial-gradient(
      60% 50% at 10% 30%,
      color-mix(in oklab, var(--accent) 25%, transparent) 0%,
      transparent 70%
    );
  --lp-mesh: linear-gradient(
    135deg,
    color-mix(in oklab, var(--primary) 10%, transparent),
    transparent 60%
  );
  --lp-glow: color-mix(in oklab, var(--primary) 40%, transparent);
  --lp-glass-bg: color-mix(in oklab, var(--card) 70%, transparent);
  --lp-glass-border: color-mix(in oklab, var(--border) 60%, white 10%);
}
```

---

## 4) Typography: “short lines, strong hierarchy”

### Default typography rules

- Body text line length: **60–75 characters** on desktop.
- Paragraph rhythm: 16–20px base size; 1.6–1.8 line-height.
- Use 1–2 lines for section intros. If it needs more, split into bullets.

### Suggested type scale (Tailwind-friendly)

- `h1`: `text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight`
- `h2`: `text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight`
- `h3`: `text-lg sm:text-xl font-semibold`
- Body: `text-base sm:text-lg text-muted-foreground leading-relaxed`
- Small: `text-sm text-muted-foreground`

### Emphasis

- Prefer **weight** over color shifts for emphasis.
- Avoid large blocks of italic text (harder for many readers).

---

## 5) Layout system: consistent section rhythm

### Max width + gutters

- Max content width: `max-w-6xl` (or similar)
- Horizontal padding: `px-4 sm:px-6 lg:px-8`

### Section rhythm

Use predictable spacing:

- Section padding: `py-16 sm:py-20 lg:py-24`
- Header gap: `gap-3` between label → headline → subhead
- Card grids: `gap-4 sm:gap-6`

### “Alternating surfaces”

Alternate background surfaces to keep scroll engaging without heavy effects:

- Section A: `bg-background`
- Section B: `bg-card/50` (or a subtle gradient)

---

## 6) Component patterns (landing + access)

### Buttons

**Primary button**

- High contrast, large hit area
- Include an icon only if it clarifies (“ArrowRight” is fine)
- Hover: small translateY + subtle shadow (transform only)

**Secondary button**

- Outline or “ghost” style
- Must remain readable on dark backgrounds

**Rules**

- Always include visible focus styles
- Avoid hover-only affordances; states must work on touch

Glow recipe (static, or opacity-only animation):

```css
.lp-primary-button {
  position: relative;
  isolation: isolate;
}

.lp-primary-button::before {
  content: "";
  position: absolute;
  inset: -10px;
  z-index: -1;
  border-radius: inherit;
  background: radial-gradient(circle at 50% 50%, var(--lp-glow), transparent 60%);
  opacity: 0.6;
  transition: opacity 150ms ease-out;
}

.lp-primary-button:hover::before {
  opacity: 0.9;
}
```

### Cards

Card variants:

1. **Standard card**: `bg-card border border-border rounded-xl`
2. **Elevated card**: adds soft shadow (static)
3. **Glass card**: translucent background; blur optional and guarded

Glass fallback rule:

- If `backdrop-filter` unsupported or user prefers reduced transparency, render as Standard card.

### Chips / badges

Use chips to communicate status in timeline and control mock:

- Done: uses `--success`
- In progress: uses `--primary`
- Waiting for approval: uses `--warning`

Do not rely on color alone: include icon or label text.

### Section header block

Standardize a reusable header:

- Optional label (small caps)
- Headline
- Subhead
- Optional “Learn more” link (for power users)

### Deliverable preview

This is the hero’s “proof artifact”.

Must include:

- Title (“Competitive summary”)
- 2–3 headings with bullets
- A small metadata line (“Updated 4 minutes ago • Ready for review”)
- A “View example” action (scroll or modal)

---

## 7) Content style guide (non-power-user friendly)

### Preferred language patterns

- Use verbs that describe outcomes: “Draft”, “Compare”, “Plan”, “Review”.
- Use “you” to keep it personal, but avoid manipulative hype.
- When describing autonomy, always pair it with control (“runs, then waits for approval”).

### Avoid

- “Magic” phrasing that implies unbounded capability.
- Unverifiable security promises.
- Jargon without an inline explanation (e.g., “workstreams” should have a tooltip the first time).

---

## 8) Accessibility defaults (design-level)

- Minimum target size: 44×44px for touch targets.
- Visible focus rings on all interactive elements.
- Heading order must be semantic (don’t skip levels for sizing).
- For any rotating/changing text, ensure screen readers have a stable equivalent.

---

## 9) Implementation checklist (design-system layer)

- Decide: Option A (reuse theme) vs Option B (scoped landing theme).
- Create a small landing CSS module or a scoped CSS block that defines:
  - `--lp-aurora`, `--lp-mesh`, `--lp-glass-*`, `--lp-glow`
- Implement reusable section primitives:
  - `LandingSection`
  - `LandingSectionHeader`
  - `DeliverablePreviewCard`
  - `HowItWorksCard`
