# HEARTBEAT.md — Xavier

## Active Monitoring Directives

---

### 🔭 OBS-01 through OBS-06 — Observability Mega-Branch

**Status target:** All 6 phases complete before 2 PM MST Feb 22.
**Spec:** `~/.openclaw/workspace/_shared/OBS_STACK_SPEC.md`
**Mega-branch:** `observability/main` → target `dgarson/fork`

**On every heartbeat, in this order:**

1. **Check OBS status** — read `_shared/WORKBOARD.md` OBS section. Note which tasks are `done`, `in-progress`, `in-review`, `unclaimed`.

2. **Check active agents** — `subagents(action=list)`. Are OBS workers currently running?

3. **If nothing is actively in-progress AND OBS-06 is not yet done:**
   - Find the lowest-numbered unclaimed OBS-* task
   - Kick it off via the delegation chain below
   - Update WORKBOARD.md to `in-progress`
   - Notify Merlin via `sessions_send(agent:main:slack:channel:c0ab5hfjqm7, "...")`

4. **If something is in-review:** Ping the appropriate reviewer (see below) — don't let reviews stall.

5. **Update WORKBOARD.md** with current status before ending heartbeat.

---

### 📋 OBS Phase → Agent Delegation Map

| Phase | Branch | Lead Agent | Model | Your Role |
|-------|--------|-----------|-------|-----------|
| OBS-01 — OTel Core | `observability/otel-core` | Roman | gpt-5.3-codex-spark (High Thinking) | Kick off; checkpoint only |
| OBS-02 — Prometheus | `observability/prometheus-exporter` | Roman → Larry | gpt-5.3-codex-spark + MiniMax M2.5 | Kick off after OBS-01 PR open |
| OBS-03 — Docker Stack | `observability/docker-stack` | Larry + Oscar + Nate + Vince | gpt-5.3-codex-spark (High Thinking) | Kick off parallel to OBS-02 |
| OBS-04 — A/B Experiments | `observability/experiments` | Barry (flags) + Jerry (schema) | MiniMax M2.5 + GLM-5 | Kick off when OBS-01 types available |
| OBS-05 — Analytics UI | `observability/analytics-ui` | Luis squad (Wes/Quinn/Piper/Reed) | MiniMax M2.5 | Coordinate with Luis after OBS-01/02 |
| OBS-06 — Regression Harness | `observability/regression-harness` | Larry + Sandy | gpt-5.3-codex-spark | Kick off when OBS-01/02 complete |

---

### 🔗 Review Chain for OBS PRs

**You (Xavier) are reserved for major checkpoint reviews only:**
- OBS mega-branch integration PR (each phase merging into `observability/main`)
- Any PR that changes `src/telemetry/otel.ts` core initializer
- Final `observability/main` → `dgarson/fork` PR

**Codex 5.3 Medium agents handle routine PR reviews:**
- Spawn a Codex Medium sub-agent: `{ agentId: "sandy", model: "openai/gpt-5.3-codex", task: "Review PR #X on observability/... — check types, test coverage, correctness. Approve or request changes." }`
- Tony, Sandy, Barry, Jerry on Codex Medium = your primary review tier

**MiniMax M2.5 agents (Barry, Jerry) act as senior mediators:**
- When Roman/Claire/Larry open PRs, Barry or Jerry review first before escalating to you
- They can approve sub-PRs that merge into `observability/otel-core` or `observability/prometheus-exporter`
- You only see things after Barry/Jerry have approved or flagged them

---

### 🚀 Kickoff Task (Do NOW on first heartbeat)

