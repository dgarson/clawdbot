---
name: openclaw-gateway
description: Expert guidance for OpenClaw Gateway WebSocket/RPC/event/hook/callback architecture and plugin extension APIs. Use when deciding which gateway method/event/hook to use, designing extension execution flow, interpreting operator scopes/approvals, or mapping natural-language requests to specific method/event/hook names (for example node.invoke, chat.send, tool.approval.request, connect.challenge, before_tool_call, registerGatewayMethod, registerHook).
---

# OpenClaw Gateway

## Overview

Use this skill to map natural-language questions to the correct OpenClaw Gateway RPCs, WebSocket events, plugin APIs, and hook/callback execution paths.
Optimize for architecture and integration correctness, not endpoint trivia.

## Source Of Truth

- Treat code on the checked-out `main` branch as canonical.
- Start with `src/gateway/server-methods.ts`, `src/gateway/server-methods-list.ts`, and `src/gateway/server.impl.ts`.
- Use docs to clarify intent and operational guidance, not to override code.

## Workflow

1. Classify the request surface first: `RPC method`, `event/hook/callback`, or `extension API`.
2. Load only the needed reference files from this skill (see index below).
3. For each method/event/hook mentioned, provide: what it does, why it exists, when to use/avoid, auth scope/role, shape summary, error/stability notes.
4. If the request includes writes or side effects, apply the approval architecture from `references/05-approval-workflow.md`.
5. If a capability is internal/unstable/legacy, explicitly say so and provide migration guidance from `references/06-internal-unstable-deprecated.md`.

## Major Abstractions

### 1) Transport And Framing

Gateway uses WebSocket request/response/event frames (`req`, `res`, `event`) and a handshake challenge (`connect.challenge`) before normal RPC traffic.
This abstraction defines protocol safety limits (`maxPayload`, buffering, tick cadence) and is the root for all callback and event delivery behavior.

Related interfaces and flows:

- `src/gateway/protocol/schema/frames.ts`
- `src/gateway/server/ws-connection.ts`, `src/gateway/server/ws-connection/message-handler.ts`

### 2) Auth, Roles, And Scopes

Connection auth resolves via token/password/Tailscale/device context, then gateway authorization gates methods by role and scope.
Role/scope design is the first architectural guardrail before any handler or plugin logic runs.

Related interfaces and flows:

- `src/gateway/auth.ts`
- `src/gateway/server-methods.ts` (`authorizeGatewayMethod`)

### 3) RPC Dispatch Layer

Requests resolve through core handlers and extra handlers (plugins + approval handlers), then emit typed responses.
This is the central callback point where extension RPCs join the same execution path as core methods.

Related interfaces and flows:

- `src/gateway/server-methods.ts`
- `src/gateway/server.impl.ts` (`extraHandlers` wiring)

### 4) Event Plane And Broadcasts

Gateway emits server-side events (`agent`, `chat`, `presence`, approvals, pairing, etc.) to subscribed clients.
Events are both operational telemetry and synchronization points for control UIs and remote operator surfaces.

Related interfaces and flows:

- `src/gateway/server-methods-list.ts` (`GATEWAY_EVENTS`)
- `src/gateway/server-broadcast.ts`

### 5) Node Bridge

Node role clients use pairing + invoke/result + event channels to extend execution from operator to remote nodes.
Treat this as a distributed RPC callback system with explicit authorization and pairing policy boundaries.

Related interfaces and flows:

- `src/gateway/server-methods/nodes.ts`
- `src/gateway/server-node-subscriptions.test.ts`

### 6) Plugin Extension Surface

Extensions register gateway methods, HTTP routes/handlers, hooks, services, tools, channels, and providers through plugin API entry points.
This is the main architecture seam for adding behavior without invasive core edits.

Related interfaces and flows:

- `src/plugins/types.ts` (`OpenClawPluginApi`)
- `src/plugins/registry.ts`, `src/gateway/server-plugins.ts`

### 7) Approval State Machine

Tool/exec approval RPCs are mediated by a shared pending-state manager and broadcast request/resolve lifecycle events.
Use this layer to enforce risk-sensitive write controls and escalation policy without breaking core handler semantics.

Related interfaces and flows:

- `src/gateway/tool-approval-manager.ts`
- `src/gateway/server-methods/tool-approval.ts`, `src/gateway/server-methods/exec-approval.ts`

## Reference Index

- `references/01-gateway-abstractions-and-flow.md`
  Reason to load: End-to-end execution flow, callback boundaries, and the most important architectural seams.

- `references/02-gateway-rpc-catalog.md`
  Reason to load: Method-level map for gateway RPCs with purpose, scope, stability, and high-signal payload examples.

- `references/03-events-hooks-callbacks.md`
  Reason to load: Event inventory, plugin hook semantics, and callback ordering (including sync vs async hooks).

- `references/04-plugin-extension-apis.md`
  Reason to load: Extension developer API surface and when to choose `registerGatewayMethod` vs hooks/routes/services.

- `references/05-approval-workflow.md`
  Reason to load: Multi-tier approval architecture (Tier 0/1/3/4 + human gate), escalation rules, and mapping to current RPCs/events.

- `references/06-internal-unstable-deprecated.md`
  Reason to load: Internal/unstable/deprecated inventory with migration guidance.

## Response Contract

When answering with this skill, follow this structure:

1. Identify the exact abstraction(s) involved.
2. Name the exact RPC/event/hook/API.
3. State what and why in 1-2 lines.
4. State when to use and when to avoid.
5. State auth role/scope and stability level.
6. Provide concise shape/error notes or a minimal payload example for major flows.
7. For risky writes, include approval-tier and escalation guidance.
