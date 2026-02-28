# Routing Policy — Skill Guide

The `ocx-routing-policy` extension intercepts every agent run at two points: before the model is selected (`before_model_resolve`) and before the system prompt is built (`before_prompt_build`). At the first hook it classifies the incoming message and matches it against a priority-ordered list of routing policies, optionally overriding the model or provider for that run. At the second hook it assembles the system prompt from a pool of conditional prompt contributors sorted by priority and trimmed to fit a token budget. Use this extension when you need consistent, policy-driven control over which model handles which tasks, or when you need to inject context-specific instructions into agent prompts without hardcoding them.

## Actions at a Glance

| Gateway Method              | What it does                                             | Required params        |
| --------------------------- | -------------------------------------------------------- | ---------------------- |
| `routing.classify`          | Classify a text string and return the label + confidence | `text`                 |
| `routing.policies.list`     | Return all active routing policies                       | —                      |
| `routing.policies.set`      | Replace the full policy list (create or update)          | `policies` (array)     |
| `routing.contributors.list` | Return all active prompt contributors                    | —                      |
| `routing.contributors.set`  | Replace the full contributor list (create or update)     | `contributors` (array) |

## Classification Labels

Each message is classified into exactly one label. The label can be used as a condition in both routing policies and prompt contributors.

| Label        | Meaning                                                             | Typical model target                |
| ------------ | ------------------------------------------------------------------- | ----------------------------------- |
| `simple`     | Short questions, greetings, factual lookups                         | Smallest/cheapest model             |
| `code`       | Code generation, debugging, review, programming tasks               | Code-optimized model                |
| `complex`    | Long-form analysis, research, detailed multi-paragraph explanations | Most capable general model          |
| `multi-step` | Workflows requiring sequential steps or coordinated actions         | Most capable or orchestrating model |

The classifier runs a zero-cost heuristic first. If the heuristic confidence meets the configured threshold (default `0.7`), the heuristic result is used. If confidence falls below the threshold, an LLM classifier is invoked on a truncated (500-character) version of the message. The method used (`heuristic` or `llm`) is returned in the classification result.

## Policy Precedence Rules

A routing policy fires when **all** of its `conditions` match the current run context. When multiple policies match, the one with the **highest `priority` number wins**. Priority `100` beats priority `10`.

```json
{
  "id": "complex-to-opus",
  "priority": 50,
  "conditions": [{ "kind": "classification", "label": "complex" }],
  "target": { "model": "claude-opus-4-6" }
}
```

Available condition kinds for routing policies:

| Condition kind     | Matches when...                                        |
| ------------------ | ------------------------------------------------------ |
| `agent`            | Run is for the named `agentId`                         |
| `channel`          | Message arrived on the named channel (e.g. `telegram`) |
| `classification`   | Classifier assigned this label to the message          |
| `budget_remaining` | Remaining token budget is `gt` or `lt` a threshold     |
| `tool_count`       | Number of available tools is `gt` or `lt` a threshold  |
| `hour_of_day`      | Current UTC hour falls in `[from, to)`                 |
| `session_depth`    | Current session depth is `gt` or `lt` a threshold      |

All conditions in a policy are ANDed. If no policy matches, the `defaultModel` config value is used; if that is empty, the agent's own configured model is used unchanged.

## Prompt Contributors

Contributors inject static text into the system prompt before each run. They are filtered by conditions (an empty `conditions` array means always include), sorted by ascending `priority` (lower number = earlier in the prompt), and concatenated with double newlines.

```json
{
  "id": "code-style-guide",
  "priority": 10,
  "optional": false,
  "conditions": [{ "kind": "classification", "label": "code" }],
  "content": "Follow the project ESLint config. Prefer functional patterns over classes."
}
```

Available condition kinds for contributors:

| Condition kind   | Matches when...                          |
| ---------------- | ---------------------------------------- |
| `agent`          | Run is for the named `agentId`           |
| `channel`        | Message arrived on the named channel     |
| `classification` | Classifier assigned this label           |
| `has_tool`       | The named tool is available in this run  |
| `session_type`   | Session is `main`, `subagent`, or `cron` |

### Token Pressure Behavior

