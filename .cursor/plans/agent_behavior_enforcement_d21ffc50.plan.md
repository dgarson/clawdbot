---
name: Agent Behavior Enforcement
overview: Design a multi-layered agent behavior enforcement system with a prompt contributor framework (supporting both Pi and Claude SDK runtimes), extend auto-labeling into a session classification system, and enable tag-based contributor selection.
todos:
  - id: contributor-types
    content: Define PromptContributor, ContributorContext, PromptSection, ContributorTag interfaces in src/agents/prompt-contributors/types.ts
    status: completed
  - id: contributor-registry
    content: Implement PromptContributorRegistry with tag-based selection, priority sorting, and shouldContribute filtering
    status: completed
  - id: builtin-contributors
    content: Refactor existing buildXxxSection() functions in system-prompt.ts into individual PromptContributor implementations (Memory, Skills, Messaging, Docs, Voice, ReplyTags, etc.)
    status: completed
  - id: system-prompt-refactor
    content: Refactor buildAgentSystemPrompt() to use the contributor registry instead of inline section assembly
    status: completed
  - id: classification-types
    content: Define SessionClassification, SessionTopic, SessionComplexity types and add classification field to SessionEntry
    status: completed
  - id: extend-auto-label
    content: "Extend session-auto-label.ts: require dedicated model (remove agent-default fallback), request structured JSON (label + topic + complexity + domain + flags), bump LABEL_MAX_TOKENS to ~120, persist as SessionEntry.classification"
    status: completed
  - id: classification-event
    content: Emit session classification event and wire it into the agent event bus for downstream consumers
    status: completed
  - id: tool-sequence-enforcer
    content: Implement ToolSequenceEnforcer as a before_tool_call hook with configurable prerequisite rules
    status: completed
  - id: config-schema
    content: Add promptContributors config schema to agent defaults for config-driven contributors with tags
    status: completed
  - id: plugin-contributor-hook
    content: Add register_prompt_contributor plugin hook so extensions can contribute tagged prompt sections
    status: completed
isProject: false
---

# Agent Behavior Enforcement and Prompt Contributor System

## Current Architecture (Baseline)

**System prompt assembly** is centralized in `[src/agents/system-prompt.ts](src/agents/system-prompt.ts)` via `buildAgentSystemPrompt()`. Both Pi and Claude SDK runtimes consume the same prompt text -- Pi via `session.agent.setSystemPrompt()`, Claude SDK via the `systemPrompt` field in `query()` options. The branch point is in `[src/agents/pi-embedded-runner/run/attempt.ts](src/agents/pi-embedded-runner/run/attempt.ts)` at ~line 693.

**Plugin hook** `before_prompt_build` already allows plugins to override `systemPrompt` or prepend `prependContext`, but there is no structured multi-contributor composition -- it's last-write-wins for `systemPrompt` and concatenation for `prependContext`.

**Tool gating** uses a multi-tier policy pipeline (`[src/agents/tool-policy-pipeline.ts](src/agents/tool-policy-pipeline.ts)`) and `before_tool_call` hooks (`[src/agents/pi-tools.before-tool-call.ts](src/agents/pi-tools.before-tool-call.ts)`) that can block/modify tool calls.

**Auto-labeling** (`[src/sessions/session-auto-label.ts](src/sessions/session-auto-label.ts)`) fires on `"input"` events, sends a single LLM call to generate a display label (string, max 79 chars), and persists it as `SessionEntry.label`.

---

## Part 1: Approaches to Enforce Agent Behavior

### Approach A -- Prompt-Directive Enforcement (Serena-style)

Embed behavioral requirements directly in tool descriptions and create "checkpoint" tools that return instruction prompts.

**How it works (Serena pattern):**

