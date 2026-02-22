# OpenClaw Analytics Dashboard — Full Spec
**Author:** Luis (Principal UX Engineer)  
**Date:** 2026-02-21  
**Version:** 1.0  
**Status:** Ready for implementation

---

## Overview

The Analytics Dashboard is OpenClaw's Mission Control surface. It answers the question every operator asks but can never currently answer: *"What is my AI team actually doing, is it working, and what is it costing me?"*

This is not a vanity metrics screen. Every data point here should drive a decision: route a task differently, kill a stalled session, investigate a cost spike, verify a skill is healthy. Design principle: **data that doesn't change behavior shouldn't be on the screen.**

**Route:** `/analytics`  
**Access:** Available to all users; Power User mode unlocks raw data exports and debug overlays  
**Refresh strategy:** Hybrid — WebSocket streaming for real-time counters, polling (15–30s) for historical panels  

---

## Section 1: Overview Panel (Mission Control Header)

### Purpose
The above-the-fold KPI strip. Visible at all times. This is the "health bar" — a user should be able to tell in 2 seconds if everything is fine.

### Key Metrics
| Metric | Display | Threshold |
|--------|---------|-----------|
| Active Agents | Count badge (green/amber/red) | Red if 0, amber if >80% stalled |
| Messages Today | Count + delta vs. yesterday | — |
| Active Sessions | Count (currently open) | Red if 0 |
| Cost Today | $X.XX with trend arrow | Amber if >75% daily budget, red if exceeded |
| Gateway Uptime | Duration + connection indicator | Red dot if disconnected |
| Last Gateway Event | Relative timestamp | Amber if >5min stale |

### Data Sources
- `gateway.status` → uptime, connection health
- `sessions.usage` → active session count, message counts
- `usage.cost` → today's spend
- `agents.list` → active agent count, health statuses
- WebSocket event stream → real-time delta updates

### Components
- `KPIStrip` — horizontal bar of 6 stat cards
- `GatewayStatusBadge` — pulsing green dot or red with last-seen
- `CostBudgetBar` — compact progress bar showing spend vs. daily budget
- Refresh: WebSocket for real-time; 30s polling fallback

---

## Section 2: Agent Activity Panel

### Purpose
Per-agent breakdowns: who's doing what, how much, how well.

### Key Metrics
- Messages sent/received per agent (today, 7d, 30d)
- Tool calls: total + breakdown by tool type
- Session duration distribution (histogram: <5m / 5–30m / 30m–2h / >2h)
- Sub-agent spawn trees: depth, success rate, avg duration
- Agent health over time (sparkline: active/idle/stalled/errored)

### Filters
- Time range: Today / 7d / 30d / Custom
- Agent selector: All / individual agent
- Status filter: All / Active only / Stalled

### Data Sources
- `sessions.list` + `sessions.usage` → message counts, durations
- `agents.list` → agent identities, health status
- Session JSONL transcripts → tool call counts (client-side parse or server-side agg)
- `agents.spawn_history` (if available) or infer from session key patterns

### Components
- `AgentActivityTable` — sortable by agent, message count, cost, last active
- `AgentSparkline` — 24h health history per agent (reuse ActivityHeatMap data)
- `SpawnTreeViz` — collapsible tree showing parent → child agent relationships + depth
- `ToolCallBreakdown` — horizontal bar chart of tool types per agent
- Refresh: 15s polling; WebSocket push on agent state changes

---

## Section 3: Model & Cost Tracking

### Purpose
Where the money goes. Answers: "Which agent is expensive? Which model is being overused? Am I on track for my monthly budget?"

