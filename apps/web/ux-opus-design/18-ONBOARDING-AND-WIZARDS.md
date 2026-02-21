# Onboarding, Guided Discovery, and Create Agent Wizard (apps/web)

This document defines the canonical onboarding journey for `apps/web/` and reconciles the “basic 3-step wizard” with the existing, more powerful Create Agent wizard.

**Canonical personas:** `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`
**Command palette (jump IA):** `apps/web/ux-opus-design/16-STATE-NAV-AND-COMMAND-PALETTE.md`
**Error + secrets UX:** `apps/web/docs/plans/2026-02-01-auth-oauth-pairing-secrets-and-errors.md`

## 1) Why We Keep Two Wizard Modes

We intentionally support two Create Agent wizard modes:

1) **Basic Setup** (default for non-technical users)
   - Optimized for speed and confidence.
   - Minimizes decisions; inherits system defaults.
   - Produces a functional agent with safe capabilities quickly.

2) **Advanced Setup** (power users)
   - Optimized for control at creation time.
   - Exposes additional configuration (personality/values, per-tool toggles, and future advanced knobs).
   - Reduces post-create “go edit 6 tabs” friction for engineers and tech-savvy users.

We keep both because the personas have fundamentally different needs:
- **Personal User (Non-Technical)** should never be forced into expert-level decisions.
- **Engineer / Technical Expert** wants high control without repetitive post-create editing.

## 2) Mode Selection (Before Wizard Steps)

Requirement: mode selection happens **before** entering the step flow, but may be part of the same modal/popup.

### Mode chooser UI (top of wizard modal)

Two choices:
- **Basic Setup** (recommended)
- **Advanced Setup**

Default selection:
- Derived from `useUIStore.powerUserMode` (Expert Mode).
- User can override for this one wizard session (local-only; does not change the global preference unless explicitly saved).

## 3) Wizard Flows (Canonical)

### 3.1 Basic Setup (3 steps, can be 4–5 if required)

Goal: create a safe, useful agent with minimal choices.

Step 1: **Template + Name**
- Choose a template
- Name + short description

Step 2: **Capabilities (Toolset)**
- Choose a toolset/profile (Minimal / Standard / Full / Custom later)
- Explain “you can change this later”

Step 3: **Review + Create**
- Summary of choices
- Explicitly: “Everything else inherits system defaults”

Optional Step 0 (only when required): **Connect Provider**
- Only appears when no model provider is connected (blocker state).
- This step can link out to Settings > Model & Provider and return.

### 3.2 Advanced Setup (current + future)

The existing `apps/web` wizard is already an Advanced Setup flow:
- Step 1: Template selection
- Step 2: Identity (name/description/avatar)
- Step 3: Personality (sliders) + core values
- Step 4: Tools selection + review

We keep this flow and may expand it with 1–2 additional steps only if they are:
- widely useful to the power personas, AND
- capability-gated where provider/runtime support differs.

Potential Advanced-only future steps:
- “Behavior overrides” (creativity/length/streaming presets)
- “Execution / sandbox posture” (only if it maps to real config and has clear guardrails)

## 4) Why the Advanced Wizard Diverges From the 3-Step Story

The 3-step story is the **Basic Setup** narrative (non-technical). The existing multi-step wizard is the **Advanced Setup** narrative (power users).

All docs must reflect:
- “3-step wizard” refers to Basic Setup.
- Advanced Setup is intentionally longer and more expressive.

## 5) Guided Discovery (Non-Nagging)

Guided discovery is opt-in and contextual. The goal is to help users succeed, not to teach the product exhaustively up front.

### 5.1 First-run checklist (persistent until complete)

A lightweight checklist shown in:
- Dashboard (if it exists) and/or
- Settings landing, and/or
- empty states

Checklist items (canonical starter set):
1) Connect a model provider
2) Create your first agent
3) Send your first message
4) Pick a toolset for an agent
5) (Optional) Turn on Expert Mode

Each item must link to the correct deep link:
- `/settings?section=model-provider`
- `/agents` (create agent CTA)
- `/agents/:id?tab=basics`

### 5.2 Tooltips and inline help

Rules:
- Tooltips explain “what this does” in one sentence.
- Longer explanations belong in a “Learn more” side panel, not hover text.
- Tooltips must never block progress.

### 5.3 Surfacing Advanced mode without nagging

Allowed patterns:
- A single, subtle affordance in the wizard mode chooser: “Advanced Setup” with a short description and a “Power users” label.
- Command palette includes “Toggle Expert Mode”.
- After a user performs an “advanced action” (e.g., searches for “sandbox”), show a one-time hint: “Expert Mode reveals more controls.”

Disallowed patterns:
- Repeated popups prompting upgrades to Advanced/Expert Mode.
- Interstitial modals after every action.

