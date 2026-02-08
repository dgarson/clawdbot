import { describe, expect, it } from "vitest";
import type { WorkerConfig } from "../config/types.agents.js";
import type { WorkItem, WorkItemPayload } from "./types.js";
import {
  buildWorkerSystemPrompt,
  buildWorkerTaskMessage,
  readPayload,
  resolveRuntimeOverrides,
} from "./system-prompt.js";

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "item-1",
    queueId: "q-1",
    title: "Implement retry logic",
    description: "Add exponential backoff to the HTTP client",
    status: "pending",
    priority: "medium",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeConfig(overrides: Partial<WorkerConfig> = {}): WorkerConfig {
  return {
    enabled: true,
    ...overrides,
  };
}

describe("readPayload", () => {
  it("returns empty object when payload is undefined", () => {
    const result = readPayload(makeItem({ payload: undefined }));
    expect(result).toEqual({});
  });

  it("returns typed payload fields", () => {
    const result = readPayload(
      makeItem({
        payload: {
          repo: "dgarson/clawdbrain",
          baseBranch: "develop",
          acceptanceCriteria: ["tests pass"],
        },
      }),
    );
    expect(result.repo).toBe("dgarson/clawdbrain");
    expect(result.baseBranch).toBe("develop");
    expect(result.acceptanceCriteria).toEqual(["tests pass"]);
  });
});

describe("resolveRuntimeOverrides", () => {
  it("uses payload values over config", () => {
    const config = makeConfig({ model: "claude-3", thinking: "low", sessionTimeoutSeconds: 600 });
    const payload: WorkItemPayload = { model: "gpt-4", thinking: "high", timeoutSeconds: 120 };
    const result = resolveRuntimeOverrides(config, payload);
    expect(result.model).toBe("gpt-4");
    expect(result.thinking).toBe("high");
    expect(result.timeoutSeconds).toBe(120);
  });

  it("falls back to config values when payload omits them", () => {
    const config = makeConfig({ model: "claude-3", thinking: "low", sessionTimeoutSeconds: 600 });
    const payload: WorkItemPayload = {};
    const result = resolveRuntimeOverrides(config, payload);
    expect(result.model).toBe("claude-3");
    expect(result.thinking).toBe("low");
    expect(result.timeoutSeconds).toBe(600);
  });

  it("uses default timeout of 300 when neither payload nor config set it", () => {
    const result = resolveRuntimeOverrides(makeConfig(), {});
    expect(result.timeoutSeconds).toBe(300);
  });
});

