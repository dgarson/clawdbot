---
summary: "Adaptive approval gating for risky tool calls using policy, safety classification, and channel routed approvals"
read_when:
  - Designing approval flows beyond exec only gating
  - Adding dynamic tool safety decisions that request approval only when needed
  - Integrating approval UX across channels, connections, and control surfaces
title: "Adaptive Tool Approval Architecture"
status: proposal
---

# Adaptive tool approval architecture

## Executive summary

OpenClaw already has strong hard controls (`tools.allow/deny`, sandboxing, `exec` approvals), but approval gating is currently concentrated around `exec` and static modes.
Users who run permissive tool policies want adaptive behavior: no prompts for clearly safe work, fast prompts when risk matters.

This proposal adds a unified approval layer for all tool calls:

- keep hard policy checks first (deny still wins)
- run a cheap safety evaluation pipeline for uncertain calls
- request approval only when the policy engine says the call is materially risky
- evaluate the request across multiple independent approvers (`UserRequestApprover`, `RulesBasedApprover`, `LLMEvaluationApprover`)
- approve only when a configurable quorum (`minApprovals`) is reached
- route approval requests through any connected operator surface (control UI, CLI, chat channels, plugin channels)

Human approval is the first implementation target, but the design is approver agnostic so automated approvers can be added later.

## Problem statement

Current controls answer "is this tool allowed" and "is this exec path allowlisted," but they do not consistently answer "does this specific invocation have real external impact right now."
The gap appears most often when:

- a permissive model can call many tools without context sensitive gating
- an invocation has side effects outside the local workspace
- the right approval path depends on channel or operator availability

## Design goals

- Minimize unnecessary prompts for low risk tool calls.
- Require explicit approval for high impact external side effects.
- Keep decisions deterministic and auditable.
- Reuse existing gateway approval/event infrastructure.
- Treat control UI and chat channels as equal approval transport adapters.
- Keep latency low by using a fast model only for ambiguous cases.
- Support configurable multi-factor approvals using independent approvers and quorum rules.

## Non goals

- Replacing hard allow/deny policy with model judgement.
- Sending raw chain of thought to any classifier.
- Full autonomous non-human approval in v1.

## Current state baseline

Existing building blocks that this architecture reuses:

- tool policy resolution in `src/agents/pi-tools.policy.ts`
- pre tool hook seam in `src/agents/pi-tools.before-tool-call.ts`
- `exec` allowlist and ask logic in `src/infra/exec-approvals.ts` and `src/agents/bash-tools.exec.ts`
- approval request and resolution APIs/events in `src/gateway/server-methods/exec-approval.ts`
- channel forwarding in `src/infra/exec-approval-forwarder.ts`

## High level design

The new flow adds a Tool Safety Evaluator and a unified Tool Approval Orchestrator in front of tool execution.
The orchestrator calls an Approver Registry and an Aggregation Engine so one operation can require one or more approval "factors".

```mermaid
flowchart LR
  A["Tool invocation request"] --> B["Tool policy check"]
  B --> C["Tool safety evaluator"]
  C --> D["Approval decision engine"]
  D -->|"allow"| E["Execute tool"]
  D -->|"deny"| F["Return blocked result"]
  D -->|"approval required"| G["Approver registry"]
  G --> H["RulesBasedApprover"]
  G --> I["LLMEvaluationApprover"]
  G --> J["UserRequestApprover"]
  H --> K["Approval aggregation engine"]
  I --> K
  J --> K
  K -->|"quorum reached"| E
  K -->|"needs human request"| L["Approval manager"]
  K -->|"rejected or timeout"| F
  L --> M["Approval router"]
  M --> N["Control UI adapter"]
  M --> O["CLI adapter"]
  M --> P["Channel adapters (Discord, Slack, Telegram, plugins)"]
  N --> Q["tool.approval.resolve"]
  O --> Q
  P --> Q
  Q --> L
  L -->|"approved"| E
  L -->|"denied or timeout"| F
  E --> R["Audit and metrics"]
  F --> R
```

## Safety evaluation model

Evaluation has two stages to keep performance predictable:

1. Static rule stage

- deterministic parse of tool name, params, target surface, and known side effect class
- immediate decision for clear safe or clear unsafe cases

