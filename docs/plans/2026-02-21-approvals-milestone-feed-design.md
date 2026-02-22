# Approvals + Milestone Feed — Design Doc

**Date:** 2026-02-21
**Branch:** luis/ui-redesign

## Problem

Approval requests accumulate across agents throughout the day (mix of urgent high-risk and batchable low-risk). There is no consolidated place to triage them or see goal milestone completions. The existing `ApprovalAttentionNudge` banner is not sufficient for batch workflows.

## Goals

- Surface urgent approvals without interrupting current context (slide-out panel)
- Enable batch triage of approval backlogs (dedicated page)
- Show goal milestone completions in the same feed — one-liner with drill-down, not agent activity noise
- Reuse the same components across both surfaces

## Out of Scope

- Auto-approval thresholds / escalation paths (future)
- Regular agent activity in the feed
- Push notifications

---

## Architecture

### Shared Components

| Component                | Props                         | Used By                                 |
| ------------------------ | ----------------------------- | --------------------------------------- |
| `<ApprovalsQueue>`       | `mode: "compact" \| "full"`   | Slide-out panel + `/approvals` page     |
| `<MilestoneFeed>`        | `mode: "compact" \| "full"`   | Slide-out panel + `/approvals` page     |
| `<ApprovalItem>`         | approval, onApprove, onReject | Inside ApprovalsQueue                   |
| `<MilestoneItem>`        | milestone, goal, onClick      | Inside MilestoneFeed                    |
| `<MilestoneDetailPanel>` | goal, milestone               | Slide-out, triggered from MilestoneItem |

### Routes

- `/approvals` — dedicated page (new)
- Sidebar inbox icon → slide-out panel (no route change)

---

## Slide-out Panel

Triggered by an inbox icon in the sidebar with a live badge count. Right-anchored drawer, ~380px wide. Opens over the current page without navigation.

**"Needs Attention" section:**

- High/medium-risk approvals only
- Max 8 items, sorted by age (oldest first)
- Inline approve/reject per item
- "View all" link → `/approvals`

**"Recent Milestones" section:**

- Last 8 milestone completions
- One-liner format: checkmark icon, "[Milestone] — [Goal]", agent name, timestamp
- Click → opens `MilestoneDetailPanel` on top of the drawer

**Empty state:** "Nothing needs your attention" + link to approval history.

---

## Dedicated Page — `/approvals`

### Header

- Title: "Inbox" with live pending count badge
- Actions: "Approve All Low-Risk" (batch), "Settings" (placeholder)

### Approval Queue

- Filter chips: All / High / Medium / Low / Resolved (default: All, pending first)
- **Grouping:** When an agent has 3+ pending, collapse into a group card:
  - "Agent X — 14 pending bash commands"
  - Inline "Approve All" / "Reject All" buttons on the group
  - Expandable to show individual items
- **Single items:** Ungrouped, show: risk badge, tool name + truncated command, agent name, age
- **Row action:** Click row → inline expansion using existing `ToolApprovalCard` (keeps batch flow, avoids slide-out)
- **Resolved items:** Dimmed, collapsed under "Show N resolved today" disclosure

### Milestone Feed

Separated from the queue by a labeled divider: "Goal Activity"

- Date-grouped: Today / Yesterday / This Week
- One-liner per item: checkmark, "[Milestone] — [Goal]", agent, timestamp
- Click → `MilestoneDetailPanel` slide-out

---

## MilestoneDetailPanel

Slide-out triggered by clicking any milestone item (on page or in panel).

**Intermediate milestone:**

- Goal title + status badge
- Progress bar (e.g. "3 of 5 milestones")
- Full milestone list with checkmarks
- Which agent completed this milestone + timestamp

**Final milestone (goal complete):**

- "Goal Complete" banner
- All milestones checked
- CTA: Archive goal / View goal

---

## Data Sources

- Approvals: `useAgentApprovalActions()`, `derivePendingApprovalsSummary()`, agent `pendingToolCallIds`
- Milestones: `useGoals()` — derive completion events from milestone `completed` state changes
- Risk levels: existing `RiskLevel` type on `ToolCall` (`low | medium | high`)

---

## Key Decisions

- Inline expansion (not slide-out) for approval items on the page — preserves batch triage flow
- Slide-out used only for milestone detail and the panel itself
- Panel shows only high/medium risk; page shows all — natural urgency gradient
- No regular agent activity in either surface
