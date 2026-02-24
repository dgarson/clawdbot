# WORKSTREAM.md — ACP / Workflow DAGs

_Mega-branch:_ `acp`
_Owner:_ Tim
_Created:_ 2026-02-21
_Last updated:_ 2026-02-22 13:36 MST

## Deliverable

Advance bs-tim-1 workflow DAG durability/restartability and ACP integration with deterministic run state, checkpointing, resume behavior, and cross-session compatibility.

## Design

- `/Users/openclaw/.openclaw/workspace/_shared/specs/bs-tim-1-workflow-dags.md`
- `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`

## Tasks & Status

| Task                             | Owner | Status         | Notes                                       |
| -------------------------------- | ----- | -------------- | ------------------------------------------- |
| DAG state persistence interfaces | Nate  | 🔄 in-progress | foundation landed in spec lane              |
| Resume/retry transition tests    | Roman | ⏳ queued      | to align with issue-tracking DAG test style |
| ACP handoff compatibility wiring | Tim   | ⏳ queued      | follows current critical lanes              |

## Squad

Tim, Nate, Roman
