# Gateway RPC Catalog

## Table Of Contents

- Scope and stability legend
- Common shapes and errors
- Core RPCs (by namespace)
- Approval RPCs
- Plugin extension RPCs
- High-signal payload examples

## Scope And Stability Legend

- Scope `node-role-only`: callable only by role `node`.
- Scope `operator.read`: requires read access (or broader).
- Scope `operator.write`: requires write access (or admin).
- Scope `operator.pairing`: pairing operations.
- Scope `operator.approvals`: approval resolution operations.
- Scope `operator.admin`: configuration/admin surfaces.

Stability levels:

- `public`: advertised in gateway method list and intended for operator usage.
- `internal`: implemented but not advertised in the base method list; usable with caution.
- `legacy`: compatibility alias; prefer the canonical replacement.
- `plugin-defined`: method provided by extension/plugin.

## Common Shapes And Errors

- Request frame: `{ "type": "req", "id": "...", "method": "...", "params": { ... } }`
- Response frame: `{ "type": "res", "id": "...", "ok": true|false, "payload"|"error" }`
- Common error codes: `INVALID_REQUEST`, `UNAVAILABLE`, `NOT_LINKED`, `NOT_PAIRED`, plus worktree/path-specific errors.
- Validation is schema-driven in `src/gateway/protocol/index.ts`.

## Core RPCs

### General Runtime

- `connect` — Handshake-only bootstrap request. Scope: `operator.admin` (special-case first request), Stability: `internal`.
- `health` — Returns health snapshot for gateway and channels. Scope: `operator.read`, Stability: `public`.
- `status` — Returns aggregate gateway/runtime status. Scope: `operator.read`, Stability: `public`.
- `logs.tail` — Streams or returns recent logs. Scope: `operator.read`, Stability: `public`.
- `poll` — Compatibility polling method for environments that cannot consume full event stream. Scope: `operator.admin`, Stability: `internal`.
- `system-presence` — Returns current presence state. Scope: `operator.read`, Stability: `public`.
- `system-event` — Emits a system event entry. Scope: `operator.admin`, Stability: `public`.
- `last-heartbeat` — Returns last heartbeat snapshot. Scope: `operator.read`, Stability: `public`.
- `set-heartbeats` — Sets heartbeat recipients/configuration. Scope: `operator.admin`, Stability: `public`.
- `wake` — Triggers an immediate wake cycle. Scope: `operator.write`, Stability: `public`.
- `talk.mode` — Gets/sets conversational mode behavior. Scope: `operator.write`, Stability: `public`.

### Messaging And Agent Operations

- `send` — Sends a message through routing/channel logic. Scope: `operator.write`, Stability: `public`.
- `agent` — Triggers an agent run with provided input. Scope: `operator.write`, Stability: `public`.
- `agent.wait` — Waits for an agent run result. Scope: `operator.write`, Stability: `public`.
- `chat.send` — WebSocket-native chat send operation. Scope: `operator.write`, Stability: `public`.
- `chat.abort` — Aborts an active chat run. Scope: `operator.write`, Stability: `public`.
- `chat.history` — Reads chat history for a session/conversation. Scope: `operator.read`, Stability: `public`.
- `chat.inject` — Injects chat data directly (debug/testing path). Scope: `operator.admin`, Stability: `internal`.

### Channel And Voice/TTS

- `channels.status` — Returns channel connection states. Scope: `operator.read`, Stability: `public`.
- `channels.logout` — Logs out channel account/session. Scope: `operator.admin`, Stability: `public`.
- `voicewake.get` — Gets voice wake configuration. Scope: `operator.read`, Stability: `public`.
- `voicewake.set` — Sets voice wake configuration. Scope: `operator.write`, Stability: `public`.
- `tts.status` — Reads TTS status and current provider. Scope: `operator.read`, Stability: `public`.
- `tts.providers` — Lists available TTS providers. Scope: `operator.read`, Stability: `public`.
- `tts.enable` — Enables TTS system. Scope: `operator.write`, Stability: `public`.
- `tts.disable` — Disables TTS system. Scope: `operator.write`, Stability: `public`.
- `tts.convert` — Performs text-to-speech conversion. Scope: `operator.write`, Stability: `public`.
- `tts.setProvider` — Switches active TTS provider. Scope: `operator.write`, Stability: `public`.
- `web.login.start` — Starts web-channel login handshake. Scope: `operator.admin`, Stability: `internal`.
- `web.login.wait` — Waits for completion of web-channel login. Scope: `operator.admin`, Stability: `internal`.

### Config, Wizard, Skills, Models, Agents

