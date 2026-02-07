# Trust, Safety, and Accessibility for Landing and Console Entry

**Date:** 2026-02-06  
**Applies to:** `/landing`, `/unlock`, and the console home entry patterns

This document defines how we communicate safety and control honestly, and how we keep the experience accessible and welcoming to non-power users without hiding power-user depth.

---

## 1) Trust strategy: show control, not bravado

Users are increasingly skeptical of autonomous systems. The fastest trust builder is not “we’re secure”; it’s:

1. Clear boundaries (what can happen automatically)
2. Clear approvals (what waits for you)
3. Clear history (what happened and why)
4. Clear stop switch (pause/stop everything)

Design implication: trust is a **product affordance**, not a paragraph.

---

## 2) Claims policy (avoid risky wording)

### Avoid unless strictly verified

- “End-to-end encrypted”
- “Zero access”
- “Cannot be accessed by anyone”

### Prefer precise, user-meaningful language (only if true)

- “Encrypted in transit and at rest”
- “You choose what requires approval”
- “You can pause automation instantly”
- “Actions are recorded in an activity history”

If a claim is aspirational, label it as such (e.g., “Planned”, “In development”) or remove it.

---

## 3) Safety UX patterns (non-power-user friendly)

### A) Approval presets (human-readable)

Offer 3 presets, each expandable to show exact rules:

- **Conservative:** approvals for anything external, destructive, or irreversible
- **Standard:** approvals for external + sensitive; internal drafts can run
- **Autopilot (safe-only):** runs safe tasks automatically; still blocks high-risk actions

Power user drill-in: show the rule list and allow editing.

### B) Approvals inbox (central)

Make approvals impossible to miss:

- Badge count in top nav
- Home card that appears when approvals exist
- “Snooze” options with clear consequences (not hidden)

### C) Pause and stop (big, obvious)

Add a global “Pause automation” control in:

- Console header (or settings quick menu)
- `/unlock` access screen (where relevant)

### D) Activity history that answers “why”

Every entry should include:

- What happened
- When it happened
- Why it happened (trigger)
- What it touched (scope)

---

## 4) Privacy messaging (keep it calm and specific)

Non-power users don’t want a privacy manifesto; they want to know:

- What data is used to do the work
- Where it lives
- How to remove it
- What happens when they disconnect

Recommended UI pattern (landing FAQ + console settings):

- “What Clawdbrain stores” (short list)
- “What Clawdbrain does not store” (short list)
- “Delete / export” actions (clear)

Power user drill-in:

- Per-integration scopes
- Per-agent memory scope settings
- Retention controls (if supported)

---

## 4.1) FAQ answer templates (ready-to-use copy patterns)

These are templates you can reuse on `/landing` (FAQ) and `/unlock` (help drawer). Keep answers short and action-oriented.

### “What runs automatically?”

Clawdbrain can run safe, reversible work automatically (like drafts and summaries). Anything sensitive—sending messages, making purchases, deleting data, or acting in external systems—should be gated behind approvals based on your settings.

**Learn more:** Approval presets → (console link)

### “How do approvals work?”

When an action needs approval, Clawdbrain prepares the work and then pauses. You’ll see exactly what it wants to do and why, and you can approve, edit, or reject.

### “What data is stored?”

Only store what you choose to store. You can keep the system in a “minimal memory” mode, or you can allow it to save preferences and summaries to reduce repetition. You should be able to review and delete saved items at any time.

### “What happens if I disconnect the Gateway?”

If the Gateway is disconnected, Clawdbrain cannot continue tasks that require it. The console should show a clear “Disconnected” state and preserve your in-progress work so you can resume when reconnected.

---

## 5) Accessibility requirements (must-have, not polish)

### Keyboard and focus

- Every interactive element is reachable via keyboard.
- Focus is visible and not overridden by custom styles.
- No “hover-only” interaction is required to understand content.

### Semantics

- One `h1` per page; headings in order.
- Use real `button` and `a` elements (no click-divs).
- Form fields have labels; errors are announced.

### Reduced motion and transparency

- Respect `prefers-reduced-motion: reduce`:
  - remove continuous motion
  - remove scroll-linked parallax
  - remove reveal animations (render final state)

- If using glass effects:
  - provide a non-blur fallback
  - keep contrast readable

### Rotating or changing text

If any text changes automatically:

- Provide a stable, non-animated equivalent for assistive tech.
- Avoid repeatedly updating live regions.

---

## 6) Progressive disclosure without hiding power features

The best pattern is “simple defaults + explicit reveal”:

### Beginner defaults

- Templates and outcome-first language
- Presets instead of raw rule editors
- One visible “next step”

### Drill-in for power users

Offer “Show advanced” links that reveal:

- Agent selection
- Toolsets and permissions
- Memory scope
- Scheduling options
- Full audit/event history

Crucially:

- Advanced panels must still be fully keyboard accessible.
- The UI should remember the user’s choice (beginner vs advanced).

---

## 7) Trust surfaces checklist (where to place reassurance)

- `/landing` hero: 1 microline (3 trust bullets max)
- `/landing` control section: approval + pause + history visual
- `/landing` FAQ: privacy + approvals + “what happens if…”
- `/unlock`: trust bullets + “tour” link
- Console home: approval inbox + clear status indicators

---

## 8) Accessibility validation checklist (quick, practical)

Before shipping changes to `/landing` or `/unlock`:

- Keyboard only: can you reach every link, button, and control in a sensible order?
- Focus: is the current focus obvious on dark backgrounds?
- Reduced motion: does the page look complete and stable with reduced motion enabled?
- Screen reader smoke test (fast):
  - Does the page announce a single `h1`?
  - Do buttons and links have meaningful names?
  - Are form errors announced and understandable?
