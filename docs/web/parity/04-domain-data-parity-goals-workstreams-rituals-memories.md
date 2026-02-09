# Web Parity Task Domain Data Goals Workstreams Rituals Memories Schedules

## Task objective

Replace mock only data in major operational domains with real backend wiring, or explicitly degrade to truthful read only states until real APIs are available.

Domains in scope:

1. Goals
2. Workstreams and queue views
3. Rituals
4. Memories
5. Cron Jobs and Automations boundary alignment

## Why this is critical for OpenClaw setup

These pages are positioned as core control surfaces. Mock data on production paths creates false operational confidence and prevents reliable adoption for planning, automation, and memory workflows.

## Current behavior and evidence

### Goals are mock only

- Query uses local mock data:
  - `apps/web/src/hooks/queries/useGoals.ts:49`
- Mutations are mock only:
  - `apps/web/src/hooks/mutations/useGoalMutations.ts:7`
- Route consumes those hooks:
  - `apps/web/src/routes/goals/index.tsx:73`

### Workstreams and queue are mock only

- Workstreams query uses mock fetchers:
  - `apps/web/src/hooks/queries/useWorkstreams.ts:207`
- Workstream mutations are mock only:
  - `apps/web/src/hooks/mutations/useWorkstreamMutations.ts:13`
- Work queue data and mutations are mock in memory:
  - `apps/web/src/hooks/queries/useWorkQueue.ts:66`
- Route consumes these hooks:
  - `apps/web/src/routes/workstreams/index.tsx:55`

### Rituals are mock only

- Ritual query uses mock schedules and executions:
  - `apps/web/src/hooks/queries/useRituals.ts:62`
- Ritual mutations are mock only:
  - `apps/web/src/hooks/mutations/useRitualMutations.ts:7`
- Route includes explicit mock action text:
  - `apps/web/src/routes/rituals/index.tsx:197`

### Memories are mock only

- Memory query returns hardcoded records:
  - `apps/web/src/hooks/queries/useMemories.ts:37`
- Memory mutations are mock only:
  - `apps/web/src/hooks/mutations/useMemoryMutations.ts:7`
- Route consumes these hooks as primary source:
  - `apps/web/src/routes/memories/index.tsx:118`

### Cron Jobs and Automations are live, but split from Rituals

Cron and automation pages are backend wired:

- Jobs route and hooks are live:
  - `apps/web/src/routes/jobs/index.tsx:76`
  - `apps/web/src/hooks/queries/useCron.ts:54`
  - `apps/web/src/lib/api/cron.ts:196`
- Automations route and API are live:
  - `apps/web/src/routes/automations/index.tsx:119`
  - `apps/web/src/lib/api/automations.ts:127`

But rituals stay fully mock and disconnected:

- `apps/web/src/hooks/queries/useRituals.ts:62`
- `apps/web/src/hooks/mutations/useRitualMutations.ts:7`

This creates three scheduler surfaces with inconsistent data models and no shared source of truth.

## Unified migration strategy

## Principle 1 no fake success in production

If backend APIs do not exist for a domain yet:

1. Show empty or read only states.
2. Explain capability status.
3. Do not mutate local fake state as if persisted.

## Principle 2 move each domain to the closest existing backend first

- Goals should align with overseer goal APIs once contract parity is fixed.
- Rituals should align with `cron.*` and or `automations.*` depending product intent.
- Workstreams and memories may require new gateway methods; until then, do not present mutable fake data.

## Principle 3 one canonical scheduler model

Do not keep independent planner concepts in UI without backend ownership.

1. Pick one canonical scheduler entity for rituals: `cron` or `automations`.
2. Treat the other as an advanced view or adapter, not a separate source of truth.
3. Keep field mapping explicit and reversible.

## Principle 4 keep route UX stable while swapping data source layer

Retain route and component structure where possible; replace query and mutation adapters first.

## Implementation plan by domain

### Goals

1. Resolve gateway method contract first (see task 06).
2. Replace goal query and mutation adapters with `lib/api/overseer` methods.
3. Map UI status model to backend status model in one normalization layer.

Suggested files:

- `apps/web/src/hooks/queries/useGoals.ts`
- `apps/web/src/hooks/mutations/useGoalMutations.ts`
- `apps/web/src/lib/api/overseer.ts`

### Workstreams and queue

