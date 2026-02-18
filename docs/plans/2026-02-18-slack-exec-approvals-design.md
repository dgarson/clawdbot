# Slack Exec Approvals — Design

**Date:** 2026-02-18
**Branch:** feat/channel-interactive-input-tools

## Problem

Discord has a fully interactive exec approval flow (`DiscordExecApprovalHandler`) that posts
Block/Components v2 messages with Allow once / Always allow / Deny buttons. When an approver
clicks a button, the handler resolves the approval through the gateway and updates the message.

Slack currently falls back to the generic `ExecApprovalForwarder`, which delivers a plain text
message with manual slash-command instructions (`/approve <id> allow-once|allow-always|deny`).
No buttons, no interactivity.

## Goal

Give Slack feature parity for exec approvals: Block Kit buttons in the originating channel,
resolved through a gateway call when clicked. DM delivery to approvers is deferred.

## Scope

Part 1 only: `SlackExecApprovalHandler` for exec approvals.
Agent tool wiring (`ask_question` / `ask_confirmation` in `createOpenClawTools()`) is a
separate follow-up.

## Approach

Build a **thin handler** that reuses existing infrastructure unchanged:

| Reused                           | Role                                        |
| -------------------------------- | ------------------------------------------- |
| `createSlackInteractiveAdapter`  | Block Kit building + system event polling   |
| `registerSlackInteractionEvents` | Bolt `app.action()` routing → system events |
| `sendMessageSlack`               | Message delivery                            |

The handler adds only:

- Its own `GatewayClient` (needed to listen for `exec.approval.requested` events)
- Logic to call `adapter.askQuestion()` and resolve the gateway on response

No changes to `interactions.ts`, `exec-approval-forwarder.ts`, or any gateway code.

## Components

### New

**`src/slack/monitor/exec-approvals.ts`**

`SlackExecApprovalHandler` class with:

- `constructor({ app, botToken, accountId, config, gatewayUrl?, cfg })`
- `start()` — connects `GatewayClient` with `operator.approvals` scope
- `stop()` — disconnects gateway client
- `shouldHandle(request)` — checks enabled, approvers present, agentFilter, sessionFilter, account match
- `handleApprovalRequested(request)` — core flow (see Data Flow below)

### Modified (minimally)

**`src/config/types.slack.ts`**

```ts
export type SlackExecApprovalConfig = {
  /** Enable interactive exec approvals for this Slack account. Default: false. */
  enabled?: boolean;
  /** Slack user IDs authorized to click approval buttons. Required if enabled. */
  approvers?: string[];
  /** Only forward approvals for these agent IDs. Omit = all agents. */
  agentFilter?: string[];
  /** Only forward approvals matching these session key patterns (substring or regex). */
  sessionFilter?: string[];
};
```

Add `execApprovals?: SlackExecApprovalConfig` to the Slack account config type.

**`src/slack/monitor/provider.ts`**

After the Bolt app is created and `registerSlackMonitorEvents` is called, instantiate and
start the handler if `slackCfg.execApprovals?.enabled`:

```ts
if (slackCfg.execApprovals?.enabled) {
  const execApprovalHandler = new SlackExecApprovalHandler({
    app,
    botToken,
    accountId: account.accountId,
    config: slackCfg.execApprovals,
    cfg,
    runtime,
  });
  await execApprovalHandler.start();
  // stop on abort
}
```

## Data Flow

```
exec.approval.requested (gateway broadcast)
  → handler.shouldHandle(request)
      checks: enabled, approvers.length > 0, agentFilter, sessionFilter,
              account match (session store lookup, channel must be "slack")
  → extractSlackChannelId(request.sessionKey)
      parses "agent:<id>:slack:channel:<C...>" → channel ID
      returns null if not a slack session → skip
  → adapter.askQuestion({
        to: channelId,
        question: {
          id: request.id,
          text: buildApprovalText(request),   // command + metadata
          options: [
            { label: "Allow once",   value: "allow-once" },
            { label: "Always allow", value: "allow-always" },
            { label: "Deny",         value: "deny" },
          ],
          timeoutMs: Math.max(0, request.expiresAtMs - Date.now()),
        },
        accountId,
    })
      ↓ sendMessageSlack posts Block Kit message
      ↓ polls systemEvents for "openclaw:question:<id>:" prefix
  → approver clicks button
      → registerSlackInteractionEvents enqueues system event (no changes needed)
      → adapter polling detects event, returns InteractivePromptResponse
  → response.timedOut === true  → log debug, return (approval expires naturally)
  → response.answered === true
      → validate response.respondedBy?.id is in config.approvers
        (unauthorized: no gateway call; approval continues waiting or times out)
      → gatewayClient.request("exec.approval.resolve", {
            id: request.id,
            decision: response.selectedValues[0],   // "allow-once"|"allow-always"|"deny"
        })
      → registerSlackInteractionEvents has already updated the message in-place
        (buttons replaced with "✅ <decision> selected by @user")
```

No `exec.approval.resolved` listener needed in the handler. The adapter's built-in message
update on button click provides sufficient UX feedback.

## Error Handling

| Condition                          | Behavior                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| Session key is not a Slack session | `logDebug` + skip; text forwarder still fires                                  |
| Channel ID can't be extracted      | `logError` + skip                                                              |
| `sendMessageSlack` throws          | `logError`; approval expires naturally; text forwarder fires for other targets |
| Approver not in `config.approvers` | No gateway call; approval continues waiting / times out                        |
| Gateway resolve fails              | `logError`; agent's exec tool times out on its own                             |
| Gateway disconnects                | `logError`; handler stops; text forwarder handles remaining approvals          |

## Out of Scope (Deferred)

- DM delivery to approvers (`target: "dm" | "both"`) — session key mismatch between user ID
  and DM channel ID requires separate mapping logic
- `cleanupAfterResolve` (delete message after resolution) — requires storing `messageTs` from
  `sendMessageSlack` result and a `handleResolved` listener
- Agent tool wiring (`ask_question` / `ask_confirmation` in `createOpenClawTools()`)
