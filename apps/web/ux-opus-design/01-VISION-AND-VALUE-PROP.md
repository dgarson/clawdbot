# Vision and Value Proposition

> Making AI agents accessible beyond developers.

**Canonical personas + terms + scope boundary:** `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`

---

## The Problem

Today's AI agent platforms assume technical expertise:

- Configuration requires editing JSON or YAML files
- Settings use developer jargon and provider-specific terms (e.g. temperature, `max_tokens`, context window)
- Power features are hidden behind CLI commands
- Non-technical users feel lost and intimidated

**Result:** In practice, configuration works well for engineers but is intimidating (or unusable) for many other users.

---

## Our Vision

**Clawdbrain makes AI agents as easy to configure as setting up a smartphone.**

Most users should be able to:
- Create an agent in under 2 minutes
- Understand what every setting does
- Trust that defaults are sensible
- Go deeper only when they want to

---

## Target Users (Canonical)

These personas must match 1:1 across all strategy and monetization docs (no extra enums):

### 1) Business User
- Wants repeatable workflows and safe defaults for teams
- Needs sharing, toolsets, permissions, and auditability

### 2) Personal User (Non-Technical)
- Wants a “basic setup” that works without learning the system
- Needs minimal setup, plain language, and guardrails

### 3) Tech-Savvy Personal User
- Wants customization and experimentation without enterprise overhead
- Needs templates, import/export, and fast iteration

### 4) Engineer / Technical Expert
- Wants integration, automation, reproducibility, and deep control
- Needs raw config, config paths, diffs, keyboard-first workflows, and capability-gated knobs

---

## Value Proposition

### For Non-Technical Users

> "Set up your AI assistant in minutes, not hours. No coding required."

**Key Messages:**
1. **Simple choices, smart defaults** — We pick sensible starting points
2. **Plain language** — "Creativity" not "temperature"
3. **Safety first** — Dangerous features are clearly labeled
4. **Grow at your pace** — Advanced options are there when you need them

### For Developers

> "Skip the boilerplate. Configure once, deploy anywhere."

**Key Messages:**
1. **Fast iteration** — UI for quick changes, CLI for automation
2. **Full access** — Raw config editor for power users
3. **Consistent model** — Same settings work across providers
4. **API-first** — Everything in UI is also in API

### For Teams

> "Standardize your AI toolkit with shareable presets."

**Key Messages:**
1. **Toolsets** — Named permission bundles (Research Mode, Developer Tools)
2. **Defaults** — Organization-wide settings that agents inherit
3. **Audit trails** — See who changed what, when
4. **Role-based access** — Control who can modify agents

---

## Core Concept Definitions (One Paragraph)

See the canonical definitions in `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`. In short: Agents are the user-facing assistants you configure and chat with; the System Brain is a special system-level agent used for routing/fallbacks/system tasks; and the Gateway is the backend service that stores config, connects providers/channels, and executes tools.

---

## Product Shape (How We Deliver “Simple + Powerful”)

### Dual-Mode Create Agent Wizard
- **Basic Setup**: optimized for non-technical users (short, safe, default-heavy).
- **Advanced Setup**: optimized for power users (more steps, more control).

Canonical spec: `apps/web/ux-opus-design/18-ONBOARDING-AND-WIZARDS.md`.

### “Basics + More” Agent Configuration
- Default agent configuration is presented as **Basics** (90% controls) and **More** (grouped advanced surfaces).
- Expert Mode (global) and a per-page “Simple/Full” override control visibility and density.

Canonical spec: `apps/web/ux-opus-design/08-AGENT-CONFIGURATION-DESIGN.md`.

### Power User Speed
- Command palette + search/jump is a first-class workflow surface.

Canonical spec: `apps/web/ux-opus-design/16-STATE-NAV-AND-COMMAND-PALETTE.md`.

---

## The Pitch (30-Second Version)

> "Clawdbrain helps more people create and manage AI agents without writing code.
> Our interface uses plain language - like 'Creativity' instead of 'temperature' -
> so you can see what you're adjusting. Start simple with smart defaults,
> then unlock advanced features as you grow. It's AI configuration that
> finally makes sense."

---

## The Pitch (Technical Audience)

> "Clawdbrain provides a unified configuration layer for multi-provider AI agents.
> Configure Anthropic, OpenAI, or any provider through one interface. Set system-wide
> defaults, then override per-agent. Features like the System Brain (system-level helper)
> and Heartbeat (scheduled background tasks) give you capabilities
> beyond basic chat. Full API access means everything works with your existing toolchain."

---

## Success Metrics

### User Experience
- Time to first agent: < 2 minutes
- Settings comprehension: > 90% understand labels without help
- Task completion: > 95% complete basic configuration

### Adoption
- Non-developer users: > 40% of active users
- Feature discovery: > 60% explore advanced settings within first week
- Toolset usage: > 30% create custom toolsets

### Satisfaction
- NPS score: > 50
- Support tickets for "how do I configure X": < 10% of total
- Configuration errors: < 5% of changes result in errors

---

## Competitive Positioning

| Competitor | Their Approach | Our Advantage |
|------------|---------------|---------------|
| OpenAI Assistants | API-first, minimal UI | Full-featured UI with friendly labels |
| LangChain | Developer SDK | No-code configuration option |
| AutoGPT | Technical setup required | Guided wizard experience |
| Claude.ai | Single-agent chat | Multi-agent orchestration |

Positioning hypothesis (avoid absolutes): Clawdbrain focuses on delivering high capability with low expertise requirements by combining progressive disclosure UX with safety/auditability and reproducible configs.

---

## Design Implications

This vision drives several key design decisions:

1. **Progressive disclosure** — Simple first, complex on demand
2. **Friendly terminology** — Human labels with technical tooltips
3. **Smart defaults** — "Use system default" is always available
4. **Visual feedback** — Status indicators, not log files
5. **Guided experiences** — Wizards for complex flows
6. **Escape hatches** — Raw config for those who need it

---

## Explicit Non-Goals (Agent Configuration MVP)

Graph DB integration and ingestion/RAG pipelines are valuable but must not contaminate the Agent Configuration MVP scope. They are split into a separate track:
- `apps/web/docs/plans/2026-02-01-graph-and-ingestion-track.md`