- Tool docstrings contain directives: _"You MUST call `check_onboarding_performed` before using any other tool"_
- "Thinking" tools like `ThinkAboutCollectedInformationTool` return templated prompt text from a `PromptFactory`, forcing the agent to process instructions mid-turn
- `InitialInstructionsTool` returns the entire system prompt as a tool result (fallback for MCP clients that don't read system prompts)

**Adaptation for OpenClaw:**

- Add directive metadata to tool definitions (a `prerequisites` field listing required prior tool calls)
- Surface these prerequisites in the tool summary section of the system prompt
- Create checkpoint tools (`verify_context`, `review_plan`) whose `execute()` returns behavioral instructions from templates

**Pros:**

- Simple to implement; works with any LLM provider
- Composable -- different tools can declare different prerequisites
- Degrades gracefully (agent may skip but nothing breaks)

**Cons:**

- Soft enforcement only -- LLMs can and do ignore directives
- Requires prompt real estate (costs tokens)
- No visibility into whether the agent actually followed the directive

**Best for:** Workflow guidance, coding discipline, information-gathering sequences

---

### Approach B -- Orchestration-Level Enforcement (Hook Guards)

Use the existing `before_tool_call` hook system to enforce tool call prerequisites at runtime.

**How it works:**

- Register a `ToolSequenceEnforcer` as a `before_tool_call` hook
- Track per-session tool call history (which tools have been called)
- Each tool declares `requiredPrior: string[]` (tools that must have been called first)
- Hook checks history and returns `{ block: true, blockReason: "..." }` if prerequisites not met

**Implementation sketch:**

```typescript
interface ToolPrerequisite {
  toolName: string;
  requiredPrior: string[];
  blockMessage: string;
}

function createToolSequenceEnforcer(prereqs: ToolPrerequisite[]): BeforeToolCallHook {
  const history = new Map<string, Set<string>>(); // sessionKey -> called tools
  return (ctx, event) => {
    const called = history.get(ctx.sessionKey) ?? new Set();
    const rule = prereqs.find((p) => p.toolName === event.toolName);
    if (rule) {
      const missing = rule.requiredPrior.filter((t) => !called.has(t));
      if (missing.length > 0) {
        return { block: true, blockReason: rule.blockMessage };
      }
    }
    called.add(event.toolName);
    history.set(ctx.sessionKey, called);
    return {};
  };
}
```

**Pros:**

- Hard enforcement -- the tool call is actually blocked
- Provides clear error message guiding the agent back on track
- Audit trail (which tools were blocked and why)
- Works identically for Pi and Claude SDK runtimes (hooks run before tool execution in both)

**Cons:**

- Can create frustrating loops if the agent doesn't understand why it's blocked
- Rigid -- may need escape hatches for edge cases
- Only works for tool ordering; cannot enforce prompting behavior (e.g., "think before writing")

**Best for:** Security-critical sequences (approve before execute), data-gathering prerequisites

---

### Approach C -- Tool-Response Directives (Hybrid)

Tools return structured directive payloads that the orchestration layer interprets and enforces.

**How it works:**

- Tool results can include a `__directives` metadata block (stripped before LLM sees it)
- Directives set session-scoped flags: `{ requireBeforeNext: ["verify_plan"], escalateToOwner: false }`
- The `before_tool_call` hook reads these flags and enforces them on the next tool call

**Pros:**

- Dynamic enforcement -- tools can set context-dependent requirements
- Composable with Approach B
- Tools can express nuanced constraints based on their own output

**Cons:**

- More complex to implement and debug
- Directive lifecycle management (when do flags expire?)

**Best for:** Context-dependent workflows where prerequisites change based on tool output

---

### Approach D -- Prompt Section Gating via Classification

Use session classification (see Part 3) to conditionally include/exclude behavioral directives in the system prompt.

**How it works:**

- Contributors (see Part 2) are tagged with topic/complexity classifiers
- At prompt build time, only contributors matching the session's classification are included
- Example: A "security-review" contributor adds strict file-change guidelines only for sessions classified as `topic:security`

**Pros:**

- Keeps system prompts lean (no irrelevant directives)
- Naturally adapts behavior to the task at hand
- Works for both Pi and Claude SDK (prompt-level, not runtime-level)

**Cons:**

- Depends on classification accuracy
- Classification happens after first message (cold start problem)
- Requires re-building the system prompt when classification changes

**Best for:** Domain-specific behavioral guidelines, complexity-aware tooling

---

### Recommended Strategy: Layered Enforcement

Combine approaches in layers:

```
Layer 1 (always): Prompt contributors set baseline behavioral directives (Approach A + D)
Layer 2 (critical paths): Hook guards enforce hard prerequisites (Approach B)
Layer 3 (adaptive): Tool-response directives for dynamic mid-session adjustments (Approach C)
```

---

## Part 2: Prompt Contributor System

### Core Abstraction

```typescript
interface PromptContributor {
  id: string;
  /** Tags for classification-based selection */
  tags: ContributorTag[];
  /** Lower = earlier in prompt. Default 100. */
  priority: number;
  /** Return false to skip this contributor for the current session */
  shouldContribute(ctx: ContributorContext): boolean;
  /** Produce the prompt section */
  contribute(ctx: ContributorContext): PromptSection;
}

type ContributorTag = {
  dimension: "topic" | "complexity" | "domain" | "channel" | "custom";
  value: string;
};

interface PromptSection {
  heading?: string;
  content: string;
  /** Max chars budget; content will be truncated if exceeded */
  maxChars?: number;
}

interface ContributorContext {
  agentId: string;
  sessionKey?: string;
  classification?: SessionClassification;
  availableTools: string[];
  channel?: string;
  promptMode: PromptMode;
  runtime: "pi" | "claude-sdk";
  workspaceDir: string;
}
```

### Contributor Registry

A `PromptContributorRegistry` collects contributors from multiple sources:

1. **Built-in contributors** -- replace the current hardcoded sections in `buildAgentSystemPrompt()` (Memory, Skills, Messaging, Docs, etc.) as individual `PromptContributor` implementations
2. **Plugin contributors** -- plugins register contributors via a new `register_prompt_contributor` hook or via the existing plugin lifecycle
3. **Config-driven contributors** -- agent config can specify inline prompt sections with tags
4. **Workspace contributors** -- `.agents/prompts/*.md` files with YAML frontmatter declaring tags

### Assembly Flow

```
buildAgentSystemPrompt(params)
  |
  v
PromptContributorRegistry.resolve(ctx)
  |-- filter by shouldContribute(ctx)
  |-- filter by classification tag match (if classification available)
  |-- sort by priority
  |-- call contribute(ctx) for each
  |-- concatenate sections with headings
  |
  v
Final system prompt string (consumed by Pi or Claude SDK identically)
```

### Integration with Both Runtimes

The contributor system operates **above** the runtime split. Since both Pi and Claude SDK already consume the output of `buildAgentSystemPrompt()` as a plain string, the contributor system slots in at the same level. The `ContributorContext.runtime` field allows contributors to conditionally include runtime-specific guidance (e.g., Claude SDK doesn't use `<final>` tags).

### Migration Path

Refactor the existing section-builder functions (`buildSkillsSection`, `buildMemorySection`, `buildMessagingSection`, etc.) into `PromptContributor` implementations. The `buildAgentSystemPrompt()` function becomes a thin orchestrator that:

1. Constructs the `ContributorContext`
2. Calls the registry
3. Wraps the result with identity line + runtime info

---

## Part 3: Extending Auto-Labeling into Session Classification

### Current State

`[src/sessions/session-auto-label.ts](src/sessions/session-auto-label.ts)` makes a single LLM call with `complete()` to generate a display label. It currently falls back to the agent's default model when no dedicated model is configured, which is wasteful -- the agent's model may be a high-capability (expensive) model while classification only requires something cheap and fast.

### Proposed Changes

**Two changes from the current implementation:**

1. **Require a dedicated model** -- `sessionLabels.model` becomes mandatory (no fallback to the agent's default model). If unset, classification is skipped entirely with a clear log warning. This prevents accidentally routing cheap classification work through an expensive agent model (e.g., Opus or o3). The config UI label should indicate this is required when `sessionLabels.enabled` is true.
2. **Structured JSON output** -- The LLM call returns a JSON object instead of a plain string, combining the existing label with new classification fields:

```typescript
interface SessionClassification {
  label: string;
  topic: SessionTopic;
  complexity: SessionComplexity;
  domain: string[];
  flags: string[];
}

type SessionTopic =
  | "coding"
  | "research"
  | "ops"
  | "conversation"
  | "creative"
  | "debugging"
  | "config"
  | "other";

type SessionComplexity = "trivial" | "simple" | "moderate" | "hard" | "complex";
```

**Complexity scale rationale** (5 tiers):

- `trivial` -- single-shot factual answers, greetings, config lookups
- `simple` -- single-file edits, straightforward Q&A with one tool call
- `moderate` -- multi-file changes, requires reading context before acting
- `hard` -- cross-cutting refactors, multi-step debugging, architecture decisions
- `complex` -- system design, multi-service coordination, novel problem-solving

**Updated classification prompt** (still a single lightweight call):

```
Analyze this conversation opener. Return a JSON object with:
- "label": concise title (max 79 chars, no quotes/trailing punctuation)
- "topic": one of coding|research|ops|conversation|creative|debugging|config|other
- "complexity": one of trivial|simple|moderate|hard|complex
- "domain": array of 0-3 short tags (e.g. ["frontend","react"] or ["devops","k8s"])
- "flags": array of 0-2 notable attributes (e.g. ["security-sensitive","multi-file"])

Reply with ONLY the JSON object.

Conversation:
${truncatedPrompt}
```

**Model resolution change** in `generateLabel()`:

- Remove the `resolveDefaultModelForAgent()` fallback path (lines 85-89 of the current file)
- If `labelsCfg?.model` is not set or not in `"provider/model"` format, log a warning and return early
- `LABEL_MAX_TOKENS` should be bumped from 50 to ~120 to accommodate the JSON wrapper overhead while staying cheap

The `label` field from the JSON response replaces the current string-only output, so the existing `SessionEntry.label` write path continues to work by extracting `result.label`. The full classification object is written to the new `SessionEntry.classification` field.

### Persistence

Add a `classification` field to `SessionEntry` in `[src/config/sessions/types.ts](src/config/sessions/types.ts)`:

```typescript
export type SessionEntry = {
  // ... existing fields ...
  label?: string;
  classification?: SessionClassification;
  // ...
};
```

### Event Propagation

After classification is persisted, emit a new agent event:

```typescript
emitAgentEvent({
  runId,
  stream: "classification",
  data: { classification },
  sessionKey,
});
```

This event can trigger:

- Prompt contributors to re-evaluate (for subsequent turns)
- Plugin hooks to react (e.g., activate domain-specific tools)
- UI updates (show topic/complexity badges)
- Analytics pipelines

### Re-classification

On subsequent turns, if the conversation shifts significantly, a lightweight re-classification can run. Use a configurable threshold (e.g., every N turns, or when compaction happens) and merge/update the classification. The `before_prompt_build` hook already runs per-turn, so contributors can read the latest classification from the session store.

### No Embedding Model Needed (Initially)

The structured-output approach using the existing lightweight LLM call is sufficient for the initial classification. Topic and complexity buckets are well-defined categories that small models handle reliably. An embedding-based classifier could be added later for:

- Matching against a large library of prompt contributors
- Semantic similarity-based contributor selection (beyond exact tag matching)
- Zero-shot classification without predefined buckets

If embedding-based selection is desired later, the existing embedding infrastructure in `[src/memory/embeddings.ts](src/memory/embeddings.ts)` (supporting OpenAI, Gemini, Voyage, local providers) can be reused.

---

## Part 4: Tag-Based Contributor Selection

### Selection Algorithm

When the `PromptContributorRegistry` resolves contributors, it applies this selection logic:

```
1. Always include contributors with no tags (universal contributors)
2. For tagged contributors:
   a. Match contributor tags against session classification
   b. A contributor is included if ANY of its tags match
   c. Tags can use wildcard dimensions: { dimension: "topic", value: "*" }
3. Apply shouldContribute() as a final programmatic filter
4. Sort by priority, concatenate
```

### Tag Matching Rules

- `{ dimension: "topic", value: "coding" }` matches sessions classified as `topic: "coding"`
- `{ dimension: "complexity", value: "complex" }` matches sessions classified as `complexity: "complex"`
- `{ dimension: "domain", value: "frontend" }` matches sessions with `"frontend"` in their `domain` array
- `{ dimension: "channel", value: "telegram" }` matches sessions originating from Telegram
- Contributors can have multiple tags (OR logic -- any match includes the contributor)

### Config-Driven Contributors Example

```yaml
agents:
  defaults:
    promptContributors:
      - id: "security-guidelines"
        tags: [{ dimension: "domain", value: "security" }]
        priority: 50
        content: |
          ## Security Guidelines
          - Never commit secrets or credentials
          - Always validate user input
          - Use parameterized queries for database access
      - id: "frontend-patterns"
        tags: [{ dimension: "domain", value: "frontend" }]
        priority: 60
        content: |
          ## Frontend Patterns
          - Use React hooks, not class components
          - Follow the project's component structure
```

---

## Key Files to Create/Modify

- **New:** `src/agents/prompt-contributors/types.ts` -- `PromptContributor`, `ContributorContext`, `PromptSection` interfaces
- **New:** `src/agents/prompt-contributors/registry.ts` -- `PromptContributorRegistry` class
- **New:** `src/agents/prompt-contributors/builtin/` -- Refactored built-in sections as contributors
- **Modify:** `[src/agents/system-prompt.ts](src/agents/system-prompt.ts)` -- Refactor to use contributor registry
- **Modify:** `[src/sessions/session-auto-label.ts](src/sessions/session-auto-label.ts)` -- Extend to produce `SessionClassification`
- **Modify:** `[src/config/sessions/types.ts](src/config/sessions/types.ts)` -- Add `classification` field to `SessionEntry`
- **Modify:** `[src/config/types.agent-defaults.ts](src/config/types.agent-defaults.ts)` -- Add `promptContributors` config schema
- **New:** `src/agents/tool-sequence-enforcer.ts` -- Hook-based tool prerequisite enforcement (Approach B)
