# Internal, Unstable, And Deprecated Notes

Use this concise map when advising operators/extension developers.

- `exec.approval.request` and `exec.approval.resolve` are legacy compatibility methods.
  Use `tool.approval.request` and `tool.approval.resolve` for new implementations.
- `chat.inject` is an internal/debug-style method and should not be a public integration dependency.
  Prefer `chat.send`, `chat.abort`, and `chat.history` for client-facing flows.
- `poll` is internal compatibility plumbing, not a preferred primary integration surface.
  Prefer event-driven WS flows with normal `req/res/event` frames.
- These methods are implemented but not advertised in base gateway method list; treat as internal unless explicitly productized:
  `automations.*`, `security.*`, `tokens.*`, `worktree.*`, `sessions.resolve`, `sessions.usage*`, `audit.query`,
  `overseer.events`, `overseer.goal.update`, `overseer.goal.cancel`, `overseer.simulator.*`, `web.login.*`.
- `connect` appears in handler inventory but is handshake-only and not a normal post-handshake RPC.
  Treat misuse (`connect` after handshake) as invalid request behavior.
- Approval method inventory is split across core handlers and extra handlers wired at runtime.
  Do not infer method availability from `coreGatewayHandlers` alone.
- Base method list and full runtime method surface can differ.
  Always cross-check `src/gateway/server-methods-list.ts`, `src/gateway/server.impl.ts`, and loaded plugin methods.
- For extension APIs, method/route collisions are rejected at registration time.
  Use namespaced method/route naming to avoid accidental conflicts.
- For stability-sensitive integrations, pin to the advertised/public surface plus explicit plugin contracts.
  Avoid binding hard dependencies to internal-only methods.