- `config.get` — Reads config path/section/full snapshot. Scope: `operator.admin`, Stability: `public`.
- `config.set` — Sets a single config path. Scope: `operator.admin`, Stability: `public`.
- `config.patch` — Applies multi-field config patch. Scope: `operator.admin`, Stability: `public`.
- `config.apply` — Applies config and triggers runtime reconciliation. Scope: `operator.admin`, Stability: `public`.
- `config.schema` — Returns schema for config validation/discovery. Scope: `operator.admin`, Stability: `public`.
- `gateway.startupCommands.list` — Lists startup commands. Scope: `operator.admin`, Stability: `public`.
- `gateway.startupCommands.append` — Adds startup command. Scope: `operator.admin`, Stability: `public`.
- `gateway.startupCommands.remove` — Removes startup command. Scope: `operator.admin`, Stability: `public`.
- `gateway.reload` — Reloads gateway subsystems safely. Scope: `operator.admin`, Stability: `public`.
- `wizard.start` — Starts onboarding/config wizard session. Scope: `operator.admin`, Stability: `public`.
- `wizard.next` — Advances wizard step with answer payload. Scope: `operator.admin`, Stability: `public`.
- `wizard.cancel` — Cancels wizard session. Scope: `operator.admin`, Stability: `public`.
- `wizard.status` — Reads wizard session status. Scope: `operator.admin`, Stability: `public`.
- `models.list` — Lists available models/providers. Scope: `operator.read`, Stability: `public`.
- `agents.list` — Lists configured agents. Scope: `operator.read`, Stability: `public`.
- `agents.describe` — Returns full details for an agent. Scope: `operator.read`, Stability: `public`.
- `agents.files.list` — Lists agent-owned files. Scope: `operator.admin`, Stability: `public`.
- `agents.files.get` — Reads agent file content. Scope: `operator.admin`, Stability: `public`.
- `agents.files.set` — Writes/updates agent file content. Scope: `operator.admin`, Stability: `public`.
- `skills.status` — Returns skill install/state overview. Scope: `operator.read`, Stability: `public`.
- `skills.bins` — Returns node-side skill bins for remote execution. Scope: `node-role-only`, Stability: `public`.
- `skills.install` — Installs a skill package. Scope: `operator.admin`, Stability: `public`.
- `skills.uninstall` — Uninstalls a skill package. Scope: `operator.admin`, Stability: `public`.
- `skills.update` — Updates installed skills. Scope: `operator.admin`, Stability: `public`.
- `update.run` — Runs update procedure for gateway/runtime. Scope: `operator.admin`, Stability: `public`.

### Sessions And Workspaces

- `sessions.list` — Lists sessions with summary metadata. Scope: `operator.read`, Stability: `public`.
- `sessions.preview` — Returns compact session preview. Scope: `operator.read`, Stability: `public`.
- `sessions.patch` — Patches session metadata/content. Scope: `operator.admin`, Stability: `public`.
- `sessions.reset` — Resets a session to baseline. Scope: `operator.admin`, Stability: `public`.
- `sessions.delete` — Deletes a session. Scope: `operator.admin`, Stability: `public`.
- `sessions.compact` — Compacts session transcript/state. Scope: `operator.admin`, Stability: `public`.
- `sessions.resolve` — Resolves routing/session target details. Scope: `operator.admin`, Stability: `internal`.
- `sessions.usage` — Session usage summary. Scope: `operator.admin`, Stability: `internal`.
- `sessions.usage.logs` — Session usage logs/events. Scope: `operator.admin`, Stability: `internal`.
- `sessions.usage.timeseries` — Session usage timeseries metrics. Scope: `operator.admin`, Stability: `internal`.
- `worktree.list` — Lists workspace tree entries. Scope: `operator.read`, Stability: `internal`.
- `worktree.read` — Reads workspace file content. Scope: `operator.read`, Stability: `internal`.
- `worktree.write` — Writes workspace file content. Scope: `operator.write`, Stability: `internal`.
- `worktree.delete` — Deletes workspace path. Scope: `operator.write`, Stability: `internal`.
- `worktree.move` — Moves/renames workspace path. Scope: `operator.write`, Stability: `internal`.
- `worktree.mkdir` — Creates workspace directory. Scope: `operator.write`, Stability: `internal`.

### Node And Device Pairing/Invocation