2. Fast model stage (optional)

- runs only when static stage returns uncertain
- uses a small model (`nano`, `flash`, local model) with tight timeout
- outputs structured risk labels and confidence, not free text policy decisions

The policy engine, not the model, makes the final allow/deny/approval decision.

## Multi-factor approver model

Every approval-required operation is evaluated by an approver set and aggregated by quorum.

Default policy:

- `allowedApprovers = ["user_request", "rules_based"]`
- `disabledApprovers = []`
- `minApprovals = 1`

This means either the user-request path or rules-based policy can approve by default.
`LLMEvaluationApprover` is opt-in and can be enabled through `allowedApprovers`.

Aggregator rules:

- deny wins immediately if any required hard-policy factor rejects
- disabled approvers are removed before quorum calculation
- if `minApprovals` is greater than active approver count, fail closed (or clamp with explicit warning)
- identical factor ids count once (no duplicate votes)
- stale votes are invalidated when tool payload, risk class, or TTL changes

Proposed approver roles:

- `UserRequestApprover`: human-in-the-loop via UI/CLI/channel
- `RulesBasedApprover`: deterministic policy checks (allowlists, sender role, command class)
- `LLMEvaluationApprover`: fast risk evaluator factor for ambiguous cases

## Risk taxonomy

| Class | Description                                    | Typical examples                                         | Default action                                 |
| ----- | ---------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `R0`  | Read only, no external mutation                | `read`, session/history queries                          | allow                                          |
| `R1`  | Local workspace mutation                       | `write`, `edit`, `apply_patch` in workspace              | allow or sandbox constrained allow             |
| `R2`  | External read or low impact external actions   | web fetch/search, status probes                          | allow with optional approval on low confidence |
| `R3`  | External mutation or irreversible side effects | `message`, `gateway` writes, `cron`, remote node actions | approval required                              |
| `R4`  | High impact operations                         | destructive system commands, security boundary changes   | deny or break glass approval                   |

Risk-to-quorum defaults:

- `R0-R1`: `minApprovals = 0` after hard policy checks
- `R2`: `minApprovals = 1` using rules or user (policy configurable)
- `R3`: `minApprovals = 1` and must include `user_request` unless explicitly waived
- `R4`: `minApprovals = 2` and one factor must be `user_request` (or explicit break-glass policy)

## Mid level design

### Component responsibilities

| Component                  | Responsibility                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Tool Safety Evaluator      | Produces normalized risk assessment from static rules and optional model classification             |
| Approval Decision Engine   | Applies org/agent/session policy to assessment and returns `allow`, `deny`, or `approval_required`  |
| Tool Approval Orchestrator | Sits in tool invocation path, handles request lifecycle and tool continuation                       |
| Approval Manager           | Stores pending approvals, timeout handling, idempotency, resolution state                           |
| Approver Registry          | Loads enabled approvers from policy (`allowedApprovers`/`disabledApprovers`)                        |
| Aggregation Engine         | Computes quorum (`minApprovals`) and consolidates factor results                                    |
| Approval Router            | Resolves delivery targets from session channel, configured targets, and active operator connections |
| Channel adapters           | Deliver prompts and map user actions to `tool.approval.resolve`                                     |
| Audit pipeline             | Records request, decision, resolver identity, and execution outcome                                 |

### Invocation sequence

