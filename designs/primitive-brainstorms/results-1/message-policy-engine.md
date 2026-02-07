# Message policy engine primitive

**Goal:** Provide a unified policy engine for inbound message gating, allowlists, mention rules, and command authorization across channels.

## Current state and pain points

- Allowlist matching and command gating are implemented in several helpers but still require per-channel assembly and interpretation.
- Mention gating has specialized logic for group and command bypass behavior, which is easy to diverge when channels evolve.
- Channel plugins and core channel code must coordinate multiple small helper utilities to make a final decision about whether to accept or skip a message.

## Proposed primitive

Create a **Message Policy Engine** that provides:

1. **Unified policy model**
   - Standard structure for allowlists, group policy, mention requirements, and command authorization.

2. **Single evaluation entry point**
   - A single `evaluateMessagePolicy` function that returns a decision, reason codes, and telemetry context.

3. **Reason codes and diagnostics**
   - Expose machine readable reason codes to help with debugging and user feedback.

4. **Channel adapters**
   - Small adapters to translate channel specific metadata into the policy model.

## API sketch

```ts
export interface MessagePolicyInput {
  channelId: string;
  sender: { id: string; name?: string; tags?: string[] };
  chat: { id: string; isGroup: boolean };
  message: { text?: string; hasCommand: boolean; mentions?: string[] };
  config: {
    allowlist?: string[];
    groupPolicy: "open" | "allowlist" | "disabled";
    requireMention: boolean;
    allowTextCommands: boolean;
  };
}

export interface MessagePolicyDecision {
  allowed: boolean;
  reason: string;
  details?: Record<string, unknown>;
}

export function evaluateMessagePolicy(input: MessagePolicyInput): MessagePolicyDecision;
```

## Integration plan

### Phase 1: Core policy layer

- Implement the policy engine using existing helper logic for allowlists, mention gating, and command authorization.
- Provide unit tests that cover group and direct message scenarios.

### Phase 2: Core channel migration

- Update core channel implementations to call the policy engine instead of combining helpers directly.
- Preserve existing behavior while emitting reason codes for diagnostics.

### Phase 3: Plugin channel migration

- Add a light adapter layer for plugin channels to map their metadata into the policy model.
- Replace duplicated gating logic inside plugin channel implementations.

### Phase 4: Operator feedback

- Add optional logging and status output that use reason codes for clear messaging in status commands.

## Targeted complexity reductions

- Reduce multiple gating helper calls into a single policy evaluation step.
- Ensure consistent behavior across channels and plugins for allowlists and mention rules.
- Provide a single debugging surface for message acceptance decisions.
