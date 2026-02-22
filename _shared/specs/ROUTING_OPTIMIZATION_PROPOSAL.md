# Routing Optimization Proposal: Inbound Message Handling

*Created: 2026-02-21*
*Author: Julia (CoS)*
*Status: PROPOSAL — Awaiting David's review*

---

## Executive Summary

Today, **every inbound Slack message** routes to the `main` agent, which runs Claude Sonnet 4.6 (with Opus-capable sub-agents). There are **zero bindings** configured — `main` is the default agent and catches 100% of traffic. This is expensive and unnecessary. Most messages don't need Sonnet-level reasoning, and many could be handled by cheaper models or specialized agents.

This proposal evaluates four routing architectures and recommends **Option D (Tiered Main Agent)** as the immediate win, with **Option B (Channel-Based Routing)** as a Phase 2 optimization. Together, these changes can reduce inbound message costs by **60-80%** while maintaining quality for complex interactions.

---

## 1. Current State Analysis

### Message Flow Today

```
Every Slack message
    ↓
main agent (Sonnet 4.6 + high thinking)
    ↓
main decides: respond directly OR spawn sub-agent
    ↓
Sub-agents run on various models (Opus through Spark)
```

### What We Have

| Component | Current State |
|---|---|
| **Agents** | 26 agents configured |
| **Bindings** | `[]` — empty, zero routing rules |
| **Default agent** | `main` (first in list, catches everything) |
| **Main model** | `anthropic/claude-sonnet-4-6` with `thinkingDefault: "high"` |
| **Slack channels** | ~14 channels allowed (6 by ID, 7 by name) |
| **Channel routing** | None — all channels → main |
| **DM routing** | None — all DMs → main |

### Cost Profile

**Main agent model: Claude Sonnet 4.6**
- Input: ~$3/MTok, Output: ~$15/MTok
- With extended thinking on "high": significantly more output tokens per turn
- Every message — even "ok" or "👍" — triggers a full Sonnet inference with high thinking

**Estimated daily cost structure** (rough, based on typical usage patterns):
- Simple acknowledgments, status updates, casual chat: ~40% of messages → overpaying by 5-10x
- Moderate tasks (delegation, coordination, Q&A): ~35% of messages → appropriately priced
- Complex tasks (architecture, strategy, debugging): ~15% of messages → should escalate to Opus
- Heartbeats, system messages, cron outputs: ~10% of messages → overpaying by 10-20x

### The Core Problem

Main agent applies **uniform processing** to every message regardless of complexity. A "sounds good" reply gets the same Sonnet + high thinking treatment as "design a new microservice architecture." This is like sending every letter by overnight express — effective but wasteful.

---

## 2. Routing Architecture Options

### Option A: Triage Agent

**Concept:** A cheap model (Flash/Spark) reads every inbound message first and routes to the appropriate agent/model.

```
Every Slack message
    ↓
triage agent (Gemini Flash: $0.50/$3 per MTok)
    ↓ classifies as: simple | moderate | complex | domain-specific
    ↓
Routes to: cheap agent | main (Sonnet) | main (Opus) | specialist agent
```

**Config example:**
```json5
{
  agents: {
    list: [
      {
        id: "triage",
        name: "Triage",
        model: "google/gemini-3-flash-preview",
        workspace: "~/.openclaw/workspace/triage",
        default: true,  // catches all inbound
        tools: {
          allow: ["session_status", "sessions_spawn", "sessions_send", "message"]
        }
      },
      {
        id: "main",
        model: "anthropic/claude-sonnet-4-6",
        // ... existing config
      }
    ]
  },
  bindings: []  // triage is default, catches everything
}
```

**Triage agent SOUL.md would include:**
```markdown
You are a message router. For every inbound message:
1. Read the message content and context
2. Classify complexity: SIMPLE, MODERATE, COMPLEX, DOMAIN
3. Route accordingly:
   - SIMPLE (greetings, acks, simple Q&A) → respond directly (you're cheap enough)
   - MODERATE (coordination, delegation, standard tasks) → sessions_send to main
   - COMPLEX (architecture, strategy, novel problems) → sessions_send to main with model=opus hint
   - DOMAIN (engineering tasks) → sessions_send to xavier
4. For threads: check thread history before routing; escalate if complexity increases
```

