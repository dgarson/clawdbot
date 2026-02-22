# WORK_PROTOCOL.md — Engineering Work Protocol

_Last updated: 2026-02-21_

**This protocol is MANDATORY for all engineering agents. Read it every session.**

---

## 1. Git Worktree Rule (CRITICAL)

**ALWAYS use a new git worktree for every task.** Never work directly on `main` or in a shared checkout. This prevents collisions with other agents working concurrently.

```bash
# Before starting any work:
cd /path/to/repo
git fetch origin
git worktree add ../worktrees/<issue-number>-<short-desc> origin/main
cd ../worktrees/<issue-number>-<short-desc>
git checkout -b <agent-id>/<issue-number>-<short-desc>

# When done (after PR is merged):
cd /path/to/repo
git worktree remove ../worktrees/<issue-number>-<short-desc>
```

**Naming convention:** `<agent-id>/<issue-number>-<short-description>`

- Example branch: `roman/142-auth-refactor`
- Example worktree: `../worktrees/142-auth-refactor`

**Never:**

- Work directly on `main`
- Share a worktree with another agent
- Leave stale worktrees after PR merge

---

## 2. Work Queue (workq)

Before starting any task:

1. Check if the issue/task is already claimed by another agent
2. Claim the work item before starting
3. Update status as you progress (in-progress → review → done)
4. Record which files you're touching so others can detect conflicts

_Note: The `workq` tool is being built as an OpenClaw extension. Until it's live, coordinate via GitHub issue assignment and Slack._

---

## 3. File Path Convention

**Always reference files by their fully qualified absolute path** in all communications — messages, logs, memory files, PR descriptions, and architecture docs.

✅ `/Users/openclaw/.openclaw/workspace/_shared/WORK_PROTOCOL.md`
✅ `/Users/openclaw/openclaw/src/gateway/sessions/manager.ts`
❌ `WORK_PROTOCOL.md`
❌ `./src/gateway/sessions/manager.ts`
❌ "the work protocol file"

This ensures any agent reading your output can immediately locate and read the file without guessing paths.

---

## 4. Document References in Specs

When senior engineers (Staff+) produce architecture docs, specs, or implementation plans:

- **Write them as files** in the `_shared/specs/` directory or your workspace
- **Reference them by absolute path** when assigning work to implementation agents
- **Do NOT paste full document contents** into messages — provide the file path and let the agent read it
- Example: "Implement the workq extension per spec at `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-architecture.md`"

---

## 5. Code Review Gate

**No work is considered complete until it passes code review.**

Review pipeline:

```
T4 Fast Worker → T3 Workhorse review → T2 Bridge/Staff review → merge
```

- Tier 4 agents: work must be reviewed by a Tier 3+ agent
- Tier 3 agents: work must be reviewed by a Tier 2+ agent (Staff/Bridge)
- Tier 2 agents: work can be reviewed by peers or escalated to Tier 1
- Tier 1 agents: peer review or self-review for small changes

**PR requirements:**

- Reference the GitHub issue number
- Describe WHAT changed and WHY
- List all files modified (fully qualified paths)
- Tag the appropriate reviewer based on the pipeline above

---

## 6. PR Target Rule (CRITICAL — NEVER VIOLATE)

**ALL pull requests MUST be opened against `dgarson/clawdbot` (origin). NEVER open PRs against `openclaw/openclaw` (upstream).**

This is a hard rule. No exceptions. No "just this once."

```bash
# ✅ CORRECT — always target origin
gh pr create --repo dgarson/clawdbot --head <branch> --base main

# ❌ NEVER DO THIS — never target upstream
gh pr create --repo openclaw/openclaw --head <branch> --base main
```

**Why:** `openclaw/openclaw` is the public upstream. Opening PRs there exposes internal work, pollutes the public project, and is a security/reputation risk.

**Enforcement:**

- The `acp-handoff` skill hardcodes `dgarson/clawdbot` as the PR target
- Any agent caught opening a PR against upstream will have the PR closed immediately
- If `gh pr create` ever defaults to upstream (because `dgarson/clawdbot` is a fork), you MUST explicitly pass `--repo dgarson/clawdbot`

**Git remote convention:**

- `origin` = `dgarson/clawdbot` (where we push, where PRs go)
- `upstream` = `openclaw/openclaw` (read-only sync source)

---

