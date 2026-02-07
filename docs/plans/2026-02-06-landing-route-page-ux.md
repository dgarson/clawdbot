# `/landing` Page UX: Public Product Tour (Fast, Trustworthy, Non-Power-User Friendly)

**Date:** 2026-02-06  
**Applies to:** `apps/web/*` (TanStack Router)  
**Route:** `/landing` (public; no Gateway required)

This document defines the `/landing` experience as a high-conversion, low-friction tour of Clawdbrain that complements the console. It is written for people who are not power users, while still giving power users clear “drill-in” routes to deeper capability.

---

## 1) What `/landing` is (and is not)

### It is

- A **public** page that renders without Gateway connection, unlock, or onboarding.
- A narrative tour that answers:
  1. What does this do for me?
  2. How does it work?
  3. Why should I trust it?
  4. What can it do today?
  5. What’s the next step?

### It is not

- The console itself.
- A documentation site.
- A place to expose every configuration surface upfront.

---

## 2) Primary CTA strategy

Choose one primary action and keep it consistent:

**Primary CTA:** Open Console

- Routes to `/` and lets the app handle unlock/onboarding as needed.

**Secondary CTA:** Watch a 90-second tour

- Opens a lightweight modal video or an inline “tour” section (no autoplay).

Why: “Book a demo” is best for enterprise motion; “Open Console” + “Watch” is best for self-serve.

---

## 3) Page structure (recommended order)

The order below is deliberate: value → proof → how it works → safety → breadth → reassurance → CTA.

1. Hero (value + immediate proof)
2. “How it works” (3 steps)
3. Personalization (“It learns your preferences”)
4. Always-on work (“It keeps going while you don’t”)
5. Control and approvals (“It cannot act silently”)
6. Capabilities (bento grid + integrations)
7. FAQ (trust + practical questions)
8. Social proof (short, believable)
9. Final CTA + footer

---

## 4) Header and navigation (simple, sticky, not salesy)

### Goals

- Let users jump to the parts they care about (safety, capabilities, FAQ).
- Keep a single, consistent primary CTA visible (“Open Console”).
- Provide accessibility basics: skip link, clear focus styles, no hover-only menus.

### Header contents (recommended)

- Left: Clawdbrain wordmark (links to `/landing` top)
- Middle (desktop only): 4 anchor links
  - How it works
  - Safety
  - Capabilities
  - FAQ
- Right: Primary CTA “Open Console”

Mobile behavior:

- Collapse anchors into a “Menu” sheet with the same anchors + primary CTA.

Implementation notes:

- Use a translucent sticky header with a subtle border (avoid heavy blur).
- Add a “Skip to content” link that appears on focus.

---

## 5) Hero section: value + proof above the fold

### Purpose

Non-power users need an immediate “oh, I get it” moment. The hero should show:

- A single outcome-driven statement
- A realistic artifact of what the product produces
- A clear path to start

### Content (draft copy)

**Headline:** Your work moves forward—even when you step away  
**Subhead:** Turn an idea into a plan, a draft, or a decision-ready summary. You stay in control of anything sensitive.

**CTA row:**

- Primary: Open Console
- Secondary: Watch a quick tour

**Trust microline (small):**

- “Approvals for sensitive actions • Pause anytime • Clear activity history”

### Visual: “Deliverable preview” card (proof artifact)

Instead of abstract floating cards alone, show one “deliverable” card that looks like the real product output:

- Example: “Competitor research summary” with headings, bullets, and a small “Sources reviewed: 47” line.
- Include a “View full example” link that scrolls to a later “Example deliverables” section (or opens a modal).

### Decorative elements (kept, but performance-friendly)

Keep the ambient aurora/mesh vibe, but:

- Prefer static or slow transform-only motion.
- Avoid animating blur/filter.
- Limit “glass” effects to a small number of elements with graceful fallbacks.

---

## 6) “How it works” section (3 steps)

### Purpose

This is the conversion hinge for safety-conscious users. Make the workflow explicit.

### Structure

Three cards with simple verbs and one sentence each:

1. **Connect**  
   “Link the places you already work (files, messages, tools).”
2. **Set guardrails**  
   “Choose what needs approval and what can run automatically.”
3. **Review and ship**  
   “Get drafts and decisions ready to send, publish, or schedule.”

### Power-user drill-in

Each card can have a “See advanced options” link that expands into:

- Connect: integrations list + credentials scope
- Guardrails: rule examples + presets
- Review: approvals queue + audit trail example

---

## 7) Personalization section: “It adapts to you”

### Purpose

Show that the system becomes more useful over time, without implying creepy surveillance.

### Content (draft copy)

**Headline:** It learns your preferences—without asking you to repeat yourself  
**Body:** As you work, Clawdbrain remembers what “good” looks like for you: tone, structure, priorities, and the way you like decisions summarized.

### Visual

Use a profile-style card with neutral labels:

