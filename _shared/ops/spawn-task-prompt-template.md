# Spawn Task Prompt Template

**Version:** 1.0 — 2026-02-22  
**Owner:** Luis (Principal UX Engineer)  
**Reference:** `_shared/ops/spawn-preflight.md`, `luis/SILENT_FAILURE_INVESTIGATION.md`

---

## Background: The Problem This Solves

Agents were silently exiting tasks when a target file already existed — treating `file_exists(target) == True` as `task_complete == True`. Three confirmed cases:

| Case                     | Exit speed | Damage                                                        |
| ------------------------ | ---------- | ------------------------------------------------------------- |
| Sam / RateLimitDashboard | 22s        | Unverified quality — prior file unvalidated                   |
| Reed / ChatRoom          | ~22s       | Same                                                          |
| Piper / a11y audit       | ~22s       | **Stale compliance artifact** — audit predated 200+ new views |

The fix is two-layer: **correct verb patterns** at task framing, and a **preflight guard block** at execution. Both are required.

---

## Layer 1: Verb Patterns (Task Framing)

Move the success condition from the _action_ to the _outcome_.

> "Build X" → agent wins when X exists  
> "Ensure X satisfies [criteria]" → agent wins when X _works_

### Canonical Verb Table

| Task intent          | ✅ Use this                                                                       | ❌ Not this                                 | Why                                                             |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| Create something new | `Ensure [artifact] exists and satisfies [criteria]`                               | `Build`, `Create`, `Write`                  | Ties existence to requirement satisfaction                      |
| Run an operation     | `Run [operation] and produce a current [output] as of [timestamp/state]`          | `Write the audit to`, `Generate the report` | Emphasizes recency and execution, not artifact                  |
| Update/fix existing  | `Verify [thing] handles [case] correctly, updating it if needed`                  | `Update`, `Fix`, `Patch`                    | Makes validation the job, modification the contingency          |
| Validate/check       | `Confirm [property] holds across [scope]; document findings regardless of result` | `Check if`, `See if`                        | Removes binary pass/fail shortcut; findings required either way |

### Anti-Patterns (Do Not Use)

- ❌ `"Build X"` — done when X exists
- ❌ `"Create X"` — done when X exists
- ❌ `"Write X to [path]"` — done when file is written, not when it's correct
- ❌ `"Run the a11y audit"` — done when script runs, even against stale state
- ❌ `"Update X to handle Y"` — done when any edit is made, regardless of whether Y is handled
- ❌ `"Check if X is accessible"` — done when a prior audit file is found

### How to Write Criteria

Vague criteria reproduce the failure in a different form.

> ❌ **Too vague:** `"Ensure the dashboard satisfies accessibility requirements"`  
> → Agent declares success when any ARIA attributes are present

> ✅ **Concrete:** `"Ensure the dashboard passes axe-core with zero violations at AA level, tested against the live rendered component with all data states populated"`  
> → Agent has a specific, falsifiable success condition

Criteria should specify: **what**, **how tested**, **what state**, **what threshold**.

---

## Layer 2: Preflight Guard Block (Paste Into Every Task Body)

**Copy-paste this block verbatim at the end of every `sessions_spawn` task prompt.** Do not summarize or paraphrase — the exact wording is load-bearing.

```
---
## PREFLIGHT REQUIRED — READ BEFORE STARTING

**Step 0: Existence check**
Before writing any code or producing any output:
1. Check whether the target file(s) or output artifact(s) already exist
2. If they DO exist — read the existing content (first 100 lines minimum)
3. State explicitly: "File found. It [meets / does not meet] the requirements because [specific reason]."
4. Only if fully satisfied: explain why and exit with evidence (quote the relevant sections)
5. If not fully satisfied: proceed with the work

File presence is NOT task completion. Requirement satisfaction is task completion.

**Step 0b: Operational task check**
If this task is an OPERATION (audit, test, health check, validation, scan, report):
- You MUST re-run the operation regardless of any prior output file
- Timestamp of a prior artifact is irrelevant — the codebase or state may have changed
- Write the current output to the target path, overwriting any prior result

**Never fast-exit.** The requester cannot distinguish "task done correctly" from "task skipped silently." A 22-second exit with no output written is a silent failure, not a completion.
---
```

