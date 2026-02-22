# OpenClaw Branch Merge Testing Protocol — Strategy & Regression Categories

**Version:** 1.1
**Date:** 2026-02-21
**Author:** Amadeus (Testing Strategy) + Tim (Execution Plan)
**Status:** Ready for execution (reality-checked by Tim)

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Risk-Tiered Regression Categories](#2-risk-tiered-regression-categories)
3. [Detailed Test Specifications by Category](#3-detailed-test-specifications-by-category)
4. [Automated vs Manual Test Boundaries](#4-automated-vs-manual-test-boundaries)
5. [Verification Criteria](#5-verification-criteria)
6. [Rollback Protocol](#6-rollback-protocol)
7. [Sign-Off Checklist](#7-sign-off-checklist)

---

## 1. Testing Philosophy

### What "Regression-Safe" Means for OpenClaw

OpenClaw is a **multi-channel AI gateway** — a single long-lived daemon process that owns all messaging surfaces, session state, agent routing, tool execution, scheduling, and authentication. It runs continuously, often as the sole communication bridge between a human and their AI agents across WhatsApp, Slack, Discord, Telegram, Signal, and more.

**A regression in OpenClaw is not a broken feature — it's a broken relationship.** When the gateway goes down, messages are lost, sessions are corrupted, or heartbeats stop firing, the human loses their connection to their entire AI infrastructure. This is qualitatively different from a typical web app regression.

Therefore, **"regression-safe" for OpenClaw means:**

1. **The gateway starts and stays running.** A merge that introduces a startup crash or runtime panic is a P0 failure — nothing else matters if the process can't run.

2. **Existing sessions are preserved and functional.** Session state (JSONL transcripts, session store entries, compaction summaries) from before the merge must remain loadable and usable after the merge. Data migration, if needed, must be transparent.

3. **All configured channels remain connected and can send/receive.** Channel integrations (Slack, Discord, Telegram, WhatsApp, etc.) must maintain their connections through the upgrade.

4. **Agent routing resolves correctly.** Inbound messages must reach the correct agent based on configured bindings, and replies must route back through the correct channel.

5. **Automated systems continue operating.** Heartbeats, cron jobs, hooks, and webhooks must fire on schedule with correct behavior.

6. **Tool execution works.** The full tool chain (exec, read, write, edit, browser, canvas, nodes, sessions, message, image, TTS, voice-call) must function for active sessions.

7. **No silent data loss.** If something breaks, it should break loudly — with logs, error messages, and visible failure indicators — not silently drop messages or corrupt state.

### Testing Principles

- **Test against production-equivalent state.** The test gateway should load a disposable copy of production config + session state (with port/token adjustments), not the live production state files directly. Synthetic test configs miss real-world edge cases.
- **Prefer observation over mutation.** Where possible, verify behavior by reading state rather than modifying it. Mutations (sending test messages, creating test sessions) should be clearly labeled and cleaned up.
- **Fail fast, fail loud.** Every test should have an explicit expected outcome and a clear failure indicator. "It seems to work" is not a passing grade.
- **Human verification for subjective quality.** Some things (prompt assembly, response quality, formatting) can't be mechanically verified — those require a human in the loop.

---

## 2. Risk-Tiered Regression Categories

Regressions are categorized by **blast radius** — how many users/sessions/channels are affected and how severely.

| Priority | Category | Blast Radius | Examples | Failure Tolerance |
|----------|----------|-------------|----------|-------------------|
| **P0** | Critical Path | Total — gateway is non-functional | Startup crash, config parse failure, port binding failure, WebSocket handshake broken | **Zero tolerance.** Any P0 failure is an immediate no-merge. |
| **P1** | Core Functionality | High — primary features broken for all users | Session creation/loading fails, compaction broken, agent loop errors, message delivery fails, auth broken | **Zero tolerance.** P1 failures block merge. |
| **P2** | Integrations & Subsystems | Medium — specific channels or automation systems affected | Individual channel adapter broken, heartbeat timing drift, cron delivery wrong target, hook not firing, tool regression | **Conditional.** Known, documented, with workaround = can proceed. Unknown/silent = blocks merge. |
| **P3** | Edge Cases & Polish | Low — rare scenarios or cosmetic issues | Unusual session key formats, legacy config migration, UI formatting, verbose logging gaps | **Acceptable.** Document and track. Does not block merge. |

### Priority Decision Tree

```
Is the gateway unable to start or crashes on startup?
  → P0 (Critical Path)

Does the issue affect ALL sessions or ALL channels?
  → P1 (Core Functionality)

Does the issue affect a SPECIFIC channel, subsystem, or automation?
  → P2 (Integrations)

Is the issue cosmetic, rare, or edge-case only?
  → P3 (Edge Cases)
```

---

## 3. Detailed Test Specifications by Category

### P0 — Critical Path (Gateway Viability)

These tests verify the gateway can start, accept connections, and serve its fundamental role. **All P0 tests must pass before proceeding to any other category.**

#### P0.1: Gateway Startup

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Start test gateway with production config (adjusted port/token) | Gateway starts, binds to configured port, logs "Gateway ready" or equivalent | Process exits with non-zero code; port not listening; startup error in logs |
| Start with `--dev` profile (isolated state) | Dev gateway starts cleanly alongside production | Conflict with production ports; state directory collision |
| Start with `--force` (kill existing listener) | Cleanly takes over port | Leaves orphaned processes; fails to bind |
| Config loading with current `openclaw.json` | All config sections parse without error | JSON5 parse errors; missing required fields; type validation failures |
| Config loading with env vars (`OPENCLAW_GATEWAY_TOKEN`, etc.) | Environment variables override config correctly | Env vars ignored; wrong precedence; gateway starts with wrong token |

#### P0.2: WebSocket Handshake & Auth

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Connect with valid token | `connect` → `hello-ok` response with snapshot | Connection rejected; timeout; malformed response |
| Connect with invalid token | Connection closed with auth error | Connection accepted without auth; crash on invalid token |
| Connect without token (when required) | Connection closed with auth error | Connection accepted; gateway crash |
| Multiple concurrent connections | All connections established and independent | Connection queue/blocking; resource exhaustion |

#### P0.3: Health & Status

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| `openclaw gateway health --url ws://127.0.0.1:<test-port> --token <test-token> --json` | Returns OK with channel statuses, agent list, session stats | Timeout; error response; missing fields |
| `openclaw gateway status` | Shows running gateway info (port, uptime, version) | Wrong port reported; status mismatch |
| `openclaw doctor` | Reports no new issues (or same known issues as production) | New errors/warnings introduced by the branch |

---

### P1 — Core Functionality

These tests verify the primary features that all users depend on.

#### P1.1: Session Management

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Load existing production sessions from store | All session entries parse; no data loss | Parse errors; missing sessions; corrupted entries |
| Create new session (via test message) | New session key created, JSONL transcript initialized, store updated | Session key collision; JSONL write failure; store not updated |
| Session key resolution (DM, group, channel, thread scopes) | Keys follow documented format: `agent:<id>:<channel>:<type>:<peerId>` | Wrong key format; routing to wrong session; key collision |
| Session reset (`/new`, `/reset`) | Old session preserved, new sessionId minted, clean transcript | Old session corrupted; new session inherits stale context |
| Session idle/daily expiry | Sessions expire per configured policy (`reset.mode`, `idleMinutes`, `atHour`) | Sessions never expire; expire too early; wrong timezone evaluation |
| DM scope isolation (`per-channel-peer`, `per-peer`) | Different senders get isolated sessions | Cross-contamination between senders; wrong session loaded |

#### P1.2: Compaction

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Auto-compaction trigger on long session | Compaction fires before context overflow; summary entry added to JSONL | Context overflow error; compaction not triggered; summary missing |
| Manual `/compact` command | Compaction runs with optional instructions; recent messages preserved | Command not recognized; full context loss; summary quality degraded |
| Post-compaction session continuity | Agent can reference compaction summary in subsequent turns | Summary not loaded; context gap; model confused |
| Pre-compaction memory flush | Memory files written before compaction if workspace writable | Memory flush skipped; workspace permission error |

#### P1.3: Agent Loop

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Simple message → response cycle | Send text message, receive coherent assistant response | No response; timeout; error in agent loop |
| Tool call → result → response cycle | Agent calls a tool, gets result, incorporates into response | Tool call fails; result not returned; response ignores tool output |
| Streaming response delivery | Partial responses stream to client as deltas | No streaming; entire response arrives as one block; stream corruption |
| Model failover | Primary model fails → falls back to configured fallback | No failover; wrong fallback model; crash on primary failure |
| Agent timeout enforcement | Run exceeds `timeoutSeconds` → clean abort | Run hangs indefinitely; abort corrupts session; timeout too aggressive |
| Queue serialization (per-session) | Concurrent messages to same session queue properly | Race condition; interleaved responses; session corruption |

#### P1.4: Message Delivery

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Inbound message → agent response → outbound delivery | Full round-trip: receive on channel → agent processes → reply delivered | Inbound dropped; agent processes but no outbound; wrong channel |
| Multi-channel delivery (test on Slack as primary channel) | Reply reaches correct Slack channel/thread | Delivered to wrong channel; formatting broken; delivery timeout |
| `NO_REPLY` handling | Response containing only `NO_REPLY` produces no outbound message | `NO_REPLY` text leaked to user; message sent anyway |
| Reply shaping (code blocks, markdown, platform formatting) | Platform-appropriate formatting preserved | Raw markdown leaked; code blocks broken; truncation |

#### P1.5: Multi-Agent Routing

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Agent list loading | All 26+ agents load from config with correct workspace/model/tools | Agents missing; wrong model assigned; workspace path wrong |
| Binding resolution (peer → agent) | Messages routed to correct agent per binding rules | Wrong agent; binding ignored; fallback when match should succeed |
| Default agent fallback | Unmatched messages route to default agent (`main`) | No routing; crash on unmatched message; wrong default agent |
| Per-agent workspace isolation | Each agent reads from its own workspace, sessions from its own store | Cross-agent workspace contamination; wrong session store |
| Per-agent tool/sandbox config | Agent-specific `tools.allow`/`tools.deny` and sandbox settings enforced | Tool policy ignored; sandbox not applied; wrong agent gets elevated access |
| Sub-agent spawning | `sessions_spawn` creates isolated sub-agent session; results auto-announce | Spawn fails; results lost; sub-agent can't access correct workspace |

#### P1.6: Authentication

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Auth profiles load | All configured profiles (Anthropic OAuth, OpenAI API key, etc.) resolve | Profile not found; wrong credentials loaded; auth error on first model call |
| OAuth token refresh | Stale OAuth tokens refresh transparently | Auth failure; token refresh loop; credentials corrupted |
| Per-agent auth isolation | Each agent uses its own `auth-profiles.json` | Agent uses another agent's credentials; cross-agent auth leak |
| API key env var resolution | `OPENAI_API_KEY`, `GEMINI_API_KEY`, etc. from config `env` section | Keys not injected; wrong key used; env precedence wrong |

---

### P2 — Integrations & Subsystems

These tests verify individual channels, automation systems, and tools.

#### P2.1: Channel Integrations

For each active channel, verify:

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| **Slack** — Socket Mode connection | Bot connects, receives events, responds in channels/threads | Connection failure; events missed; wrong channel delivery |
| **Slack** — Thread handling | Thread replies stay in-thread; thread sessions isolated | Reply goes to channel instead of thread; thread context bleeds |
| **Slack** — File attachments | Files sent via `filePath` deliver as Slack uploads | File path as text; upload failure; wrong file format |
| **Slack** — Reactions/emoji | React with emoji via message tool | Wrong emoji; reaction on wrong message; API error |
| Other channels (Discord, Telegram, WhatsApp, Signal) — connection | Channel adapter connects without error on startup | Connection error in logs; channel shows as disconnected in health |

> **Note:** Full channel testing for non-Slack channels requires those channels to be active. For channels not currently in use, verify they don't cause startup errors.

#### P2.2: Heartbeat System

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Heartbeat fires on schedule | Heartbeat turn runs at configured interval (2h for main) | No heartbeat fired; wrong interval; fires outside active hours |
| Active hours enforcement | Heartbeats suppressed outside configured window (07:00–24:00) | Heartbeat fires at 3 AM; active hours ignored |
| `HEARTBEAT_OK` suppression | OK-only replies not delivered to channel (unless `showOk: true`) | `HEARTBEAT_OK` text sent to user; suppression broken |
| Alert delivery | Non-OK heartbeat replies delivered to configured target | Alert dropped; delivered to wrong channel; delivered as OK |
| Per-agent heartbeat isolation | Only agents with `heartbeat` blocks run heartbeats | All agents run heartbeats; wrong agent heartbeat fires |
| Manual wake (`openclaw system event --mode now`) | Immediate heartbeat triggered | Event ignored; delayed; duplicate heartbeat |

#### P2.3: Cron System

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Job persistence | Jobs survive gateway restart (stored in `~/.openclaw/cron/jobs.json`) | Jobs lost on restart; store corrupted; duplicate jobs |
| One-shot job (`at`) fires and auto-deletes | Job runs at scheduled time, then removes itself | Job doesn't fire; doesn't delete; fires multiple times |
| Recurring job (`cron` expression) fires on schedule | Job runs at each cron tick | Skipped ticks; wrong timezone; expression parse error |
| Isolated session execution | Cron run creates fresh `cron:<jobId>` session | Reuses stale session; session leak; wrong agent context |
| Announce delivery | Isolated job result delivered to configured channel | Delivery failure; wrong channel; `HEARTBEAT_OK` delivered |
| `cron list`, `cron status`, `cron runs` | CLI commands return accurate state | Wrong state reported; missing jobs; stale run history |

#### P2.4: Hooks System

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Hook discovery on startup | Bundled + managed + workspace hooks discovered | Hooks missing; wrong directory scanned; duplicate registration |
| `session-memory` hook on `/new` | Memory file created in workspace on session reset | No memory file; wrong session context saved; file in wrong location |
| `command-logger` hook | Command events logged to `~/.openclaw/logs/commands.log` | Log file missing; events not logged; log format changed |
| `bootstrap-extra-files` hook | Configured glob patterns inject files into bootstrap context | Files not injected; wrong files; security bypass (paths outside workspace) |
| Hook eligibility checks | Hooks with missing requirements reported as ineligible | Ineligible hook runs anyway; eligible hook rejected |

#### P2.5: Tool System

For each tool category, verify basic operation:

| Tool | Test | Expected Behavior | Failure Indicator |
|------|------|-------------------|-------------------|
| `exec` | Run simple shell command | Command executes, output returned | Execution failure; timeout; wrong working directory |
| `read` | Read workspace file | File contents returned with correct encoding | File not found (wrong path resolution); truncation wrong |
| `write` | Create new file | File created with correct content and parent dirs | Write failure; wrong path; permission error |
| `edit` | Edit existing file (oldText → newText) | Exact match replaced; file updated | Match failure; partial replacement; file corrupted |
| `browser` | Take snapshot of a page | Page content returned as accessibility tree | Browser not started; snapshot timeout; wrong format |
| `canvas` | Present HTML canvas | Canvas renders and is accessible | Canvas host not serving; content not rendered |
| `message` | Send to Slack channel | Message delivered with correct formatting | Delivery failure; wrong channel; formatting broken |
| `sessions_spawn` | Spawn sub-agent | Sub-agent session created, runs, reports back | Spawn failure; results lost; wrong agent/model |
| `sessions_list` / `sessions_history` | List sessions, fetch history | Accurate session data returned | Wrong data; missing sessions; permission error |
| `image` | Analyze image | Vision model returns analysis | Image not loaded; model error; wrong model used |
| `tts` | Text-to-speech | Audio file generated | TTS failure; wrong voice; file not created |

#### P2.6: Webhooks

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Gmail PubSub webhook (if configured) | Gmail notifications received and processed | Webhook not registered; notifications missed; wrong processing |

---

### P3 — Edge Cases & Polish

These are lower-priority tests that verify correctness in unusual scenarios.

#### P3.1: Legacy & Migration

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Legacy session key formats | Old-format keys (`group:<id>`) still load and route | Key rejected; session not found; migration error |
| Legacy config format (old hook config, dm.policy) | Doctor migration works; old config still functional | Config parse error; migration data loss |
| `openclaw doctor` changes | Doctor recommendations are accurate and safe to apply | Incorrect migration; data loss on `--fix` |

#### P3.2: Concurrency & Limits

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| `maxConcurrent` agent runs (8) | 9th concurrent run queues, doesn't crash | Queue overflow; crash; run silently dropped |
| Sub-agent `maxConcurrent` (16) | 17th sub-agent run queues properly | Sub-agent leak; crash; results lost |
| Large session transcript (many turns) | Session loads and compacts gracefully | OOM; slow load; compaction failure |
| Rapid message burst | Messages queue and process in order | Messages dropped; out-of-order; race condition |

#### P3.3: Error Handling & Recovery

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Invalid model specified | Clear error, falls back to configured fallback | Crash; silent failure; wrong model used |
| Network interruption during model call | Retry or graceful error; session state preserved | Session corrupted; hang; no retry |
| Tool execution timeout | Clean abort; error returned to agent loop | Hang; zombie process; no error |
| Malformed inbound message | Logged and rejected; gateway continues | Crash; partial processing; log flood |

#### P3.4: Configuration Edge Cases

| Test | Expected Behavior | Failure Indicator |
|------|-------------------|-------------------|
| Missing optional config sections | Defaults applied correctly | Crash on missing optional; wrong defaults |
| Empty `HEARTBEAT.md` (only headers) | Heartbeat skipped to save API calls | Heartbeat runs with empty context; wasted API call |
| Identity links (cross-channel DM merge) | Same person on multiple channels gets unified session | Separate sessions; wrong identity resolution |
| Send policy rules (`session.sendPolicy`) | Denied sessions don't deliver outbound | Delivery bypasses deny rule; allowed session blocked |

---

## 4. Automated vs Manual Test Boundaries

### What CAN Be Automated

These tests can be scripted and run without human judgment:

| Category | Automation Method |
|----------|------------------|
| **P0: Gateway startup** | Script: start gateway, check exit code, verify port listening (`nc -z 127.0.0.1 <port>`), parse startup logs for "listening on ws://" signal |
| **P0: Gateway health RPC** | Script: `openclaw gateway health --url ... --token ... --json` → verify expected fields present and channels reporting expected state |
| **P0: WebSocket handshake** | Script: connect with `websocat` or Node WS client, send `connect` frame, verify `hello-ok` response |
| **P1: Session store integrity** | Script: parse `sessions.json`, verify all entries have required fields, JSONL files exist for recent sessions |
| **P1: Agent list** | Script: `openclaw agents list` → verify expected agents present with correct model/workspace |
| **P2: Cron jobs** | Script: `openclaw cron list` → verify jobs match expected set; `openclaw cron status` → scheduler running |
| **P2: Hook discovery** | Script: `openclaw hooks list` → verify expected hooks discovered and eligible |
| **P2: Config validation** | Script: parse `openclaw.json` with JSON5, verify schema, check for known regressions |
| **P2: Channel status** | Script: `openclaw channels status` → verify channels report OK |

### What REQUIRES Human Verification

These tests require human judgment, real channel interactions, or qualitative assessment:

| Category | Why Human Required |
|----------|-------------------|
| **P1: Full message round-trip** | Requires sending a real message via Slack and verifying the response is coherent and correctly formatted |
| **P1: Agent response quality** | Prompt assembly, context injection, and response quality are subjective |
| **P1: Compaction quality** | The compaction summary must accurately capture conversation essence — requires reading it |
| **P2: Heartbeat behavior** | Verifying heartbeat fires at the right time and produces useful content requires waiting and observing |
| **P2: Cron delivery** | Verifying the announce message is delivered to the correct Slack channel with correct content |
| **P2: Tool behavior** | Some tools (browser, canvas, image analysis) produce output that needs qualitative assessment |
| **P2: Sub-agent results** | Verifying sub-agent results auto-announce correctly and contain useful content |
| **P2: Channel formatting** | Slack/Discord-specific formatting (code blocks, reactions, threads) needs visual verification |

### Recommended Test Automation Script Structure

```
test-gateway-regression/
├── run-all.sh              # Master runner
├── p0-critical/
│   ├── startup.sh          # Gateway starts and binds port
│   ├── health.sh           # Gateway health RPC returns OK
│   └── websocket.sh        # WS handshake succeeds
├── p1-core/
│   ├── sessions.sh         # Session store integrity
│   ├── agents.sh           # Agent list and config
│   └── auth.sh             # Auth profiles load
├── p2-integrations/
│   ├── channels.sh         # Channel status
│   ├── cron.sh             # Cron state
│   └── hooks.sh            # Hook discovery
└── results/
    └── YYYY-MM-DD-HHMMSS/  # Timestamped results
        ├── summary.md      # Pass/fail summary
        └── details.log     # Full output
```

---

## 5. Verification Criteria

### What Constitutes a "Passing" Test Run

A test run is considered **PASS** when:

#### Tier 1 — Absolute Requirements (ALL must pass)

- [ ] Test gateway starts successfully with production-equivalent config
- [ ] Gateway health RPC reports expected channel + agent state
- [ ] WebSocket handshake succeeds with valid token
- [ ] WebSocket handshake rejects invalid token
- [ ] All configured agents are listed with correct models and workspaces
- [ ] Existing session store loads without errors
- [ ] At least one full message round-trip completes (send message → receive response)
- [ ] `openclaw doctor` reports no NEW issues compared to production baseline

#### Tier 2 — Core Behavior (ALL must pass)

- [ ] New session creation works (session key assigned, JSONL created)
- [ ] Session reset (`/new`) creates new session, preserves old
- [ ] Agent loop completes with tool call (at least one tool invoked and result used)
- [ ] Message delivery reaches correct Slack channel
- [ ] Auth profiles resolve for at least one LLM provider
- [ ] Sub-agent spawning completes successfully

#### Tier 3 — Subsystem Verification (failures documented, may not block)

- [ ] Heartbeat system reports enabled and scheduled
- [ ] Cron scheduler running with expected job count
- [ ] Hooks discovered and loaded (expected set)
- [ ] All tool types return non-error responses for basic operations
- [ ] Channel-specific formatting renders correctly

### Failure Classification

| Observation | Classification | Action |
|-------------|---------------|--------|
| Gateway won't start | P0 — Immediate fail | No merge. Debug and fix in branch. |
| Gateway health RPC returns errors for a channel | P2 — Channel regression | Document. Fix if possible. May proceed if channel is non-critical. |
| New warnings in `openclaw doctor` | P2/P3 — Evaluate | Determine if the warning indicates a real regression or is cosmetic. |
| Response quality seems different | P3 — Monitor | Note in test results. Not a blocker unless clearly wrong. |
| Test tool returns error | P2 — Tool regression | Document the specific tool and error. Fix or document workaround. |

---

## 6. Rollback Protocol

### If the Test Gateway Reveals Regressions

#### Severity-Based Response

**P0 Regressions (Gateway Can't Run):**
1. Stop the test gateway immediately.
2. Do NOT merge the branch.
3. Document the exact failure (error message, stack trace, log excerpt).
4. Open a blocking issue on the branch with the failure evidence.
5. Debug in the fork branch — do not attempt hotfixes on main.
6. Re-run the full test suite after the fix.

**P1 Regressions (Core Features Broken):**
1. Stop the test gateway.
2. Do NOT merge.
3. Document the regression with reproduction steps.
4. Determine if the regression is in the new code or an interaction with existing state.
5. Fix in the fork branch and re-test.

**P2 Regressions (Specific Subsystem/Channel):**
1. Keep the test gateway running if it's otherwise functional.
2. Document the specific regression with evidence.
3. Assess: Is the affected subsystem actively used? Is there a workaround?
4. Decision matrix:
   - **Actively used + no workaround** → Fix before merge.
   - **Actively used + workaround exists** → Document workaround, merge with tracking issue.
   - **Not actively used** → Merge with tracking issue, fix in follow-up.

**P3 Regressions (Edge Cases):**
1. Document and track.
2. Does not block merge.
3. Create follow-up issues as needed.

#### Rollback Steps (if merge has already happened)

If a regression is discovered AFTER merging to main:

1. **Immediate:** `git revert <merge-commit>` on main and push.
2. **Verify:** Restart production gateway on reverted main — confirm it starts and health is OK.
3. **Post-mortem:** Why did the regression pass testing? Update this protocol.
4. **Fix forward:** Fix the regression in the fork branch and re-run the full test suite before re-merging.

#### Production Gateway Safety

- The production gateway should **NEVER** be stopped for testing.
- The test gateway runs on a **different port** with a **different token**.
- The test gateway uses a **copied config file and copied state directory** (with overrides) to match production behavior without mutating production files.
- If both gateways need the same channel credentials, ensure only one is connected at a time (or use different accounts).

---

## 7. Sign-Off Checklist

### The Final Gate Before Recommending Merge to Main

This checklist must be completed by the testing agent(s) and reviewed by David before the merge proceeds.

#### Pre-Merge Verification

**Git State:**
- [ ] Fork branch (`dgarson/fork`) has been fetched and merged into the test branch
- [ ] All merge conflicts have been resolved and committed
- [ ] No uncommitted changes in the working tree
- [ ] Merge commit message documents what was merged and any conflict resolutions

**P0 Critical Path — ALL MUST PASS:**
- [ ] Test gateway starts successfully
- [ ] Port binding confirmed (test port, not production)
- [ ] WebSocket handshake works (valid token accepted, invalid rejected)
- [ ] `openclaw gateway health --url ws://127.0.0.1:<test-port> --token <test-token> --json` returns OK
- [ ] `openclaw doctor` shows no new issues vs production baseline
- [ ] Gateway runs for at least 10 minutes without crash

**P1 Core Functionality — ALL MUST PASS:**
- [ ] Session store loads existing sessions without error
- [ ] New session creation works
- [ ] Session reset (`/new`) works
- [ ] Full message round-trip completes (human sends message → agent responds)
- [ ] Agent loop with tool call works
- [ ] Agent routing resolves correctly for at least 2 different agents
- [ ] Auth profiles resolve and LLM calls succeed
- [ ] Sub-agent spawn + completion works
- [ ] Compaction (manual `/compact`) works

**P2 Integrations — Document Status:**
- [ ] Slack channel connected and message delivery works
- [ ] Heartbeat system enabled and scheduled (observed at least one fire, or schedule confirmed)
- [ ] Cron scheduler running with expected jobs
- [ ] Hooks discovered and loaded correctly
- [ ] Basic tool verification (exec, read, write, browser) passes
- [ ] Any P2 failures documented with evidence and workaround plan

**P3 Edge Cases — Optional but Recommended:**
- [ ] Concurrency test (multiple rapid messages)
- [ ] Error recovery (invalid model, network interruption)
- [ ] Legacy config compatibility

#### Test Evidence

- [ ] Test run timestamp and duration recorded
- [ ] Test gateway version/commit hash recorded
- [ ] Production gateway version for comparison recorded
- [ ] All test output saved to `results/` directory
- [ ] Summary of pass/fail by category written

#### Sign-Off

```
Test Run Date: ___________
Test Gateway Version: ___________
Production Version: ___________
Test Duration: ___________

P0 Critical Path:  [ ] ALL PASS  [ ] FAILURES (list: ___)
P1 Core Function:  [ ] ALL PASS  [ ] FAILURES (list: ___)
P2 Integrations:   [ ] ALL PASS  [ ] KNOWN ISSUES (list: ___)
P3 Edge Cases:     [ ] ALL PASS  [ ] KNOWN ISSUES (list: ___)

Recommendation:
[ ] MERGE — All P0/P1 pass, P2 issues documented with workarounds
[ ] DO NOT MERGE — P0 or P1 failures present
[ ] CONDITIONAL MERGE — P2 issues need decision (details: ___)

Testing Agent(s): ___________
Review: David ___________
Date: ___________
```

---

## Appendix A: OpenClaw Subsystem Map

For reference during test planning — the major subsystems that could be affected by code changes:

| Subsystem | Key Files / Paths | Config Section |
|-----------|-------------------|----------------|
| Gateway Core | `dist/gateway-*`, `dist/server-*` | `gateway.*` |
| Session Management | `dist/session-*`, `agents/<id>/sessions/` | `session.*` |
| Agent Loop | `dist/agent-*`, `dist/run-*` | `agents.list[].*` |
| Compaction | `dist/compact-*` | `agents.defaults.compaction` |
| Channel Adapters | `dist/channel-*`, `dist/slack-*`, `dist/whatsapp-*` etc. | `channels.*` |
| Heartbeat Runner | `dist/heartbeat-*` | `agents.defaults.heartbeat`, `channels.*.heartbeat` |
| Cron Scheduler | `dist/cron-*`, `~/.openclaw/cron/` | `cron.*` |
| Hook System | `dist/hooks/bundled/`, `~/.openclaw/hooks/` | `hooks.internal.*` |
| Tool System | `dist/tool-*`, `dist/exec-*`, `dist/browser-*` | `tools.*` |
| Auth System | `dist/auth-*`, `agents/<id>/agent/auth-profiles.json` | `auth.profiles.*` |
| Multi-Agent Routing | `dist/routes-*`, `dist/bindings-*` | `agents.list[]`, `bindings[]` |
| Sandbox | `dist/sandbox-*` | `agents.defaults.sandbox` |
| Plugins | `dist/plugin-*`, `~/.openclaw/plugins/` | `plugins.*` |
| Skills | `skills/`, `~/.openclaw/skills/` | `skills.*` |
| WebSocket Protocol | `dist/ws-*`, `dist/protocol-*` | `gateway.auth.*` |
| Node System | `dist/node-*` | `gateway.nodes.*` |

## Appendix B: Test Gateway Quick Reference

**Reality-checked values (Tim, 2026-02-21):**

- **Test gateway port:** `18790` (verified free while production gateway remained on `18789`)
- **Test gateway token:** `oc_test_merge_protocol_20260221`
- **Test config/state paths:**
  - State dir: `~/.openclaw/test-gateway-regression-state`
  - Config path: `~/.openclaw/test-gateway-regression-state/openclaw.json`
- **Required runtime overrides (for isolated regression runs):**
  - `OPENCLAW_SKIP_CHANNELS=1`
  - `OPENCLAW_SKIP_PROVIDERS=1`
  - `OPENCLAW_SKIP_CRON=1`
  - `OPENCLAW_SKIP_BROWSER_CONTROL_SERVER=1`
  - `OPENCLAW_SKIP_CANVAS_HOST=1`
  - `OPENCLAW_SKIP_GMAIL_WATCHER=1`
- **Start command (validated):**

```bash
OPENCLAW_STATE_DIR="$HOME/.openclaw/test-gateway-regression-state" \
OPENCLAW_CONFIG_PATH="$HOME/.openclaw/test-gateway-regression-state/openclaw.json" \
OPENCLAW_GATEWAY_PORT=18790 \
OPENCLAW_SKIP_CHANNELS=1 \
OPENCLAW_SKIP_PROVIDERS=1 \
OPENCLAW_SKIP_CRON=1 \
OPENCLAW_SKIP_BROWSER_CONTROL_SERVER=1 \
OPENCLAW_SKIP_CANVAS_HOST=1 \
OPENCLAW_SKIP_GMAIL_WATCHER=1 \
openclaw gateway run --allow-unconfigured --bind loopback --port 18790 --token "oc_test_merge_protocol_20260221"
```

- **Log locations (validated):**
  - Foreground/stdout capture: `~/.openclaw/logs/test-gateway-regression/test-gateway-foreground.log`
  - Gateway internal rotating log: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`

> Note: `OPENCLAW_TEST_MINIMAL_GATEWAY=1` only takes effect when `VITEST=1`; it is not a standalone manual-run isolation switch.

---

*This document defines the WHAT and WHY of testing. Tim's execution plan defines the HOW — the git operations, test gateway isolation mechanics, and specific commands to run. The two documents together form the complete OpenClaw Branch Merge Testing Protocol.*