## 7. Gentle Touch Policy (MANDATORY)

**All modifications to the OpenClaw core codebase (`~/openclaw/`) MUST be surgical and minimal.**

### Principles:

1. **Additive over modifying** — Prefer new files, new modules, new extension points over changing existing code
2. **Minimal diff** — Every PR should touch the fewest lines possible to achieve the goal
3. **Extension-first** — If it can be an extension (`~/.openclaw/extensions/`), it MUST be an extension. Don't add to core what can live outside it.
4. **Hook, don't fork** — If core needs to change, add a hook/event/callback that extensions can use. Don't inline business logic.
5. **No speculative changes** — Don't refactor "while you're in there." One task = one change = one PR.
6. **Measure your blast radius** — Before submitting, count: files changed, lines added, lines removed. If your diff touches >5 files or >200 lines for a single feature, stop and decompose.

### Examples:

✅ **Good:**

- New extension in `~/.openclaw/extensions/telemetry/` that reads gateway logs
- Adding a 3-line event emission in gateway that extensions can subscribe to
- New file `src/gateway/hooks/on-run-complete.ts` with a simple callback interface

❌ **Bad:**

- Rewriting `src/gateway/sessions/manager.ts` to add telemetry inline
- Changing 15 files to thread a new parameter through the codebase
- "While I was fixing the bug, I also refactored the auth module"

### Enforcement:

- **Tier 1-2 reviewers** (Xavier, Tim, Amadeus) must reject PRs that violate this policy
- If you're unsure whether your change is minimal enough, ask your squad lead BEFORE coding
- Document your rationale in the PR: "Why this couldn't be an extension: [reason]"

_Source: David's directive — the core system is stable and working. Protect it._

---

## 8. Mega-Branch & PR Review Process (MANDATORY)

**Workstream leads** (Luis, Tim/Amadeus, etc.) are responsible for reviewing and consolidating PRs within their workstream.

### The Process:

1. **Comment before reviewing:** Always leave a short comment on the GitHub PR before beginning review (e.g., "Starting review — [your name]"). This makes it clear the review is underway.

2. **Review & merge into mega-branch:** Once a sub-PR passes review with all issues resolved, the workstream lead merges it into their **mega feature branch** (e.g., `luis/ui-redesign`, `a2a-protocol`).

3. **Keep mega-branch mergeable:** The mega-branch must always be conflict-free against `dgarson/fork`. Regularly merge `dgarson/fork` into your mega-branch and resolve conflicts.

4. **Leave mega-branch PR open:** Create a single PR from your mega-branch → `dgarson/fork`. This stays open for David's final review and eventual merge. Don't close it.

5. **Minimize leaf branches:** Close sub-PRs after merging into the mega-branch. The goal is minimum leaf branches — primarily one mega-branch per workstream.

### Example flow:

```
roman/142-auth-refactor  →  (reviewed by Tim)  →  merged into a2a-protocol
sandy/143-rate-limiter   →  (reviewed by Tim)  →  merged into a2a-protocol
a2a-protocol             →  (PR open → dgarson/fork, for David's review)
```

### Mega-branch naming convention:

- UI workstream: `luis/ui-redesign`
- A2A Protocol: `a2a-protocol`
- Other workstreams: `<lead-agent>/<feature-name>`

---

## 9. Worktree Handoff Protocol (MANDATORY)

**Every time you hand off work to another agent — for review, promotion, continuation, or debugging — you MUST include:**

1. **Branch name:** The exact git branch (e.g., `amadeus/a2a-protocol-schema`)
2. **Worktree directory:** The absolute path to the worktree (e.g., `/Users/openclaw/openclaw/worktrees/a2a-protocol-schema`)
3. **Repository:** Which repo (if ambiguous)
4. **Key files changed:** List of fully qualified paths to the files you modified/created
5. **Status:** What's done, what's left, what's broken

### Example handoff message:

```
✅ Implementation complete, ready for review.

Branch: `roman/142-auth-refactor`
Worktree: `/Users/openclaw/openclaw/worktrees/142-auth-refactor`
Repo: openclaw/openclaw

Files changed:
- `/Users/openclaw/openclaw/worktrees/142-auth-refactor/src/gateway/auth/provider.ts` (new)
- `/Users/openclaw/openclaw/worktrees/142-auth-refactor/src/gateway/auth/index.ts` (modified — added export)
- `/Users/openclaw/openclaw/worktrees/142-auth-refactor/test/auth/provider.test.ts` (new)

Status: All tests pass. Ready for T2+ review.
What's left: Integration test with real provider (needs API key).
```

