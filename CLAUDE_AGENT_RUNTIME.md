Claude Agent SDK Runtime (Non-Invasive Parity Plan)

This document reconciles AGENT_RUNTIME_GOLDEN_HOOK.md and AGENT_RUNTIME_PLAN.md into a single, accurate, implementable plan for integrating the Claude Agent SDK while maintaining full parity with the existing Pi Embedded runtime and keeping changes minimal.

Guiding principle: keep all new logic isolated; touch core files only where absolutely required.

---

0) Verified Facts (from current repo)

- Single entry point: `runEmbeddedPiAgent(params: RunEmbeddedPiAgentParams): Promise<EmbeddedPiRunResult>` in `src/agents/pi-embedded-runner/run.ts`.
- Existing SDK dependency: `@anthropic-ai/claude-agent-sdk` already exists in `package.json`.
- Event bus: `emitAgentEvent` + `registerAgentRunContext` in `src/infra/agent-events.ts`.
- Streaming parity logic: implemented in `src/agents/pi-embedded-subscribe*.ts`.
- Result shape: `EmbeddedPiRunResult` and `EmbeddedPiRunMeta` in `src/agents/pi-embedded-runner/types.ts`.
- Callbacks contract: `RunEmbeddedPiAgentParams` in `src/agents/pi-embedded-runner/run/params.ts` (note `runId` + `timeoutMs` are required today).

---

1) Reconciled Decisions (Differences Resolved)

1. SDK choice: Use Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), not `@anthropic-ai/sdk` direct message streaming.
2. Hook placement: The runtime diverter must live inside the existing queue/lane wrappers (preserves serialization). Do not bypass `enqueueSession → enqueueGlobal`.
3. Contracts: The canonical shapes are the current repo types, not the expanded fields shown in AGENT_RUNTIME_PLAN.md.
4. Parity: Reuse the pi-embedded subscription handlers (or their logic) to preserve event ordering, block chunking, reasoning, and messaging-tool suppression.
5. File layout: Use a new isolated folder for the Claude runtime. Only one core file change: the diverter in `run.ts`.

---

2) Minimal Change Surface

Only core file modified
- `src/agents/pi-embedded-runner/run.ts`
  - Add a small runtime switch inside the queue wrapper.

New isolated module (all new code)
```
src/agents/claude-sdk-runner/
├── index.ts          # runClaudeSdkAgent entry point
├── session.ts        # SDK session creation + stream loop
├── events.ts         # Event bridging to pi-embedded handlers
├── tools.ts          # OpenClaw tools → SDK MCP tools
├── schema.ts         # JSON Schema → Zod adapter (minimal subset)
└── types.ts          # Local helper types (if needed)
```

Naming reconciled: use `claude-sdk-runner` (explicit, distinct from `claude-cli-runner`).

---

3) Runtime Selection Strategy (Non-Invasive)

Preferred (minimal change)
- Environment flag: `OPENCLAW_AGENT_RUNTIME=claude-sdk`

Optional (explicit param)
Add a single optional field to `RunEmbeddedPiAgentParams`:
```ts
runtime?: "pi-embedded" | "claude-sdk";
```

This is a small change to `src/agents/pi-embedded-runner/run/params.ts`. If we want zero type changes, rely solely on env var.

Diverter placement (inside queue)
```ts
return enqueueSession(() =>
  enqueueGlobal(async () => {
    if (shouldUseClaudeRuntime(params)) {
      return runClaudeSdkAgent(params);
    }
    // existing Pi logic...
  })
);
```

---

4) Canonical Contracts (Use These, Not the Drafts)

4.1 RunEmbeddedPiAgentParams (current)
Source: `src/agents/pi-embedded-runner/run/params.ts`

Key required fields:
- `sessionId`, `sessionFile`, `workspaceDir`, `prompt`, `timeoutMs`, `runId`

Key callbacks to preserve:
- `onPartialReply`, `onBlockReply`, `onBlockReplyFlush`, `onReasoningStream`
- `onToolResult`, `onAssistantMessageStart`, `onAgentEvent`
- `shouldEmitToolResult`, `shouldEmitToolOutput`

