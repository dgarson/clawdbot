# Micro-Model: Lightweight LLM Operations

> **Status**: Implemented (commit 40dcc51bd)
> **Source**: `src/agents/micro-model.ts`
> **Tests**: `src/agents/micro-model.test.ts`

## Overview

The Micro-Model system provides configurable, cost-efficient model selection for lightweight LLM utility calls. Instead of always using the primary (expensive) model for background operations like slug generation or session descriptions, this system automatically selects the cheapest available model through a multi-level fallback chain.

## Problem

Many agent operations require small LLM calls that don't need the full power of the primary model:

- Generating URL-safe slugs for sessions
- Writing session descriptions
- Evaluating memory search quality (feedback)
- Pre-compaction memory flush summaries

Using `claude-opus-4` or `gpt-4o` for these tasks wastes tokens and budget. The micro-model system solves this by routing these calls to lightweight models like `gpt-4.1-nano`, `claude-haiku`, or other small models.

## Resolution Chain

`resolveUtilityModelRef` implements a 4-level fallback chain:

```
┌─────────────────────────────────────────────┐
│ 1. Per-feature config                       │
│    agents.defaults.utility.<feature>.model   │
│    e.g., utility.slugGenerator.model         │
├─────────────────────────────────────────────┤
│ 2. Global utilityModel                      │
│    agents.defaults.utilityModel              │
│    e.g., "openai/gpt-4.1-nano"             │
├─────────────────────────────────────────────┤
│ 3. Micro-auto scoring                       │
│    Cheapest available model from catalog     │
│    Scored by name heuristics                 │
├─────────────────────────────────────────────┤
│ 4. Primary model (last resort)              │
│    resolveDefaultModelForAgent               │
│    The agent's main model                    │
└─────────────────────────────────────────────┘
```

Each level is tried in order. The first one that resolves to a valid, configured model is used.

## Micro-Auto Scoring

When no explicit configuration is provided, the system automatically scores models from the catalog by how lightweight/cheap they are:

| Pattern               | Score | Examples                                |
| --------------------- | ----- | --------------------------------------- |
| `gpt-4.1-nano`        | +250  | Highest priority — dedicated nano model |
| `nano`                | +180  | Any nano-class model                    |
| `mini`                | +120  | GPT-4o-mini, etc.                       |
| `haiku`               | +110  | Claude Haiku                            |
| `small`               | +70   | Small model variants                    |
| `fast`/`lite`/`turbo` | +40   | Speed-optimized models                  |
| `o1`/`opus`/`sonnet`  | -80   | Expensive reasoning models (penalized)  |
| `pro`                 | -20   | Pro-tier models (slightly penalized)    |

Only models with a positive score AND working authentication are considered. The highest-scoring model is selected.

```typescript
// Examples:
scoreMicroModelId("gpt-4.1-nano"); // 250 + 180 = 430
scoreMicroModelId("claude-3-haiku"); // 110
scoreMicroModelId("gpt-4o-mini"); // 120
scoreMicroModelId("claude-sonnet-4"); // -80 (excluded — negative)
```

## Feature Keys

Four utility features can be independently configured:

| Feature Key          | Description                      | Used By                                       |
| -------------------- | -------------------------------- | --------------------------------------------- |
| `slugGenerator`      | URL-safe slug generation         | `src/hooks/llm-slug-generator.ts`             |
| `sessionDescription` | Session summary generation       | `src/sessions/session-description.ts`         |
| `memoryFeedback`     | Memory search quality evaluation | `src/memory/feedback/`                        |
| `memoryFlush`        | Pre-compaction memory summaries  | `src/auto-reply/reply/agent-runner-memory.ts` |

## Configuration

### Global Utility Model

Set a single lightweight model for all utility operations:

```yaml
agents:
  defaults:
    utilityModel: "openai/gpt-4.1-nano"
```

### Per-Feature Overrides

Override the model for specific features:

```yaml
agents:
  defaults:
    utilityModel: "openai/gpt-4.1-nano" # default for all utility calls
    utility:
      slugGenerator:
        model: "openai/gpt-4.1-nano" # cheapest for simple slugs
      sessionDescription:
        model: "anthropic/claude-3-haiku" # slightly better for descriptions
      memoryFeedback:
        model: "anthropic/claude-3-haiku"
      memoryFlush:
        model: "anthropic/claude-3-haiku" # needs more capability
```

### No Configuration (Auto-Detection)

If no utility model is configured, the system automatically selects the cheapest available model from your model catalog. If no cheap model is available, it falls back to the primary model.

## Usage in Code

```typescript
import { resolveUtilityModelRef } from "../agents/micro-model.js";

// Resolve a model for a specific feature
const modelRef = await resolveUtilityModelRef({
  cfg: config,
  feature: "slugGenerator",
  agentId: "main",
});

// modelRef = { provider: "openai", model: "gpt-4.1-nano" }
```

### Helper: Config String Resolution

```typescript
import { resolveModelRefFromConfigString } from "../agents/micro-model.js";

// Resolve a provider/model string or alias
const ref = resolveModelRefFromConfigString(config, "openai/gpt-4.1-nano");
// ref = { provider: "openai", model: "gpt-4.1-nano" }

// Also works with aliases defined in agents.defaults.models
const ref2 = resolveModelRefFromConfigString(config, "nano");
// ref2 = { provider: "openai", model: "gpt-4.1-nano" } (if aliased)
```

## Callers

Current callers of `resolveUtilityModelRef`:

- **Slug Generator Hook** (`src/hooks/llm-slug-generator.ts`): Generates URL-safe slugs for session channels
- **Session Description** (`src/sessions/session-description.ts`): Creates human-readable session summaries
- **Memory Flush** (`src/auto-reply/reply/agent-runner-memory.ts`): Pre-compaction memory summarization
- **Pi Embedded Runner** (`src/agents/pi-embedded-runner/run.ts`): Utility model resolution for embedded runs

## Cost Impact

For a typical session with 50 utility calls:

| Strategy                           | Estimated Cost |
| ---------------------------------- | -------------- |
| Primary model (claude-opus-4)      | ~$2.50         |
| Global utilityModel (gpt-4.1-nano) | ~$0.02         |
| Auto-scored (haiku)                | ~$0.05         |

**Savings: 95-99%** on utility operations.

## Related Documentation

- [Execution Layer](./execution-layer.md) — Where model resolution feeds into runtime context
- [Model Selection](./model-providers.md) — How models are resolved and aliased
