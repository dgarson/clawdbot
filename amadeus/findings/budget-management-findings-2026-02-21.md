# Budget-Aware Model Management — Deep Findings
*Investigator: Amadeus (claude-opus-4-6)*
*Date: 2026-02-21*
*Brief: `/Users/openclaw/.openclaw/workspace/investigations/exec-assistant-and-budget-management-2026-02-21.md`*

---

## 1. What Already Exists: Provider Usage Infrastructure

### 1.1 Provider Usage Types (`provider-usage.types.ts`)

The system tracks usage across **8 providers**: `anthropic`, `github-copilot`, `google-gemini-cli`, `google-antigravity`, `minimax`, `openai-codex`, `xiaomi`, `zai`.

Each provider's usage is captured as a `ProviderUsageSnapshot`:
```ts
type UsageWindow = {
  label: string;        // e.g. "5h", "Week", "Sonnet", "Opus", "3h", "Day"
  usedPercent: number;  // 0–100, clamped
  resetAt?: number;     // epoch ms, when the window resets
};

type ProviderUsageSnapshot = {
  provider: UsageProviderId;
  displayName: string;
  windows: UsageWindow[];   // multiple windows per provider (e.g. 5h + weekly)
  plan?: string;            // e.g. "plus ($150.00)"
  error?: string;
};
```

**Key insight**: The data is already **percentage-based** with reset timestamps. We don't get absolute token counts from provider APIs — we get "you've used X% of your limit" and "it resets at Y."

### 1.2 Claude/Anthropic Usage Specifics (`provider-usage.fetch.claude.ts`)

The Anthropic API returns:
- `five_hour.utilization` + `resets_at` — short-term rate limit window
- `seven_day.utilization` + `resets_at` — weekly cap
- `seven_day_sonnet.utilization` / `seven_day_opus.utilization` — **model-specific** weekly caps (no reset timestamps on these)

**Critical finding**: Claude exposes **per-model-tier usage** (Sonnet vs Opus separately) but **only as 7-day utilization percentages without reset timestamps** for the model-specific windows. The 5h and general 7-day windows DO have reset timestamps.

This is enormously useful for budget management because we can see how close we are to the Opus cap vs the Sonnet cap independently.

### 1.3 Codex Usage (`provider-usage.fetch.codex.ts`)

The Codex API returns:
- `primary_window` (typically 3h) with `used_percent` and `reset_at`
- `secondary_window` (typically 24h) with `used_percent` and `reset_at`
- `plan_type` and `credits.balance`

**Finding**: Codex has a dual-window rate limit. Budget governor needs to consider both windows.

### 1.4 Usage Loading (`provider-usage.load.ts`)

`loadProviderUsageSummary()` fetches usage from all configured providers **in parallel** with timeout handling. It:
1. Resolves auth credentials for each provider
2. Dispatches fetch calls concurrently
3. Filters out providers that only have errors (e.g., "No credentials")
4. Returns a `UsageSummary` with `updatedAt` timestamp

**Constraint**: Each fetch is subject to a **5-second default timeout** (+1s grace). The whole batch completes in ~5s worst case. This is acceptable for periodic checks but not something to call on every message.

### 1.5 Session-Level Cost Tracking (`session-cost-usage.ts`)

Separately from provider-level usage, OpenClaw tracks **per-session, per-message cost data**:
- Token counts (input, output, cacheRead, cacheWrite)
- Cost breakdowns (when the API provides them)
- Estimated costs (when cost config is available via `ModelCostConfig`)
- Daily aggregations per session
- Per-model usage breakdowns within sessions

**Key insight**: This data is retrospective (parsed from transcript JSONL files). It tells you what you *spent*, not what you *have left*. The provider usage API tells you what you have left. Both are needed for budget management.

### 1.6 Cost Configuration (`usage-format.ts`)

`ModelCostConfig` is a per-million-token pricing structure:
```ts
type ModelCostConfig = {
  input: number;    // per million tokens
  output: number;
  cacheRead: number;
  cacheWrite: number;
};
```

These are defined per-model in `models-config.providers.ts`. Example: MiniMax costs `{ input: 15, output: 60, cacheRead: 2, cacheWrite: 10 }`.

**Gap**: Not all providers have cost configs defined. Anthropic models rely on the upstream pi-ai SDK for cost data, which may or may not include this. The budget governor should be resilient to missing cost data and fall back to percentage-based heuristics.

---

## 2. Model Selection Architecture

### 2.1 Model Resolution Chain

Model selection follows a clear priority chain:

1. **Session-level override**: User runs `/model anthropic/claude-sonnet-4-6` → stored in session state
2. **Agent-level config**: `agents.list[].model.primary` → per-agent override
3. **Global default**: `agents.defaults.model.primary` → org-wide default
4. **Hardcoded default**: `DEFAULT_PROVIDER = "anthropic"`, `DEFAULT_MODEL = "claude-opus-4-6"`