describe("buildWorkerSystemPrompt", () => {
  it("uses built-in default when no overrides", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem(),
      config: makeConfig(),
    });
    expect(prompt).toContain("You are an autonomous agent processing a work queue item.");
    expect(prompt).toContain("Git Worktree");
    expect(prompt).toContain("Commit & Push Per Phase");
    expect(prompt).toContain("## Work Item");
    expect(prompt).toContain("**Title:** Implement retry logic");
  });

  it("includes tsdown/tsx build semantics guidance in default prompt", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem(),
      config: makeConfig(),
    });
    expect(prompt).toContain("## Build System & Module Semantics");
    expect(prompt).toContain("tsdown");
    expect(prompt).toContain("bun <file.ts>");
    expect(prompt).toContain("dist/");
  });

  it("uses config.defaultSystemPrompt when provided", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem(),
      config: makeConfig({ defaultSystemPrompt: "You are a code review agent." }),
    });
    expect(prompt).toContain("You are a code review agent.");
    expect(prompt).not.toContain("You are an autonomous agent processing a work queue item.");
  });

  it("uses payload.systemPrompt as highest priority override", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: { systemPrompt: "Custom per-item prompt" } as Record<string, unknown>,
      }),
      config: makeConfig({ defaultSystemPrompt: "Agent-level override" }),
    });
    expect(prompt).toContain("Custom per-item prompt");
    expect(prompt).not.toContain("Agent-level override");
    expect(prompt).not.toContain("You are an autonomous agent");
  });

  it("appends systemPromptAppend to the base prompt", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: {
          systemPromptAppend: "Also follow our style guide.",
        } as Record<string, unknown>,
      }),
      config: makeConfig(),
    });
    expect(prompt).toContain("You are an autonomous agent processing a work queue item.");
    expect(prompt).toContain("Also follow our style guide.");
  });

  it("includes git configuration", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: {
          repo: "dgarson/clawdbrain",
          baseBranch: "develop",
          branchName: "feat/retry-logic",
        } as Record<string, unknown>,
      }),
      config: makeConfig(),
    });
    expect(prompt).toContain("## Git Configuration");
    expect(prompt).toContain("**Repository:** dgarson/clawdbrain");
    expect(prompt).toContain("**Base Branch:** develop");
    expect(prompt).toContain("**Branch Name:** feat/retry-logic");
  });

  it("includes acceptance criteria", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: {
          acceptanceCriteria: ["All tests pass", "No regressions in CI"],
        } as Record<string, unknown>,
      }),
      config: makeConfig(),
    });
    expect(prompt).toContain("## Acceptance Criteria");
    expect(prompt).toContain("- All tests pass");
    expect(prompt).toContain("- No regressions in CI");
  });

  it("includes verify commands", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: {
          verifyCommands: ["npm test", "npm run lint"],
        } as Record<string, unknown>,
      }),
      config: makeConfig(),
    });
    expect(prompt).toContain("## Verification Commands");
    expect(prompt).toContain("- `npm test`");
    expect(prompt).toContain("- `npm run lint`");
  });

  it("merges config.defaultVerifyCommands with payload.verifyCommands", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: {
          verifyCommands: ["pnpm test"],
        } as Record<string, unknown>,
      }),
      config: makeConfig({ defaultVerifyCommands: ["pnpm build"] }),
    });
    expect(prompt).toContain("## Verification Commands");
    // Config defaults come first, then per-item
    const buildIdx = prompt.indexOf("- `pnpm build`");
    const testIdx = prompt.indexOf("- `pnpm test`");
    expect(buildIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeGreaterThan(-1);
    expect(buildIdx).toBeLessThan(testIdx);
  });

  it("uses config.defaultVerifyCommands when payload has none", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem(),
      config: makeConfig({ defaultVerifyCommands: ["pnpm build", "pnpm lint"] }),
    });
    expect(prompt).toContain("## Verification Commands");
    expect(prompt).toContain("- `pnpm build`");
    expect(prompt).toContain("- `pnpm lint`");
  });

  it("omits verification section when neither config nor payload has commands", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem(),
      config: makeConfig(),
    });
    expect(prompt).not.toContain("## Verification Commands");
  });

  it("includes relevant files", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: {
          relevantFiles: ["src/http/client.ts", "src/http/retry.ts"],
        } as Record<string, unknown>,
      }),
      config: makeConfig(),
    });
    expect(prompt).toContain("## Relevant Files");
    expect(prompt).toContain("- `src/http/client.ts`");
  });

  it("includes context URLs", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: {
          contextUrls: [
            "https://docs.example.com/retry-patterns",
            "https://github.com/openclaw/clawdbrain/issues/42",
          ],
        } as Record<string, unknown>,
      }),
      config: makeConfig(),
    });
    expect(prompt).toContain("## Context URLs");
    expect(prompt).toContain("- https://docs.example.com/retry-patterns");
    expect(prompt).toContain("- https://github.com/openclaw/clawdbrain/issues/42");
  });

  it("includes multi-phase definition", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: {
          phases: [
            {
              name: "Schema changes",
              description: "Add the retry_count column",
              commitMessage: "feat: add retry_count column",
              verifyCommands: ["npm run migrate"],
            },
            {
              name: "Logic implementation",
              description: "Implement the retry loop",
            },
          ],
        } as Record<string, unknown>,
      }),
      config: makeConfig(),
    });
    expect(prompt).toContain("## Phases");
    expect(prompt).toContain("### Phase 1: Schema changes");
    expect(prompt).toContain("Add the retry_count column");
    expect(prompt).toContain("**Commit message:** feat: add retry_count column");
    expect(prompt).toContain("- `npm run migrate`");
    expect(prompt).toContain("### Phase 2: Logic implementation");
  });

  it("includes task-specific instructions at the end", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: {
          instructions: "Focus on edge cases with HTTP 429 responses.",
        } as Record<string, unknown>,
      }),
      config: makeConfig(),
    });
    expect(prompt).toContain("## Task-Specific Instructions");
    expect(prompt).toContain("Focus on edge cases with HTTP 429 responses.");
    // Instructions should appear after the work item section
    const workItemIdx = prompt.indexOf("## Work Item");
    const instructionsIdx = prompt.indexOf("## Task-Specific Instructions");
    expect(instructionsIdx).toBeGreaterThan(workItemIdx);
  });

  it("puts unknown payload fields in Additional Context", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({
        payload: {
          customField: "hello",
          anotherThing: 42,
          repo: "dgarson/clawdbrain", // known field — should NOT appear in additional context
        } as Record<string, unknown>,
      }),
      config: makeConfig(),
    });
    expect(prompt).toContain("## Additional Context");
    expect(prompt).toContain('"customField": "hello"');
    expect(prompt).toContain('"anotherThing": 42');
    // Known fields should not be duplicated in additional context
    const additionalIdx = prompt.indexOf("## Additional Context");
    const afterAdditional = prompt.slice(additionalIdx);
    expect(afterAdditional).not.toContain('"repo"');
  });

  it("includes carryover context from prior task", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem(),
      config: makeConfig(),
      carryoverContext: {
        summary: "Previously implemented the database schema for retry tracking.",
        extractedAt: new Date().toISOString(),
      },
    });
    expect(prompt).toContain("## Previous Task Context");
    expect(prompt).toContain("Previously implemented the database schema for retry tracking.");
  });

  it("includes workstream and priority in task header", () => {
    const prompt = buildWorkerSystemPrompt({
      item: makeItem({ workstream: "backend-infra", priority: "critical" }),
      config: makeConfig(),
    });
    expect(prompt).toContain("**Workstream:** backend-infra");
    expect(prompt).toContain("**Priority:** critical");
  });
});

describe("buildWorkerTaskMessage", () => {
  it("returns title only when no description or instructions", () => {
    const msg = buildWorkerTaskMessage(makeItem({ description: undefined }));
    expect(msg).toBe("Implement retry logic");
  });

  it("includes description", () => {
    const msg = buildWorkerTaskMessage(makeItem());
    expect(msg).toContain("Implement retry logic");
    expect(msg).toContain("Add exponential backoff to the HTTP client");
  });

  it("includes payload.instructions", () => {
    const msg = buildWorkerTaskMessage(
      makeItem({
        payload: { instructions: "Start with the test file." } as Record<string, unknown>,
      }),
    );
    expect(msg).toContain("Start with the test file.");
  });
});
