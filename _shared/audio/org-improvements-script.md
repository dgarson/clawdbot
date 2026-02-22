# Audio Script: Organizational Improvements Overview
# Target: ~3 minutes | ~440 words at 145 wpm

---

Here's the honest picture of where the organization stands — and what we need to close the gap between "mostly documented" and "actually automated."

**Where we are today.**

The core rules are written. The work protocol covers worktrees, mega-branches, PR targeting, code review tiers, and the handoff process. Every agent's workspace references it. Every heartbeat file tells workers to read it. That's real progress — but it's passive compliance. Agents *read* the rules. What we're missing is systems that *enforce* them.

**Gap one: The mega-branch workflow has no teeth.**

Section eight of the work protocol lays out the right model — sub-PRs flow through squad leads, get merged into mega-branches, and David only touches the mega-branch when the whole workstream is done. That's exactly right. But there's no registry of active mega-branches. No squad lead's workspace file says "you own this branch, you are responsible for keeping it conflict-free." And there's nothing stopping an agent from opening a PR directly to main and calling it done. The fix is a canonical mega-branch registry — one file, every workstream, named branch, lead owner — plus explicit ownership written into each squad lead's AGENTS.md.

**Gap two: The handoff is manual.**

Right now, when an agent finishes work, they post "ready for review" in Slack and hope someone notices. The ACP handoff spec — which Tim and the team have been designing — fixes this. It's a structured workflow that opens the PR, assigns the right reviewer, notifies them, updates the work queue, and enforces branch targeting automatically. This is the single highest-leverage thing we can build. The spec is done, the task breakdown is done, P1 implementation is in progress. This needs to ship.

**Gap three: David is still in the review loop too early.**

The goal is David only reviews the mega-branch once — after every constituent PR has been worked, reviewed, iterated on, and merged. Not after every individual PR. This means squad leads need to own their review pipeline completely, including cross-squad escalations. David's gate is the workstream, not the ticket. Once ACP and workq are live, this becomes mechanical rather than manual.

**Gap four: Routing cost.**

Julia's routing optimization proposal is sitting unactioned. Right now every Slack message — including heartbeats and acknowledgments — hits main with full Sonnet reasoning. A tiered routing setup could cut that cost sixty to eighty percent while keeping complex requests on Opus-class models. That's a quick win waiting to happen.

**The three-sentence version:**

Codify mega-branch ownership so squad leads know exactly what they own. Ship ACP handoff so the review pipeline runs itself. Set up intelligent routing so inference costs don't scale linearly with message volume.

The rules exist. Now we build the machines that enforce them.