4.2 EmbeddedPiRunResult (current)
Source: `src/agents/pi-embedded-runner/types.ts`
```ts
payloads?: Array<{
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  replyToId?: string;
  isError?: boolean;
}>;
meta: {
  durationMs: number;
  agentMeta?: {
    sessionId: string;
    provider: string;
    model: string;
    usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; total?: number };
  };
  aborted?: boolean;
  systemPromptReport?: SessionSystemPromptReport;
  error?: { kind: "context_overflow" | "compaction_failure" | "role_ordering" | "image_size"; message: string };
  stopReason?: string;
  pendingToolCalls?: Array<{ id: string; name: string; arguments: string }>;
};
didSendViaMessagingTool?: boolean;
messagingToolSentTexts?: string[];
messagingToolSentTargets?: MessagingToolSend[];
```

The “toolMetas / lastToolError / clientToolCall” fields exist in attempt output but are not part of the public run result. Do not extend the public shape.

---

5) Parity Requirements (Non-Negotiable)

5.1 Event Bus (global)
Use `emitAgentEvent` from `src/infra/agent-events.ts` with these streams:
`"lifecycle" | "tool" | "assistant" | "compaction"`

Source of truth:
- `src/agents/pi-embedded-subscribe.handlers.lifecycle.ts`
- `src/agents/pi-embedded-subscribe.handlers.messages.ts`
- `src/agents/pi-embedded-subscribe.handlers.tools.ts`

5.2 Callback Ordering
Match the same callback timings as Pi:

- `onAssistantMessageStart` → first assistant message boundary
- `onPartialReply` → text deltas (after thinking tags stripped)
- `onReasoningStream` → partial reasoning (if enabled)
- `onBlockReplyFlush` → before tool execution
- `onToolResult` → after tool execution
- `onAgentEvent` → emit all lifecycle/tool/assistant/compaction events

5.3 Block Reply Chunking + Directives
Reuse or replicate the logic in `src/agents/pi-embedded-subscribe.ts`:

- Inline directive parsing (reply tags, media URLs)
- `blockReplyBreak` (`text_end` vs `message_end`)
- `blockReplyChunking` behavior
- Reasoning formatting via `formatReasoningMessage`

5.4 Messaging Tool Suppression
Reuse tracking logic from `pi-embedded-subscribe.handlers.tools.ts`:

- Track pending messaging tool sends (text + target)
- Commit on success; discard on error
- Maintain `messagingToolSentTexts` and `messagingToolSentTargets`
- Use `didSendViaMessagingTool` to suppress duplicate replies

5.5 Hooks Parity
From `src/agents/pi-embedded-runner/run/attempt.ts`:

- `before_agent_start` hook (prepend context)
- `agent_end` hook (run with messages + success/error + duration)

The Claude runtime must invoke the same hooks with comparable inputs.

---

6) Claude Agent SDK Integration (Concrete Design)

6.1 SDK Session (streaming)
Use the SDK V2 session API:

- `unstable_v2_createSession(options)` and `session.stream()` for streaming messages
- `session.send(...)` for user prompts

Key SDK types referenced in `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`:
- `SDKSession`, `SDKSessionOptions`
- `SDKMessage` union (includes `SDKPartialAssistantMessage`, `SDKAssistantMessage`, `SDKStatusMessage`, `SDKToolProgressMessage`, `SDKResultMessage`)

6.2 Tools via MCP (OpenClaw → SDK)
OpenClaw tools are JSON Schema-based (TypeBox). SDK tools are Zod-based.
We need a minimal adapter:

- Build OpenClaw tools with `createOpenClawCodingTools(...)`
- Normalize schemas with existing helpers:
  - `patchToolSchemaForClaudeCompatibility`
  - `normalizeToolParameters`
- Convert normalized JSON Schema → Zod (subset only):
  - `type: "object"`, `properties`, `required`, `enum`, `items`, `oneOf/anyOf` with null unions
  - For unknown/unsupported schema: fallback to `z.any()` or `z.record(z.any())`