- `node.pair.request` — Starts node pairing request. Scope: `operator.pairing`, Stability: `public`.
- `node.pair.list` — Lists pending/known node pairings. Scope: `operator.pairing`, Stability: `public`.
- `node.pair.approve` — Approves pending node pairing. Scope: `operator.pairing`, Stability: `public`.
- `node.pair.reject` — Rejects pending node pairing. Scope: `operator.pairing`, Stability: `public`.
- `node.pair.verify` — Verifies node pairing code/challenge. Scope: `operator.pairing`, Stability: `public`.
- `node.rename` — Renames paired node metadata. Scope: `operator.pairing`, Stability: `public`.
- `node.list` — Lists connected/known nodes. Scope: `operator.read`, Stability: `public`.
- `node.describe` — Describes a specific node. Scope: `operator.read`, Stability: `public`.
- `node.invoke` — Sends invocation to node. Scope: `operator.write`, Stability: `public`.
- `node.invoke.result` — Node callback for invocation result. Scope: `node-role-only`, Stability: `public`.
- `node.event` — Node callback for node-side events. Scope: `node-role-only`, Stability: `public`.
- `device.pair.list` — Lists pending device pairings. Scope: `operator.pairing`, Stability: `public`.
- `device.pair.approve` — Approves device pairing. Scope: `operator.pairing`, Stability: `public`.
- `device.pair.reject` — Rejects device pairing. Scope: `operator.pairing`, Stability: `public`.
- `device.token.rotate` — Rotates device auth token. Scope: `operator.pairing`, Stability: `public`.
- `device.token.revoke` — Revokes device auth token. Scope: `operator.pairing`, Stability: `public`.

### Cron, Automations, Overseer, Decisions

- `cron.list` — Lists cron jobs. Scope: `operator.read`, Stability: `public`.
- `cron.status` — Returns cron scheduler health/status. Scope: `operator.read`, Stability: `public`.
- `cron.add` — Adds a cron job. Scope: `operator.admin`, Stability: `public`.
- `cron.update` — Updates cron job schedule/config. Scope: `operator.admin`, Stability: `public`.
- `cron.remove` — Removes cron job. Scope: `operator.admin`, Stability: `public`.
- `cron.run` — Triggers immediate cron run. Scope: `operator.admin`, Stability: `public`.
- `cron.runs` — Lists recent cron runs. Scope: `operator.read`, Stability: `public`.
- `cron.runLog` — Fetches detailed cron run log. Scope: `operator.read`, Stability: `public`.
- `automations.list` — Lists automation definitions. Scope: `operator.read`, Stability: `internal`.
- `automations.create` — Creates automation definition. Scope: `operator.admin`, Stability: `internal`.
- `automations.update` — Updates automation definition. Scope: `operator.admin`, Stability: `internal`.
- `automations.delete` — Deletes automation definition. Scope: `operator.admin`, Stability: `internal`.
- `automations.run` — Executes automation on demand. Scope: `operator.admin`, Stability: `internal`.
- `automations.cancel` — Cancels active automation run. Scope: `operator.admin`, Stability: `internal`.
- `automations.history` — Lists automation run history. Scope: `operator.read`, Stability: `internal`.
- `automations.artifact.download` — Downloads run artifact. Scope: `operator.admin`, Stability: `internal`.
- `overseer.status` — Returns overseer status snapshot. Scope: `operator.read`, Stability: `public`.
- `overseer.goal.create` — Creates new overseer goal. Scope: `operator.write`, Stability: `public`.
- `overseer.goal.status` — Returns goal status. Scope: `operator.read`, Stability: `public`.
- `overseer.goal.pause` — Pauses active goal. Scope: `operator.write`, Stability: `public`.
- `overseer.goal.resume` — Resumes paused goal. Scope: `operator.write`, Stability: `public`.
- `overseer.work.update` — Updates overseer work state. Scope: `operator.write`, Stability: `public`.
- `overseer.tick` — Forces overseer tick execution. Scope: `operator.write`, Stability: `public`.
- `overseer.events` — Returns overseer event history. Scope: `operator.admin`, Stability: `internal`.
- `overseer.goal.update` — Updates goal fields directly. Scope: `operator.admin`, Stability: `internal`.
- `overseer.goal.cancel` — Cancels goal. Scope: `operator.admin`, Stability: `internal`.
- `overseer.simulator.load` — Loads simulator state. Scope: `operator.admin`, Stability: `internal`.
- `overseer.simulator.save` — Saves simulator state. Scope: `operator.admin`, Stability: `internal`.
- `overseer.simulator.injectEvent` — Injects simulator event. Scope: `operator.admin`, Stability: `internal`.
- `decision.create` — Creates decision request artifact. Scope: `operator.write`, Stability: `public`.
- `decision.respond` — Responds to decision request. Scope: `operator.write`, Stability: `public`.
- `decision.list` — Lists decision records. Scope: `operator.read`, Stability: `public`.
- `decision.get` — Fetches decision record. Scope: `operator.read`, Stability: `public`.

