---
summary: "Product requirements and UX specification for the in-app guided onboarding tour"
read_when:
  - Implementing or refining first-run onboarding
  - Aligning engineering, design, and copy on onboarding scope
  - Defining onboarding success metrics and acceptance criteria
title: "Onboarding Tour — UX Spec & Requirements"
sidebarTitle: "Onboarding Tour Spec"
---

# Onboarding Tour — UX Spec & Requirements

**Work Item:** `dgarson/clawdbot#bs-ux-1-spec`

## 1) Problem statement

New users can launch OpenClaw but still fail to reach first value quickly because setup spans multiple concepts (gateway mode, permissions, channels, and first agent interaction). This tour provides a structured, low-friction first-run path that reduces abandonment and support burden.

## 2) Goals

1. Get users from install to a successful first assistant interaction in one guided flow.
2. Make trust and safety posture clear early (local-first, explicit permissions, reversible choices).
3. Minimize setup errors by sequencing decisions and validating configuration at each step.

## 3) Non-goals

- Full channel deep configuration for every provider.
- Advanced ops setup (production hardening, HA, enterprise policy packs).
- Replacing all docs; the tour should hand off to docs for deep dives.

## 4) Primary personas

- **Indie builder (local-first):** Wants setup done in minutes, minimal jargon.
- **Power user/operator:** Wants explicit control and predictable defaults.
- **Evaluator/team lead:** Wants confidence in security model before adoption.

## 5) User journey (happy path)

1. Welcome and expectation setting.
2. Select gateway mode (local or remote).
3. Confirm auth defaults and required permissions.
4. Optional CLI helper install/setup.
5. Land in onboarding chat with suggested next actions.

## 6) Functional requirements

### FR-1: Entry conditions

- Triggered on first run or when onboarding state is incomplete.
- User can resume where they left off.
- User can skip and manually complete later.

### FR-2: Step orchestration

- Tour is multi-step and stateful (progress persisted locally).
- Back/next navigation is supported without data loss.
- Each step validates required input before continue.

### FR-3: Gateway setup

- User chooses local vs remote mode.
- Auth defaults are secure-by-default (token enabled unless explicitly changed).
- Validation errors are actionable and human-readable.

### FR-4: Permissions guidance

- Required vs optional permissions are clearly separated.
- Permission prompts include “why this is needed”.
- User can continue with optional permissions deferred.

### FR-5: CLI setup (optional)

- User can skip without blocking tour completion.
- If selected, flow detects and reports success/failure clearly.

### FR-6: Onboarding chat handoff

- Finishing the tour opens a dedicated onboarding chat/session.
- Chat includes suggested first tasks (connect channel, test tool, create automation).
- Completion state is marked only after successful handoff.

### FR-7: Recovery and retry

- Interrupted steps are recoverable on relaunch.
- Failing operations provide retry and fallback guidance.

## 7) UX requirements

- Plain language over technical jargon.
- Single primary action per step; secondary actions are visually de-emphasized.
- Preserve confidence: show what is safe, local, and reversible.
- Ensure keyboard and screen-reader operability for all controls.

## 8) Accessibility requirements (WCAG 2.2 AA baseline)

- Keyboard-only completion is possible end-to-end.
- All interactive controls have accessible names and visible focus states.
- Steps and progress are announced correctly to assistive tech.
- Motion effects respect reduced-motion preferences.

## 9) Content requirements

- Explain _why_ permissions are requested, not just _what_.
- Include trust language: local execution boundaries and credential handling basics.
- Copy should be short, skimmable, and action-oriented.

## 10) Telemetry and success metrics

### Required events

- `onboarding_started`
- `onboarding_step_viewed`
- `onboarding_step_completed`
- `onboarding_skipped`
- `onboarding_completed`
- `onboarding_handoff_chat_opened`

### Key metrics

- Completion rate (start → complete)
- Time-to-complete (p50, p90)
- Drop-off by step
- First-value rate (successful first assistant interaction within same session)

## 11) Acceptance criteria

1. New user can complete onboarding and reach onboarding chat without consulting docs.
2. Required setup errors are caught before final completion.
3. Tour progress survives app restart/crash.
4. Accessibility baseline passes keyboard + screen-reader smoke tests.
5. Telemetry emits all required events for funnel analysis.

## 12) Risks and mitigations

- **Risk:** Permission fatigue causes abandonment.  
  **Mitigation:** Defer optional permissions and clearly explain value.

- **Risk:** Remote mode complexity blocks novices.  
  **Mitigation:** Keep local mode as recommended default with concise comparison.

- **Risk:** Incomplete handoff leaves users at a dead end.  
  **Mitigation:** Require successful onboarding chat launch before “complete”.

## 13) Dependencies

- Gateway config and onboarding state persistence.
- Channel/provider onboarding adapters.
- UI shell routing to onboarding chat/session.
- Event logging pipeline for onboarding telemetry.

## 14) Out-of-scope follow-ups

- Experiment variants (A/B copy and step ordering).
- Persona-specific tours (developer vs non-technical mode).
- Interactive troubleshooting branch flows.
