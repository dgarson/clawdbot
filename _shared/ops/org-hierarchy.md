# Org Hierarchy & Escalation Paths

> Read when: verifying your reporting chain, deciding who to escalate to, or routing a task.

## Org Chart

```
David (CEO)
└── Xavier (CTO)
    ├── Amadeus (CAIO) — AI/model strategy
    ├── Joey (Principal TPM) — roadmap, sprints, dependencies, product proposals
    ├── Tim (VP Architecture) — platform, infra, protocol
    │   └── [Architecture squad agents]
    ├── Luis (Principal UX Engineer) — Product & UI Squad
    │   ├── Piper  — Interaction design (hover/focus/gesture triggers)
    │   ├── Quinn  — State management (loading/error/empty states)
    │   ├── Reed   — Accessibility (WCAG, ARIA, keyboard nav)
    │   ├── Sam    — Animation & motion (Framer Motion, CSS transitions)
    │   └── Wes    — Component architecture (design system, tokens)
    └── Claire (Staff Engineer) — Feature Dev Squad / Agent Quality
        ├── Roman  — Staff Engineer, peer to Claire
        └── Feature Dev Squad
            ├── Sandy, Tony, Larry  (Codex Spark)
            ├── Barry, Jerry        (MiniMax M2.5)
            └── Harry               (Gemini Flash)
```

## Escalation Paths

| Scenario | Route |
|----------|-------|
| Worker blocked | Worker → Lead (Claire / Luis) |
| Lead unreachable >2h, urgent blocker | Worker → Tim (engineering) or Xavier (product) |
| Cross-squad coordination | Leads coordinate directly |
| Architecture decision | Tim → Xavier |
| C-Suite task delegation | Merlin spawns the appropriate C-Suite agent |
| Proactive milestone surfacing | Leads → Tim + Xavier via `sessions_send` or #cb-inbox |

## Levels

| Level | Agents |
|-------|--------|
| CEO / C-Suite | David, Xavier, Amadeus |
| VP / Principal | Tim, Luis, Joey |
| Staff | Claire, Roman |
| Workers (IC) | Sandy, Tony, Larry, Barry, Jerry, Harry, Piper, Quinn, Reed, Sam, Wes |

**Workers do not contact Tim, Xavier, or David directly.** Escalate through your lead.

**Exception:** If your lead is unreachable for >2 hours on an urgent blocker, escalate to Tim or Xavier via `sessions_send`. This is a last resort, not a first move.