- Use `createSdkMcpServer({ name, tools })`
  - Each tool uses SDK `tool(name, description, schema, handler)`
  - The handler calls the original OpenClaw tool’s `execute(...)`

Rationale: Keeps schemas accurate enough for Claude, while avoiding large refactors.

6.3 Tool Execution Parity
Inside tool handler:

- Emit `tool_execution_start` before execution
- Emit `tool_execution_update` for partial output (if supported)
- Emit `tool_execution_end` after execution

Reuse these helpers for parity:
- `sanitizeToolResult`, `extractToolResultText`, `extractToolErrorMessage`, `isToolResultError`
  - from `src/agents/pi-embedded-subscribe.tools.ts`
- `inferToolMetaFromArgs`, `normalizeToolName`
  - from `src/agents/pi-embedded-utils.ts` / `src/agents/tool-policy.ts`
- `isMessagingTool`, `isMessagingToolSendAction`, `extractMessagingToolSend`
  - from `src/agents/pi-embedded-messaging.ts`

6.4 Assistant Streaming Parity
From `SDKMessage` stream:

- Map `SDKPartialAssistantMessage` (stream events) to:
  - `message_start`, `message_update` (`text_start`, `text_delta`, `text_end`), `message_end`
- Map `SDKAssistantMessage` to final content storage
- Map `SDKStatusMessage.status === "compacting"` to `auto_compaction_start`/`auto_compaction_end`

Use the existing pi-embedded handlers (`createEmbeddedPiSessionEventHandler`) by:
- Reusing the same state/logic (preferred)
- Or re-implementing a minimal wrapper that feeds identical event shapes

6.5 Abort + Timeout
Respect `timeoutMs` and `abortSignal`:

- If aborted or timed out, close the SDK session and return:
  - `meta.aborted = true`
  - `meta.durationMs = ...`
  - `payloads` should reflect any partial reply already emitted

---

7) Result Construction (Parity with Pi)

Use the same formatting path as the Pi runner:

- Collect `assistantTexts`, `toolMetas`, `lastToolError`, `messagingToolSent*`
- Construct payloads with `buildEmbeddedRunPayloads(...)`
  - Requires a minimal `AssistantMessage` shape (from `@mariozechner/pi-ai`) derived from SDK output
  - Map SDK content to `TextContent` + `ThinkingContent` to keep reasoning support

Populate `meta`:

- `durationMs = Date.now() - started`
- `agentMeta = { sessionId, provider, model, usage }`
- `systemPromptReport` if applicable
- `error` with the same `kind` values used in Pi (context overflow, compaction failure, role ordering, image size)

If hosted client tools are detected, mirror Pi behavior:
- Set `stopReason = "tool_calls"` and `pendingToolCalls` in `meta`

---

8) Testing (Parity Coverage)

Unit tests (new):
- Streaming: `onAssistantMessageStart`, `onPartialReply`, `onBlockReply` order
- Tool: start/update/result events; `onToolResult` gating
- Messaging tools: suppression behavior

Integration tests (new):
- `runEmbeddedPiAgent` parity:
  - `runtime=pi-embedded` vs `runtime=claude-sdk`
  - Same result shape (`payloads`, `meta`, `didSendViaMessagingTool`)

---

9) Implementation Checklist (Minimal Changes)

- [ ] Add `OPENCLAW_AGENT_RUNTIME` check (optional param if desired)
- [ ] Add diverter in `src/agents/pi-embedded-runner/run.ts` (inside queue)
- [ ] Create `src/agents/claude-sdk-runner/*`
- [ ] Implement MCP tool bridge + schema adapter
- [ ] Implement SDK session loop + event bridging
- [ ] Use pi-embedded handlers for streaming parity
- [ ] Build final `EmbeddedPiRunResult` using existing helpers
- [ ] Add focused unit/integration tests

---

This plan preserves the golden-hook constraint (single core change), keeps all new logic isolated, and aligns runtime behavior with the existing Pi Embedded system at the event, callback, and result levels.