1. Create mega-branch `observability/main` from `dgarson/fork`
2. Register in `_shared/MEGA_BRANCHES.md`
3. Spawn Roman with OBS-01:
```
sessions_spawn({
  agentId: "roman",
  model: "openai/gpt-5.3-codex-spark",  // thinking: high
  task: "Implement OTel core instrumentation for OpenClaw. See _shared/OBS_STACK_SPEC.md Phase 1. Branch: observability/otel-core from dgarson/fork. Deliverables: src/telemetry/otel.ts (SDK init, OTLP exporter), src/telemetry/tracer.ts (singleton + span helpers), src/telemetry/metrics.ts (Meter, counters, histograms), src/telemetry/logger.ts (pino structured logger, per-agent log files at ~/.openclaw/logs/agents/{agentId}/YYYY-MM-DD.jsonl, daily rotation, 30-day retention). Integration: gateway request handler → HTTP span, agent session lifecycle → session span with subagent child spans. OTel SDK: @opentelemetry/sdk-node + @opentelemetry/exporter-otlp-grpc. OTLP endpoint configurable via env OTEL_EXPORTER_OTLP_ENDPOINT. Tests: 20+ unit tests. PR to observability/main (NOT dgarson/fork directly). Tag me when PR is open."
})
```
4. Spawn Larry + Oscar in parallel with OBS-03 (Docker stack doesn't need OTel core to start):
```
sessions_spawn({ agentId: "larry", model: "openai/gpt-5.3-codex-spark", task: "Build docker-compose.observability.yml..." })
```

---

### Other Ongoing Checks (existing)

- Blocked PRs / stalled work?
- Team health / workload balance?
- Quality pipeline — reviews backing up?
- #cb-inbox escalations?

---

### 📦 workq WORKSTREAM Check — Mandatory Every Heartbeat

**Source files:**
- Task board: `_shared/workstreams/workq-extension/WORKSTREAM.md` (Tasks & Status table)
- Architecture: `_shared/specs/workq-architecture.md`
- Implementation plan: `_shared/specs/workq-implementation-plan.md`

**On every heartbeat, in this order:**

1. **Read** `_shared/workstreams/workq-extension/WORKSTREAM.md` — scan the Tasks & Status table for any task that is NOT `✅ Done`.

2. **For each non-Done task, assess:**
   - Is an agent actively working it right now? → check `subagents(action=list)` and `sessions_list`.
   - Is it **in review** (PR open, awaiting feedback)? → you review it yourself now (or ping the review chain).
   - Is it **dispatched** but no agent is running? → it's stalled. Re-dispatch immediately.
   - Is it **unclaimed**? → assign it to the appropriate owner from the WORKSTREAM roadmap table (Groups 1–10).

3. **Dispatch criteria:**

   | Phase/Group | Assign To | Model |
   |---|---|---|
   | Plugin Registration & Config | Sandy | gpt-5.3-codex-spark |
   | Gateway RPC Methods | Oscar | gpt-5.3-codex-spark |
   | Pi Runtime & Claude Code Opt-in | Wes + Nate | MiniMax M2.5 |
   | Inbox Schema & Database Layer | Tony | gpt-5.3-codex-spark |
   | Inbox Tool Surface | Barry | MiniMax M2.5 |
   | Heartbeat + Skill Integration | Claire | gpt-5.3-codex-spark |
   | Advanced Routing | Roman | gpt-5.3-codex-spark |
   | Testing & Reliability | Larry | gpt-5.3-codex-spark |
   | Observability & Analytics | Xavier (with obs squad) | claude-sonnet-4-6 |

4. **When dispatching:**
   - Use `sessions_spawn` with the correct `agentId` and `model`.
   - Task text must include: branch name, relevant spec paths, exact deliverables, and "PR to `feat/workq-extension` (NOT `dgarson/fork` directly)."
   - Update `_shared/workstreams/workq-extension/WORKSTREAM.md` status to `🟡 Dispatched`.

5. **Do not skip or defer.** If something is outstanding and not being actively worked, it is YOUR responsibility to get it moving before ending this heartbeat. That is the job.

6. **After dispatch or review:** update WORKSTREAM.md status inline, note agent name + spawn time.

---

## workq Inbox Check
Call `workq_inbox_read` to check for pending messages. Process each one.
After processing, call `workq_inbox_ack` with the message IDs. This is REQUIRED.