**Pros:**
- Maximum cost savings on simple messages (Flash is ~6-15x cheaper than Sonnet)
- Centralized routing logic, easy to tune
- Can handle simple messages entirely without touching Sonnet

**Cons:**
- ⚠️ **Adds latency** — every message gets TWO model calls (triage + handler)
- ⚠️ **Misclassification risk** — triage agent may route complex messages to cheap handlers or waste Opus on simple ones
- ⚠️ **Context loss** — triage agent doesn't have main's session history; thread continuity breaks
- ⚠️ **Personality fragmentation** — different agents responding in same channel feels inconsistent
- ⚠️ **OpenClaw limitation** — no built-in "triage then forward" primitive; would need custom `sessions_send` logic
- ⚠️ **Thread handling** — if triage routes message 1 to agent A and message 2 to agent B, thread coherence is lost

**Verdict: High complexity, moderate savings, significant UX risk. Not recommended as primary strategy.**

---

### Option B: Channel-Based Routing

**Concept:** Different Slack channels route to different agents via bindings. Each channel gets the right agent for its purpose.

```
#cb-inbox          → main (Sonnet) — David's direct conversations
#cb-engineering    → xavier (Sonnet) — engineering tasks
#task-updates      → harry (Flash) — status updates, low-complexity
#task-completion   → harry (Flash) — task completions
#task-blockers     → main (Sonnet) — needs judgment
#activity-cron     → wes (GLM Flash) — cron output monitoring
#activity-workers  → wes (GLM Flash) — worker status
#activity-briefs   → reed (Flash) — daily briefs
#activity-experience → piper (Flash) — experience logs
DMs with David     → main (Sonnet) — personal assistant
```

**Config example:**
```json5
{
  bindings: [
    // DMs with David → main (highest priority: peer match)
    {
      agentId: "main",
      match: { channel: "slack", peer: { kind: "direct", id: "U0A9JFQU3S9" } }
    },
    // Core channels → main (Sonnet)
    { agentId: "main", match: { channel: "slack", peer: { kind: "channel", id: "C0AAP72R7L5" } } },  // #cb-inbox
    { agentId: "main", match: { channel: "slack", peer: { kind: "channel", id: "C0AAQJBCU0N" } } },  // #cb-engineering (or xavier)
    // Task channels → cheap agent
    { agentId: "harry", match: { channel: "slack", peer: { kind: "channel", id: "#task-updates" } } },
    { agentId: "harry", match: { channel: "slack", peer: { kind: "channel", id: "#task-completion" } } },
    { agentId: "harry", match: { channel: "slack", peer: { kind: "channel", id: "#task-blockers" } } },
    // Activity channels → cheapest agent
    { agentId: "wes", match: { channel: "slack", peer: { kind: "channel", id: "#activity-cron" } } },
    { agentId: "wes", match: { channel: "slack", peer: { kind: "channel", id: "#activity-workers" } } },
    { agentId: "reed", match: { channel: "slack", peer: { kind: "channel", id: "#activity-briefs" } } },
    { agentId: "piper", match: { channel: "slack", peer: { kind: "channel", id: "#activity-experience" } } },
  ]
}
```

**Pros:**
- ✅ **Works TODAY** — OpenClaw bindings fully support peer-based channel routing
- ✅ **Zero latency overhead** — routing is deterministic config, no model call needed
- ✅ **Clear ownership** — each channel has one agent, no personality fragmentation
- ✅ **Thread coherence** — all messages in a channel go to same agent
- ✅ **Easy to tune** — reassign a channel by changing one binding

**Cons:**
- ⚠️ **Rigid** — a channel is locked to one model tier regardless of message complexity
- ⚠️ **Channel proliferation** — may need more channels to get granular routing
- ⚠️ **Cross-channel context** — agent in #task-updates doesn't see #cb-inbox context
- ⚠️ **Identity concern** — different agents responding in different channels (all show as same Slack bot?)

**Verdict: Strong option. Works today, zero overhead, clean separation. Best for activity/task channels where messages are predictable.**

