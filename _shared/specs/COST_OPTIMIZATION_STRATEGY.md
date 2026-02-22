# Cost Optimization Strategy for OpenClaw Agent Operations

*Created: 2026-02-21*
*Author: Amadeus (CAIO)*
*Priority Order: (1) Effectiveness → (2) Cost → (3) Efficiency*

---

## Executive Summary

We operate 26 agents across 8 distinct model tiers. Our current monthly API spend is dominated by two factors: **(a)** the main agent (Merlin) using Sonnet 4.6 with `thinking=high` to handle 100% of Slack messages, and **(b)** Amadeus running on Opus 4.6. This strategy proposes concrete changes estimated to reduce costs by **40-60%** while maintaining or improving effectiveness, through model right-sizing, intelligent routing, sub-agent spawn discipline, and usage tracking.

---

## 1. Current State: Agent Model Inventory

### Full Agent Map (26 agents)

| Agent | Role | Current Model | Tier | Est. Cost/MTok (in/out) | Assessment |
|-------|------|---------------|------|-------------------------|------------|
| **main** | Merlin — primary Slack responder | `claude-sonnet-4-6` + `thinking=high` | T2+ | $3/$15 + thinking overhead | ⚠️ **Over-provisioned for many messages** |
| **amadeus** | Chief AI Officer | `claude-opus-4-6` | T1 | $5/$25 | ⚠️ **Over-provisioned — Opus rarely needed** |
| **julia** | Chief Agent Officer | `claude-sonnet-4-6` | T2 | $3/$15 | ✅ Appropriate |
| **xavier** | CTO | `claude-sonnet-4-6` | T2 | $3/$15 | ✅ Appropriate |
| **stephan** | CMO | `claude-sonnet-4-6` | T2 | $3/$15 | ⚠️ Possibly over-provisioned |
| **drew** | Chief Data Officer | `openai/gpt-5.2` | T2 | $1.75/$14 | ✅ Appropriate |
| **tim** | VP Architecture | `gpt-5.3-codex` + `thinking=high` | T1-T2 | Subscription-based | ⚠️ Thinking=high may be excessive |
| **roman** | Staff Engineer | `claude-sonnet-4-6` | T2 | $3/$15 | ⚠️ Could use T3 for most work |
| **claire** | Staff Engineer | `claude-sonnet-4-6` | T2 | $3/$15 | ⚠️ Could use T3 for most work |
| **luis** | Principal UX Engineer | `claude-sonnet-4-6` | T2 | $3/$15 | ⚠️ Could use T3 for most work |
| **robert** | CFO | `gemini-3.1-pro-preview` | T3 | $2/$8* | ✅ Cost-effective |
| **tyler** | Chief Legal Officer | `MiniMax-M2.5` | T3 | $0.15/$1.20 | ✅ Very cost-effective |
| **sandy** | Senior Engineer | `gpt-5.1-codex-mini` | T3-T4 | $0.25/$2 (subscription) | ✅ Cost-effective |
| **tony** | Senior Engineer | `gpt-5.1-codex-mini` | T3-T4 | $0.25/$2 (subscription) | ✅ Cost-effective |
| **barry** | Mid-Level Engineer | `MiniMax-M2.5` | T3 | $0.15/$1.20 | ✅ Appropriate |
| **jerry** | Mid-Level Engineer | `MiniMax-M2.5` | T3 | $0.15/$1.20 | ✅ Appropriate |
| **harry** | Mid-Level Engineer | `gemini-3-flash-preview` | T4 | $0.50/$3 | ✅ Appropriate |
| **larry** | Engineer | `gpt-5.3-codex-spark` | T4 | Subscription-based | ✅ Cost-effective |
| **nate** | Engineer (Platform Core) | `gpt-5.3-codex-spark` | T4 | Subscription-based | ✅ Cost-effective |
| **oscar** | Engineer (Platform Core) | `gpt-5.3-codex-spark` | T4 | Subscription-based | ✅ Cost-effective |
| **sam** | Engineer (Product & UI) | `gpt-5.3-codex-spark` | T4 | Subscription-based | ✅ Cost-effective |
| **piper** | Engineer (Product & UI) | `gemini-3-flash-preview` | T4 | $0.50/$3 | ✅ Appropriate |
| **quinn** | Engineer (Product & UI) | `gemini-3-flash-preview` | T4 | $0.50/$3 | ✅ Appropriate |
| **reed** | Engineer (Product & UI) | `gemini-3-flash-preview` | T4 | $0.50/$3 | ✅ Appropriate |
| **vince** | Engineer (Platform Core) | `zai/glm-5` | T3 | $0.30/$2.55 | ✅ Appropriate |
| **wes** | Engineer (Product & UI) | `zai/glm-4.7-flash` | T4 | $0.06/$0.40 | ✅ Very cost-effective |