### Security, Tokens, Audit

- `security.getState` — Returns current security state. Scope: `operator.read`, Stability: `internal`.
- `security.getHistory` — Returns security history/audit trail. Scope: `operator.read`, Stability: `internal`.
- `security.unlock` — Unlocks secured operator surface. Scope: `operator.write`, Stability: `internal`.
- `security.lock` — Locks operator surface. Scope: `operator.write`, Stability: `internal`.
- `security.setupPassword` — Initializes security password. Scope: `operator.write`, Stability: `internal`.
- `security.changePassword` — Rotates security password. Scope: `operator.write`, Stability: `internal`.
- `security.disable` — Disables security layer. Scope: `operator.write`, Stability: `internal`.
- `security.setup2fa` — Enables 2FA setup flow. Scope: `operator.write`, Stability: `internal`.
- `security.verify2fa` — Verifies 2FA challenge. Scope: `operator.write`, Stability: `internal`.
- `security.disable2fa` — Disables 2FA. Scope: `operator.write`, Stability: `internal`.
- `tokens.list` — Lists issued tokens. Scope: `operator.read`, Stability: `internal`.
- `tokens.create` — Creates new token. Scope: `operator.write`, Stability: `internal`.
- `tokens.revoke` — Revokes token. Scope: `operator.write`, Stability: `internal`.
- `audit.query` — Queries audit event log. Scope: `operator.read`, Stability: `internal`.

### Usage, Browser, Misc

- `usage.status` — Returns usage summary/quotas. Scope: `operator.read`, Stability: `public`.
- `usage.cost` — Returns usage cost breakdown. Scope: `operator.read`, Stability: `public`.
- `browser.request` — Requests browser-control operation. Scope: `operator.write`, Stability: `public`.

## Approval RPCs

- `tool.approval.request` — Canonical request for tool-level approval workflow. Scope: `operator.approvals`, Stability: `public`.
- `tool.approval.resolve` — Resolves pending tool approval (`allow-once|allow-always|deny`). Scope: `operator.approvals`, Stability: `public`.
- `tool.approvals.get` — Lists pending tool approvals. Scope: `operator.admin`, Stability: `public`.
- `exec.approval.request` — Legacy exec-focused approval request. Scope: `operator.approvals`, Stability: `legacy`.
- `exec.approval.resolve` — Legacy exec-focused approval resolution. Scope: `operator.approvals`, Stability: `legacy`.
- `exec.approvals.get` — Reads exec approval settings. Scope: `operator.admin`, Stability: `public`.
- `exec.approvals.set` — Writes exec approval settings. Scope: `operator.admin`, Stability: `public`.
- `exec.approvals.node.get` — Reads node exec approval settings. Scope: `operator.admin`, Stability: `public`.
- `exec.approvals.node.set` — Writes node exec approval settings. Scope: `operator.admin`, Stability: `public`.

## Plugin Extension RPCs

- Any plugin can add RPC methods via `registerGatewayMethod(method, handler)`.
- These methods become gateway-visible and dispatch through `extraHandlers`.
- Treat plugin RPC stability as `plugin-defined`; validate method naming, scope expectations, and rollout policy per plugin.

Relevant code:

- `src/plugins/types.ts`
- `src/plugins/registry.ts`
- `src/gateway/server-plugins.ts`

## High-Signal Payload Examples

### 1) Connect Handshake

```json
{
  "type": "req",
  "id": "c1",
  "method": "connect",
  "params": {
    "minProtocol": 1,
    "maxProtocol": 1,
    "client": {
      "id": "openclaw-cli",
      "version": "1.0.0",
      "platform": "darwin",
      "mode": "operator"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"]
  }
}
```

### 2) Chat Send

```json
{
  "type": "req",
  "id": "chat-42",
  "method": "chat.send",
  "params": {
    "sessionKey": "telegram:default:user:1234",
    "message": "Run status check and summarize"
  }
}
```

### 3) Node Invoke

```json
{
  "type": "req",
  "id": "node-7",
  "method": "node.invoke",
  "params": {
    "nodeId": "node-mac-mini",
    "method": "skills.status",
    "params": {}
  }
}
```

### 4) Tool Approval Request (Canonical)

```json
{
  "type": "req",
  "id": "appr-1",
  "method": "tool.approval.request",
  "params": {
    "toolName": "exec",
    "paramsSummary": "rm -rf build/tmp",
    "riskClass": "R4",
    "requestHash": "sha256:..."
  }
}
```

### 5) Plugin Method (Example)

```json
{
  "type": "req",
  "id": "plugin-1",
  "method": "acme.backup.run",
  "params": {
    "target": "nightly"
  }
}
```
