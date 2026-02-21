# @openclaw/voice-call

Official Voice Call plugin for **OpenClaw**.

Providers:

- **Twilio** (Programmable Voice + Media Streams)
- **Telnyx** (Call Control v2)
- **Plivo** (Voice API + XML transfer + GetInput speech)
- **Mock** (dev/no network)

Docs: `https://docs.openclaw.ai/plugins/voice-call`
Plugin system: `https://docs.openclaw.ai/plugin`

## Install (local dev)

### Option A: install via OpenClaw (recommended)

```bash
openclaw plugins install @openclaw/voice-call
```

Restart the Gateway afterwards.

### Option B: copy into your global extensions folder (dev)

```bash
mkdir -p ~/.openclaw/extensions
cp -R extensions/voice-call ~/.openclaw/extensions/voice-call
cd ~/.openclaw/extensions/voice-call && pnpm install
```

## Config

Put under `plugins.entries.voice-call.config`:

```json5
{
  provider: "twilio", // or "telnyx" | "plivo" | "mock"
  fromNumber: "+15550001234",
  toNumber: "+15550005678",

  twilio: {
    accountSid: "ACxxxxxxxx",
    authToken: "your_token",
  },

  telnyx: {
    apiKey: "KEYxxxx",
    connectionId: "CONNxxxx",
    // Telnyx webhook public key from the Telnyx Mission Control Portal
    // (Base64 string; can also be set via TELNYX_PUBLIC_KEY).
    publicKey: "...",
  },

  plivo: {
    authId: "MAxxxxxxxxxxxxxxxxxxxx",
    authToken: "your_token",
  },

  // Webhook server
  serve: {
    port: 3334,
    path: "/voice/webhook",
  },

  // Public exposure (pick one):
  // publicUrl: "https://example.ngrok.app/voice/webhook",
  // tunnel: { provider: "ngrok" },
  // tailscale: { mode: "funnel", path: "/voice/webhook" }

  outbound: {
    defaultMode: "notify", // or "conversation"
  },

  streaming: {
    enabled: true,
    streamPath: "/voice/stream",
  },
}
```

Notes:

- Twilio/Telnyx/Plivo require a **publicly reachable** webhook URL.
- `mock` is a local dev provider (no network calls).
- Telnyx requires `telnyx.publicKey` (or `TELNYX_PUBLIC_KEY`) unless `skipSignatureVerification` is true.
- `tunnel.allowNgrokFreeTierLoopbackBypass: true` allows Twilio webhooks with invalid signatures **only** when `tunnel.provider="ngrok"` and `serve.bind` is loopback (ngrok local agent). Use for local dev only.

## Stale call reaper

Use `staleCallReaperSeconds` to end calls that never receive a terminal webhook
(for example, notify-mode calls that never complete). The default is `0`
(disabled).

Recommended ranges:

- **Production:** `120`–`300` seconds for notify-style flows.
- Keep this value **higher than `maxDurationSeconds`** so normal calls can
  finish. A good starting point is `maxDurationSeconds + 30–60` seconds.

Example:

```json5
{
  staleCallReaperSeconds: 360,
}
```

## TTS for calls

Voice Call uses the core `messages.tts` configuration (OpenAI or ElevenLabs) for
streaming speech on calls. You can override it under the plugin config with the
same shape — overrides deep-merge with `messages.tts`.

```json5
{
  tts: {
    provider: "openai",
    openai: {
      voice: "alloy",
    },
  },
}
```

Notes:

- Edge TTS is ignored for voice calls (telephony audio needs PCM; Edge output is unreliable).
- Core TTS is used when Twilio media streaming is enabled; otherwise calls fall back to provider native voices.

## CLI

```bash
openclaw voicecall call --to "+15555550123" --message "Hello from OpenClaw"
openclaw voicecall continue --call-id <id> --message "Any questions?"
openclaw voicecall speak --call-id <id> --message "One moment"
openclaw voicecall end --call-id <id>
openclaw voicecall status --call-id <id>
openclaw voicecall tail
openclaw voicecall expose --mode funnel
```

## Tool

Tool name: `voice_call`

Actions:

- `initiate_call` (message, to?, mode?)
- `continue_call` (callId, message)
- `speak_to_user` (callId, message)
- `end_call` (callId)
- `get_status` (callId)

## Gateway RPC

- `voicecall.initiate` (to?, message, mode?)
- `voicecall.continue` (callId, message)
- `voicecall.speak` (callId, message)
- `voicecall.end` (callId)
- `voicecall.status` (callId)

## Notes

- Uses webhook signature verification for Twilio/Telnyx/Plivo.
- `responseModel` / `responseSystemPrompt` control AI auto-responses.
- Media streaming requires `ws` and OpenAI Realtime API key.

## Proposal: async sub-agents for fast voice calls

If the primary voice-call session must stay very fast, treat it as a **router + presenter** and
offload complex work to asynchronous sub-agents.

### Why this helps

- Voice turn latency stays low (fast acknowledgements + short follow-up prompts).
- Long-running tasks (research, planning, tool-heavy work) run in parallel without blocking call audio.
- The voice agent remains simple and deterministic, while specialist agents can be richer.