1. Decide whether workstreams are gateway owned entities or UI only artifacts.
2. If gateway owned, define methods and wire live hooks.
3. If not yet implemented, switch route to explicit preview mode and disable create update delete.

Suggested files:

- `apps/web/src/hooks/queries/useWorkstreams.ts`
- `apps/web/src/hooks/mutations/useWorkstreamMutations.ts`
- `apps/web/src/hooks/queries/useWorkQueue.ts`
- `apps/web/src/routes/workstreams/index.tsx`

### Rituals

1. Decide canonical backend mapping.
   - If ritual equals cron job, map ritual forms to `cron.add/update/remove/run`.
   - If ritual equals higher level automation, map to `automations.*`.
2. Remove mock only toast actions and local fake execution history.
3. Add cross navigation from Ritual detail to canonical scheduler entity.

Suggested files:

- `apps/web/src/hooks/queries/useRituals.ts`
- `apps/web/src/hooks/mutations/useRitualMutations.ts`
- `apps/web/src/routes/rituals/index.tsx`

### Cron Jobs and Automations alignment

1. Add adapter utilities that map ritual form state to the canonical scheduler payload.
2. Prevent duplicate entities by storing upstream ID in ritual metadata.
3. Show scheduler source badges in rituals list and detail view.

Suggested files:

- `apps/web/src/routes/jobs/index.tsx`
- `apps/web/src/routes/automations/index.tsx`
- `apps/web/src/hooks/queries/useRituals.ts`
- `apps/web/src/hooks/mutations/useRitualMutations.ts`

### Memories

1. Add real memory API methods if available.
2. If no backend support exists yet, convert memories route to read only disabled state with explicit message.
3. Remove optimistic fake mutation behavior in production path.

Suggested files:

- `apps/web/src/hooks/queries/useMemories.ts`
- `apps/web/src/hooks/mutations/useMemoryMutations.ts`
- `apps/web/src/routes/memories/index.tsx`

## Code sample pattern for domain adapter conversion

Current mock pattern:

```ts
async function fetchGoals(): Promise<Goal[]> {
  await new Promise((resolve) => setTimeout(resolve, 450));
  return [{ ...hardcoded }];
}
```

Target adapter pattern:

```ts
async function fetchGoalsLive(): Promise<Goal[]> {
  const result = await listOverseerGoals({ limit: 100 });
  return result.goals.map(mapOverseerGoalToUiGoal);
}

export function useGoals() {
  const live = useGatewayEnabled();
  return useQuery({
    queryKey: goalKeys.lists(),
    queryFn: () => (live ? fetchGoalsLive() : fetchGoalsReadonlyFallback()),
  });
}
```

Ritual to cron adapter example:

```ts
function ritualToCronCreate(ritual: RitualDraft): CronJobCreateParams {
  return {
    name: ritual.name,
    description: ritual.description,
    enabled: ritual.enabled,
    schedule: { kind: "cron", expr: ritual.cronExpr, tz: ritual.timezone },
    sessionTarget: "main",
    wakeMode: "next-heartbeat",
    payload: { kind: "agentTurn", message: ritual.prompt },
  };
}
```

## Testing plan

### Domain level tests

1. Add query tests for each domain that verify live adapters call real API functions.
2. Add mutation tests to verify no local fake writes happen in live mode.

### End to end sanity

1. Goals page shows real backend entries.
2. Ritual create update run performs real backend action.
3. Ritual item links to matching cron or automation entity and stays consistent after refresh.
4. Workstreams and memories either show real data or explicit not available state.

### Required test gates

1. `pnpm test:affected`
2. `pnpm test:smart`
3. `pnpm test`
4. `pnpm build && pnpm check`

## Acceptance criteria

1. No major domain page presents mock records as persisted production data.
2. All enabled create update delete actions hit real backend APIs.
3. Rituals share one canonical scheduler source with Jobs and or Automations.
4. Domains without backend support are clearly marked and non destructive.
5. Route behavior is deterministic across refresh and reconnect.

## Out of scope

1. Rebuilding domain UI component libraries from scratch.
2. New product level feature definitions for each domain.

## Related docs and references

- Related task docs:
  - [Core Conversation And Agent Live Mode](/web/parity/03-core-conversation-agent-live-parity)
  - [Gateway Contract Parity](/web/parity/06-gateway-contract-parity-overseer-method-catalog)
- Existing OpenClaw docs:
  - [Configuration](/configuration)
  - [Gateway Doctor](/gateway/doctor)