---

## Complete Task Prompt Structure

Use this as your template for every `sessions_spawn` call:

```
[Your task title here]

**Context:**
[Background the agent needs — what this is for, any relevant history]

**Requirements:**
[Specific, concrete list of what the output must do or contain]

**Target file(s):**
[Exact paths, e.g., `apps/web-next/src/views/FooBar.tsx`]

**Constraints:**
[What to NOT touch, scope limits, style requirements]

**Success criteria:**
[How the agent knows it's done — specific, falsifiable]

**When done:**
[Any notification command, PR creation instruction, Slack post, etc.]

**MANDATORY FINAL STEP — workq closure:**
If you claimed a workq item for this task, you MUST call one of the following before announcing completion:
- Task fully complete: `openclaw workq done openclaw/openclaw#<item-ref>`
- Partial / needs review: `openclaw workq status openclaw/openclaw#<item-ref> --set in-review`

**Do not announce completion without closing the workq item first.** Items left open are indistinguishable from abandoned work and will be reassigned.

---
## PREFLIGHT REQUIRED — READ BEFORE STARTING

**Step 0: Existence check**
Before writing any code or producing any output:
1. Check whether the target file(s) or output artifact(s) already exist
2. If they DO exist — read the existing content (first 100 lines minimum)
3. State explicitly: "File found. It [meets / does not meet] the requirements because [specific reason]."
4. Only if fully satisfied: explain why and exit with evidence (quote the relevant sections)
5. If not fully satisfied: proceed with the work

File presence is NOT task completion. Requirement satisfaction is task completion.

**Step 0b: Operational task check**
If this task is an OPERATION (audit, test, health check, validation, scan, report):
- You MUST re-run the operation regardless of any prior output file
- Timestamp of a prior artifact is irrelevant — the codebase or state may have changed
- Write the current output to the target path, overwriting any prior result

**Never fast-exit.** The requester cannot distinguish "task done correctly" from "task skipped silently." A 22-second exit with no output written is a silent failure, not a completion.
---
```

---

## Where This Applies

**Every `sessions_spawn` task body.** No exceptions.

The preflight block costs nothing when the file doesn't exist yet (agent reads, finds nothing, proceeds). It only activates when the file is present — which is exactly the failure case we're preventing.

### Who Should Apply This

| Role                            | How to apply                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Merlin (orchestrator)           | Paste block into all task bodies sent via `sessions_spawn`                                               |
| Luis (UX lead)                  | Already updated `UX_WORK_QUEUE.md` spawn patterns; subagent task prompts to Piper, Quinn, Reed, Wes, Sam |
| All agents with spawn authority | Xavier, Amadeus, Tim, Stephan, Drew, Robert — any `sessions_spawn` call                                  |

---

## Platform-Level Fix (In Progress)

A prompt-layer fix is in place. A platform-level task completion validator has been filed with Tim — see `_shared/ops/tim-task-completion-validator.md`. That validator will make the preflight semantic platform-enforced rather than agent-enforced, and adds **input-hash validation** for operational tasks (the a11y staleness case).

Until that ships, this template is the line of defense.

---

## Files Created as Part of This Fix

| File                                           | Purpose                                                      |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `_shared/ops/spawn-preflight.md`               | Full reference doc with rationale, verb table, anti-patterns |
| `_shared/ops/spawn-task-prompt-template.md`    | This file — copy-paste ready template                        |
| `_shared/ops/tim-task-completion-validator.md` | Platform issue for Tim                                       |
| `luis/SILENT_FAILURE_INVESTIGATION.md`         | Root cause analysis, three case studies                      |

---

_Generated by Merlin based on Luis's investigation (2026-02-22)_