### Cost Tier Summary

| Tier | Models | Agents | Input/MTok | Output/MTok | Notes |
|------|--------|--------|------------|-------------|-------|
| **T1 (Premium)** | Opus 4.6, Grok 4 | 1 (amadeus) | $3-5 | $15-25 | Opus 5x-8x more expensive than T3 |
| **T2 (Strong)** | Sonnet 4.6, GPT-5.2, GPT-5.3-Codex | 9 (main*, julia, xavier, stephan, roman, claire, luis, drew, tim) | $1.75-3 | $14-15 | *Main has thinking=high adding ~2-3x output cost |
| **T3 (Workhorse)** | MiniMax-M2.5, GLM-5, Gemini 3.1 Pro, Codex-Mini | 7 (robert, tyler, sandy, tony, barry, jerry, vince) | $0.15-2 | $1.20-8 | Should be 60-70% of all work |
| **T4 (Fast/Cheap)** | Gemini 3 Flash, GLM-4.7 Flash, Codex-Spark | 9 (harry, larry, nate, oscar, sam, piper, quinn, reed, wes) | $0.06-0.50 | $0.40-3 | Best for high-volume, simple tasks |

### Special Cost Considerations

1. **OpenAI Codex platform** (sandy, tony, larry, nate, oscar, sam, tim): Subscription-based with usage limits, not pure per-token. Current usage shows `97% left` on 5h window and `77% left` on daily cap. These agents are **effectively free within subscription limits**.
2. **MiniMax OAuth** (tyler, barry, jerry): Cost is $0 in config — likely a special OAuth arrangement or free tier. **Treat as near-zero cost**.
3. **ZAI models** (vince, wes): Also $0 in config — similar arrangement. **Near-zero cost**.
4. **Gemini models** (robert, harry, piper, quinn, reed): Via API key. Flash is very cheap; Pro is moderate.
5. **Anthropic models** (main, julia, xavier, amadeus, stephan, roman, claire, luis): This is where the money goes. **10 agents on Anthropic = primary cost driver**.

---

## 2. The Main Agent Cost Problem

### Current Situation

Merlin (main) is the **only** agent bound to Slack channels. It runs `claude-sonnet-4-6` with `thinking=high`, meaning:

- **Every Slack message** triggers a Sonnet 4.6 inference with extended thinking
- Extended thinking tokens are billed as output tokens ($15/MTok)
- A `thinking=high` response can easily generate 2,000-10,000 thinking tokens before producing actual output
- For a casual "hey, what's up?" message, this is massive overkill

