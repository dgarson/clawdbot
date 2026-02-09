# Web Parity Task Channel Config Wiring

## Task objective

Make channel configuration in `apps/web` production capable by wiring the active Settings channel page to a single, complete, backend connected implementation that covers core and extension channels.

## Why this is critical for OpenClaw setup

Channel setup is a primary operator workflow. If this page is incomplete or partially mocked, users cannot reliably configure message ingress and delivery, which directly blocks practical OpenClaw use.

## Current behavior and evidence

### Active settings uses a reduced component

- `apps/web/src/components/domain/settings/ChannelsSection.tsx:31` mounts `<ChannelConfigConnected />`.
- `apps/web/src/components/domain/config/ChannelConfigConnected.tsx:92` hard filters to:
  - `telegram`, `whatsapp`, `discord`, `signal`, `slack`, `imessage`.

### Placeholder actions in active component

- WhatsApp pairing is placeholder toast:
  - `apps/web/src/components/domain/config/ChannelConfigConnected.tsx:260`
- Slack OAuth is placeholder toast:
  - `apps/web/src/components/domain/config/ChannelConfigConnected.tsx:271`

### More complete component exists but is not wired

- Rich channel matrix and generic dialogs are implemented in:
  - `apps/web/src/components/domain/config/ChannelConfig.tsx:44`
  - `apps/web/src/components/domain/config/ChannelConfig.tsx:811`
- It already includes a real WhatsApp QR flow call path:
  - `apps/web/src/components/domain/config/ChannelConfig.tsx:615`
  - `apps/web/src/lib/api/config.ts:214`

## Scope and design goals

1. One canonical channel config component in active settings path.
2. Full channel coverage based on gateway metadata and plugin channels.
3. No placeholder connect actions in production settings.
4. Clear platform and install requirements for local only channels.

## Recommended approach

### Step 1 converge to one component

Choose one implementation as canonical and remove dual path drift.

Recommended: keep `ChannelConfig` as canonical and retire `ChannelConfigConnected` after migration.

Primary wiring change:

- `apps/web/src/components/domain/settings/ChannelsSection.tsx`

### Step 2 preserve live data sourcing from `channels.status` and config snapshot

Use existing hooks and data flow already present in both components:

- `useChannelsStatus`
- `useConfig`
- `usePatchConfig`
- `useLogoutChannel`

Files:

- `apps/web/src/hooks/queries/useChannels.ts`
- `apps/web/src/hooks/queries/useConfig.ts`
- `apps/web/src/hooks/mutations/useConfigMutations.ts`

### Step 3 enforce backend connected connect actions

Remove all toast placeholder handlers in active path. Every connect action must call real backend APIs.

Minimum expected connect behavior:

1. Telegram, Discord, Signal, iMessage: config patch + enable.
2. WhatsApp: QR start and wait using `web.login.start` and `web.login.wait`.
3. Slack: real token mode and delegated OAuth mode (see OAuth task).

### Step 4 retain extension channel compatibility

Do not hardcode a fixed list in rendering logic. Use gateway channel metadata and plugin surfaced channel IDs.

Relevant backend and plugin context:

- `src/channels/plugins/index.ts`
- `src/gateway/server-methods-list.ts`
- `src/gateway/server-methods/web.ts`

## Implementation details

### Replace fixed supported set logic

Current reduced logic:

```ts
const supportedChannels = new Set<ChannelId>([
  "telegram",
  "whatsapp",
  "discord",
  "signal",
  "slack",
  "imessage",
]);
```

Target behavior:

- Use channel order and channel metadata from `channels.status`.
- Render known specialized sheets for core channels.
- Render generic config dialog for remaining channels with schema driven fields.

### Preserve platform constraints

Continue honoring platform checks, especially for local only channels (`imessage`) and install dependent channels (`signal`, `bluebubbles`, `obsidian`).

Existing platform model is in:

- `apps/web/src/components/domain/config/ChannelConfig.tsx:467`

## Testing plan

### Component and hook tests

1. Add tests that verify all channels returned by `channels.status.channelOrder` are represented in UI.
2. Add tests that ensure connect handlers are backend calls, not placeholder toasts.

### Manual regression checklist

1. Configure Telegram and Discord with token flow.
2. Pair WhatsApp via QR and verify connected state refresh.
3. Configure Slack in token mode.
4. Verify unsupported platform channels show proper guidance instead of broken actions.

### Required test gates

1. `pnpm test:affected`
2. `pnpm test:smart`
3. `pnpm test`
4. `pnpm build && pnpm check`

## Acceptance criteria

1. Active settings page uses one canonical channel config implementation.
2. No placeholder connect actions remain in production settings.
3. Channel list is derived from live gateway metadata, not a hardcoded six channel set.
4. WhatsApp QR pairing works end to end.
5. Slack OAuth readiness is aligned with OAuth delegated auth task.

## Out of scope

1. Designing entirely new extension channel SDK contracts.
2. Replacing all generic dialogs with custom per channel UI.

## Related docs and references

- Related task docs:
  - [OAuth Delegated Auth End To End](/web/parity/01-oauth-delegated-auth-e2e)
  - [Gateway Contract Parity](/web/parity/06-gateway-contract-parity-overseer-method-catalog)
- Existing OpenClaw docs:
  - [Signal Channel](/channels/signal)
  - [Configuration](/configuration)
