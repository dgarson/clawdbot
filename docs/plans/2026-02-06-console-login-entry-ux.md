# Console and Login Entry UX (/, /unlock) + Public Marketing Page (/landing)

**Date:** 2026-02-06  
**Applies to:** `apps/web/*` (React + TanStack Router + shadcn/Tailwind)

This document defines the recommended entry experience for Clawdbrain’s web console:

- `/` is the **product landing** for returning users (the console).
- `/unlock` is the **console access** screen (unlock + connection help), not a dead-end “blocked” state.
- `/landing` is a **public, marketing-style tour** of the product that does not require a running Gateway.

The goal is to make the first 30 seconds feel obvious and safe for non-power-users, while still giving power-users fast paths to everything via drill-down.

---

## 1) Goals, audience, success criteria

### Goals

1. Make `/` feel like “home base” for daily use (simple default, no cognitive overload).
2. Make locked/disconnected states feel welcoming and self-healing (help users recover without reading docs).
3. Keep `/landing` accessible without any Gateway connection so it can be shared, indexed, and used for pre-login education.
4. Support progressive disclosure: beginners see “start a task”; power users can reach agents/tools/memory/workstreams quickly.

### Audience segments (useful for design decisions)

- **New / curious:** clicked a link, has no Gateway context, wants to understand “what is this”.
- **Returning casual:** uses a few workflows, wants predictable “do the thing” entry.
- **Power user:** cares about speed, shortcuts, deep configuration, and observability.

### Success criteria (what “good” looks like)

- A new visitor can understand “what Clawdbrain does” and “how to start” without leaving the UI.
- A disconnected user can connect/unlock in under 60 seconds with clear next actions.
- A power user can reach any deep surface (Agents, Automations, Nodes, Workstreams, Settings, Debug) in ≤2 clicks or via command palette.

---

## 2) Route map and guard behavior

### Recommended route responsibilities

|         Route | Primary role                    | Must work without Gateway?      | Shell      | Notes                                                        |
| ------------: | ------------------------------- | ------------------------------- | ---------- | ------------------------------------------------------------ |
|    `/landing` | Public marketing + product tour | **Yes**                         | Fullscreen | No AppShell; no auth/unlock/onboarding redirects             |
|           `/` | Console “home”                  | No (in prod)                    | AppShell   | Default for signed-in/unlocked users                         |
|     `/unlock` | Console access screen           | No (but should still render UI) | Fullscreen | Offers connection + unlock; links to `/landing`              |
| `/onboarding` | Setup wizard                    | Preferably no                   | Fullscreen | Should be reachable from `/unlock` + from “Get started” CTAs |

### Guard behavior changes (implementation notes)

To make `/landing` truly public and fast:

- **OnboardingGuard:** add `/landing` to skip paths.
- **UnlockGuard:** add `/landing` to skip paths.
- **GatewayAuthGuard + gateway event hooks:** disable auto-connect and streaming handlers on `/landing`.
- **AppShell:** treat `/landing` as fullscreen (hide sidebar/top chrome).

Rationale: a public marketing page must not show “Connecting to Gateway…” or “Unlock required” overlays. Those are console concerns.

---

## 3) `/` Console UX: “simple by default, deep by choice”

### The “job to be done”

Most users arrive with an outcome in mind, not a feature in mind. The home console should optimize for:

> “Tell Clawdbrain what I want. See progress. Approve what matters. Get the deliverable.”

### Default home layout (non-power-user first)

**Top strip**

- Greeting + date (already present), plus a small status indicator: Gateway connected, unlock state, and any pending approvals.

**Primary action**

- A single, prominent “Start a task” composer:
  - Placeholder that suggests outcomes (“Plan a trip”, “Write a proposal”, “Research competitors”).
  - One-line “What will you deliver?” optional field (advanced users can ignore; beginners benefit).

**Suggested starters (templates, not features)**

- 6–9 tiles that map to real outcomes: “Research”, “Draft”, “Plan”, “Automate”, “Review”, “Summarize”.
- Each tile opens a guided prompt with just 2–3 questions and a clear “Run” button.

**Recent work**

- Show 3 recent items with a “Resume” action (workstreams or conversations).
- Hide the rest behind “View all”.

**Approvals inbox**

- If there are pending approvals, show a card that is impossible to miss (this is safety UX).

### Progressive disclosure: “Beginner / Advanced” mode

Add a simple, persistent toggle (e.g., in the home header or user menu):

- **Beginner mode (default):**
  - Emphasize outcomes, templates, and “one next step”.
  - Hide advanced configuration (models, toolsets, memory settings).
  - Keep navigation, but visually de-emphasize power surfaces.

- **Advanced mode:**
  - Show “Agent chooser”, “Toolset”, “Memory scope”, “Guardrail preset”.
  - Show richer dashboards (agents/workstreams/nodes) and quick links.

Important: this is **UI simplification**, not capability removal. Everything remains reachable via navigation and command palette.

### Power-user fast paths

Power users should be able to do any of these instantly:

- `Cmd/Ctrl+K` command palette: go-to routes, run commands, open recent sessions.
- Pinned shortcuts on home (configurable): Agents, Automations, Nodes, Workstreams, Debug.
- “Copy as…” actions on outputs (Markdown, JSON, clipboard) for downstream tooling.

