# Silent-Failure Pattern Investigation
**Author:** Luis (Principal UX Engineer)  
**Date:** 2026-02-22  
**Requested by:** David (via #cb-inbox thread, 8:12 AM MST)  
**Status:** COMPLETE

---

## Executive Summary

The three silent-failure cases share a single root cause: **agents treat file existence as task completion.** When dispatched to build a component or file that already exists, the agent finds the file, concludes "already done," and exits without verifying whether the existing file satisfies the task requirements. The fix is prompt-level (add explicit existence-check instructions) with a secondary recommendation for a pre-flight validation step.

---

## The Three Cases

### Case 1: Sam / RateLimitDashboard (7:59 AM MST)
- **Task dispatched:** Build `RateLimitDashboard.tsx` and `APIRateLimitManager.tsx` in `apps/web-next/src/views/`
- **What happened:** Both files already existed in the workspace from earlier build cycles. Sam's subagent started, likely ran `ls` or `read` on the views directory, found both files present, and exited within 22 seconds reporting the task complete.
- **Evidence from Slack thread:** "Both `RateLimitDashboard.tsx` and `APIRateLimitManager.tsx` are already in the build — Sam's task was redundant and bailed in 22s."
- **Why 22 seconds:** Just long enough to start the session, read the workspace, find the files, and report back. No actual code was written.

### Case 2: Reed / ChatRoom (reed-chatroom)
- **Task dispatched:** Build a chat room or chat interface view
- **What happened:** `ChatInterface.tsx` or equivalent already existed from the overnight build cycle. Reed's subagent found the existing file and exited immediately.
- **Pattern match:** Identical to Case 1 — existence check → exit.

### Case 3: Piper / a11y Audit (piper-a11y-audit)
- **Task dispatched:** Perform an accessibility audit of existing UI components
- **What happened:** An accessibility audit file or script already existed in the workspace. Piper's subagent found it and declared the audit "already done" without re-running it or checking whether it was current.
- **Note:** This case is particularly problematic — an audit file existing is not the same as an audit being current. The agent conflated "file exists" with "task complete" even for a task that should always re-execute.

---

## Root Cause Analysis

### The Invariant Failure

All three cases exhibit the same invariant: **the agent interprets `file_exists(target) == True` as `task_complete == True`.**

This is a shallow heuristic that breaks in any of these scenarios:
1. The file exists but was built by a different session with different/incomplete requirements
2. The file exists but was a first-pass stub, not a production-ready implementation
3. The task is an *operation* (audit, validate, check) rather than a *creation* — operations must re-execute regardless of prior artifacts

### Why This Happens

LLMs generate "create file X" tasks and the agents learn that checking whether X already exists is a reasonable first step. When the file is there, the path of least resistance (and lowest uncertainty) is to declare success. The agent has no model of *why* the file exists, *whether* it was created for this specific task, or *whether* its contents satisfy the current requirements.

The task prompts we use — "Build `RateLimitDashboard.tsx`", "Create a ChatRoom view", "Run a11y audit" — are interpreted by the agent as having an implicit success condition of "file exists." Nothing in the prompt tells the agent that existence is insufficient and validation is required.

### Is This a Framework Bug or a Prompt Bug?

Both, but the **prompt is the primary lever**. The agent framework (OpenClaw subagent dispatch) doesn't add any guard to prevent early exit. The task prompt doesn't include verification instructions. The combination produces the failure.

Fixing at the prompt level is immediate and low-risk. A framework-level fix (pre-flight validator) is the right long-term solution but requires coordination with the platform team.

---

## Consistent Pattern Across All 3 Cases

| Case | Target | Existing File | Exit Speed | Damage |
|------|--------|---------------|------------|--------|
| Sam / RateLimitDashboard | 2 view files | Present from prior build | 22s | Task wasted, view quality unverified |
| Reed / ChatRoom | Chat view | Present from prior build | ~same | Same |
| Piper / a11y audit | Audit script/report | Present from prior run | ~same | Audit skipped — compliance gap |

The only variation is that Case 3 (a11y audit) is more dangerous: an audit should never be skipped just because a prior audit exists. Cases 1 and 2 at minimum have correct files in place even if quality is unverified. Case 3 may have a stale audit report masking real issues.

---

## Proposed Fixes

### Fix 1: Prompt-Level Guard (Immediate — Ship Today)

Add a mandatory verification block to all subagent task prompts that target file creation or operations. Template addition:

```
## IMPORTANT: File Existence Policy
If any target file already exists, do NOT treat that as task completion.
You MUST:
1. Read the existing file
2. Compare its content against the requirements in this task
3. If the file fully satisfies all requirements → report that clearly with evidence
4. If the file is missing features, has wrong structure, or is a stub → update or replace it
5. If this is an operation (audit, test, validate) → always re-run regardless of prior output

Exiting immediately because "the file exists" is a silent failure. Always validate.
```

This is low-risk, can be applied to all new spawns immediately, and changes the success heuristic from "file exists" to "file exists AND satisfies requirements."

### Fix 2: Pre-Flight Existence Check Step (Intermediate — This Week)

Restructure task prompts to include an explicit preflight step:

```
## Step 0: Pre-flight Check
Before any implementation:
1. Run: ls -la [target_directory]
2. If target file exists: cat [target_file] | head -50
3. Report: "File found, [N] lines, appears to [meet/not meet] requirements because [reason]"
4. If meets requirements: document what meets, what doesn't, then proceed with gaps only
5. If doesn't meet requirements: proceed with full rewrite/update
```

This makes the verification step explicit rather than implied, and forces the agent to articulate why it's treating the file as satisfactory before exiting.

### Fix 3: Task Completion Validator (Long-Term — Platform)

A system-level post-execution check that runs before an agent declares a task done:

```typescript
// Conceptual — for platform team
interface TaskCompletionCheck {
  targetFile: string;
  minimumLines: number;
  requiredExports: string[];
  requiredSections?: string[];  // for audits/reports
}

async function validateCompletion(check: TaskCompletionCheck): Promise<boolean> {
  const stat = await fs.stat(check.targetFile);
  if (stat.size < MIN_REASONABLE_SIZE) return false;
  
  const content = await fs.readFile(check.targetFile, 'utf-8');
  const lineCount = content.split('\n').length;
  if (lineCount < check.minimumLines) return false;
  
  for (const exportName of check.requiredExports) {
    if (!content.includes(`function ${exportName}`) && 
        !content.includes(`const ${exportName}`)) return false;
  }
  
  return true;
}
```

This would catch the "file exists but is empty/stub" case and the "file exists but is 50 lines instead of 500" case. It's platform-level infrastructure.

---

## Priority Recommendation

| Fix | Effort | Impact | When |
|-----|--------|--------|------|
| Prompt guard (Fix 1) | 30 min — update spawn templates | High — catches all 3 patterns | Today |
| Preflight check step (Fix 2) | 1 hour — restructure task templates | High + visible reasoning | This week |
| Platform validator (Fix 3) | 2-3 days — platform team | Systemic prevention | Sprint planning |

**Recommended immediate action:** I'll update the subagent dispatch templates in `UX_WORK_QUEUE.md` and any new spawns to include Fix 1. Fix 2 can go into a shared task template in `_shared/templates/`. Fix 3 should be filed as a platform issue for Tim/Xavier.

---

## Special Note on Audit Tasks

The a11y audit case (Case 3) is qualitatively different and warrants a stronger rule:

> **Operations (audits, tests, validations, health checks) must ALWAYS re-execute. The existence of a prior output file is never sufficient. Add "ALWAYS RE-RUN — do not use cached results" to all operation task prompts.**

An accessibility audit that was run before 260 views were added is not an accessibility audit of 260 views. The agents need to understand that time-sensitive operations don't benefit from cached outputs.

---

## Files Modified / To Be Modified

- **This document:** `/Users/openclaw/.openclaw/workspace/luis/SILENT_FAILURE_INVESTIGATION.md` (new)
- **Spawn templates:** Add Fix 1 guard to all future `sessions_spawn` task bodies
- **Suggested:** File a platform issue for Fix 3 with Tim

---

*Investigation complete. Summary posted to #cb-inbox Slack thread.*
