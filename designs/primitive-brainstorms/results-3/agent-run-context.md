# Agent run context primitive

## Summary

Agent execution is currently built through multiple call sites that each reassemble model selection, workspace setup, skill snapshotting, and delivery behavior. A reusable agent run context primitive would consolidate this logic into a single builder that can be shared by cron, CLI, and channel initiated runs, reducing duplication and drift.

## Current state and primitives in use

- Cron isolated runs build a large agent context inline, including agent resolution, workspace creation, model catalog loading, hook specific model overrides, and delivery behavior. The logic in `runCronIsolatedAgentTurn` handles config overrides, workspace bootstrapping, model selection, and message delivery.
- Skills are loaded from multiple sources with precedence (extra, bundled, managed, workspace) and then filtered by eligibility. This is another required step for most run entry points.

These primitives work, but the logic is spread across multiple files and has to be re-assembled for each entry point that runs the agent.

## Pain points and complexity

1. **Duplicated run setup logic across entry points.** Cron isolated runs, CLI runs, and messaging entry points each reconstruct similar flows for workspace, model selection, and skill snapshots. This causes maintenance drift and inconsistent behavior over time.
2. **Skills pipeline requires careful ordering.** Skill loading has explicit precedence and eligibility filters. Re-using this logic outside the skills module is error prone.
3. **Model selection behavior is tightly intertwined with run setup.** The cron run path directly handles model fallback and catalog loading alongside run logic, which makes it hard to reuse elsewhere.

## Proposed primitive

### Agent run context builder

Introduce a new `AgentRunContext` primitive that encapsulates the full run setup process. The builder would:

- Resolve agent config overrides and derive the final agent profile.
- Resolve workspace and bootstrap files, with configurable `skipBootstrap` behavior.
- Build the skills snapshot and eligibility map.
- Resolve model selection and fallbacks in a single, testable path.
- Provide a structured object for downstream components to use (messaging, hooks, tool policies, and delivery configuration).

### Example API

```ts
const ctx = await buildAgentRunContext({
  cfg,
  agentId,
  sessionKey,
  workspaceDirOverride,
  requestedModel,
  allowSkills: true,
});

await runAgentTurn({ ctx, message, delivery });
```

## Integration plan

### Phase 1: Introduce the builder

1. Create a new `buildAgentRunContext` helper under `src/agents/` that consolidates:
   - Agent config resolution.
   - Workspace resolution and bootstrap file prep.
   - Skills snapshot building.
   - Model selection and fallback setup.
2. Provide a stable `AgentRunContext` type used by the CLI runner and cron runner.

### Phase 2: Migrate cron isolated runs

1. Refactor `runCronIsolatedAgentTurn` to build the run context through the new helper and remove duplicated logic in the cron module.
2. Ensure delivery behavior (announce vs none) continues to use the same config, with a clearer separation between context build and delivery.

### Phase 3: Migrate CLI and channel entry points

1. Use the same context builder for CLI driven runs so model selection and workspace creation remain consistent.
2. Expose the builder for channel adapters that invoke agent turns, ensuring consistent skills and model handling.

## Expected impact

- Consistent run setup across cron, CLI, and channel contexts.
- Easier testing of model selection and skills resolution without duplicating logic.
- Reduced risk of drift between run entry points.
