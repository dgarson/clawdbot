# Unified Inbound & Policy Pipeline

**Source Material:** Synthesized from `designs/primitive-brainstorms/results-2/inbound-message-pipeline.md` and `designs/primitive-brainstorms/results-1/message-policy-engine.md`.

## Goal

Create a single, consolidated pipeline for processing all inbound messages across all channels. This primitive standardizes envelope formatting, applies a unified policy engine for gating (allowlists, mentions, auth), and orchestrates dispatch, reducing security risks and maintenance overhead from duplicated logic.

## Problem Statement

Currently, every channel (Discord, Slack, Signal, Web) re-implements its own inbound flow. They individually handle:

1.  **Normalization:** converting raw events to `MessageContext`.
2.  **Gating:** checking allowlists, mention rules, and "command" vs "chat" logic.
3.  **History:** loading conversation context.
4.  **Dispatch:** triggering the agent or auto-replies.

This leads to:

- **Inconsistent Security:** Allowlist logic might differ slightly between channels.
- **Drift:** Fixes to "mention parsing" in Discord might be missed in Slack.
- **Complex Debugging:** "Why did the bot ignore this?" requires investigating channel-specific code.

## Proposed Primitive: `InboundPipeline`

The `InboundPipeline` is a higher-order primitive that composes a **Message Policy Engine** with a standardized **Execution Flow**.

### 1. Message Policy Engine (The "Brain")

A unified decision maker that takes raw context and returns a comprehensive `PolicyDecision`. It does _not_ execute actions; it only decides _if_ actions should be allowed.

**Responsibilities:**

- **Allowlist Check:** Is the sender/group allowed?
- **Mention Logic:** Did the user mention the bot? Is it required for this channel/group type?
- **Command Auth:** Is this a privileged command? Does the user have rights?
- **Group Policy:** Are we in "open", "allowlist-only", or "disabled" mode for this group?

**API:**

```ts
interface PolicyInput {
  channelId: string;
  sender: { id: string; tags: string[] };
  chat: { id: string; isGroup: boolean };
  content: { text: string; mentions: string[] };
  config: PolicyConfig; // Resolved from OpenClawConfig
}

interface PolicyDecision {
  accepted: boolean;
  reason:
    | "allowed_user"
    | "explicit_mention"
    | "admin_command"
    | "denied_policy"
    | "denied_allowlist"
    | "ignored_no_mention";
  flags: {
    isCommand: boolean;
    isPrivileged: boolean;
    shouldReply: boolean;
  };
  metadata?: Record<string, unknown>;
}

function evaluateMessagePolicy(input: PolicyInput): PolicyDecision;
```

### 2. Inbound Pipeline (The "Flow")

A standardized orchestration flow that every channel adapter invokes.

**Responsibilities:**

- **Envelope Normalization:** (via Channel Adapter)
- **Policy Evaluation:** Calls `evaluateMessagePolicy`.
- **Context Assembly:** Loads history, user profiles (if policy permits).
- **Typing/State:** Manages "typing..." indicators.
- **Dispatch:** Routes to the `Agent Session Kernel` or `Command Runner`.

**API:**

```ts
interface ChannelAdapter {
  // Extract raw metadata
  normalize(raw: unknown): InboundEnvelope;
  // Channel-specific actions
  setTyping(typing: boolean): Promise<void>;
  sendReply(payload: ReplyPayload): Promise<void>;
}

const pipeline = createInboundPipeline({
  adapter: myChannelAdapter,
  kernel: sessionKernel,
  config: globalConfig,
});

// Called by the channel listener
await pipeline.process(rawEvent);
```

## Integration Plan

### Phase 1: Policy Engine Core

1.  Implement `src/inbound/policy/engine.ts`.
2.  Centralize all logic for `allowlist`, `requireMention`, and `adminUsers` into this engine.
3.  Add comprehensive unit tests covering all edge cases (DM vs Group, Admin vs User, Mention vs No-Mention).

### Phase 2: Pipeline Orchestrator

1.  Implement `src/inbound/pipeline.ts`.
2.  Define the `ChannelAdapter` interface.
3.  Implement the standard flow: `Normalize -> Policy -> History -> Kernel -> Reply`.

### Phase 3: Channel Migration

1.  **Discord:** Refactor `src/channels/discord` to implement `ChannelAdapter` and use `pipeline.process()`.
2.  **Slack:** Refactor `src/channels/slack` similarly.
3.  **Web/Socket:** Migrate the web auto-reply flow.
4.  **Signal:** Migrate Signal integration.

### Phase 4: Observability & Diagnostics

1.  Emit structured logs from the Pipeline with the `PolicyDecision.reason`.
2.  Update `openclaw status` or `doctor` to show why the last message was ignored (using the decision reason).

## Expected Impact

- **Zero Logic Duplication:** "Should I reply?" logic exists in exactly one file.
- **Security:** Allowlist and Admin checks are consistent and auditable everywhere.
- **Extensibility:** New channels (e.g., WhatsApp, Telegram) just implement a dumb Adapter; they get full policy/history/dispatch behavior for free.
