# Design: Control-Plane Re-architecture and Strategic Pivots (d)

## Objective

Define a higher-cohesion architecture for the control-plane stack with better explainability, lifecycle visibility, and operational resilience.

## Architecture Pivot Themes

### Pivot 1: Shared Control-Plane Contracts

Standardize contracts across domains:

- event schema,
- policy evaluation trace,
- quality risk record,
- escalation decision artifact.

### Pivot 2: Pluggable State Backends

Abstract persistence through adapters:

- file (default),
- SQLite (next),
- external stores (future).

### Pivot 3: Unified Policy Composition Engine

Unify routing, budget, and reaper policy semantics:

- common policy AST,
- deterministic precedence,
- explain-by-construction output.

### Pivot 4: Run Lifecycle Facade

Expose a first-class lifecycle service:

1. route decision,
2. budget admission,
3. execution timeline,
4. quality evaluation,
5. health/escalation outcomes.

### Pivot 5: Unified Operator CLI Surface

Adopt `openclaw ops` namespace for cross-domain workflows:

- `openclaw ops events ...`
- `openclaw ops health ...`
- `openclaw ops budget ...`
- `openclaw ops quality ...`

## Architectural Guardrails

- Keep destructive controls explicit and auditable.
- Keep domain ownership despite shared contracts.
- Prefer additive migration with rollback points.

## Target Outcomes

- Single coherent control-plane mental model.
- Lower integration friction for new extensions.
- Faster root-cause and policy debugging.