- “Writing style: concise”
- “Preferred format: bullet summary”
- “Priorities: speed, accuracy”
- “Current focus: product launch”

Avoid “stressors” or overly intimate framing on a public landing page.

### Drill-in

Link: “See what’s remembered (and edit it)” → routes into the console’s preferences/memory surface.

---

## 8) Always-on work section: “Progress while you’re away”

### Purpose

Demonstrate continuity and momentum, not magic.

### Content (draft copy)

**Headline:** It keeps the work moving  
**Subhead:** Research, drafts, and next steps arrive ready for your review.

### Visual

Timeline / activity feed mock:

- Time-stamped entries
- Clear “status” chips (Done / In progress / Waiting for approval)
- One visible “waiting for you” entry to reinforce control

### Drill-in

Link: “View activity history” → routes to the console activity surface.

---

## 9) Control and approvals section: “Autonomy with supervision”

### Purpose

Neutralize fear: “Will it do things without me?”

### Content (draft copy)

**Headline:** It can run on its own—without acting silently  
**Body:** Decide what requires approval. Pause automation instantly. Review what happened, when, and why.

### Visual

A dashboard mock focused on three safety concepts:

- **Approval gates** (what is blocked until approved)
- **Pause/stop controls** (big, obvious)
- **History** (a short, credible activity log)

### Avoid risky claims

Do not promise “end-to-end encryption” unless it is strictly true for the relevant flows. Prefer clear, accurate language like “encrypted in transit and at rest” only if verified.

---

## 10) Capabilities section: bento grid (outcomes, not a feature dump)

### Purpose

Give breadth without overwhelming. Each tile should map to an outcome.

### Recommended tiles (example set)

- Research and compare (summaries + citations when applicable)
- Draft and refine (email, proposal, post, PRD)
- Plan and break down work (tasks, milestones, schedules)
- Keep context (notes, memory, decision history)
- Automate safe chores (status checks, reminders, follow-ups)
- Integrate where you work (tools + channels)

### Power-user drill-in

Each tile links to:

- A console route (Agents, Workstreams, Automations, Nodes, Settings)
- Or a focused “capability detail” section on the same page

---

## 11) Example deliverables (deep proof without a full demo)

### Purpose

Some users won’t believe the value proposition until they see a realistic artifact. This section is a “proof gallery” that stays readable and light.

### Structure

A 3-up grid on desktop (1-up on mobile). Each card includes:

- Deliverable title
- A short excerpt (headings + bullets)
- A metadata line (“Ready for review”, “Waiting for approval”, etc.)
- Two actions:
  - “Open Console” (primary)
  - “See how this is made” (expands an explanation drawer)

### Suggested examples (outcome-first)

1. **Competitive summary**  
   Includes: positioning, differentiation, risks, recommended next steps.

2. **Draft ready to send (approval required)**  
   Includes: subject lines, tone options, a “Why this wording” note.

3. **Weekly status brief**  
   Includes: what changed, what’s blocked, what needs a decision.

Power-user drill-in:

- “See the underlying workstream” link (routes into the console when available).

---

## 12) FAQ section (must-have for trust + conversion)

Keep it short: 6–10 questions. Examples:

- What can it do automatically vs what needs approval?
- What data does it store?
- Can I delete my data?
- What happens if I disconnect the Gateway?
- How do I pause everything?
- Is there an audit trail?
- Can I customize agents and tools?

Each answer should be 2–4 sentences, with an optional “Learn more” link for power users.

---

## 13) Social proof (short, believable, aligned with outcomes)

Prefer:

- Short quotes that mention a concrete deliverable
- A one-line “before → after” tag

Avoid:

- Overly magical claims
- Testimonials that require users to trust unverifiable numbers

---

## 14) Footer: useful links (no dead ends)

Only include links that exist, or anchor links that scroll to sections:

- Product tour (anchors)
- Safety and control (anchor)
- FAQ (anchor)
- Open Console (`/`)

Optional if they exist:

- Docs, pricing, contact

---

## 15) Accessibility and performance requirements (page-level)

### Accessibility

- Single `h1`; logical heading order.
- All interactive elements keyboard reachable with visible focus.
- No essential info conveyed by color alone.
- Reduced motion: disable continuous animation and scroll-linked motion when `prefers-reduced-motion: reduce`.

### Performance

- Avoid scroll handlers unless absolutely necessary.
- Prefer transform/opacity-only animations.
- Limit backdrop blur usage; provide a non-blur fallback.
- Consider `content-visibility: auto` on below-the-fold sections.

---

## 16) Implementation checklist (high level)

- Create `apps/web/src/routes/landing/index.tsx` for `/landing`.
- Mark `/landing` as fullscreen (hide AppShell).
- Skip onboarding/unlock/gateway guards for `/landing`.
- Build landing as a small set of composable sections (each a component) with CSS that uses existing theme variables.
- Ensure all `/landing` content loads without calling Gateway APIs.
