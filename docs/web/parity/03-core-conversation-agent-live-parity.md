# Web Parity Task Core Conversation And Agent Live Mode

## Task objective

Eliminate mock behavior in core day to day workflows for conversations and agents in active live mode. This task covers:

1. Conversation creation.
2. Agent data loading behavior.
3. Agent status mutation behavior.

## Why this is critical for OpenClaw setup

Conversations and agents are the core operator loop. If creating sessions or changing agent state is mock only, users cannot trust control UI behavior even when gateway connection is healthy.

## Current behavior and evidence

### Conversation creation always uses mock

- `apps/web/src/hooks/mutations/useConversationMutations.ts:118` sets `mutationFn: createConversationMock` unconditionally.

### Conversation read and send are already gateway backed

- Conversations list and message history are live capable in `useConversations`:
  - `apps/web/src/hooks/queries/useConversations.ts:148`
- Session and chat APIs are gateway methods:
  - `apps/web/src/lib/api/sessions.ts:124`
  - `apps/web/src/lib/api/sessions.ts:142`
  - `apps/web/src/lib/api/sessions.ts:153`

### Agent query can silently fall back to mock in live mode

- In live mode, errors in `fetchAgents` return mock agents instead of surfacing failure:
  - `apps/web/src/hooks/queries/useAgents.ts:130`

### Agent status updates are mock only while UI exposes toggle

- Mutation uses `updateAgentStatusMock` only:
  - `apps/web/src/hooks/mutations/useAgentMutations.ts:279`
- UI calls that mutation from multiple pages:
  - `apps/web/src/routes/agents/index.tsx:154`
  - `apps/web/src/routes/agents/$agentId.tsx:158`
  - `apps/web/src/components/domain/config/AgentConfig.tsx:125`

### Gateway supports creating session entries via sessions patch

- Session patch path can create missing session entries (`existing ? ... : { sessionId: randomUUID() ... }`):
  - `src/gateway/sessions-patch.ts:75`
  - `src/gateway/server-methods/sessions.ts:159`

## Design decisions to resolve

## Decision A conversation creation API path

Use a live creation path in web that creates a real session key and persists metadata via `sessions.patch`.

Suggested behavior:

1. Create session key (agent scoped when agentId exists).
2. Call `patchSession({ key, label })`.
3. Return a `Conversation` mapped to real session key.

## Decision B agent load failure behavior in live mode

In live mode, do not silently return mock data. Surface an error state so operators can trust diagnostics.

Suggested behavior:

- `fetchAgents` should throw on gateway errors when live mode is enabled.
- Mock fallback remains only for explicit mock mode.

## Decision C agent status action

Current status appears derived from runtime health, not a first class mutable gateway resource. Stop pretending this is a real mutation.

Recommended short term behavior:

1. Disable status toggles in live mode.
2. Keep toggles only in explicit mock mode.
3. Label status as runtime derived.

Alternative if product requires mutation:

- Add a real backend method and wire to it. Do not keep mock mutation on live pages.

## Implementation plan

### Step 1 add `createConversationLive`

Update `useCreateConversation` to use live or mock based on `useGatewayEnabled`.

Expected file:

- `apps/web/src/hooks/mutations/useConversationMutations.ts`

Example shape:

```ts
async function createConversationLive(
  data: Omit<Conversation, "id" | "createdAt" | "updatedAt">,
): Promise<Conversation> {
  const now = new Date().toISOString();
  const key = data.agentId
    ? buildAgentSessionKey(data.agentId, `session-${Date.now()}`)
    : `session:${uuidv7()}`;

  await patchSession({ key, label: data.title ?? null });

  return {
    ...data,
    id: key,
    createdAt: now,
    updatedAt: now,
  };
}
```

### Step 2 remove silent agent fallback in live mode

Update `fetchAgents` error handling so live mode returns error states, not mock data.

Expected file:

- `apps/web/src/hooks/queries/useAgents.ts`

### Step 3 gate status toggle controls by mode

Disable or hide status toggle UI when in live mode until a real backend mutation exists.

Expected files:

- `apps/web/src/routes/agents/index.tsx`
- `apps/web/src/routes/agents/$agentId.tsx`
- `apps/web/src/components/domain/config/AgentConfig.tsx`
- `apps/web/src/hooks/mutations/useAgentMutations.ts`

## Testing plan

### Unit and hook tests

1. Add tests for `useCreateConversation` verifying live mode uses `patchSession`.
2. Add tests for `fetchAgents` in live mode to ensure errors are surfaced.
3. Add tests for status toggle availability rules by mode.

### Manual verification

1. Create conversation from conversations page and verify entry appears in sessions list.
2. Reload page and verify conversation persists with same key.
3. Simulate gateway failure and confirm agents page shows error, not fake agents.
4. Verify status toggle is unavailable in live mode.

### Required test gates

1. `pnpm test:affected`
2. `pnpm test:smart`
3. `pnpm test`
4. `pnpm build && pnpm check`

## Acceptance criteria

1. Conversation creation writes real session metadata in live mode.
2. Conversation IDs correspond to real session keys.
3. Agent list does not silently degrade to mock when live mode is on.
4. No fake status mutation behavior is exposed in live mode.

## Out of scope

1. Full redesign of agent lifecycle model.
2. New backend API surface unless explicitly needed for real status mutation.

## Related docs and references

- Related task docs:
  - [Domain Data Parity](/web/parity/04-domain-data-parity-goals-workstreams-rituals-memories)
  - [Gateway Contract Parity](/web/parity/06-gateway-contract-parity-overseer-method-catalog)
- Existing OpenClaw docs:
  - [Configuration](/configuration)
  - [Gateway Doctor](/gateway/doctor)