### Suggested architecture

1. **Fast voice agent (foreground lane)**
   - Keeps using the existing `lane: "voice"` run path.
   - Answers immediately (for example: “Got it — checking that now.”).
   - Emits a `delegation_request` envelope when deeper processing is needed.

2. **Async broker (plugin-local queue)**
   - New in-memory + persisted queue keyed by `callId` and `jobId`.
   - Accepts `delegation_request` payloads and starts one or more sub-agent runs with bounded concurrency.
   - Stores status: `queued | running | done | failed | expired`.

3. **Sub-agents (background lane)**
   - Run via embedded agent runner in an `async-voice` lane with dedicated prompts/tool policies.
   - Each sub-agent gets a constrained task prompt (single objective + output schema).
   - Returns structured results (`summary`, `confidence`, `next_actions`, optional `tool_artifacts`).

4. **Result callback to voice session**
   - Broker writes result events to a per-call event stream.
   - Foreground voice loop polls or subscribes between user turns.
   - When ready, the voice agent speaks a concise callback: “I checked that — here’s what I found…”.

### Suggested prompt contract

Use a strict envelope so the fast voice agent can decide quickly:

```json
{
  "action": "respond_now" | "delegate",
  "immediate_text": "short phrase for caller",
  "delegations": [
    {
      "specialist": "research" | "scheduler" | "policy",
      "goal": "single clear objective",
      "input": { "...": "context" },
      "deadline_ms": 15000
    }
  ]
}
```

And require each sub-agent to return:

```json
{
  "summary": "caller-safe spoken summary",
  "confidence": 0.0,
  "needs_followup": false,
  "followup_question": null,
  "artifacts": []
}
```

### Schema tolerance and semantic recovery

Sub-agent output should still target the strict JSON schema, but the broker should add a
**lenient normalization layer** before marking a job failed. This reduces brittle failures from
minor nondeterministic drift (for example `followupQuestion` vs `followup_question`).

Recommended normalization pipeline:

1. Parse JSON when possible; if parsing fails, try extracting the first JSON object from mixed text.
2. Apply alias mapping for common key variants (camelCase/snake_case/synonyms).
3. Coerce obvious scalar mismatches (for example `"0.82"` -> `0.82`, `"yes"` -> `true`).
4. If required fields are still missing, run a tiny repair prompt that converts the output into the canonical schema.
5. If repair still fails, downgrade to a safe spoken fallback and mark the job `failed_normalization`.

Example alias map:

```json
{
  "summary": ["summary", "result", "answer", "spoken_summary"],
  "confidence": ["confidence", "score", "certainty"],
  "needs_followup": ["needs_followup", "needsFollowup", "follow_up_required"],
  "followup_question": ["followup_question", "followupQuestion", "question"],
  "artifacts": ["artifacts", "sources", "tool_artifacts", "attachments"]
}
```

Keep this tolerant parser narrow and auditable: log raw payload + normalized payload for
debugging, cap repair attempts to 1, and never let normalization bypass voice safety filters.

### Guardrails and ops defaults

- **Time budget:** hard cap each sub-agent (for example 10–20 seconds).
- **Concurrency limit:** e.g. max 2 active jobs per call.
- **Cancellation:** cancel outstanding jobs when call ends.
- **Privacy boundary:** only pass minimal required transcript/context to sub-agents.
- **Voice safety:** only speak from `summary`; never stream raw tool output directly.
- **Fallback:** if no result by deadline, respond with a graceful deferral and optional SMS follow-up.

### Minimal incremental rollout

1. Add broker + queue primitives and a single `research` specialist.
2. Add one delegation trigger (“this requires checking”).
3. Add callback speech on result completion.
4. Add metrics (`voice_turn_latency_ms`, `delegation_count`, `subagent_time_ms`, `callback_success_rate`).

This approach keeps the caller experience snappy while enabling deeper reasoning asynchronously.

### Suggested future improvements (P2 backlog)

The current implementation covers fast foreground responses, async delegation, tolerant
normalization, cancellation on call end, and fallback speech. The following items are
recommended for a future spec/implementation phase:

- **Persistent job store:** replace in-memory store with a durable backend implementing the same
  store interface for crash recovery and replay.
- **Per-call event stream:** emit structured sub-agent lifecycle events (`queued`, `running`,
  `done`, `failed`, `expired`, `canceled`) for diagnostics and UI visibility.
- **Metrics and tracing:** track delegation latency, normalization recovery rate, fallback rate,
  cancellation rate, and callback success.
- **Specialist expansion:** add specialist-specific prompts/tool policies and stronger validation for
  `delegation.input` contracts.
- **Operator controls:** add CLI/RPC endpoints to inspect active jobs and manually cancel/retry jobs.
- **Safety hardening:** add configurable moderation/policy checks before speech output and include
  redaction policies for logs.
- **Replay/summarization controls:** support optional batching/coalescing when many async jobs
  complete close together in long calls.

These are intentionally deferred to keep this phase minimally invasive while preserving a clean
interface for future persistence and observability work.
