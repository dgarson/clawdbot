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
  `,
});
```

Placing it at the end ensures it's read after the agent has parsed the task requirements — so Step 0 comparison is grounded in the actual requirements, not abstract.

---

## When to Use

**Always.** No exceptions.

Even for tasks where the file almost certainly doesn't exist yet: the preflight block costs nothing if the file is absent (agent reads, finds nothing, proceeds). It only activates when the file is present — which is exactly the failure case we're preventing.

---

## Verb Pattern Addendum

The preflight block patches the exit heuristic at execution time. This section fixes the upstream problem: task framing that makes "file exists" look like success.

**The core shift:** Move the success condition from the action to the outcome.

> "Build X" → agent wins when X exists  
> "Ensure X satisfies [criteria]" → agent wins when X _works_

---

### Canonical Verb Table

| Task intent          | Use this                                                                          | Not this                                    | Why                                                             |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| Create something new | `Ensure [artifact] exists and satisfies [criteria]`                               | `Build`, `Create`, `Write`                  | Ties existence to requirement satisfaction                      |
| Run an operation     | `Run [operation] and produce a current [output] as of [timestamp/state]`          | `Write the audit to`, `Generate the report` | Emphasizes recency and execution, not artifact                  |
| Update/fix existing  | `Verify [thing] handles [case] correctly, updating it if needed`                  | `Update`, `Fix`, `Patch`                    | Makes validation the job, modification the contingency          |
| Validate/check       | `Confirm [property] holds across [scope]; document findings regardless of result` | `Check if`, `See if`                        | Removes binary pass/fail shortcut; findings required either way |

---

### Anti-Patterns (Do Not Use)

These phrasings create the "cheapest checkpoint" problem:

- ❌ `"Build X"` — done when X exists
- ❌ `"Create X"` — done when X exists
- ❌ `"Write X to [path]"` — done when the file is written, not when it's correct
- ❌ `"Run the a11y audit"` — done when the script runs, even if against stale state
- ❌ `"Update X to handle Y"` — done when any edit is made to X, regardless of whether Y is handled
- ❌ `"Check if X is accessible"` — done when a prior audit file is found

---

### How to Write Criteria

When using `"Ensure X satisfies [criteria]"`, the criteria section is load-bearing. Vague criteria reproduce the problem in a different form.

**Too vague:** `"Ensure the dashboard satisfies accessibility requirements"`  
→ Agent declares success when any ARIA attributes are present

**Concrete:** `"Ensure the dashboard passes axe-core with zero violations at AA level, tested against the live rendered component with all data states populated"`  
→ Agent has a specific, falsifiable success condition

Criteria should specify: what, how tested, what state, and what threshold.

---

### Why Both Layers Are Needed

The verb pattern sets the right intent at task framing. The preflight block enforces it at execution. Neither alone is sufficient:

- Verb pattern only → agent reads "ensure X satisfies criteria" and still fast-exits if X exists and _looks_ right
- Preflight block only → agent reads the guard but the task phrasing ("build X") still creates a cognitive exit ramp toward existence-as-success

Together: verb pattern defines the success condition correctly; preflight block makes skipping without validation a policy violation the agent has to explicitly override.

---

## Why Two Checks (Step 0 and Step 0b)

The two cases need different semantics:

| Task type                         | Existing artifact means | Correct behavior                                                      |
| --------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| **Creation** (build, implement)   | Prior work was done     | Read it, validate content adequacy, only skip if requirements are met |
| **Operation** (audit, test, scan) | Prior run was done      | Doesn't matter — re-run unconditionally, overwrite                    |

A single check would get creation right but silently miss operational staleness — which is exactly the pattern we're preventing. The a11y audit case: an audit report predating 200 new views is not "an a11y audit." It's a historical document. The validator has to know it's looking at an operational task to apply staleness semantics rather than content-adequacy semantics.

This distinction should also drive the platform-level validator design (see Tim ticket) — the framework needs a task-type signal, not just file metadata.

---

_Created by Luis following the silent-failure investigation (2026-02-22)_  
_Reference: `luis/SILENT_FAILURE_INVESTIGATION.md`_