---

### Option C: Hybrid (Triage + Channel Hints)

**Concept:** Channel-based routing for predictable channels, plus a triage agent for the main inbox channel.

```
#activity-*        → cheap agents (via bindings)
#task-*            → moderate agents (via bindings)
#cb-inbox          → triage (Flash) → routes to main (Sonnet) or responds directly
DMs                → triage (Flash) → routes to main (Sonnet) or responds directly
```

**Pros:**
- Gets the best of both worlds
- Cheap channels are fully automated
- Complex channels still get intelligent routing

**Cons:**
- ⚠️ All the triage agent problems from Option A, just scoped to fewer channels
- ⚠️ More complex config and maintenance
- ⚠️ Thread continuity still breaks in triage channels

**Verdict: Overengineered for current scale. The triage agent's cons outweigh its benefits when Option D exists.**

---

### Option D: Tiered Main Agent (RECOMMENDED for Phase 1)

**Concept:** Main agent stays as the default handler for core channels, but runs on Sonnet by default (already the case!) and uses `session_status(model=opus)` to self-escalate for complex tasks. Combine with channel-based routing for activity/task channels.

```
Core channels + DMs → main (Sonnet 4.6, thinkingDefault: "medium")
    ↓ main self-assesses each message
    ↓ simple → respond with minimal thinking (or lower thinking level)
    ↓ complex → session_status(model=opus) for this turn
    ↓ delegate → sessions_spawn to specialist agent

Activity channels → cheap agents (via bindings)
Task channels → moderate agents (via bindings)
```

**Key insight:** Main is ALREADY on Sonnet 4.6. The biggest immediate win is:
1. **Reduce `thinkingDefault` from `"high"` to `"medium"` or even `"low"`** for the main agent
2. **Add bindings** to route activity/task channels to cheap agents
3. **Let main self-escalate** to Opus when it recognizes complexity

**Config changes:**
```json5
{
  agents: {
    list: [
      {
        id: "main",
        model: "anthropic/claude-sonnet-4-6",
        thinkingDefault: "medium",  // DOWN from "high" — immediate cost savings
        // ... rest unchanged
      }
    ]
  },
  bindings: [
    // Activity channels → cheapest agents (GLM Flash / Gemini Flash)
    { agentId: "wes", match: { channel: "slack", peer: { kind: "channel", id: "#activity-cron" } } },
    { agentId: "wes", match: { channel: "slack", peer: { kind: "channel", id: "#activity-workers" } } },
    { agentId: "reed", match: { channel: "slack", peer: { kind: "channel", id: "#activity-briefs" } } },
    { agentId: "piper", match: { channel: "slack", peer: { kind: "channel", id: "#activity-experience" } } },

    // Task channels → moderate agent (Flash or MiniMax)
    { agentId: "harry", match: { channel: "slack", peer: { kind: "channel", id: "#task-updates" } } },
    { agentId: "harry", match: { channel: "slack", peer: { kind: "channel", id: "#task-completion" } } },
    { agentId: "harry", match: { channel: "slack", peer: { kind: "channel", id: "#task-blockers" } } },

    // Everything else (DMs, #cb-* channels) → main (default, no binding needed)
  ]
}
```

**Main agent SOUL.md addition for self-escalation:**
```markdown
## Model Self-Escalation Protocol

You run on Sonnet by default. For most messages, this is sufficient.

**Escalate to Opus** (`session_status(model=opus)`) when:
- Architecture or system design decisions
- Multi-step strategic reasoning
- Complex debugging requiring deep system understanding
- Nuanced writing (proposals, strategy docs)
- Any task where you feel uncertain about your reasoning quality

**Stay on Sonnet** for:
- Delegation and task management
- Simple Q&A and status updates
- Routine coordination
- Sub-agent spawning (the sub-agent picks its own model)

**De-escalate back** (`session_status(model=default)`) after the complex turn is complete.
```