### Key Metrics
- Token usage: input vs. output vs. cache hits, broken down by model
- Cost by agent (sortable table: agent → model → tokens → $)
- Cost by session (top 10 most expensive sessions)
- Cost over time: 30d area chart (daily spend)
- Model fallback events: when did we fall back and why
- Budget governor status: current utilization % per provider (from `provider-usage.ts` data)
- Projected daily spend / projected monthly spend (linear extrapolation from today's rate)
- Cache hit rate per provider (Anthropic prompt caching savings)

### Filters
- Time range: Today / 7d / 30d
- Model filter: All / specific provider
- Agent filter

### Data Sources
- `usage.cost` → aggregate cost data
- `sessions.usage` → per-session token breakdown
- Gateway config / `loadProviderUsageSummary()` → provider utilization percentages
- Model fallback events from gateway logs (if telemetry exists)

### Components
- `CostAreaChart` — 30d spend over time, stacked by model/agent
- `ModelBreakdownTable` — model × tokens × cost × cache savings
- `AgentCostRanking` — bar chart: cost per agent
- `BudgetGovernorStatus` — provider utilization gauges (0–100%)
- `ProjectedSpend` — daily rate × 30 = monthly projection with confidence interval
- `ModelFallbackLog` — recent fallback events with reason codes
- Refresh: 30s polling for cost data (doesn't change in real-time)

---

## Section 4: Channel Health

### Purpose
Are messages getting through? Where are the bottlenecks?

### Key Metrics
- Messages per channel (Slack, Discord, Telegram, WhatsApp, etc.) — today + 7d sparkline
- Delivery success rate per channel (% delivered vs. failed)
- Delivery latency P50 / P95 per channel
- Reconnection events (count + timestamps)
- Unread backlog per channel (messages sent but not yet processed)
- Last successful message timestamp per channel
- Error breakdown: timeout / auth / rate_limit / unknown

### Filters
- Channel selector: All / specific channel
- Time range

### Data Sources
- Gateway channel adapter stats (needs a `channels.stats` RPC or equivalent)
- WebSocket event stream for real-time delivery events
- Gateway logs for error events

### Components
- `ChannelHealthGrid` — card per channel with status indicator, delivery rate, latency
- `ChannelLatencyChart` — P50/P95 latency per channel over time
- `ReconnectionTimeline` — scatter plot of reconnection events
- `DeliveryErrorBreakdown` — pie/donut chart of error types
- Refresh: Real-time via WebSocket for live delivery events; 15s polling for aggregates

---

## Section 5: Tool Usage Analytics

### Purpose
Which tools are being hammered, which are failing, which are slow. Essential for debugging agent behavior and finding reliability bottlenecks.

### Key Metrics
- Top 10 most-used tools (by invocation count)
- Error rate per tool (% calls that failed)
- Avg execution time per tool (P50 / P95)
- Blocked/rejected tool calls (approval gates, permission denials)
- Tool call volume over time (24h histogram)
- Per-tool breakdown: success / error / timeout / blocked

### Filters
- Tool filter: All / specific tool
- Agent filter: All / specific agent
- Time range

### Data Sources
- Session transcripts (tool call blocks with timing)
- `telemetry.query` if telemetry extension is available
- Gateway tool execution hooks

### Components
- `ToolLeaderboard` — sortable table: tool name / calls / error rate / avg time
- `ToolErrorHeatmap` — grid: tool × agent showing error concentration
- `ToolVolumeChart` — 24h bar chart of call volume
- `BlockedCallsLog` — recent rejected tool calls with reason
- Refresh: 30s polling (tool execution logs)

---

## Section 6: Session Inspector

### Purpose
Deep-dive on individual sessions. Find the expensive ones, the broken ones, the interesting ones.

### Key Metrics
- Searchable session list with columns: agent, channel, duration, messages, cost, status
- Per-session detail panel:
  - Full message timeline (user/assistant alternating)
  - Tool call trace (tool name, input summary, duration, success/fail)
  - Cost breakdown (input tokens × rate + output tokens × rate + cache savings)
  - Sub-agent spawns (tree view)
  - Compaction events

### Filters
- Agent selector
- Channel filter
- Date range
- Status: All / Active / Completed / Errored
- Cost range: All / >$0.01 / >$0.10 / >$1.00
- Free text search (session key prefix)

### Data Sources
- `sessions.list` with pagination
- Session JSONL transcripts (via `agents.files.get` or dedicated sessions RPC)
- `sessions.usage` for cost/token aggregates

### Components
- `SessionListTable` — paginated, sortable, filterable
- `SessionDetailPanel` — slide-in or expand-in-place
  - `MessageTimeline` — conversation thread with timestamps
  - `ToolCallTrace` — ordered list of tool calls with duration bars
  - `CostBreakdown` — token math displayed clearly
  - `SpawnTree` — sub-agent tree if applicable
- `SessionSearch` — search by session key prefix or content
- Refresh: On-demand (user navigates to session detail); no auto-refresh for historical sessions

---

## Section 7: Skill Performance

### Purpose
Are skills working? Which ones are flaky? Which ones users rely on most?

### Key Metrics
- Skill invocations: total + per skill (today, 7d, 30d)
- Success rate per skill
- Avg execution time per skill
- Top error types per skill (P50 error message clustering)
- Skills never invoked (dead code signal)

### Filters
- Skill name filter
- Agent filter (which agent invokes which skills)
- Time range

### Data Sources
- `skills.list` → installed skills
- Agent session transcripts (skill invocation patterns — detect by tool name matching)
- Skill execution hooks if available

### Components
- `SkillPerformanceTable` — name / invocations / success rate / avg duration / last used
- `SkillErrorLog` — recent failures with error type and skill name
- `SkillUsageChart` — invocations over time per skill
- Refresh: 60s polling (skill data changes slowly)

---

## Section 8: Heartbeat / Cron Monitor

### Purpose
Are cron jobs running on schedule? Are heartbeats firing? This is where silent failures live.

### Key Metrics
- All configured cron jobs: name, schedule, last run, next run, status
- Per-job run history: timestamp / duration / pass-fail
- Timing drift: how far off-schedule was each run
- Jobs that haven't fired in N expected intervals (stale alert)
- Delivery failures: cron jobs that ran but couldn't deliver output

### Filters
- Job name filter
- Status: All / Passing / Failing / Stale
- Time range

### Data Sources
- Gateway cron API: job list, run history
- `cron.list` → all scheduled jobs
- `cron.runs(jobId)` → per-job run history

### Components
- `CronJobGrid` — card per job with status badge (green/amber/red/stale), last run, next run
- `RunHistoryTimeline` — per-job sparkline of pass/fail over last 20 runs
- `TimingDriftChart` — bar chart: expected vs. actual fire time per run
- `StaleCronAlert` — highlighted banner for jobs overdue by >2x their interval
- Refresh: 30s polling; WebSocket push on cron event

---

## Section 9: System Health

### Purpose
Is the gateway itself healthy? What's the infrastructure status?

### Key Metrics
- Gateway uptime: continuous uptime graph (30d sparkline)
- Memory usage (if gateway exposes this via system stats)
- Connected node devices: count, last-seen per node
- WebSocket connection stability: drop/reconnect events over time
- Plugin/extension health: loaded, failed, disabled extensions
- Config hash: current config version + last change timestamp

### Filters
- Time range for history graphs
- Node filter

### Data Sources
- `gateway.status` → uptime, memory, version
- `nodes.list` → paired devices
- `gateway.config` → config hash, extension list
- WebSocket event log for connection events

### Components
- `GatewayUptimeChart` — 30d uptime bar chart (green = up, red = down)
- `NodeDeviceList` — cards for each paired node with connectivity status
- `ExtensionStatus` — list of loaded extensions with health indicators
- `ConnectionEventLog` — recent WS connect/disconnect events with timestamps
- `ConfigSummary` — current config hash + last modified
- Refresh: 30s polling; real-time WebSocket for connection events

---

## Section 10: Alerting & Anomaly Feed

### Purpose
Real-time feed of things that need attention. This is the "inbox" for system problems.

### Alert Types
| Type | Trigger | Severity |
|------|---------|----------|
| Cost spike | >2× usual hourly rate | 🔴 High |
| Error surge | Tool error rate >20% in 5min window | 🔴 High |
| Stalled session | No activity in session for >30min with open tasks | 🟡 Medium |
| Unreachable node | Node hasn't checked in for >5min | 🟡 Medium |
| Unusual tool pattern | Agent calling same tool >50× in 10min | 🟡 Medium |
| Budget threshold | Cost today >75% of daily limit | 🟡 Medium |
| Model fallback | Unexpected model cascade | 🔵 Info |
| Cron job failed | Cron run returned non-zero exit | 🔴 High |
| Memory index dirty | Memory retrieval quality degraded | 🟡 Medium |
| Session compacted | Session hit context limit | 🔵 Info |

### Feed Features
- Chronological feed, newest first
- Severity filter (All / High / Medium / Info)
- Agent filter
- Mark as resolved / dismiss
- Click-through to relevant section (cost spike → Cost section, stalled session → Session Inspector)
- Alert count badge in sidebar nav item

### Data Sources
- Real-time via WebSocket event stream (gate events on type)
- Polling baseline for anomaly detection (compare current rate vs. rolling average)
- `usage.cost` polling for budget threshold detection

### Components
- `AlertFeed` — scrollable list of alert cards with severity color coding
- `AlertCard` — type icon + message + timestamp + agent + action button
- `AlertBadge` — unread count in nav
- `AnomalyChart` — mini sparkline showing the metric that triggered the alert
- Refresh: Real-time WebSocket push; fall back to 10s polling

---

## Global Design Decisions

### Layout
- Full-width dashboard, no max-width cap (unlike other routes)
- Sticky header with KPI strip always visible on scroll
- Sections collapsible (user can hide sections they don't use)
- Section order configurable via drag-and-drop (stored in localStorage)
- Sidebar nav item: "Analytics" with unread alert badge

### Navigation
- Each section header is an anchor (`#agent-activity`, `#cost`, etc.)
- Direct deep-link support: `/analytics#cost`, `/analytics#sessions`
- Keyboard shortcut: `A` opens analytics from anywhere (requires command palette)

### Empty States
- Each section has a meaningful empty state explaining what will appear when data exists
- Gateway disconnected → single full-page "Connect to gateway to see analytics" state

### Performance
- Lazy-load each section (TanStack Query per section, not one giant query)
- Canvas/WebGL for large time-series charts if data exceeds 1000 points
- Virtualize long tables (session list, alert feed)
- Background data refresh — no blocking spinners, just subtle "Refreshing…" indicators

### Export
- Per-section CSV export button (Power User mode)
- Full dashboard snapshot as JSON (for bug reports, support)

---

## Implementation Notes

### Missing RPCs (need gateway support)
These features require gateway endpoints that may not yet exist:
- `channels.stats` — channel delivery metrics (may need implementing)
- `cron.runs(jobId)` — run history per job (check if this exists via `openclaw cron runs`)
- `telemetry.query` — tool call telemetry (blocked on TEL-01 extension)
- `agents.spawn_history` — sub-agent tree data

### Workarounds for missing RPCs
- Infer channel health from session event stream (listen for delivery events)
- Parse session JSONL for tool call data (expensive but works)
- Use existing `/analytics` route data (`sessions.usage` + `usage.cost`) for baseline

### Phasing
**Phase 1 (ship now):** Sections 1, 3, 6, 8, 10 — all use existing RPCs  
**Phase 2 (needs channel.stats):** Section 4 (Channel Health)  
**Phase 3 (needs telemetry extension):** Sections 5, 7 (Tool/Skill analytics)  
