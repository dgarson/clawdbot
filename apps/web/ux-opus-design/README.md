# Clawdbrain Web UX Design Documentation

> **Target Implementation:** `apps/web/` (NOT `ui/`)
>
> **Last Updated:** 2026-02-01
>
> **Status:** Active Design Phase

---

## Overview

This directory contains the complete UX design documentation for Clawdbrain's new web application. The goal is to transform agent configuration from a developer-centric CLI experience into a friendly, approachable interface that serves both non-technical users and power users through **progressive disclosure**.

### Canonical References (Read These First)

- `00-CANONICAL-CONFIG-AND-TERMS.md` — source of truth for internal keys, terminology, personas, and MVP scope boundaries.
- `EDGE-CASES.md` — long-term edge case inventory (tracked, not solved in MVP docs).
- `16-STATE-NAV-AND-COMMAND-PALETTE.md` — canonical URL/state model and “search/jump” IA via the Configuration Command Palette.
- `17-DEPENDENCIES-AND-SHARED-UX-PRIMITIVES.md` — dependency options (DnD/editors/diff) + canonical validation/error UX spec.
- `18-ONBOARDING-AND-WIZARDS.md` — dual-mode agent creation + guided discovery.
- `COPY.md` — canonical UI copy for the Agent Configuration MVP.
- `STORYBOOK-PLAN.md` — how a future agent should generate Storybook setup.
- `TESTING-STRATEGY.md` — complete testing plan (unit/integration/e2e + failure modes).
- `19-DEFENSIBILITY-PLAN.md` — pitch-ready defensibility plan (hard-to-copy moat).

### Explicit Non-Goals (Agent Configuration MVP)

The Agent Configuration MVP does **not** include Graph DB integration or ingestion/RAG pipelines. Those are a separate track with their own MVP, risks, and security requirements:
- `apps/web/docs/plans/2026-02-01-graph-and-ingestion-track.md`

---

## Document Index

### Foundation Documents

| Document | Purpose |
|----------|---------|
| [00-CANONICAL-CONFIG-AND-TERMS.md](./00-CANONICAL-CONFIG-AND-TERMS.md) | Canonical internal keys, terminology, personas, and scope boundaries |
| [01-VISION-AND-VALUE-PROP.md](./01-VISION-AND-VALUE-PROP.md) | The "why" - value proposition, target users, and pitch |
| [02-TERMINOLOGY-MAPPING.md](./02-TERMINOLOGY-MAPPING.md) | Technical terms → friendly labels mapping |
| [03-DESIGN-PRINCIPLES.md](./03-DESIGN-PRINCIPLES.md) | Core UX principles and patterns |
| [16-STATE-NAV-AND-COMMAND-PALETTE.md](./16-STATE-NAV-AND-COMMAND-PALETTE.md) | Canonical URL/state model + search/jump IA |
| [17-DEPENDENCIES-AND-SHARED-UX-PRIMITIVES.md](./17-DEPENDENCIES-AND-SHARED-UX-PRIMITIVES.md) | Dependency options + shared validation/error spec |
| [18-ONBOARDING-AND-WIZARDS.md](./18-ONBOARDING-AND-WIZARDS.md) | Onboarding, guided discovery, and dual-mode Create Agent wizard |
| [COPY.md](./COPY.md) | Canonical UI text for Agent Configuration MVP |
| [STORYBOOK-PLAN.md](./STORYBOOK-PLAN.md) | How to generate Storybook setup |
| [TESTING-STRATEGY.md](./TESTING-STRATEGY.md) | Testing levels, scenarios, and failure modes |
| [19-DEFENSIBILITY-PLAN.md](./19-DEFENSIBILITY-PLAN.md) | Defensibility plan (safety/auditability/reproducibility/system brain/heartbeat) |

### Analysis Documents

| Document | Purpose |
|----------|---------|
| [04-CURRENT-STATE-ANALYSIS.md](./04-CURRENT-STATE-ANALYSIS.md) | What already exists in apps/web |
| [05-GAP-ANALYSIS.md](./05-GAP-ANALYSIS.md) | Design vs implementation gaps |

### Design Specifications

| Document | Purpose |
|----------|---------|
| [06-INFORMATION-ARCHITECTURE.md](./06-INFORMATION-ARCHITECTURE.md) | Navigation, page structure, routing |
| [07-SYSTEM-SETTINGS-DESIGN.md](./07-SYSTEM-SETTINGS-DESIGN.md) | Model & Provider page (system-wide) |
| [08-AGENT-CONFIGURATION-DESIGN.md](./08-AGENT-CONFIGURATION-DESIGN.md) | Per-agent settings tabs |
| [09-COMPONENT-SPECIFICATIONS.md](./09-COMPONENT-SPECIFICATIONS.md) | Reusable component specs |