---

## 4) `/unlock` Console Access Screen: make the “blocked state” feel premium

### Why this matters

“Locked” or “not connected” is often the first impression for new or returning users. If it looks like an error page, users bounce. Treat it as a first-class landing surface.

### Structure: a 2-step (sometimes 3-step) access flow

**Step 1 — Connect**

- Show the Gateway URL (editable) and connection status.
- If not running, show “How to start the Gateway” inline help (collapsed by default).
- Provide a “Troubleshoot” drawer with the most common issues:
  - Wrong URL / port
  - Gateway not running
  - Auth required
  - Network issues

**Step 2 — Unlock**

- Unlock form (PIN/passphrase/etc).
- Recovery option link (if available).
- Clear lockout messaging if rate-limited.

**Optional Step 3 — Quick start**

- If user is newly onboarded or has no agents configured, show a “Start with a guided setup” CTA that routes to `/onboarding`.

### Layout (desktop)

Left column (education + trust)

- One crisp headline about the outcome (not “features”).
- 3 bullets about safety + control (avoid unverifiable claims).
- A small “See the full tour” link to `/landing`.

Right column (action)

- Stepper UI: Connect → Unlock → Enter Console
- Forms with generous spacing and clear errors.

### Layout (mobile)

Stacked sections, with action first:

1. Connection + unlock actions
2. “Why Clawdbrain” summary
3. “Tour” link + help links

### Copy draft (original writing)

**Headline:** Open your console  
**Subhead:** Connect, unlock, and pick up where you left off—without losing control of what runs.

**Trust bullets (keep tight):**

- Approval gates for sensitive actions
- A clear history of what happened and why
- Pause or stop automation at any time

**Secondary links:**

- See the product tour (`/landing`)
- Need help connecting a Gateway? (opens the troubleshooting drawer)

---

## 5) “Drill-down” patterns for non-power users (that still satisfy power users)

These are UI patterns that preserve depth without overwhelming:

1. **Guided templates with an “Advanced options” accordion**
   - Default: 2–3 questions, plain language.
   - Advanced: agent, tools, memory scope, run schedule, approval preset.

2. **Safety presets (human-friendly)**
   - “Conservative” (more approvals)
   - “Standard” (balanced)
   - “Autopilot” (only for safe categories)
     Each preset expands to show the exact rules it implies for power users.

3. **Explain-in-place**
   - When a user sees “Workstreams”, show a one-line definition and a “Learn more” tooltip the first time only.

4. **One visible “next step”**
   - Whenever something is running, the UI should state the next expected event:
     - “Waiting for your approval to send…”
     - “Generating draft…”
     - “Gathering sources…”

---

## 6) Navigation IA and drill-down map (beginner vs power user)

### Sidebar grouping (recommended)

The sidebar should support two mental models:

- **Beginner:** “Start something, see progress, approve what matters.”
- **Power user:** “Jump directly to surfaces (agents, nodes, automations, settings).”

Recommended grouping (with progressive disclosure):

- **Home** (`/`)
- **Chat** (`/conversations`)  
  Simple label for non-power users; internally it can still be “conversations”.
- **Approvals** (entry point to the approvals inbox; route depends on implementation)
- **Activity** (work history / sessions / workstreams)
- **Explore** (collapsed by default in Beginner mode)
  - Agents (`/agents`)
  - Workstreams (`/workstreams`)
  - Automations (`/automations`)
  - Goals (`/goals`)
  - Memories (`/memories`)
  - Nodes (`/nodes`)
- **Settings** (`/settings`)
- **Debug** (`/debug`) (hidden unless enabled; always searchable via command palette for power users)

### Drill-down mapping table (outcome → surface)

| User intent (plain language)       | Beginner entry point             | Power-user surface                                 |
| ---------------------------------- | -------------------------------- | -------------------------------------------------- |
| “I want an answer / draft / plan.” | Home “Start a task” composer     | Conversations, Agents sessions                     |
| “Keep working on what I started.”  | “Recent work” → Resume           | Workstreams, Conversations                         |
| “Run this again every week.”       | Starter tile: Automate           | Automations                                        |
| “Make it follow my rules.”         | Safety preset selector           | Guardrail editor, tool permissions, settings       |
| “Show me what happened.”           | Activity card                    | Agent activity, audit history, workstream timeline |
| “Connect my tools.”                | Guided setup CTA                 | Settings → Connections / Integrations              |
| “Tune how it thinks / acts.”       | Advanced toggle → “More options” | Agents, toolsets, memory scope, model settings     |

Notes:

- Keep beginner entries anchored in outcomes, not nouns (“Agents”, “Nodes”).
- Every beginner UI should have a consistent “Show advanced” affordance that reveals the underlying surface for power users.

---

## 7) Implementation checklist (high level)

- Add `/landing` route (fullscreen).
- Update guards to skip `/landing`.
- Disable gateway auto-connect + streaming hooks on `/landing`.
- Update fullscreen route list to include `/landing`.
- Redesign `/unlock` to be a “Console Access” page with connection + unlock + tour link.
- Add a Beginner/Advanced toggle on `/` home, persisted in preferences.