### Worker → Reviewer Flow:

1. **Worker** completes implementation in their worktree on their branch
2. **Worker** sends handoff message (with ALL required fields above) to the designated reviewer
3. **Reviewer** checks out / navigates to the specified worktree and branch
4. **Reviewer** conducts code review:
   - For **low-complexity fixes** (typos, style, small logic errors): reviewer fixes directly on the branch
   - For **unaddressed concerns** (design issues, missing tests, logic gaps): reviewer sends task **back** to worker with specific feedback AND the branch/worktree/directory info
5. **When all concerns resolved:** Reviewer pushes the branch, marks work as done, and identifies/kicks off the next task(s) immediately
6. **Worker receives feedback:** Addresses concerns in the SAME worktree/branch, then re-sends for review with updated handoff message

### Rules:

- **NEVER** hand off work without branch + worktree + directory info. This is a hard rule.
- **NEVER** assume the reviewer knows which branch/directory you're working in.
- **Reviewers** must also include branch/worktree info when sending work back or escalating.
- **The handoff message IS the source of truth** for where the work lives.

---

## 10. Act On Concerns — Don't Just Report Them (MANDATORY)

**When you identify a problem, gap, risk, or improvement opportunity during your work — FIX IT. Do not just report it and wait.**

### The Rule:

If you see something wrong, broken, incomplete, or improvable AND you have the skills and context to fix it, **you are expected to act immediately**. Open a PR, fix the code, update the doc, resolve the issue. Surfacing observations without action is not enough.

### When to escalate instead of acting:

- The fix is outside your domain or competence level
- The change has significant blast radius and needs architectural input
- There's genuine ambiguity about the right approach (not just "I'm not sure if I should")
- It conflicts with another agent's in-progress work

### Mock Data vs Real API Integration:

When you encounter mock/stub/fake data in the codebase, **think critically** before changing it:

**Keep mocks when:**

- They enable fast, reliable unit tests that don't need network access
- They provide a development/demo mode for features that need external services
- The real API has rate limits, costs, or latency that would slow down dev/test cycles
- You need deterministic test fixtures for edge cases

**Switch to real APIs when:**

- The mock is papering over integration issues that only surface with real data
- The feature is mature enough that mock-only testing gives false confidence
- The mock has drifted from the real API's behavior and is now misleading
- There's no ongoing need for offline/demo mode

**Preferred approach:** Maintain both where practical. Use an interface/adapter pattern so the system can swap between mock and real implementations. Tests use mocks; integration tests and staging use real APIs. Don't rip out mocks just because real APIs exist — but don't hide behind mocks when real integration testing is needed.

_Source: David's directive (2026-02-21) — agents must be autonomous problem-solvers, not reporters._

---

## 11. Squad Structure

### Squad 1 — Platform Core (7 agents)

- **Lead:** Tim (Codex 5.3, VP Architecture)
- **Staff:** Roman (GLM-5)
- **Senior:** Sandy (Codex 5.3), Tony (Codex 5.3)
- **Mid:** Nate (MiniMax M2.5), Oscar (MiniMax M2.5), Vince (GLM-5)

### Squad 2 — Product & UI (7 agents)

- **Lead:** Luis (Sonnet 4.6, UX Architect)
- **Mid:** Barry (MiniMax M2.5), Harry (GLM-5), Wes (GLM-5)
- **Fast:** Piper (Flash), Quinn (Flash), Reed (Flash)

### Squad 3 — Agent Quality (4 agents)

- **Lead:** Claire (MiniMax M2.5, Staff Engineer)
- **Mid:** Jerry (MiniMax M2.5)
- **Fast:** Larry (Spark), Sam (Spark)

### C-Suite

- Xavier (CTO, Opus 4.6) — Final engineering gate
- Amadeus (CAIO, Opus 4.6) — AI research & strategy
- Julia (CAO, Sonnet 4.6) — Operations
- Stephan (CMO, Sonnet 4.6) — Marketing & storytelling
- Robert (CFO, Gemini 3.1 Pro), Drew (CDO), Tyler (CLO) — Support roles
