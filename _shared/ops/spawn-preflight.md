# spawn-preflight.md
**Purpose:** Copy-paste block for all `sessions_spawn` task bodies. Paste this verbatim at the end of every task prompt. Do not summarize or paraphrase — the exact wording is load-bearing.

---

## The Block (paste into every task body)

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

## How to Use

Paste the block at the **end** of the task body in every `sessions_spawn` call:

```typescript
sessions_spawn({
  task: `
    [Your actual task description here]
    
    [task details, requirements, file paths, etc.]
    
    ---
    ## PREFLIGHT REQUIRED — READ BEFORE STARTING
    ... [paste block here] ...
    ---
  `
})
```

Placing it at the end ensures it's read after the agent has parsed the task requirements — so Step 0 comparison is grounded in the actual requirements, not abstract.

---

## When to Use

**Always.** No exceptions.

Even for tasks where the file almost certainly doesn't exist yet: the preflight block costs nothing if the file is absent (agent reads, finds nothing, proceeds). It only activates when the file is present — which is exactly the failure case we're preventing.

---

## Verb Pattern Addendum

*(David — this section is for your addition on the canonical verb shift)*

The preflight block above patches the exit heuristic at execution time. But the upstream fix is at task framing time.

**Wrong:** `"Build RateLimitDashboard.tsx"` → invites cheapest completion checkpoint  
**Right:** `"Ensure RateLimitDashboard.tsx exists and satisfies the following criteria: [...]"`

The canonical verb pattern for spawn tasks:
- **Creation:** `"Ensure [file] exists and satisfies [criteria]"` — not `"Build"` or `"Create"`
- **Operations:** `"Run [operation] and produce a current [output]"` — not `"Write the [audit] to [file]"`
- **Updates:** `"Verify [component] handles [case], updating it if needed"` — not `"Update [component]"`

This reframing makes the success condition explicit at the point of task statement, before the preflight block even runs. Both together: verb pattern sets the right intent, preflight block enforces it at execution.

---

## Why Two Checks (Step 0 and Step 0b)

The two cases need different semantics:

| Task type | Existing artifact means | Correct behavior |
|-----------|------------------------|------------------|
| **Creation** (build, implement) | Prior work was done | Read it, validate content adequacy, only skip if requirements are met |
| **Operation** (audit, test, scan) | Prior run was done | Doesn't matter — re-run unconditionally, overwrite |

A single check would get creation right but silently miss operational staleness — which is exactly the pattern we're preventing. The a11y audit case: an audit report predating 200 new views is not "an a11y audit." It's a historical document. The validator has to know it's looking at an operational task to apply staleness semantics rather than content-adequacy semantics.

This distinction should also drive the platform-level validator design (see Tim ticket) — the framework needs a task-type signal, not just file metadata.

---

*Created by Luis following the silent-failure investigation (2026-02-22)*  
*Reference: `luis/SILENT_FAILURE_INVESTIGATION.md`*
