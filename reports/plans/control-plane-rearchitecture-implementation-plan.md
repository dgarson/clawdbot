# Implementation Plan: Control-Plane Re-architecture (d)

## Phase 1: Architecture Foundations

- [ ] Create architecture RFC set.
  - [ ] Shared contract RFC.
  - [ ] Storage adapter RFC.
  - [ ] Policy composition RFC.
  - [ ] Lifecycle facade RFC.
- [ ] Define non-functional requirements.
  - [ ] performance budgets.
  - [ ] observability and audit requirements.
  - [ ] rollback and migration criteria.

## Phase 2: Contracts + Storage Adapters

- [ ] Implement shared contracts package.
  - [ ] Event/decision/evaluation/escalation schemas.
  - [ ] Versioning strategy.
- [ ] Implement storage adapter layer.
  - [ ] File adapter parity.
  - [ ] SQLite pilot adapter.
  - [ ] migration utilities.

## Phase 3: Policy Composition Engine

- [ ] Build common policy AST and evaluator.
  - [ ] Routing policy integration.
  - [ ] Budget policy integration.
  - [ ] Reaper policy integration.
- [ ] Add explain-by-construction artifacts.
  - [ ] per-decision trace IDs.
  - [ ] serialized explain output.

## Phase 4: Lifecycle Facade + Ops CLI

- [ ] Implement run lifecycle facade APIs.
  - [ ] route + budget + execution + quality + escalation timeline.
  - [ ] evidence links to ledger.
- [ ] Implement `openclaw ops` CLI namespace.
  - [ ] events subcommands.
  - [ ] health subcommands.
  - [ ] budget subcommands.
  - [ ] quality subcommands.

## Phase 5: Rollout and Hardening

- [ ] Progressive environment rollout.
  - [ ] canary.
  - [ ] staged production.
  - [ ] full production.
- [ ] Hardening and cleanup.
  - [ ] deprecate superseded APIs.
  - [ ] finalize docs/runbooks.
  - [ ] postmortem template updates.
