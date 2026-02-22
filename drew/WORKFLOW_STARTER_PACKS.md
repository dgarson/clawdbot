# Workflow Starter Packs (v1 spec)

## Why this exists
OpenClaw is powerful but invisible to new users: there are no one-click, opinionated “first 10 minutes” workflows that create an agent + automation with sensible defaults.

**Starter Packs** are meant to:
- reduce time-to-value (TTV) from hours → minutes
- make “what good looks like” discoverable
- provide safe defaults (least-privilege, predictable schedules, easy uninstall)

---

## Definition: what a “Starter Pack” is
A **Starter Pack** is a small, installable workflow template distributed as a **bundle**:

- A **manifest** file (`*.starter-pack.json` or YAML equivalent)
- One or more **agents** (either **referencing existing agent IDs** or defining “agent patches” that can be applied)
- One or more **cron jobs** (recurring automations)
- A short **brief** (what it does, required integrations, how to validate it)
- **Example prompts** (so users can immediately drive it)

V1 scope: treat a pack as **data** (a manifest) that the web app can render and the backend can “install” by calling existing primitives:
- agent selection/creation (or agent configuration patching)
- `cron.add` / `openclaw cron add`

---

## V1: the first 3 Starter Packs to ship
These three cover the most common “I get value immediately” archetypes (sales, support, ops) and map cleanly to OpenClaw’s existing strengths (messaging, summarization, scheduling, agent specialization).

### 1) Sales Follow-up (first pack)
**Who it’s for:** founders, sales reps, anyone doing outbound or post-call follow-up.

**Outcome:** daily sweep that:
- drafts follow-ups (email/DM) based on brief notes
- reminds you of stalled leads
- produces a send-ready message + optional CRM update note

**Typical integrations:** Slack (delivery), Gmail/Email, optional CRM (HubSpot/Salesforce) later.

**Suggested default agent IDs (existing):** `stephan` for high-quality copy + `main` for orchestration.

### 2) Support Triage
**Who it’s for:** teams receiving inbound issues across Slack/Discord/email.

**Outcome:** periodic triage that:
- classifies new tickets (bug/billing/how-to/feature request)
- extracts required fields (steps to reproduce, customer, urgency)
- routes: reply draft, assign owner, or create a GitHub issue

**Typical integrations:** Slack/Discord, GitHub.

**Suggested default agent IDs (existing):** `oscar` (debug/reliability mindset) + `joey` (process/triage) depending on org.

### 3) Daily Ops Digest (first pack)
**Who it’s for:** small teams that need a daily “what matters” snapshot.

**Outcome:** morning digest that:
- summarizes overnight changes (messages, key threads)
- lists today’s scheduled automations + outstanding work
- flags risks/blockers and recommends next actions

**Typical integrations:** Slack.

**Suggested default agent IDs (existing):** `joey` (TPM-style digest) or `main`.

---

## Starter Pack manifest: `.starter-pack.json` schema (v1)

The manifest is intentionally small and install-focused. It should be possible to:
- render a pack card in UI
- preview “what will be created”
- install/uninstall deterministically

### Top-level fields
```jsonc
{
  "schema_version": 1,
  "id": "daily-ops-digest",
  "name": "Daily Ops Digest",
  "description": "Morning digest of what happened + what to do next.",
  "time_to_value": "10–15 minutes",

  "tags": ["ops", "onboarding"],

  "install_inputs": [
    {
      "key": "delivery.slack.to",
      "label": "Where should updates be posted?",
      "kind": "slack_target",
      "required": true
    },
    {
      "key": "timezone",
      "label": "Timezone",
      "kind": "timezone",
      "default": "America/Denver",
      "required": true
    }
  ],

  "agents": [
    {
      "agent_id": "joey",
      "purpose": "TPM-style daily digest + next actions.",
      "notes": "Uses existing agent id; v1 does not clone agents by default."
    }
  ],

  "crons": [
    {
      "name": "Daily Ops Digest (morning)",
      "agent_id": "joey",
      "enabled": true,
      "session_target": "isolated",
      "wake_mode": "now",
      "schedule": { "kind": "cron", "expr": "30 7 * * *", "tz": "America/Denver" },
      "payload": {
        "kind": "agentTurn",
        "message": "...",
        "thinking": "medium",
        "timeoutSeconds": 1800
      },
      "delivery": {
        "mode": "announce",
        "channel": "slack",
        "to": "channel:C0AAP72R7L5"
      }
    }
  ],

  "example_prompts": [
    "Install this pack for #ops and run the first digest now.",
    "Change the digest to include GitHub PRs and CI failures."
  ]
}
```

