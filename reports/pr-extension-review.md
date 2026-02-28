# PR Review: `extensions/*` + SKILL Surface

## Scope reviewed

Focused on the newly added extension stack and related skill surface in this branch:

- `extensions/ocx-event-ledger`
- `extensions/ocx-routing-policy`
- `extensions/ocx-budget-manager`
- `extensions/ocx-evaluation`
- `extensions/ocx-orchestration`
- `extensions/ocx-observability`
- `extensions/inter-agent-mail`
- `extensions/inter-agent-mail/skills/mail-triage/SKILL.md`

---

## (a) Missing SKILL.md docs that are likely high-leverage wins

The current PR introduces a lot of operational behavior and gateway/tool affordances, but only one explicit operator-facing skill (`mail-triage`) for the new stack. The biggest gap is not implementation functionality — it is _agent/operator ergonomics_ and _safe usage patterns_.

### Recommended high-impact new skills

1. **`extensions/ocx-orchestration/skills/orchestration/SKILL.md`**
   - Why: `orchestration` is a multi-action tool plus many gateway methods and webhook semantics. Without a skill, agents will underuse workflows (review requests, blocked-item reporting, sprint telemetry).
   - Should include:
     - canonical action playbooks (`list_items` → `update_item` → `request_review`)
     - failure/retry patterns for blocked work
     - escalation hygiene (when to report blocked vs ask for review)

2. **`extensions/ocx-routing-policy/skills/routing-policy/SKILL.md`**
   - Why: model-routing + prompt-contributor pipeline is strategically important and easy to misuse.
   - Should include:
     - confidence threshold tuning guidance
     - when to override default model vs preserve agent-configured model
     - pattern library for policy rules by task class

3. **`extensions/ocx-budget-manager/skills/budget-ops/SKILL.md`**
   - Why: enforcement modes (`read-only`, `soft`, `hard`) and hierarchy/price-table semantics are policy-heavy and likely to drift.
   - Should include:
     - rollout progression (`read-only` baseline → `soft` → selective `hard`)
     - incident response for budget breaches
     - “safe defaults” for new teams/scopes

4. **`extensions/ocx-evaluation/skills/eval-ops/SKILL.md`**
   - Why: async scoring + judge profiles + quality-risk thresholds need operational interpretation.
   - Should include:
     - how to triage low scores
     - model-comparison and tool-report interpretation
     - scorecard retention and calibration cadence

5. **`extensions/ocx-observability/skills/observability-reaper/SKILL.md`**
   - Why: reaper actions can become destructive (`terminate_session`, `cancel_run`) and need explicit human-in-the-loop norms.
   - Should include:
     - confirmation workflows
     - suppression windows and anomaly false-positive handling
     - action policy examples by severity level

6. **`extensions/ocx-event-ledger/skills/event-ledger/SKILL.md`**
   - Why: this appears to be the canonical event spine for other extensions; users need query and retention mental models.
   - Should include:
     - hot/warm/cold retention tradeoffs
     - canonical query patterns (run timeline, incident slice, family filters)
     - schema conventions for emitted events

7. **Cross-extension skill: `extensions/ocx-platform/skills/control-plane/SKILL.md` (if consolidated)**
   - Why: these extensions function as a coherent control plane. A single “operator runbook” skill would reduce context thrash and teach sequence-level workflows.

---

## (b) Are current extension boundaries meaningful? What to consolidate?

### What is well-separated today

The decomposition is conceptually strong:

- **Ledger** (`ocx-event-ledger`) = event durability + retention + query
- **Routing** (`ocx-routing-policy`) = model/prompt decisions
- **Budget** (`ocx-budget-manager`) = spend + quota enforcement
- **Evaluation** (`ocx-evaluation`) = quality scoring + comparisons
- **Observability** (`ocx-observability`) = health metrics/anomaly/reaper actions
- **Orchestration** (`ocx-orchestration`) = work-item/sprint/delegation state machine
- **Inter-agent-mail** = asynchronous delegation transport

This separation aligns to bounded contexts and is defendable.

### Consolidation candidates (and expected benefit)

1. **Consolidate `ocx-observability` + `ocx-event-ledger` into an “observability-plane” package**
   - Benefit: stronger single-source-of-truth for telemetry capture, storage, retention, and anomaly evaluation.
   - Concrete upside:
     - fewer duplicated event-shape transforms
     - shared indexing/query cache
     - simpler incident drill-down (same backend for monitor + history)
   - Risk: larger blast radius per deploy.

2. **Consolidate `ocx-budget-manager` + `ocx-routing-policy` into a “governance-plane” package (or tight shared library)**
   - Benefit: budget-aware routing becomes first-class (not loosely coupled via events only).
   - Concrete upside:
     - direct budget utilization feed into model route selection
     - unified policy DSL for cost/latency/quality constraints