**No routing bindings exist** — zero bindings configured. All Slack messages go to `main` (the default agent). There are 13+ Slack channels being monitored, many of which are automated notification channels (#task-blockers, #task-completion, #task-updates, #activity-cron, etc.) that likely don't need Opus/Sonnet-tier responses.

### Cost Estimate: Main Agent

Assuming main processes ~200 messages/day with an average of:
- 2,000 input tokens per message (context + history)
- 3,000 thinking tokens per message (thinking=high)
- 1,500 output tokens per message

**Daily cost estimate:**
- Input: 200 × 2,000 = 400K tokens × $3/MTok = **$1.20/day**
- Output (thinking + response): 200 × 4,500 = 900K tokens × $15/MTok = **$13.50/day**
- **Total: ~$14.70/day = ~$441/month** (just for main agent interactions)

### Solution: Multi-Layer Routing Strategy

#### Option A: Triage Agent Pattern (RECOMMENDED)

Deploy a **cheap triage agent** that receives all Slack messages first and routes complex ones to the appropriate specialist.

```json5
// Proposed new agent
{
  id: "triage",
  model: "google/gemini-3-flash-preview",  // T4: $0.50/$3 per MTok
  workspace: "~/.openclaw/workspace/triage",
  // No thinking needed
}
```

**How it works:**
1. Triage agent receives every Slack message
2. Classifies message intent in <500 tokens (at $0.50/$3 per MTok — pennies)
3. Routes to appropriate handler:
   - Simple acknowledgment/status → triage handles directly
   - Engineering questions → spawns to relevant engineer agent (T3/T4)
   - Strategic/architecture decisions → escalates to main (Sonnet) or amadeus
   - Automated channel noise (#activity-*, #task-*) → triage handles or ignores

**Estimated cost reduction:** 70-80% of messages never need Sonnet. If only 40 of 200 daily messages escalate:
- Triage cost: 200 × 3,000 tokens × $3/MTok = **$1.80/day** (tiny)
- Escalated cost: 40 × 4,500 tokens × $15/MTok = **$2.70/day**
- **New total: ~$4.50/day = ~$135/month** (vs $441 = **70% reduction**)

#### Option B: Per-Channel Routing (COMPLEMENTARY)

Use OpenClaw bindings to route automated/notification channels to cheaper agents:

```json5
// Proposed bindings
bindings: [
  // Automated notification channels → cheap handler
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "#task-blockers" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "#task-completion" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "#task-updates" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "#activity-cron" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "#activity-briefs" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "#activity-experience" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "#activity-workers" } } },

  // David's DMs → main (premium)
  { agentId: "main", match: { channel: "slack", peer: { kind: "direct", id: "U0A9JFQU3S9" } } },

  // Everything else → main (but with lower thinking)
  // OR: main with thinking=medium, OR: triage for all remaining
]
```

**Important note on bindings:** OpenClaw uses peer IDs (Slack channel IDs like `C0AB5HERFFT`) not channel names for binding matches. The `#task-blockers` style references would need the actual Slack channel IDs.

#### Option C: Reduce Main Agent Thinking Level (QUICK WIN)

The simplest immediate change: reduce `thinking=high` to `thinking=medium` or `thinking=off` for main.

```json5
// Current
{ id: "main", model: "anthropic/claude-sonnet-4-6", thinkingDefault: "high" }

// Proposed
{ id: "main", model: "anthropic/claude-sonnet-4-6", thinkingDefault: "medium" }
// OR for maximum savings:
{ id: "main", model: "anthropic/claude-sonnet-4-6" }  // thinking off
```

**Estimated impact:** Reducing thinking from high to medium/off could cut thinking tokens by 50-80%, saving **$5-10/day** with zero effectiveness loss for routine messages.

### Recommendation: Implement All Three

1. **Immediate (Day 1):** Option C — reduce main thinking to `medium`
2. **Short-term (Week 1):** Option B — bind automated channels to a cheap handler
3. **Medium-term (Week 2-3):** Option A — deploy full triage agent pattern

---

## 3. Agent-Level Model Right-Sizing

### Agents That Should Change

| Agent | Current | Proposed | Rationale | Est. Savings |
|-------|---------|----------|-----------|--------------|
| **amadeus** | `opus-4-6` ($5/$25) | `sonnet-4-6` ($3/$15) | CAIO work is strategic but doesn't need Opus for every interaction. Escalate to Opus only for architecture/strategy sub-tasks. | **40% per interaction** |
| **main** | `sonnet-4-6` + `thinking=high` | `sonnet-4-6` + `thinking=medium` | High thinking is overkill for most Slack messages | **30-50% on output** |
| **roman** | `sonnet-4-6` ($3/$15) | `MiniMax-M2.5` ($0.15/$1.20) or `GLM-5` ($0.30/$2.55) | Staff engineer doing implementation work — T3 handles this well | **85-95%** |
| **claire** | `sonnet-4-6` ($3/$15) | `MiniMax-M2.5` ($0.15/$1.20) or `GLM-5` ($0.30/$2.55) | Same as Roman — staff engineer, mostly coding | **85-95%** |
| **luis** | `sonnet-4-6` ($3/$15) | `MiniMax-M2.5` ($0.15/$1.20) | UX engineer — UI work is pattern-heavy, T3 handles well | **85-95%** |
| **stephan** | `sonnet-4-6` ($3/$15) | `gemini-3.1-pro-preview` ($2/$8) or `MiniMax-M2.5` | CMO — marketing content can work on T3; escalate creative strategy to Sonnet via spawn | **40-95%** |
| **tim** | `gpt-5.3-codex` + `thinking=high` | `gpt-5.3-codex` + `thinking=medium` | VP Architecture — thinking=high is excessive for most interactions | **30-50% on output** |

### Agents Already Right-Sized (No Change)

| Agent | Model | Rationale |
|-------|-------|-----------|
| **julia** | `sonnet-4-6` | CAO makes org-level decisions — needs strong reasoning |
| **xavier** | `sonnet-4-6` | CTO makes architectural decisions — needs strong reasoning |
| **drew** | `gpt-5.2` | CDO needs analytical capability at reasonable cost |
| **robert** | `gemini-3.1-pro` | CFO on T3 — good cost/effectiveness balance |
| **tyler** | `MiniMax-M2.5` | Legal on T3 — appropriate for document/policy work |
| **sandy, tony** | `codex-mini` | Subscription-based, effectively free |
| **barry, jerry** | `MiniMax-M2.5` | T3 engineers — appropriate |
| **harry** | `gemini-3-flash` | T4 — appropriate for mid-level work |
| **larry, nate, oscar, sam** | `codex-spark` | Subscription-based, effectively free |
| **piper, quinn, reed** | `gemini-3-flash` | T4 — appropriate for UI work |
| **vince** | `glm-5` | T3 — appropriate for platform work |
| **wes** | `glm-4.7-flash` | T4 — cheapest option, appropriate |

### The Anthropic Concentration Problem

**10 of 26 agents** run on Anthropic models (Opus/Sonnet), which are the most expensive per-token providers we use. This creates:
1. **Cost concentration risk** — a large portion of spend goes to one provider
2. **Rate limit risk** — heavy Anthropic usage can hit API rate limits
3. **Opportunity cost** — cheaper alternatives (MiniMax, GLM, Gemini) are underutilized despite good performance

**Recommendation:** Move 3-4 Anthropic agents to T3 alternatives. The implementation engineers (roman, claire, luis) and stephan are the best candidates. Keep leadership (julia, xavier) and the primary interaction point (main) on Anthropic for quality-critical work.

---

## 4. Sub-Agent Spawn Cost Discipline

### Current Policy

The `MODEL_SELECTION_POLICY.md` is well-written but enforcement is manual — agents must remember to follow it.

### Proposed Enforcement Mechanisms

#### 4.1 Default Spawn Model

The system default model for main is `openai-codex/gpt-5.1-codex-mini` (from `openclaw models status`). This is good — if an agent forgets to specify a model, they get a cheap one. **Keep this default.**

#### 4.2 Spawn Budget Rules (Add to MODEL_SELECTION_POLICY.md)

```markdown
## Spawn Cost Caps

### Rule: No Opus Spawns Without Justification
- NEVER use `anthropic/claude-opus-4-6` in `sessions_spawn` without documenting why
- If the spawned task could be completed by Sonnet, it MUST use Sonnet
- If it could be completed by T3, it MUST use T3

### Rule: Sub-Agent Model Ceiling
- Sub-agents spawned by T3/T4 agents MUST use T3 or T4 models
- Sub-agents spawned by T2 agents SHOULD use T3 unless the task genuinely requires T2
- Only T1/T2 agents with leadership roles (main, julia, xavier, amadeus) may spawn T1 sub-agents

### Rule: Retry Escalation Pattern
1. First attempt: cheapest viable model (usually T3)
2. If task fails: retry with T2
3. If task fails again: retry with T1
4. Document failure modes to update tier recommendations
```

#### 4.3 Cost-Tagged Spawning Convention

When spawning, include a cost tag in the label:

```
sessions_spawn(
  label: "fix-merge-conflict-T3",
  model: "minimax-portal/MiniMax-M2.5",
  task: "..."
)
```

This makes it easy to audit spawn patterns from session logs.

#### 4.4 High-Value Spawn Patterns

| Spawn Pattern | Model | Cost/Spawn (est.) |
|---------------|-------|-------------------|
| Merge conflict resolution | MiniMax-M2.5 | ~$0.01-0.03 |
| Simple bug fix | GLM-5 or MiniMax-M2.5 | ~$0.01-0.05 |
| Code review (standard PR) | MiniMax-M2.5 or Sonnet | ~$0.05-0.30 |
| Feature implementation | Sonnet 4.6 | ~$0.20-1.00 |
| Architecture review | Opus 4.6 (justified) | ~$0.50-3.00 |
| Status check / verification | Gemini Flash or Codex-Spark | ~$0.001-0.01 |
| Research / web search task | Gemini Flash | ~$0.01-0.05 |

---

## 5. Token Budget and Usage Tracking

### 5.1 Monitoring Infrastructure

#### Daily Cost Logging

Each agent should log its model usage to a shared location. Propose a daily cost log:

```
/Users/openclaw/.openclaw/workspace/_shared/reports/cost/YYYY-MM-DD.json
```

Format:
```json
{
  "date": "2026-02-21",
  "agents": {
    "main": {
      "model": "anthropic/claude-sonnet-4-6",
      "sessions": 45,
      "inputTokens": 450000,
      "outputTokens": 675000,
      "thinkingTokens": 300000,
      "estimatedCost": 16.50
    },
    "amadeus": { ... }
  },
  "totalEstimatedCost": 28.40,
  "spawns": {
    "total": 120,
    "byTier": { "T1": 2, "T2": 15, "T3": 80, "T4": 23 }
  }
}
```

#### Weekly Cost Summary (Robert / CFO)

Robert (CFO, on Gemini 3.1 Pro) should own a weekly cost summary task:
- Run every Monday morning via cron
- Aggregate daily cost logs
- Flag anomalies (e.g., sudden spike in T1 spawns)
- Post summary to a `#cost-tracking` Slack channel

#### Anthropic OAuth Usage Dashboard

Since we use Anthropic OAuth, usage may be visible in the Anthropic console. David should check if organization-level usage data is available and set up alerts for spend thresholds.

### 5.2 Budget Caps

| Category | Monthly Budget | Alert At | Hard Cap |
|----------|---------------|----------|----------|
| **Anthropic (Opus)** | $150 | $100 | $200 |
| **Anthropic (Sonnet)** | $400 | $300 | $500 |
| **OpenAI (GPT-5.2)** | $100 | $75 | $150 |
| **OpenAI Codex** | Subscription-based | N/A (monitor usage %) | N/A |
| **Gemini** | $50 | $35 | $75 |
| **MiniMax/GLM/ZAI** | $20 | $15 | $30 |
| **TOTAL** | **$720** | **$525** | **$955** |

**Note:** These are estimates. Actual usage data is needed to calibrate. Start tracking now, refine caps after 2 weeks of data.

### 5.3 OpenAI Codex Usage Management

The Codex platform runs on subscription-based usage limits. Current status: `97% left` on 5h window, `77% left` on daily cap. Six agents (sandy, tony, larry, nate, oscar, sam) plus tim run on Codex models.

**Risk:** If too many Codex agents run simultaneously, we could hit usage caps.

**Mitigation:**
- Monitor Codex usage daily via `openclaw models status`
- If hitting >80% daily cap regularly, consider moving 1-2 agents off Codex to per-token models
- Prioritize Codex usage for actual coding tasks (the platform is optimized for this)

---

## 6. Concrete Recommendations & Implementation Plan

### Phase 1: Quick Wins (Implement Today)

**Estimated savings: 30-40% off current Anthropic spend**

| # | Action | Change | Impact |
|---|--------|--------|--------|
| 1 | **Reduce main thinking** | `thinkingDefault: "high"` → `"medium"` | 30-50% reduction in main output tokens |
| 2 | **Downgrade amadeus** | `opus-4-6` → `sonnet-4-6` | 40% reduction per amadeus interaction |

Config changes:
```json5
// In openclaw.json, agents.list:
{ id: "main", model: "anthropic/claude-sonnet-4-6", thinkingDefault: "medium" /* was "high" */ },
{ id: "amadeus", model: "anthropic/claude-sonnet-4-6" /* was opus-4-6 */ },
```

### Phase 2: Engineer Right-Sizing (Week 1)

**Estimated savings: Additional 15-25%**

| # | Action | Change | Impact |
|---|--------|--------|--------|
| 3 | **Move roman to T3** | `sonnet-4-6` → `MiniMax-M2.5` | ~90% cost reduction for roman |
| 4 | **Move claire to T3** | `sonnet-4-6` → `MiniMax-M2.5` | ~90% cost reduction for claire |
| 5 | **Move luis to T3** | `sonnet-4-6` → `MiniMax-M2.5` | ~90% cost reduction for luis |
| 6 | **Move stephan to T3** | `sonnet-4-6` → `gemini-3.1-pro-preview` | ~40% cost reduction for stephan |

Config changes:
```json5
{ id: "roman", model: "minimax-portal/MiniMax-M2.5" /* was sonnet-4-6 */ },
{ id: "claire", model: "minimax-portal/MiniMax-M2.5" /* was sonnet-4-6 */ },
{ id: "luis", model: "minimax-portal/MiniMax-M2.5" /* was sonnet-4-6 */ },
{ id: "stephan", model: "google/gemini-3.1-pro-preview" /* was sonnet-4-6 */ },
```

**Risk mitigation:** Monitor task completion quality for 1 week. If any agent shows degraded output quality, escalate back to Sonnet.

### Phase 3: Channel Routing (Week 2)

**Estimated savings: Additional 10-20%**

| # | Action | Change | Impact |
|---|--------|--------|--------|
| 7 | **Create triage agent** | New agent on `gemini-3-flash-preview` | Filters all incoming messages |
| 8 | **Route automated channels** | Bind #task-*, #activity-* to triage | Remove noise from main agent |
| 9 | **Set up per-channel bindings** | Route by channel ID | Right-size per channel |

**Triage agent config:**
```json5
// New agent in agents.list
{
  id: "triage",
  workspace: "~/.openclaw/workspace/triage",
  model: "google/gemini-3-flash-preview",
  subagents: {
    allowAgents: ["main", "julia", "xavier", "amadeus"]
  },
  tools: {
    allow: ["read", "exec", "message", "sessions_spawn", "session_status"]
  }
}
```

**Triage SOUL.md should instruct it to:**
1. Read every incoming message
2. If it's an automated notification → acknowledge or silently ignore
3. If it's a simple question → answer directly (it's Flash, it's cheap)
4. If it's complex/strategic → spawn to main or relevant lead with context
5. If it @mentions a specific agent → route to that agent

**Binding changes:**
```json5
bindings: [
  // David's DMs always go to main (premium experience)
  { agentId: "main", match: { channel: "slack", peer: { kind: "direct", id: "U0A9JFQU3S9" } } },

  // Automated channels → triage (cheap)
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "<#task-blockers-id>" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "<#task-completion-id>" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "<#task-updates-id>" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "<#activity-cron-id>" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "<#activity-briefs-id>" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "<#activity-experience-id>" } } },
  { agentId: "triage", match: { channel: "slack", peer: { kind: "channel", id: "<#activity-workers-id>" } } },

  // All other Slack → main (default, but triage could also handle this)
]
```

### Phase 4: Usage Tracking (Week 2-3)

| # | Action | Owner | Impact |
|---|--------|-------|--------|
| 10 | **Set up daily cost logging** | robert (CFO) | Visibility into actual spend |
| 11 | **Configure budget alerts** | david + robert | Prevent cost overruns |
| 12 | **Weekly cost review** | robert (cron task) | Ongoing optimization |

### Phase 5: Ongoing Optimization (Monthly)

| # | Action | Owner | Impact |
|---|--------|-------|--------|
| 13 | **Review MODEL_SELECTION_POLICY.md** | amadeus | Keep tier assignments current |
| 14 | **Analyze spawn patterns** | robert | Identify wasteful spawn patterns |
| 15 | **A/B test model downgrades** | julia | Validate T3 effectiveness for more tasks |

---

## 7. Estimated Total Impact

### Before Optimization (estimated monthly)

| Provider | Agents | Est. Monthly Cost |
|----------|--------|-------------------|
| Anthropic (Opus) | 1 (amadeus) | $150-250 |
| Anthropic (Sonnet + thinking) | 8 (main, julia, xavier, stephan, roman, claire, luis + spawns) | $400-600 |
| OpenAI (GPT-5.2) | 1 (drew) | $50-100 |
| OpenAI Codex (subscription) | 6 (sandy, tony, larry, nate, oscar, sam, tim) | Fixed subscription |
| Google Gemini | 5 (robert, harry, piper, quinn, reed) | $30-60 |
| MiniMax / ZAI | 5 (tyler, barry, jerry, vince, wes) | $5-15 |
| **TOTAL** | **26** | **$635-1,025/month** |

### After Full Optimization (estimated monthly)

| Provider | Agents | Est. Monthly Cost |
|----------|--------|-------------------|
| Anthropic (Opus) | 0 (amadeus moved to Sonnet) | $0 (spawn-only) |
| Anthropic (Sonnet, thinking=medium) | 4 (main, julia, xavier + spawns) | $150-250 |
| OpenAI (GPT-5.2) | 1 (drew) | $50-100 |
| OpenAI Codex (subscription) | 6 | Fixed subscription |
| Google Gemini | 7 (robert, harry, piper, quinn, reed, stephan, triage) | $50-80 |
| MiniMax / ZAI | 8 (tyler, barry, jerry, vince, wes, roman, claire, luis) | $10-25 |
| **TOTAL** | **27** | **$260-455/month** |

### Projected Savings: **$375-570/month (55-60%)**

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| T3 models fail on complex engineering tasks | Medium | Medium | Retry escalation pattern (T3 → T2 → T1). Monitor failure rates. |
| Triage agent misroutes important messages | Low | High | Start with conservative routing (only automated channels). Add channels gradually. |
| Codex usage limits hit during heavy coding sprints | Medium | Medium | Monitor daily. Move 1-2 agents off Codex if needed. |
| Model quality regression affects user experience | Low | High | Keep main and leadership on Sonnet. Only downgrade implementers. |
| MiniMax/ZAI free tier disappears | Low | Medium | Have fallback plan to move to Gemini Flash or Codex-Mini. |

---

## 9. Decision Log: What NOT to Change (and Why)

| Decision | Reasoning |
|----------|-----------|
| **Keep main on Sonnet (not T3)** | Main is David's primary interface. Quality of interaction matters most. |
| **Keep julia on Sonnet** | CAO makes org decisions — needs strong reasoning. |
| **Keep xavier on Sonnet** | CTO makes architecture decisions — needs strong reasoning. |
| **Keep drew on GPT-5.2** | Data work requires analytical depth. GPT-5.2 is already well-priced. |
| **Keep T4 agents on T4** | They're already on the cheapest viable models. No further optimization possible. |
| **Don't remove thinking entirely from main** | Some messages genuinely benefit from reasoning. Medium is the right balance. |

---

## Appendix A: Model Pricing Reference (Feb 2026)

| Model | Provider | Input/MTok | Output/MTok | Notes |
|-------|----------|------------|-------------|-------|
| claude-opus-4-6 | Anthropic | $5.00 | $25.00 | Most expensive. Thinking tokens = output rate. |
| claude-sonnet-4-6 | Anthropic | $3.00 | $15.00 | 5x cheaper than Opus on output. |
| gpt-5.2 | OpenAI | $1.75 | $14.00 | Cached input: $0.175. |
| gpt-5.3-codex | OpenAI Codex | Subscription | Subscription | Usage-limit based. |
| gpt-5.1-codex-mini | OpenAI Codex | Subscription | Subscription | Cheapest Codex. |
| gpt-5.3-codex-spark | OpenAI Codex | Subscription | Subscription | Research preview. |
| gemini-3.1-pro-preview | Google | $2.00 | ~$8.00 | Competitive with Sonnet for less. |
| gemini-3-flash-preview | Google | $0.50 | $3.00 | Best value for simple tasks. |
| MiniMax-M2.5 | MiniMax | $0.15 | $1.20 | OAuth — possibly $0 in our setup. |
| GLM-5 | ZAI | $0.30 | $2.55 | Strong T3 option. |
| GLM-4.7-flash | ZAI | $0.06 | $0.40 | Cheapest per-token model we use. |
| grok-4 | xAI | $3.00 | $15.00 | Fallback only. |

## Appendix B: Action Items Checklist

- [ ] **Phase 1.1:** Change main `thinkingDefault` from `"high"` to `"medium"` in openclaw.json
- [ ] **Phase 1.2:** Change amadeus model from `opus-4-6` to `sonnet-4-6` in openclaw.json
- [ ] **Phase 2.1:** Change roman model to `MiniMax-M2.5`
- [ ] **Phase 2.2:** Change claire model to `MiniMax-M2.5`
- [ ] **Phase 2.3:** Change luis model to `MiniMax-M2.5`
- [ ] **Phase 2.4:** Change stephan model to `gemini-3.1-pro-preview`
- [ ] **Phase 3.1:** Create triage agent workspace and SOUL.md
- [ ] **Phase 3.2:** Add triage agent to openclaw.json
- [ ] **Phase 3.3:** Look up Slack channel IDs for automated channels
- [ ] **Phase 3.4:** Add bindings for automated channels → triage
- [ ] **Phase 3.5:** Test routing with `openclaw gateway restart`
- [ ] **Phase 4.1:** Create cost logging directory structure
- [ ] **Phase 4.2:** Add cost tracking cron to robert (CFO)
- [ ] **Phase 4.3:** Set up Anthropic console spend alerts
- [ ] **Phase 5.1:** Schedule monthly MODEL_SELECTION_POLICY.md review

---

*This document is a living strategy. Review monthly and update based on actual usage data.*