### Required keys (v1)
- `schema_version` (number)
- `id` (string, stable slug)
- `name` (string)
- `description` (string)
- `time_to_value` (string; human-readable)
- `agents[]` (array; at least 1)
- `crons[]` (array; may be empty for “manual-only” packs, but our first packs should include at least 1)
- `example_prompts[]` (array; at least 3 recommended)

### Agent entry (`agents[]`)
V1 supports **referencing existing agent IDs** (what we can do today). Later we can support “clone + patch” for user-owned custom agents.

- `agent_id` (string; must match existing OpenClaw agent ID, e.g. `main`, `joey`, `stephan`, `oscar`)
- `purpose` (string)
- `notes` (optional string)

### Cron entry (`crons[]`)
Designed to map 1:1 onto the existing cron job model (`~/.openclaw/cron/jobs.json`) and CLI (`openclaw cron add`).

- `name` (string)
- `agent_id` (string)
- `enabled` (boolean)
- `session_target` (string; typically `isolated`)
- `wake_mode` (string; typically `now`)
- `schedule`:
  - `kind`: `cron` (v1)
  - `expr`: cron string (examples already used in our system: `30 7 * * *`, `0 18 * * *`, `30 22 * * *`)
  - `tz`: IANA timezone (e.g. `America/Denver`)
- `payload`:
  - `kind`: `agentTurn` (v1)
  - `message`: the prompt to run
  - `thinking`: `low|medium|high` (optional)
  - `timeoutSeconds`: number (optional)
- `delivery` (optional; if omitted, job can be “silent”):
  - `mode`: `announce` (v1)
  - `channel`: `slack|telegram|whatsapp|discord|webhook` (v1: ship slack first)
  - `to`: channel/target string as used by existing delivery system

### Install-time inputs / templating
Manifests should be installable across different orgs. Therefore, packs should support **install-time inputs** with simple string substitution.

V1 approach:
- `install_inputs[]` describes what the UI must collect.
- Cron `delivery.to`, `schedule.tz`, and payload message can include template variables like `{{timezone}}` and `{{delivery.slack.to}}`.

---

## Discovery & recommendation (how users find the right pack)

### Where packs live
- A curated list shipped with the app (bundled JSON files)
- Later: remote registry + versioning

### Recommendation signals (v1)
On first run (or first web login), show a short “What do you want to automate?” picker and **recommend** packs using:
- Connected providers: Slack connected → show Slack-first packs
- Role selection: Sales / Support / Ops
- Existing usage: if user has run `cron` or used “announce” delivery, recommend automation-heavy packs

### Auto-configuration behaviors (v1)
When installing:
1. Ask for required inputs (delivery target, timezone)
2. Validate agent IDs exist (fallback to `main` if missing)
3. Create cron jobs (default `session_target=isolated`, `wake_mode=now`)
4. Provide “Run now” button for the primary cron
5. Show success state with:
   - link to the created cron jobs
   - example prompts
   - how to uninstall

---

## Acceptance criteria (v1)

### Packaging
- [ ] A starter pack is representable by a single `*.starter-pack.json` manifest (YAML optional)
- [ ] Two example manifests exist and validate as JSON

### Install
- [ ] Installer can create cron jobs with schedules already supported by OpenClaw
- [ ] Installer validates `agent_id` exists; if missing, uses `main` and warns
- [ ] Installer collects install inputs (timezone + delivery target) and applies substitutions

### UX
- [ ] Packs are browsable: name, description, tags, estimated TTV
- [ ] Pack detail view shows: what agents are used, what crons will be created, and where output will go
- [ ] One-click install + one-click uninstall (removes created cron jobs; does not delete existing agents)
- [ ] A “Run now” affordance exists after install for immediate feedback

### Safety / guardrails
- [ ] Pack crons default to `enabled=false` unless user explicitly enables (or provide clear toggle during install)
- [ ] Cron delivery targets are explicit (no silent posting to unknown channels)
- [ ] Pack uninstall is reversible (reinstall yields same resources with new IDs, or stable IDs if we add them)

---

## Note to David (UI support needed from Luis)
To make Starter Packs browsable + launchable in the web app, Luis needs to implement:

1. **Starter Packs library page**
   - card grid/list (name, description, tags, time_to_value)
   - search + filters (Sales/Support/Ops)

2. **Pack detail page**
   - "What gets installed" preview (agents referenced, cron schedules, delivery destinations)
   - required integrations + install inputs form

3. **Install flow**
   - input collection for `timezone` + `delivery target` (Slack channel/DM picker)
   - toggles for enabling/disabling each cron by default
   - success screen with "Run now" and “View cron jobs”

4. **Manage installed packs**
   - show installed packs + their created cron jobs
   - uninstall action (removes only resources created by that pack)

If Luis can deliver the library + install UI, backend work can be minimal: install is just a thin layer over existing cron creation + agent ID validation.
