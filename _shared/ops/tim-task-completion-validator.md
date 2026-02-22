# Platform Issue: Task Completion Validator

**For:** Tim (platform team)  
**Filed by:** Merlin  
**Date:** 2026-02-22  
**Reference:** `luis/SILENT_FAILURE_INVESTIGATION.md`, `_shared/ops/spawn-preflight.md`  
**Priority:** High (see staleness argument below)

---

## Problem Statement

Agents silently declare tasks complete when a prior artifact exists at the target path. This is not a correctness failure — the agent doesn't crash or error. It exits cleanly, reports success, and the output looks normal. The failure is invisible to the requester.

**The invariant being violated:** `file_exists(target) == True` does not imply `task_complete == True`. Agents treat it as if it does.

Three confirmed cases:

- `RateLimitDashboard.tsx` — file present from prior build cycle, agent exited in 22 seconds, no new code written
- `ChatInterface.tsx` — same pattern, prior cycle artifact
- a11y audit report — prior audit file found, audit not re-run; report predated 200+ new views being added

The first two cases produce unverified quality (existing files may be stubs or partial implementations). The third is qualitatively worse: **a compliance artifact that silently doesn't cover what it claims to cover**.

---

## Why This Needs a Platform Fix

We have a prompt-layer mitigation in place (`_shared/ops/spawn-preflight.md`). It's a paste block that instructs agents to validate before exiting. It will help.

It is not sufficient long-term for one reason: **staleness semantics cannot be encoded at the prompt layer**.

A prompt can say "re-run if the file is old." An agent cannot reliably determine whether an audit file predates the addition of 200 new views without framework support. The framework knows:

- When the artifact was written
- What codebase state it was generated against (commit hash, file tree snapshot)
- Whether relevant inputs have changed since the artifact was produced

The agent has none of this at prompt-execution time. It can only read the file's modification timestamp (unreliable) and make a judgment call. That judgment call is exactly the one that failed in the a11y case.

---

## What We're Asking For

A **task-type-aware completion validator** that runs before an agent is allowed to declare a task done.

### Critical design requirement: two semantics, not one

This is the most important design constraint. A single generic validator (file exists + size > N + required exports) would have passed the RateLimitDashboard case and silently failed the a11y audit case — because both produce files that look fine on metadata inspection.

The validator must accept a **task type signal**:

| Task type   | Success semantics | What to check                                                                                   |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `creation`  | Content adequacy  | File exists, size ≥ threshold, required exports/sections present, not a stub                    |
| `operation` | Artifact currency | File exists AND was generated against current codebase state (commit-aware or input-hash-aware) |

Without this distinction, the validator gets creation right and silently fails operational staleness — the same pattern we're preventing.

---

## Proposed Interface (Sketch)

```typescript
interface TaskCompletionSpec {
  taskType: "creation" | "operation";
  targetFile: string;

  // For 'creation' tasks
  minimumLines?: number;
  minimumBytes?: number;
  requiredExports?: string[];
  requiredSections?: string[]; // for reports/docs
  prohibitedPatterns?: string[]; // detect stubs: ["TODO", "placeholder", "not implemented"]

  // For 'operation' tasks
  inputFiles?: string[]; // files the operation reads; stale if any have changed
  inputGlobs?: string[]; // e.g., "apps/web-next/src/views/**/*.tsx"
  maxAgeMs?: number; // hard ceiling regardless of input staleness
  requiresCurrentCommit?: boolean; // artifact must postdate HEAD
}

async function validateTaskCompletion(spec: TaskCompletionSpec): Promise<ValidationResult> {
  // creation: content-adequacy checks
  // operation: input-hash comparison or commit-timestamp comparison
}
```

The `inputFiles` / `inputGlobs` approach is the right one for the a11y case: the audit is stale if any view file has changed since the audit was written. The framework computes a hash of all matched files at audit time, stores it alongside the artifact, and re-validates on next completion check.

---

## Priority Argument

This is higher priority than "avoid redundant builds."

The RateLimitDashboard case wastes time and produces unverified quality. Bad, but bounded.

The a11y audit case produces a compliance artifact that **appears to cover the current codebase but does not**. If anyone downstream acts on that audit (accessibility review, legal compliance, user testing decisions), they're acting on false information. The damage is unbounded and silent.

The staleness check (`operation` task type, input-hash validation) is the capability that changes the risk profile. The content-adequacy check (`creation` task type) is useful but less urgent. If resources require prioritization, start with `operation` semantics.

---

## References

- `luis/SILENT_FAILURE_INVESTIGATION.md` — full case analysis and root cause
- `_shared/ops/spawn-preflight.md` — prompt-layer mitigation (in place now)
- Three failure cases documented with transcript evidence in the investigation doc

---

_Ready to discuss design. Happy to pair on the input-hash approach or sketch the storage schema for audit currency metadata._