**Pros:**
- ✅ **Minimal disruption** — main agent stays as primary handler for core channels
- ✅ **Immediate cost savings** — activity/task channels offloaded via bindings TODAY
- ✅ **Thinking reduction** — dropping from "high" to "medium" reduces output tokens ~30-50%
- ✅ **Self-escalation** — main can call `session_status(model=opus)` when it needs more power
- ✅ **Thread coherence** — main handles full threads, no context loss
- ✅ **Personality consistency** — David always talks to "Merlin" in core channels
- ✅ **Works TODAY** — all mechanisms already exist in OpenClaw

**Cons:**
- ⚠️ Sonnet still processes every message in core channels (including simple ones)
- ⚠️ Self-escalation relies on the model correctly judging its own capability limits
- ⚠️ Activity channel agents need their own workspace/persona setup

**Verdict: Best balance of cost savings, implementation simplicity, and UX quality. Recommended.**

---

## 3. OpenClaw Routing Capabilities: What Works Today vs. What's Missing

### ✅ Works TODAY

| Capability | Status | Notes |
|---|---|---|
| **Channel-based bindings** | ✅ Full support | Route by `peer.kind: "channel"`, peer ID or name |
| **DM-based bindings** | ✅ Full support | Route by `peer.kind: "direct"`, sender ID |
| **Account-based bindings** | ✅ Full support | Route by `accountId` |
| **Team-based bindings** | ✅ Full support | Route by `teamId` (Slack workspace) |
| **Per-agent model config** | ✅ Full support | Each agent has its own `model` field |
| **Per-agent tool restrictions** | ✅ Full support | `tools.allow` / `tools.deny` per agent |
| **Per-agent sandbox** | ✅ Full support | `sandbox.mode` per agent |
| **`session_status(model=X)`** | ✅ Full support | Dynamic model switching mid-session |
| **`sessions_spawn` to other agents** | ✅ Full support | Delegate to specialist agents |
| **Multiple agents, single Slack bot** | ✅ Works | All agents share one Slack bot token; bindings select agent |
| **`thinkingDefault` per agent** | ✅ Full support | Control thinking overhead per agent |
| **Most-specific-wins routing** | ✅ Built-in | Peer > parentPeer > guild > team > account > channel > default |

### ⚠️ Partially Available / Needs Verification

| Capability | Status | Notes |
|---|---|---|
| **Slack channel name in bindings** | ⚠️ Verify | Config shows `"#task-updates"` names — need to confirm bindings accept these or require channel IDs |
| **Thread-level routing** | ⚠️ Limited | `parentPeer` match exists but thread-initiated routing (different agent per thread) isn't clean |
| **Dynamic routing (ML-based)** | ❌ Not built-in | No "classifier" or "triage" routing primitive; must be done via agent logic |

### ❌ Not Available Today (Would Need Development)

| Capability | Gap | Impact |
|---|---|---|
| **Inbound message classifier** | No built-in triage/routing layer before agent selection | Eliminates Option A as a config-only solution |
| **Per-message model selection** | Agent's model is session-level, not per-message | Self-escalation via `session_status` is the workaround |
| **Cost-based routing** | No awareness of message cost in routing decisions | Manual channel assignment is the workaround |
| **Complexity-based routing** | No automatic complexity scoring | Agent must self-assess |
| **Thread migration** | Can't move a thread from one agent to another mid-conversation | Thread must stay with the initially-routed agent |

---

## 4. Recommended Architecture

### Phase 1: Immediate Wins (Deploy This Week)

**Goal:** 40-60% cost reduction with minimal risk.

#### 1A. Reduce Main Agent Thinking Level

```json5
// In openclaw.json → agents.list[0] (main)
{
  id: "main",
  model: "anthropic/claude-sonnet-4-6",
  thinkingDefault: "medium",  // was "high" — saves ~30-50% on output tokens
  // ...
}
```

**Impact:** Every main agent response generates fewer thinking tokens. This is the single highest-ROI change.

#### 1B. Route Activity Channels to Cheap Agents

These channels receive automated output (cron logs, worker status, briefs). They rarely need Sonnet-level reasoning.