### Implementation Guides

| Document | Purpose |
|----------|---------|
| [10-UX-PATTERNS-AND-FLOWS.md](./10-UX-PATTERNS-AND-FLOWS.md) | Interaction patterns, user flows |
| [11-IMPLEMENTATION-ROADMAP.md](./11-IMPLEMENTATION-ROADMAP.md) | Phased build plan with file paths |
| [12-DIFFERENTIATORS.md](./12-DIFFERENTIATORS.md) | Competitive advantages and unique features |

### Strategy & Vision Documents

| Document | Purpose |
|----------|---------|
| [13-FUTURE-EXPANSIONS-AND-MONETIZATION.md](./13-FUTURE-EXPANSIONS-AND-MONETIZATION.md) | Revenue strategies by user persona |
| [14-GRAPH-DB-INTEGRATION.md](./14-GRAPH-DB-INTEGRATION.md) | Future track (not MVP): graph DB + knowledge explorer |
| [15-INGESTION-AND-RETRIEVAL-PIPELINE.md](./15-INGESTION-AND-RETRIEVAL-PIPELINE.md) | Future track (not MVP): ingestion, RAG, hybrid retrieval |

### Advanced UX Systems

| Document | Purpose |
|----------|---------|
| [20-INHERITANCE-CLARITY-BADGES.md](./20-INHERITANCE-CLARITY-BADGES.md) | Visual system for default vs custom value inheritance |
| [21-PERSONA-PROGRESSION-SYSTEM.md](./21-PERSONA-PROGRESSION-SYSTEM.md) | Three-tier user complexity system (Casual/Engaged/Expert) |
| [22-HIGH-IMPACT-UX-PATTERNS.md](./22-HIGH-IMPACT-UX-PATTERNS.md) | Five high-impact patterns for progressive disclosure |

### Tab Consolidation Effort

| Document | Purpose |
|----------|---------|
| [23-TAB-CONSOLIDATION-NAVIGATION.md](./23-TAB-CONSOLIDATION-NAVIGATION.md) | Complete navigation redesign spec (6 tabs → 5 tabs) with ASCII diagrams |
| [24-IMPLEMENTATION-PLAN-TAB-CONSOLIDATION.md](./24-IMPLEMENTATION-PLAN-TAB-CONSOLIDATION.md) | Phased implementation plan with code examples and task checklists |

---

## Quick Links

- **For Product/Design Review:** Start with [Vision](./01-VISION-AND-VALUE-PROP.md) → [Principles](./03-DESIGN-PRINCIPLES.md) → [Differentiators](./12-DIFFERENTIATORS.md)
- **For Engineering:** Start with [Current State](./04-CURRENT-STATE-ANALYSIS.md) → [Gap Analysis](./05-GAP-ANALYSIS.md) → [Roadmap](./11-IMPLEMENTATION-ROADMAP.md)
- **For Copy/Content:** See [Terminology Mapping](./02-TERMINOLOGY-MAPPING.md)
- **For Strategy/Business:** See [Monetization](./13-FUTURE-EXPANSIONS-AND-MONETIZATION.md) → [Differentiators](./12-DIFFERENTIATORS.md)
- **For Data Architecture:** See [Graph DB](./14-GRAPH-DB-INTEGRATION.md) → [Ingestion Pipeline](./15-INGESTION-AND-RETRIEVAL-PIPELINE.md)

---

## Key Decisions

1. **Progressive Disclosure:** Simple by default, advanced when asked
2. **Friendly Labels:** No jargon in primary UI (temperature → Creativity)
3. **System Defaults:** Per-agent overrides are opt-in, not forced
4. **Target Directory:** All implementation in `apps/web/src/`, not `ui/`

---

## Related Resources

- Original design docs: `apps/web/ux-agent-config/`
- Toolset design: `apps/web/docs/plans/2026-02-01-toolset-configuration-design.md`
- Graph + ingestion/RAG track: `apps/web/docs/plans/2026-02-01-graph-and-ingestion-track.md`
- UX audit: `docs/audits/agentic-workflow-ux-audit.md`
- SaaS transformation: `docs/plans/SAAS_TRANSFORMATION_PLAN.md`