The function `resolveDefaultModelForAgent(cfg, agentId)` resolves this chain.

**Important**: There's a separate `subagents.model` field that controls what model spawned sub-agents use. The resolution function `resolveSubagentSpawnModelSelection()` checks:
1. Runtime `modelOverride` (from spawn call)
2. Agent-level `subagents.model`
3. Global `agents.defaults.subagents.model`
4. Global `agents.defaults.model.primary`
5. Runtime default from `resolveDefaultModelForAgent()`

### 2.2 Model Fallback System (`model-fallback.ts`)

OpenClaw has a sophisticated model fallback system:
- `runWithModelFallback()` tries the primary model first
- On failover-eligible errors (rate limits, server errors), it falls through to configured fallbacks
- Fallback candidates come from `agents.defaults.model.fallbacks` array
- **Auth profile cooldown**: If all auth profiles for a provider are in cooldown (rate-limited), the candidate is skipped — UNLESS it's the primary model and the cooldown is near expiry, in which case it "probes" to detect recovery

**Critical finding for budget governor**: The fallback system already handles reactive rate-limit scenarios. A budget governor would be *proactive* — downgrading models before hitting rate limits, to preserve capacity for high-priority agents.

### 2.3 Per-Agent Model Config

From `agent-scope.ts` and `zod-schema.agent-runtime.ts`:
```ts
// Each agent entry can have:
{
  id: "amadeus",
  model: "anthropic/claude-opus-4-6",  // or { primary: "...", fallbacks: ["..."] }
  subagents: {
    model: "anthropic/claude-sonnet-4-6",
    thinking: "medium",
  },
}
```

**This is the integration point for budget override.** A budget governor could dynamically modify the effective model for agents by either:
- Modifying config at runtime (bad — config is loaded from YAML)
- Injecting a model override at the resolution layer (better)
- Using the existing fallback mechanism (best — least invasive)

### 2.4 Model Aliases

The system supports model aliases via `agents.defaults.models`:
```yaml
models:
  anthropic/claude-opus-4-6:
    alias: opus
  anthropic/claude-sonnet-4-6:
    alias: sonnet
```

This means budget tier definitions could reference aliases for clarity.

---

## 3. Heartbeat Infrastructure

### 3.1 How Heartbeats Work

From `heartbeat-runner.ts`:
- Each agent with heartbeat enabled gets periodic "ticks"
- The heartbeat prompt is sent as a user message to the agent's session
- The agent responds (with full tool access)
- Responses are optionally delivered to a target channel

**Budget integration point**: A heartbeat handler (or a dedicated cron job) could run usage checks and trigger model downgrades. The heartbeat already runs at a configurable interval (`agents.defaults.heartbeat.every`, default `30m`).

### 3.2 Heartbeat Model Override

The heartbeat supports a `model` field to use a cheaper model for heartbeat runs:
```yaml
heartbeat:
  every: 30m
  model: anthropic/claude-sonnet-4-6
```

This is relevant because the budget check itself should run on a cheap model.

---

## 4. Gaps and Constraints

### 4.1 No "Budget" Concept Exists Yet

Searched the entire codebase — **no budget management infrastructure exists**. The word "budget" appears only in unrelated contexts (token budgets for context pruning, delivery queue naming).

### 4.2 Provider Usage Is Percentage-Based, Not Dollar-Based

The provider APIs expose **utilization percentages**, not dollar amounts or token counts. This means:
- We can't directly calculate "you have $X remaining"
- We CAN calculate "you've used Y% of your Anthropic weekly limit, and it resets in Z hours"
- Budget decisions must be based on **percentage thresholds** and **time remaining until reset**

### 4.3 No Real-Time Usage Feed

Provider usage is fetched on-demand (with a ~5s timeout). There's no webhook or streaming update. The budget governor must **poll** at intervals. The heartbeat system provides a natural polling mechanism.

### 4.4 Model-Specific Caps Are Opaque

Claude's `seven_day_sonnet` and `seven_day_opus` give utilization percentages but no reset timestamps. The general `seven_day` window does have a reset timestamp. The model-specific windows likely share the same reset cadence, but this isn't guaranteed by the API.

### 4.5 Config Is Static (YAML-Based)

The OpenClaw config is loaded from YAML at startup and cached. Dynamic runtime changes to model assignments need to work **outside** the config system — either by:
- Writing override state to a file the agents read
- Injecting overrides at the model resolution layer
- Using the existing session model override mechanism

### 4.6 Multi-Agent Coordination

Multiple agents run concurrently (default max: 4, configured max: 8). Each has its own session. A budget governor needs to consider **aggregate usage** across all agents, not just individual sessions.

### 4.7 Protected Agent Constraints

Per the brief:
- **Tim** (openai/gpt-5.3-codex): Never downgrade — uses a different provider entirely
- **Luis** (anthropic/claude-sonnet-4-6): Never downgrade — already on the "floor" model
- **Amadeus**: Floor = claude-sonnet-4-6 (currently on opus-4-6)