```mermaid
sequenceDiagram
  participant Agent as Agent runtime
  participant Orchestrator as Tool approval orchestrator
  participant Static as Static risk rules
  participant Classifier as Fast safety model
  participant Policy as Decision engine
  participant Registry as Approver registry
  participant Rules as RulesBasedApprover
  participant LLM as LLMEvaluationApprover
  participant Gateway as Approval manager and router
  participant Human as UserRequestApprover
  participant Tool as Tool executor

  Agent->>Orchestrator: invoke(tool, params, context)
  Orchestrator->>Static: evaluate
  alt clear static decision
    Static-->>Orchestrator: assessment
  else uncertain
    Orchestrator->>Classifier: classify(snapshot)
    Classifier-->>Orchestrator: assessment
  end
  Orchestrator->>Policy: decide(assessment, policy)
  alt allow
    Orchestrator->>Tool: execute
    Tool-->>Agent: result
  else deny
    Orchestrator-->>Agent: blocked
  else approval required
    Orchestrator->>Registry: evaluate factors(request)
    Registry->>Rules: approve/reject
    Rules-->>Registry: factor result
    Registry->>LLM: approve/reject/abstain
    LLM-->>Registry: factor result
    alt quorum reached
      Registry-->>Orchestrator: approved
      Orchestrator->>Tool: execute
      Tool-->>Agent: result
    else needs human factor
      Registry->>Gateway: tool.approval.request
      Gateway->>Human: deliver approval prompt
      Human->>Gateway: tool.approval.resolve
      Gateway-->>Registry: factor result
      alt quorum reached
        Registry-->>Orchestrator: approved
        Orchestrator->>Tool: execute
        Tool-->>Agent: result
      else denied or timeout
        Registry-->>Orchestrator: denied
        Orchestrator-->>Agent: blocked
      end
    else denied
      Orchestrator-->>Agent: blocked
    end
  end
```

## Channel and connection model

Approvals are routed through an adapter model where each delivery surface is a channel:

- control UI adapter
- CLI/gateway operator socket adapter
- first party channel adapters (Discord, Slack, Telegram, Signal, iMessage, WhatsApp web)
- extension channel adapters (plugin channels)

Routing modes mirror existing patterns:

- `session`: send to origin session route
- `targets`: send to configured operator targets
- `both`: send to both session and targets

This lets approval UX align with how users already interact with OpenClaw.

## Context package for safety evaluation

To support contextual risk decisions without leaking full reasoning traces, the evaluator receives:

- tool name and normalized args
- resolved execution host and path targets (when relevant)
- session and channel metadata
- compact action summary for the current task step
- policy context (sandbox on/off, agent trust level, sender role)

The package excludes raw chain of thought.

## Fallback behavior

- If classifier is disabled or times out, policy falls back to static rules.
- If approval delivery fails on one adapter, router fanout continues to other targets.
- If no approver is reachable, timeout policy applies (`deny` by default).
- If quorum cannot be satisfied because active factors are below `minApprovals`, block and emit `insufficient-factors`.

## Best-practices from external systems

This design is aligned to common approval controls in production systems:

- OWASP Authorization Cheat Sheet: enforce deny-by-default and least privilege in approval decisions, not allow-by-default behavior.
- NIST SP 800-53 Rev. 5: apply separation of duties (`AC-5`) and explicit change-control approvals (`CM-3`) for high-impact operations.
- HashiCorp Vault control groups: support threshold-style multi-person authorization for sensitive operations.
- GitHub protected branch reviews and GitLab merge-request approvals: use required approval counts and invalidate stale approvals when the request changes.
- Google Access Approval: keep explicit, auditable approvals with per-request traceability.
- Microsoft Entra PIM guidance: separate requestor and approver roles for privileged operations.

References:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [NIST SP 800-53 Rev. 5 (AC-5, CM-3)](https://www.govinfo.gov/content/pkg/FR-2020-12-10/pdf/2020-27049.pdf)
- [Vault Enterprise control groups](https://developer.hashicorp.com/vault/docs/enterprise/control-groups)
- [GitHub protected branches](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitLab merge request approvals](https://docs.gitlab.com/user/project/merge_requests/approvals/)
- [Google Access Approval overview](https://cloud.google.com/access-approval/docs/overview)
- [Microsoft Entra PIM approval guidance](https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-how-to-change-default-settings)

## Security and audit requirements

- Every approval request gets an immutable id, TTL, and audit record.
- Resolution records resolver identity and transport channel.
- Decision artifacts are structured JSON and redaction safe.
- Deny by default on ambiguous parser errors for high risk classes.

## Migration strategy

- Start with `tool.approval.*` APIs while keeping `exec.approval.*` compatibility aliases.
- Move `exec` to the shared orchestrator first, then expand to non-`exec` tools.
- Keep existing `tools.allow/deny` and sandbox behavior unchanged.

## Related document

- Detailed implementation blueprint: [Adaptive Tool Approval Implementation Blueprint](/refactor/adaptive-tool-approval-implementation)