```json5
// In openclaw.json → bindings
{
  bindings: [
    // Activity channels → GLM Flash (essentially free)
    { agentId: "wes", match: { channel: "slack", peer: { kind: "channel", id: "#activity-cron" } } },
    { agentId: "wes", match: { channel: "slack", peer: { kind: "channel", id: "#activity-workers" } } },
    { agentId: "reed", match: { channel: "slack", peer: { kind: "channel", id: "#activity-briefs" } } },
    { agentId: "piper", match: { channel: "slack", peer: { kind: "channel", id: "#activity-experience" } } },
  ]
}
```

**Note:** We need to verify whether bindings accept `#channel-name` format or require Slack channel IDs (e.g., `C0AB5HERFFT`). The Slack channel config uses both formats — test with one channel first.

**Assigned agents and why:**
- **wes** (GLM-4.7 Flash) — cheapest available, good enough for log monitoring
- **reed** (Gemini Flash) — good for reading/summarizing briefs
- **piper** (Gemini Flash) — good for experience logging

#### 1C. Route Task Channels to Moderate Agents

```json5
// Append to bindings[]
{ agentId: "harry", match: { channel: "slack", peer: { kind: "channel", id: "#task-updates" } } },
{ agentId: "harry", match: { channel: "slack", peer: { kind: "channel", id: "#task-completion" } } },
{ agentId: "harry", match: { channel: "slack", peer: { kind: "channel", id: "#task-blockers" } } },
```

**harry** (Gemini Flash) is a good fit — task channels need comprehension but rarely need deep reasoning.

#### 1D. Add Self-Escalation Guidance to Main Agent

Add to main's workspace files (AGENTS.md or SOUL.md):

```markdown
## Model Self-Escalation

You run on Sonnet 4.6 by default. This handles 85% of conversations well.

**Escalate to Opus** (call `session_status` with model `anthropic/claude-opus-4-6`) when you encounter:
- Architecture/system design that requires exploring multiple approaches
- Strategic business decisions with complex trade-offs  
- Debugging that requires understanding 5+ interacting systems
- Writing that needs to be persuasive, nuanced, or creative at a high level
- Any situation where you're uncertain about the quality of your own reasoning

**After the complex portion is done**, de-escalate back: `session_status` with model `default`.

**Never escalate for:** task delegation, status updates, simple Q&A, sub-agent spawning.
```

### Phase 2: Channel Specialization (Week 2-3)

Once Phase 1 is stable, consider routing specific core channels to specialized agents:

```json5
// Example: if #cb-engineering exists and is used for dev discussions
{ agentId: "xavier", match: { channel: "slack", peer: { kind: "channel", id: "C0AAQJBCU0N" } } },
```

