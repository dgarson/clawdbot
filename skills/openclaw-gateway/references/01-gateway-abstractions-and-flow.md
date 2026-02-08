# Gateway Abstractions And Flow

## Table Of Contents

- Transport and frame model
- Auth and scope gating
- Handler dispatch
- Event and callback propagation
- Node and pairing bridge
- Extension seam
- End-to-end flow walkthrough

## Transport And Frame Model

Gateway sessions begin with an event challenge (`connect.challenge`) and a required `connect` request frame.
After handshake, traffic uses three frame types: request (`req`), response (`res`), and event (`event`).

Primary code:

- `src/gateway/protocol/schema/frames.ts`
- `src/gateway/server/ws-connection.ts`
- `src/gateway/server/ws-connection/message-handler.ts`

Links to other abstractions:

- Frame validation feeds auth/scope decisions before dispatch.
- Event frames carry approval, pairing, agent, and presence callbacks.

## Auth And Scope Gating

Auth resolves from token/password/Tailscale/device context; local direct requests are treated separately.
Method authorization then gates by role (`operator` vs `node`) and scope (`operator.read`, `operator.write`, `operator.admin`, etc.).

Primary code:

- `src/gateway/auth.ts`
- `src/gateway/server-methods.ts`

Links to other abstractions:

- Scope gating happens before core and plugin handlers.
- Approval flows add extra policy checks after method authorization.

## Handler Dispatch

Gateway dispatches to core handlers first and falls back to `extraHandlers` for plugin and approval methods.
This keeps extension RPCs in the same transport and response contract as core methods.

Primary code:

- `src/gateway/server-methods.ts`
- `src/gateway/server.impl.ts` (`extraHandlers` includes plugin + approval handlers)

Links to other abstractions:

- Dispatch integrates with event broadcast for async lifecycle updates.
- Plugin method registration flows through this same path.

## Event And Callback Propagation

`context.broadcast(...)` pushes runtime events to connected clients, with optional slow-consumer drop behavior.
Events are state synchronization callbacks for UIs, operators, node clients, and automation flows.

Primary code:

- `src/gateway/server-methods-list.ts` (`GATEWAY_EVENTS`)
- `src/gateway/server-broadcast.ts`
- `src/gateway/server.impl.ts`

Links to other abstractions:

- Approval methods emit request/resolution callbacks as events.
- Node invoke/event/result uses event propagation plus targeted callbacks.

## Node And Pairing Bridge

Pairing methods establish trust for nodes/devices, then node RPC methods (`node.invoke`, `node.event`, `node.invoke.result`) bridge execution.
Treat this as distributed callback orchestration with explicit role/scope boundaries.

Primary code:

- `src/gateway/server-methods/nodes.ts`
- `src/gateway/server-methods/devices.ts`
- `src/gateway/server-node-subscriptions.test.ts`

Links to other abstractions:

- Pairing policy influences who can publish node callbacks.
- Node role methods bypass operator role path and require strict role enforcement.

## Extension Seam

Plugins inject behavior with `registerGatewayMethod`, `registerHttpRoute`, `registerHook`, `registerService`, and related APIs.
Extension methods are merged into gateway method exposure and dispatch without modifying base transport semantics.

Primary code:

- `src/plugins/types.ts`
- `src/plugins/registry.ts`
- `src/gateway/server-plugins.ts`

Links to other abstractions:

- Plugin hooks affect callback execution outside the RPC layer.
- Plugin gateway methods inherit the same auth/scope gate used by core methods.

## End-To-End Flow Walkthrough

1. WS connection opens; server sends `connect.challenge`.
2. Client sends `req(connect)` with protocol/client/auth context.
3. Server validates frame + auth + role/scope context.
4. Server replies `hello-ok` with available methods/events and policy limits.
5. Client sends normal `req(method, params)` frames.
6. Dispatcher resolves core or extra handler and executes.
7. Handler responds with `res(ok|error)` and optionally broadcasts `event(...)` callbacks.
8. Plugin hooks and services run in parallel execution paths where registered.

High-signal files for debugging full flow:

- `src/gateway/server/ws-connection/message-handler.ts`
- `src/gateway/server-methods.ts`
- `src/gateway/server.impl.ts`