3. **Keep `ocx-orchestration` and `inter-agent-mail` separate, but extract shared “coordination core”**
   - Benefit: keep transport concerns (mailbox semantics) independent, while sharing delegation primitives.
   - Concrete upside:
     - one canonical lineage/delegation graph model
     - less duplicated escalation/blocking semantics

### Recommendation

Do **not** hard-merge everything now. Prefer a **shared control-plane runtime library** first (event envelope types, query adapters, policy engine primitives, state-dir layout conventions), then reassess package merges after operational telemetry proves stable.

---

## (c) Tool sprawl: consolidate or add new tools?

### Current state

- Good pattern already used: `mail(action=...)` and `orchestration(action=...)` provide “many tools in one.”
- Many capabilities are currently gateway-method-first rather than agent-tool-first (especially evaluation/observability/event-ledger).

### Consolidation opportunities

1. **Create a unified control-plane tool**
   - Proposed: `control_plane(action=...)`
   - Actions could include:
     - `run_summary` (ledger)
     - `query_events` (ledger)
     - `health` / `anomalies` (observability)
     - `budget_status` / `budget_report` (budget)
     - `scorecards` / `quality_risk` (evaluation)
     - `route_explain` (routing)
   - Benefit: lower tool-selection entropy in agent context and less repetitive tool schema overhead.

2. **Split “operator” vs “worker” tool personas**
   - Keep existing domain tools, but expose:
     - `worker_mail(action=...)` for task agents
     - `ops_control(action=...)` for supervisors/operators
   - Benefit: reduces accidental misuse and narrows permissions.

3. **Add a meta tool for cross-domain explainability**
   - Proposed: `decision_trace(action='why_route'|'why_blocked'|'why_escalated'|'why_low_score')`
   - Pulls from routing policy, budget ledger, evaluation, and observability timeline in one response.
   - Benefit: better debuggability than querying multiple tools/methods manually.

### Worth it for context usage?

Yes, if done with strict action names + compact response envelopes.

- **Pros**: reduced prompt/tool-cardinality, fewer schema tokens, less planning overhead.
- **Cons**: over-consolidation can create mega-tools that are hard to permission and test.

Suggested compromise: one consolidated **read/query** tool (`control_plane`) and keep **mutation actions** in specialized tools.

---

## (d) Re-architecture / pivots / more elegant patterns

### 1) Adopt an explicit "control-plane event contract" package

Introduce a shared package (e.g., `extensions/ocx-core-contracts`) for:

- event envelope schemas
- family/type registries
- causal lineage standards (`runId`, `sessionKey`, `traceId`, `spanId`)
- retention tier metadata

This avoids schema drift across ledger/evaluation/observability/orchestration.

### 2) Move from ad-hoc file stores toward pluggable state backends

Several extensions appear file/stateDir-centric. Add a storage adapter boundary now:

- `FileStateAdapter` (default)
- optional `SQLiteAdapter` (single file DB)
- future external adapters

This enables meaningful consolidation benefits (shared transactions/indexes) without forcing hard package merges.

### 3) Introduce a policy composition layer

Routing, budget, and reaper policies should be composable in one engine:

- common policy AST
- deterministic evaluation order
- unified explain output

This could collapse repeated policy parsing/evaluation logic.

### 4) Build an end-to-end "run lifecycle" façade

A façade service that ties together:

1. route decision
2. budget admission
3. execution events
4. quality score
5. health/evaluation escalations

Operators care about lifecycle outcomes, not plugin boundaries. A façade/API could become the primary integration surface.

### 5) Shift from plugin-local CLIs to a single operator CLI namespace

Instead of multiple plugin-specific command surfaces over time, prefer one cohesive namespace:

- `openclaw ops ...`
- `openclaw ops budget ...`
- `openclaw ops events ...`
- `openclaw ops quality ...`

Keeps operational runbooks and docs simpler.

---

## Prioritized action plan

### P0 (immediate)

- Add missing SKILL.md docs for orchestration, routing-policy, budget, evaluation, observability, event-ledger.
- Add one operator-focused cross-extension skill/runbook.

### P1 (near-term)

- Add `control_plane(action=...)` as read/query façade.
- Extract shared contracts package (`ocx-core-contracts`).

### P2 (after production telemetry)

- Decide on selective package merges:
  - observability + event-ledger
  - budget + routing-policy
- Introduce pluggable storage backend abstraction.

---

## Bottom line

The current separation is mostly meaningful and maps well to bounded contexts. The biggest immediate win is **operator/agent skill documentation** and a **query-layer consolidation tool**. Hard merges should wait until shared contracts + storage abstractions reduce the blast radius and make consolidation a net simplification rather than a coupling increase.