If a `tokenBudget` is set on the prompt context, required contributors (`optional: false`) are always included. Optional contributors are added in priority order until the next one would exceed the budget, at which point all remaining optional contributors are dropped. Required contributors are never dropped regardless of budget. To protect a contributor from being shed under pressure, set `optional: false`.

## Querying Current Routing Decisions and Policies

List all active policies and inspect their priorities:

```
routing.policies.list()
```

Classify a message to preview what label and confidence the system would assign before a real run:

```
routing.classify({ text: "Refactor this class to use the repository pattern", toolsAvailable: 5 })
```

The response includes `label`, `confidence`, `method` (`heuristic` or `llm`), and optionally `classifierModel`.

List prompt contributors to see what context is being injected for each session:

```
routing.contributors.list()
```

## Tuning Confidence Thresholds

The `heuristicConfidenceThreshold` config value (default `0.7`) controls when the cheap heuristic is trusted without escalating to an LLM call. Heuristic confidence values by label:

| Label        | Heuristic confidence |
| ------------ | -------------------- |
| `code`       | 0.7                  |
| `complex`    | 0.6                  |
| `multi-step` | 0.5                  |
| `simple`     | 0.4                  |

Because `simple`, `multi-step`, and `complex` all fall below the default threshold of `0.7`, they escalate to the LLM classifier unless you lower the threshold. To trust heuristics for all labels and eliminate LLM classification calls entirely, lower `heuristicConfidenceThreshold` to `0.4`. To require LLM confirmation for code labels too, raise it above `0.7`. Set `classifierModel` to a faster or cheaper model to reduce latency when LLM classification is frequent.

## Failure Patterns

**Routing picks the wrong model.** Run `routing.classify` on a representative message and check the returned label. If classification is correct but routing still misfires, run `routing.policies.list` and verify priority ordering — a lower-priority policy with broader conditions may be winning. Add a higher-priority policy that narrows the conditions or explicitly targets the correct model.

**Prompt contributors not appearing.** Run `routing.contributors.list` and verify the contributor's conditions match the actual session context. A `channel` condition will not match a session from a different channel. An `agent` condition requires an exact agent ID match. A contributor with zero matching conditions never fires; an empty `conditions` array means always match.

**Optional contributors disappearing unexpectedly.** The session is operating under a token budget and the contributor is being shed. Set `optional: false` if the content must always appear, or move the contributor to a lower priority number so it is included before the budget is exhausted.

**Classification always returns `simple`.** The heuristic assigns `simple` a confidence of `0.4`, which is below the default threshold, so the LLM classifier runs. If the LLM path is also returning `simple`, the message genuinely matches the simple label. Use `routing.classify` with representative text to verify.

## Override: Force a Specific Model for Specific Conditions

To unconditionally route a particular agent or channel to a specific model, create a high-priority policy with tightly scoped conditions:

```json
{
  "id": "force-haiku-for-cron-agent",
  "priority": 999,
  "conditions": [{ "kind": "agent", "agentId": "cron-summarizer" }],
  "target": { "model": "claude-haiku-3-5" }
}
```

Push the updated list (always fetch first, then re-save the full array):

```
routing.policies.list()        // 1. fetch current
// 2. append or modify your override entry
routing.policies.set({ policies: [ ...existing, newOverride ] })  // 3. write back
```

`routing.policies.set` replaces the entire list. Writing a partial array will delete the omitted entries.

## Key Rules

1. **All conditions in a policy are ANDed.** A policy with two conditions fires only when both match simultaneously; use separate policies for OR logic.
2. **Higher priority number wins.** When multiple policies match, the one with the largest `priority` value is selected. Keep emergency overrides at priority 900+.
3. **The full policy list is replaced on every `set` call.** Always fetch, modify, and re-save the complete array; never write a partial list.
4. **Classification is cached per run.** The result from `before_model_resolve` is reused in `before_prompt_build`, so classification runs at most once per agent invocation.
5. **Required contributors are never dropped.** Under token pressure only `optional: true` contributors are shed. Use `optional: false` for safety-critical or always-required instructions.
6. **Contributor priority is ascending — lower number appears first.** Priority `0` is placed at the top of the composed prompt; priority `100` appears near the bottom.
7. **An empty contributor `conditions` array means always include.** Omit conditions for contributors that should apply regardless of channel, agent, or classification label.