These constraints must be configurable, not hardcoded.

---

## 5. Available Data for Budget Decisions

### What We Have

| Data Point | Source | Granularity | Latency |
|---|---|---|---|
| Provider usage % | Provider APIs | Per-window (5h, 7d, model-tier) | ~5s fetch |
| Reset timestamps | Provider APIs | Per-window | ~5s fetch |
| Session token counts | Transcript JSONL | Per-message | Real-time (local file) |
| Session costs | Transcript JSONL | Per-message (estimated) | Real-time |
| Model cost config | Config YAML / models.json | Per-model | Instant |
| Active sessions | Session store | Per-agent | Instant |

### What We Don't Have

| Data Point | Why Not | Impact |
|---|---|---|
| Absolute token/dollar limits | Providers expose only % | Must work with percentages |
| Real-time usage stream | No provider webhook | Must poll |
| Per-agent provider usage split | Only aggregate per-provider | Can't attribute usage to specific agents at the provider level |
| Future usage prediction | No ML infrastructure | Must use simple heuristics |

---

## 6. Algorithm Sketch for Budget Decisions

### The Core Question

Given:
- Current usage percentage (e.g., 65% of Anthropic weekly)
- Time until reset (e.g., 3.5 days remaining)
- Expected daily usage rate (derived from historical data)

Should we downgrade agents to cheaper models?

### Proposed Heuristic

```
elapsed_fraction = (7 - days_until_reset) / 7
ideal_usage_at_this_point = elapsed_fraction * 100

overshoot = current_usage_percent - ideal_usage_at_this_point

if overshoot > HIGH_THRESHOLD (e.g., 20%):
    downgrade all non-protected agents to floor model
elif overshoot > MEDIUM_THRESHOLD (e.g., 10%):
    downgrade lowest-priority agents first
elif overshoot < -10%:
    restore agents to their default models (we're under budget)
```

### Complications

1. **Non-linear usage**: Weekend vs weekday patterns
2. **Bursty usage**: A single long conversation can spike usage
3. **Multiple windows**: 5h window and 7d window may conflict (e.g., plenty of weekly budget but 5h window is nearly full)
4. **Hysteresis**: Avoid flip-flopping between models (need debounce/cooldown on changes)
5. **Model-specific caps**: Opus and Sonnet have separate caps — downgrading from Opus to Sonnet shifts load between caps

---

## 7. Risk Assessment

### Low Risk
- Reading provider usage data (already exists, well-tested)
- Adding config schema fields (Zod schemas are additive)
- Creating a standalone governor module (no existing files need major changes)

### Medium Risk
- Injecting model overrides at runtime (needs careful integration with model resolution chain)
- State management for the governor (needs persistence across restarts)
- Heartbeat or cron integration (needs to avoid interfering with normal heartbeat flow)

### High Risk
- Modifying `model-selection.ts` or `model-fallback.ts` (heavily used, easy to introduce regressions)
- Interacting with auth profile cooldown system (complex state machine)
- Getting the algorithm wrong (over-aggressive downgrading degrades experience; under-aggressive doesn't save budget)

### Merge Conflict Risk

| File | Risk | Reason |
|---|---|---|
| `provider-usage.types.ts` | None | Only reading, not modifying |
| `provider-usage.load.ts` | None | Only calling, not modifying |
| `model-selection.ts` | Medium | May need to add a resolution hook |
| `model-fallback.ts` | Low | Existing fallback mechanism may be reusable |
| `agent-scope.ts` | Low | May need to add budget override resolution |
| `zod-schema.agent-defaults.ts` | Low | Additive config field |
| New: `budget-governor.ts` | None | New file, no conflicts |
| New: `budget-state.ts` | None | New file |

---

## 8. Open Questions

1. **How should the governor's state persist?** Options: JSON file in state dir, session store, or in-memory with file-backed checkpoint.

2. **Should downgrade decisions be per-session or global?** A global governor seems right — usage limits are per-account, not per-session.

3. **What's the right polling interval?** Too frequent wastes API calls and tokens. Too infrequent misses rapid usage spikes. 15–30 minutes seems reasonable (aligned with heartbeat cadence).

4. **Should the governor be an agent or a system service?** An agent can use tools and make decisions; a system service is simpler and more predictable. Recommendation: system service with agent notification.

5. **How to handle the 5h window vs 7d window?** If the 5h window is nearly full but the 7d window has plenty of headroom, should we downgrade? Probably not — just wait for the 5h reset. But if the 7d window is tight AND the 5h window is full, definitely downgrade.

6. **What about Codex/z.AI/other providers?** Tim uses Codex (never downgrade). But other agents might use z.AI or Gemini — should the governor manage those providers too?

7. **Should upgraded/downgraded state be visible to agents?** If Amadeus knows it's been downgraded, it could adjust its behavior (e.g., fewer sub-agent spawns, simpler analysis). This could be surfaced via the system prompt or a file in the workspace.
