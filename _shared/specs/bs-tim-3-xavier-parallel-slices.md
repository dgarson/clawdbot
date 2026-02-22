# bs-tim-3 — Xavier Parallel Slices (Draft for Tim sign-off)

## Scope
`openclaw/openclaw#bs-tim-3` — Memory Architecture 2.0 (Scoped, Retrievable, Governable)

## Slice C — Scoped Memory Schema + Retrieval Policy Interface

### Deliverables
- Scoped memory model:
  - `session`
  - `task`
  - `agent`
  - `global`
- Retrieval policy interface:
  - scope filters
  - recency + relevance weighting hooks
  - hard token budget output contract
- Minimal tests for scope isolation and retrieval ordering

### Suggested files
- `src/memory/memory-scope.ts`
- `src/memory/memory-retrieval-policy.ts`
- `test/memory/memory-scope.test.ts`

## Slice D — Governance: Retention + Access Boundaries

### Deliverables
- Retention policy evaluator (TTL by scope/classification)
- Access boundary checks (requester role + scope permissions)
- Audit event hooks for reads/writes/evictions
- Minimal tests for denied access and expiry behavior

### Suggested files
- `src/memory/memory-governance.ts`
- `src/memory/memory-retention.ts`
- `test/memory/memory-governance.test.ts`

## Acceptance criteria
- Scope isolation is enforced by default
- Retrieval never crosses unauthorized boundaries
- Expired records are excluded and evictable
- Memory reads/writes emit governance audit events