This requires:
1. Confirming which channel IDs map to which names
2. Setting up workspace files for routed agents (they need context about the channel's purpose)
3. Testing that the agent can handle the channel's typical message patterns

### Phase 3: Evaluate Triage (Month 2+, Optional)

Only if Phase 1+2 aren't saving enough, consider adding a triage layer for DMs:

```json5
{
  id: "triage",
  model: "google/gemini-3-flash-preview",
  default: true,
  workspace: "~/.openclaw/workspace/triage",
  tools: {
    allow: ["session_status", "sessions_send", "sessions_spawn", "message", "read"]
  }
}
```

**Only pursue this if:** David's DMs show a pattern where >50% of messages are simple enough for Flash to handle directly, AND the latency of two-hop routing is acceptable.

---

## 5. Migration Plan

### Pre-Flight Checklist

- [ ] **Verify binding format**: Test whether `#channel-name` works in bindings or if we need Slack channel IDs
- [ ] **Map channel IDs to names**: Document which `C0...` ID corresponds to which `#channel-name`
- [ ] **Prepare agent workspaces**: Ensure wes, reed, piper, harry have appropriate SOUL.md files for their assigned channels
- [ ] **Backup config**: `cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup`

### Step 1: Thinking Level Reduction (Day 1)

**Risk: LOW** — Sonnet with medium thinking is still extremely capable.

```bash
# Edit openclaw.json: change main agent's thinkingDefault from "high" to "medium"
# Then:
openclaw gateway restart
```

**Rollback:** Change `thinkingDefault` back to `"high"`, restart gateway.

**Validation:** Monitor main agent responses for 24h. Check that quality hasn't degraded on David's typical interactions.

### Step 2: Activity Channel Routing (Day 2-3)

**Risk: LOW** — These channels receive automated output; routing them to cheaper agents is safe.

1. Add bindings for `#activity-*` channels (one at a time)
2. Restart gateway after each binding addition
3. Verify the assigned agent responds correctly in each channel
4. Monitor for 24h per channel

```bash
# Add first binding, test
openclaw gateway restart
# Verify: post a test message in #activity-cron, confirm wes responds
# Add next binding, repeat
```

**Rollback:** Remove the binding, restart gateway. Messages immediately route back to main.

### Step 3: Task Channel Routing (Day 4-5)

**Risk: MEDIUM** — Task channels may occasionally need complex reasoning.

1. Add bindings for `#task-*` channels
2. Ensure harry's workspace is configured with task-channel-specific guidance
3. Monitor for escalation patterns — if harry consistently struggles, consider routing to a Tier 2/3 agent instead

**Rollback:** Remove binding, restart gateway.

### Step 4: Self-Escalation Guidance (Day 3)

**Risk: LOW** — This is just adding instructions to main's workspace files.

1. Add the self-escalation protocol to main's AGENTS.md or SOUL.md
2. Monitor Opus usage over the following week
3. Tune the escalation criteria based on observed patterns

### Step 5: Monitoring & Tuning (Ongoing)

Set up tracking:
- **Cost per channel**: Which channels are consuming the most tokens?
- **Escalation frequency**: How often does main escalate to Opus?
- **Quality signals**: Are David's interactions in routed channels maintaining quality?
- **Misrouting**: Are there messages in cheap channels that needed Sonnet/Opus?

---

## 6. Cost Impact Estimate

### Assumptions
- ~100-200 messages/day across all channels
- Average message processing: ~2K input tokens, ~1K output tokens (varies wildly)
- Thinking tokens: ~3x output tokens on "high", ~1.5x on "medium"

### Before (Current State)
All messages → Sonnet 4.6 with high thinking:
- Input: ~$3/MTok
- Output (with thinking): ~$15/MTok, amplified by high thinking overhead

### After (Phase 1 Complete)
- **Activity channels** (~25% of messages) → GLM Flash / Gemini Flash: ~$0.50/$3 per MTok → **~85% savings on these messages**
- **Task channels** (~15% of messages) → Gemini Flash: ~$0.50/$3 per MTok → **~85% savings on these messages**
- **Core channels + DMs** (~60% of messages) → Sonnet with medium thinking → **~30-40% savings from reduced thinking**
- **Opus escalation** (~5-10% of core messages) → $5/$25 per MTok → **slight increase on these specific messages**

**Net estimated savings: 50-65% reduction in total API spend on inbound message handling.**

---

## 7. Edge Cases & Mitigations

### Edge Case: Thread Starts Simple, Gets Complex

**Scenario:** A message in #task-updates starts as a routine status check but evolves into a complex debugging session.

**Mitigation:**
- The routed agent (harry/Flash) should be instructed to recognize when a conversation exceeds its capability
- Harry's SOUL.md should include: "If a thread becomes complex (multi-system debugging, architecture decisions, strategic analysis), respond with: 'This is getting complex — let me bring in the main agent.' Then `sessions_spawn` to main with the thread context."
- **Limitation:** The thread will have split context (harry's early messages, main's later ones). This is acceptable — main can read harry's history.

### Edge Case: David Messages in a Routed Channel

**Scenario:** David posts directly in #activity-workers expecting the main agent.

**Mitigation:**
- Consider adding a DM binding for David that overrides channel bindings → **not possible** (peer match is by channel, not by author within a channel)
- **Better approach:** Document which channels are "main" channels vs. automated channels. David should use #cb-inbox or DMs for conversations requiring main.
- Alternatively: cheap agents in activity channels can be instructed to `sessions_spawn` to main when they detect a message from David (by checking author ID).

### Edge Case: Binding Doesn't Match Channel Name Format

**Scenario:** Bindings with `#task-updates` don't work because OpenClaw expects channel IDs.

**Mitigation:**
- Test with one channel first before rolling out all bindings
- If names don't work, map all channel IDs:
  ```bash
  # Get channel name ↔ ID mapping from Slack API
  # Then use IDs in bindings: { peer: { kind: "channel", id: "C0AB5HERFFT" } }
  ```

### Edge Case: Routed Agent Lacks Context

**Scenario:** Agent in #task-blockers gets a message referencing a project it knows nothing about.

**Mitigation:**
- Give routed agents access to shared workspace files (`_shared/` directory)
- Include project context in their SOUL.md or AGENTS.md
- For complex queries, instruct them to `sessions_spawn` to main or the relevant specialist agent

### Edge Case: Self-Escalation Loops

**Scenario:** Main agent escalates to Opus, then de-escalates, but the conversation immediately triggers another escalation.

**Mitigation:**
- Add guidance: "If you've escalated to Opus for this thread, stay on Opus for the remainder of the thread rather than bouncing between models"
- Monitor escalation frequency; if >30% of turns escalate, the base model may need to be Opus for that channel

### Edge Case: Multiple Agents Responding in Same Channel

**Scenario:** A binding routes #task-updates to harry, but main also has it in its channel list.

**Mitigation:**
- When a binding routes a channel to a specific agent, only that agent receives messages for that channel
- Remove routed channels from main's `channels.slack.channels` config to be explicit
- This is handled by OpenClaw's routing: bindings override the default agent

---

## 8. Agent Workspace Requirements

Agents being assigned to channels need minimal workspace setup:

### Template for Activity Channel Agents (wes, reed, piper)

```markdown
# SOUL.md

You monitor the {{channel_name}} Slack channel.

Your role:
- Acknowledge automated messages (cron outputs, worker status, etc.)
- Summarize patterns when asked
- Flag anomalies (errors, failures, unexpected patterns)
- For complex questions or requests, spawn to main agent

You are lightweight and fast. Don't over-think responses.
If a human posts a direct question that requires deep reasoning, say:
"Let me escalate this to the main agent" and sessions_spawn to main with context.
```

### Template for Task Channel Agents (harry)

```markdown
# SOUL.md

You monitor task-related Slack channels (#task-updates, #task-completion, #task-blockers).

Your role:
- Process task status updates
- Acknowledge completions
- Flag blockers that need attention
- Summarize task progress when asked
- For complex debugging or strategic decisions, escalate to main agent

If a conversation thread becomes complex (multi-step reasoning, architecture decisions),
escalate by spawning to main with full thread context.
```

---

## 9. Decision Matrix

| Criteria | Option A (Triage) | Option B (Channel) | Option C (Hybrid) | **Option D (Tiered)** |
|---|---|---|---|---|
| **Cost savings** | High (70-80%) | Medium (50-60%) | High (65-75%) | **High (50-65%)** |
| **Implementation complexity** | High | Low | High | **Low** |
| **Works today (no new features)** | Partially | Yes | Partially | **Yes** |
| **Thread coherence** | Poor | Good | Mixed | **Excellent** |
| **Personality consistency** | Poor | Good | Mixed | **Excellent** |
| **Latency impact** | +200-500ms | None | +200-500ms (some) | **None** |
| **Rollback risk** | High | Low | Medium | **Low** |
| **Maintenance burden** | High | Low | Medium | **Low** |

**Winner: Option D** — combines the cost savings of channel routing with the coherence of a single main agent for core interactions, all using features that exist today.

---

## 10. Summary of Recommended Changes

### Immediate (This Week)
1. **`thinkingDefault: "high"` → `"medium"`** on main agent
2. **Add bindings** for 7 activity/task channels → cheap agents
3. **Add self-escalation guidance** to main's workspace files
4. **Prepare workspace files** for wes, reed, piper, harry

### Near-Term (Week 2-3)
5. **Map all Slack channel IDs** to names for clean config
6. **Consider routing #cb-engineering** to xavier (Sonnet)
7. **Monitor and tune** escalation patterns

### Future (Month 2+)
8. **Evaluate** whether a triage agent for DMs would provide additional savings
9. **Consider** per-message model selection if OpenClaw adds the feature
10. **Review** model tier assignments as new models launch

---

*This proposal is ready for David's review. The recommended approach (Option D) can be implemented incrementally with zero-risk rollback at each step.*
