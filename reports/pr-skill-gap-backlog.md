# SKILL.md Gap Backlog for This PR Intent

This backlog targets the newly introduced control-plane extensions and prioritizes skills that would materially improve agent execution quality, onboarding speed, and operational safety.

## Tier 1 (add first)

1. `extensions/ocx-orchestration/skills/orchestration/SKILL.md`
2. `extensions/ocx-routing-policy/skills/routing-policy/SKILL.md`
3. `extensions/ocx-budget-manager/skills/budget-ops/SKILL.md`

## Tier 2

4. `extensions/ocx-evaluation/skills/eval-ops/SKILL.md`
5. `extensions/ocx-observability/skills/observability-reaper/SKILL.md`
6. `extensions/ocx-event-ledger/skills/event-ledger/SKILL.md`

## Tier 3 (cross-cutting)

7. `extensions/ocx-platform/skills/control-plane/SKILL.md` (or equivalent top-level operator runbook)

## Suggested SKILL template sections (for all of the above)

- Purpose + boundaries (what this extension does _not_ do)
- Required inputs/config
- Canonical action flows
- Failure modes + recovery playbooks
- Safety/guardrail checks
- Example prompts/tool calls
- “Escalate when…” criteria
- Anti-patterns to avoid

## Why this matters

Without these skills, most of the added extension power remains implementation-only and will be underutilized or misused by agents/operators. Skill docs convert the PR from “feature-rich” to “operationally reliable.”
