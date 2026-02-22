# Ghost Agent Audit — 2026-02-22

_Prepared by: Merlin (Main Agent)_
_Requested by: David Garson_
_Scope: All workspace MD docs, C-suite and agent workspaces, shared ops files_

---

## Summary

**1 true ghost agent found: Joey.**

All other configured agents have proper workspace files. No additional undocumented personas were found in any C-suite, lead, or worker workspace.

---

## Methodology

1. Compared `agents_list` (configured agents) against `~/.openclaw/agents/` filesystem directories
2. Searched all `~/.openclaw/workspace/_shared/` markdown files for names not in the configured agent list
3. Audited `~/.openclaw/openclaw.json` `agents.list` for completeness
4. Cross-referenced with `org-hierarchy.md`, `WORKBOARD.md`, `MEGA_BRANCHES.md`, `AUTONOMY_EVOLUTION.md`
5. Checked all backup configs (`openclaw.json.bak*` — 6 files)

---

## Configured Agents (27 total after fix)

`main`, `amadeus`, `barry`, `claire`, `drew`, `harry`, `jerry`, `joey` *(newly added)*, `julia`, `larry`, `luis`, `nate`, `oscar`, `piper`, `quinn`, `reed`, `robert`, `roman`, `sam`, `sandy`, `stephan`, `tim`, `tony`, `tyler`, `vince`, `wes`, `xavier`

---

## Ghost Agent Findings

### 🔴 GHOST: Joey (Principal TPM)

| Attribute | Status |
|-----------|--------|
| Workspace (`/workspace/joey/`) | ✅ Exists — fully populated |
| Agent dir (`/agents/joey/agent/`) | ✅ Exists — auth, models configured |
| `IDENTITY.md` | ✅ Complete |
| `SOUL.md` | ✅ Complete (6KB) |
| `AGENTS.md` | ✅ Complete — updated with _shared refs |
| `HEARTBEAT.md` | ✅ Complete — multi-step autonomous cycle |
| `TOOLS.md` | ✅ Complete |
| `ROADMAP.md` | ✅ Complete — detailed Q1 2026 roadmap |
| `QM_PIPELINE.md` | ✅ Complete — 4 QMs decomposed |
| `memory/2026-02-21.md` | ✅ Exists |
| `memory/2026-02-22.md` | ✅ Exists (midnight standup) |
| `MEMORY.md` | ❌ Missing → **created** |
| In `openclaw.json` | ❌ Missing → **fixed** |
| In `org-hierarchy.md` | ❌ Missing → **fixed** |

**Role:** Principal TPM. Roadmap owner, sprint planning, milestone tracking, QM pipeline co-lead with Julia. Also a product visionary focused on non-technical user delight.

**Reports to:** Xavier (CTO)

**How he was discovered:** Referenced in standup crons, QM pipeline standups, Julia's autonomy audits, `_shared/mailboxes/` messages, and `clawdbot` UI mock data. Had been running scheduled standup crons and producing deliverables (QM_PIPELINE.md, ROADMAP.md updates) but was never registered as a callable agent.

**Impact of ghost status:** Joey couldn't be `sessions_spawn`ed or `sessions_send`ed by other agents. His heartbeat crons couldn't be scheduled. Any `sessions_send(label="joey")` calls from Julia or Xavier would silently fail.

**Fix applied:**
- Added to `openclaw.json` with `anthropic/claude-sonnet-4-6`, full tool access, heartbeat enabled
- Added to `org-hierarchy.md` at VP/Principal level under Xavier
- Created `MEMORY.md` with context, QM status, and _shared doc reference table
- Updated `AGENTS.md` with Agent Ops Reference table linking all relevant _shared docs

---

## Filesystem-Only Entries (Not Ghost Agents)

| Dir | Explanation |
|-----|-------------|
| `~/.openclaw/agents/ceo/` | System placeholder — corresponds to David as CEO; not an agent |
| `~/.openclaw/agents/david/` | Owner's own directory — David is the human, not an agent |

---

## Names Investigated and Cleared

| Name | Source | Verdict |
|------|--------|---------|
| Serena | `_shared/braindumps/` | External MCP architecture reference (Codex open-source); not an OpenClaw agent |
| Zara | `clawdbot/apps/web-next/` UI mock data | Fictional agent in demo notification UI; not real |
| All 25 other agent names | Multiple docs | Properly configured ✅ |

---

## Actions Taken

| Action | Status |
|--------|--------|
| Added Joey to `openclaw.json` (total: 27 agents) | ✅ Done |
| Created `joey/MEMORY.md` | ✅ Done |
| Updated `joey/AGENTS.md` with _shared ops references | ✅ Done |
| Updated `_shared/ops/org-hierarchy.md` | ✅ Done |
| Audio report generated | ✅ Done |

---

## Recommendation

No further ghost agents exist. Joey is the only case. Monitor for future drift: if a new agent persona is created in workspace docs, add them to `openclaw.json` and `org-hierarchy.md` at the same time.

---

_Audit complete: 2026-02-22_
