import type { WorkerConfig } from "../config/types.agents.js";
import type { WorkItemCarryoverContext } from "./context-extractor.js";
import type { WorkItem, WorkItemPayload } from "./types.js";
import type { WorkstreamNotesStore } from "./workstream-notes.js";

// ---------------------------------------------------------------------------
// Default system prompt — used when neither WorkerConfig.defaultSystemPrompt
// nor payload.systemPrompt is provided.
// ---------------------------------------------------------------------------

const DEFAULT_WORKER_SYSTEM_PROMPT = `You are an autonomous agent processing a work queue item.

## Workflow Requirements

1. **Git Worktree**: Always create a dedicated git worktree for your work. Branch from \`main\` unless the task specifies otherwise.
   - Example: \`git worktree add ../worktree-<branch> -b <branch> main\`
   - Never edit the main checkout directly.
2. **Branching**: Create a descriptive branch name based on the task (e.g., \`feat/add-retry-logic\`, \`fix/null-pointer-in-parser\`).
3. **Commit & Push Per Phase**: For multi-phase tasks, commit and push your work at the end of EACH phase. Never leave uncommitted work.
4. **Build Verification**: Verify your work compiles/builds successfully before marking the task complete.
5. **Final Summary**: Summarize what you accomplished in your final message.

## Build System & Module Semantics

This project uses **tsdown** (esbuild/rolldown-based bundler), NOT tsc.
The \`dist/\` directory contains flat bundled chunks with content hashes (e.g. \`dist/hooks-status-DHvNxjG0.js\`),
NOT a directory tree mirroring \`src/\`. You **cannot** require/import from \`dist/\` using source-relative paths
like \`require('./dist/hooks/hooks-status.js')\` — that file does not exist.

**Rules:**
- To execute TypeScript source directly, use \`bun <file.ts>\` or \`npx tsx <file.ts>\`. Never use \`node -e "require('./dist/...')"\`.
- \`dist/\` is gitignored and will NOT exist in a fresh worktree. Run \`pnpm build\` first if you need built output.
- To verify exports or test module loading, import from source: \`bun -e "import { foo } from './src/bar.ts'; console.log(foo)"\`.
- For runtime verification of the built bundle, run \`pnpm build\` first, then use the entry points defined in \`tsdown.config.ts\` (e.g. \`dist/index.js\`, \`dist/entry.js\`).


## Completion Protocol

- Run any verification commands specified in the task.
- Commit and push all changes.
- Report results clearly, including what was changed and any caveats.`;

/**
 * Read well-known payload fields with type safety.
 * Returns the payload cast to WorkItemPayload, or an empty object.
 */
export function readPayload(item: WorkItem): WorkItemPayload {
  return (item.payload ?? {}) as WorkItemPayload;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

export type BuildSystemPromptOptions = {
  item: WorkItem;
  config: WorkerConfig;
  carryoverContext?: WorkItemCarryoverContext;
  notesStore?: WorkstreamNotesStore;
};

/**
 * Build the system prompt for a worker agent session.
 *
 * Priority chain:
 * 1. `payload.systemPrompt` — full replacement (highest priority)
 * 2. `config.defaultSystemPrompt` — agent-level replacement of built-in default
 * 3. Built-in DEFAULT_WORKER_SYSTEM_PROMPT
 *
 * Then `payload.systemPromptAppend` is appended to whichever base was selected.
 *
 * Task-specific sections (acceptance criteria, phases, git config, context hints,
 * workstream notes, carryover context) are always appended after the base + append.
 */
export function buildWorkerSystemPrompt(opts: BuildSystemPromptOptions): string {
  const { item, config, carryoverContext, notesStore } = opts;
  const payload = readPayload(item);
  const parts: string[] = [];

  // ---- Base system prompt ----
  const basePrompt =
    payload.systemPrompt ?? config.defaultSystemPrompt ?? DEFAULT_WORKER_SYSTEM_PROMPT;
  parts.push(basePrompt);

  // ---- Append supplement ----
  if (payload.systemPromptAppend) {
    parts.push("");
    parts.push(payload.systemPromptAppend);
  }

  // ---- Task header ----
  parts.push("");
  parts.push("## Work Item");
  parts.push(`**Title:** ${item.title}`);
  if (item.description) {
    parts.push(`**Description:** ${item.description}`);
  }
  if (item.workstream) {
    parts.push(`**Workstream:** ${item.workstream}`);
  }
  if (item.priority) {
    parts.push(`**Priority:** ${item.priority}`);
  }

  // ---- Git configuration ----
  if (payload.repo || payload.baseBranch || payload.branchName || payload.branchPrefix) {
    parts.push("");
    parts.push("## Git Configuration");
    if (payload.repo) {
      parts.push(`**Repository:** ${payload.repo}`);
    }
    const base = payload.baseBranch ?? "main";
    parts.push(`**Base Branch:** ${base}`);
    if (payload.branchName) {
      parts.push(`**Branch Name:** ${payload.branchName}`);
    } else if (payload.branchPrefix) {
      parts.push(`**Branch Prefix:** ${payload.branchPrefix} (generate a descriptive suffix)`);
    }
  }

  // ---- Acceptance criteria ----
  if (payload.acceptanceCriteria && payload.acceptanceCriteria.length > 0) {
    parts.push("");
    parts.push("## Acceptance Criteria");
    for (const criterion of payload.acceptanceCriteria) {
      parts.push(`- ${criterion}`);
    }
  }

  // ---- Verify commands (config defaults + per-item) ----
  const mergedVerifyCommands = [
    ...(config.defaultVerifyCommands ?? []),
    ...(payload.verifyCommands ?? []),
  ];
  if (mergedVerifyCommands.length > 0) {
    parts.push("");
    parts.push("## Verification Commands");
    parts.push("Run these commands to verify your work before completing:");
    for (const cmd of mergedVerifyCommands) {
      parts.push(`- \`${cmd}\``);
    }
  }

  // ---- Relevant files ----
  if (payload.relevantFiles && payload.relevantFiles.length > 0) {
    parts.push("");
    parts.push("## Relevant Files");
    parts.push("Start by examining these files:");
    for (const file of payload.relevantFiles) {
      parts.push(`- \`${file}\``);
    }
  }

  // ---- Context URLs ----
  if (payload.contextUrls && payload.contextUrls.length > 0) {
    parts.push("");
    parts.push("## Context URLs");
    parts.push("Fetch and review these URLs for background context:");
    for (const url of payload.contextUrls) {
      parts.push(`- ${url}`);
    }
  }

  // ---- Multi-phase definition ----
  if (payload.phases && payload.phases.length > 0) {
    parts.push("");
    parts.push("## Phases");
    parts.push(
      "This is a multi-phase task. Complete each phase in order, committing and pushing at the end of each phase.",
    );
    for (let i = 0; i < payload.phases.length; i++) {
      const phase = payload.phases[i];
      parts.push("");
      parts.push(`### Phase ${i + 1}: ${phase.name}`);
      parts.push(phase.description);
      if (phase.commitMessage) {
        parts.push(`**Commit message:** ${phase.commitMessage}`);
      }
      if (phase.verifyCommands && phase.verifyCommands.length > 0) {
        parts.push("**Verify:**");
        for (const cmd of phase.verifyCommands) {
          parts.push(`- \`${cmd}\``);
        }
      }
    }
  }

  // ---- Non-well-known payload fields ----
  const knownKeys = new Set([
    "systemPrompt",
    "systemPromptAppend",
    "instructions",
    "repo",
    "baseBranch",
    "branchPrefix",
    "branchName",
    "model",
    "thinking",
    "timeoutSeconds",
    "acceptanceCriteria",
    "verifyCommands",
    "relevantFiles",
    "contextUrls",
    "refs",
    "phases",
    "notifyOnComplete",
  ]);
  const extraPayload: Record<string, unknown> = {};
  if (item.payload) {
    for (const [key, value] of Object.entries(item.payload)) {
      if (!knownKeys.has(key)) {
        extraPayload[key] = value;
      }
    }
  }
  if (Object.keys(extraPayload).length > 0) {
    parts.push("");
    parts.push("## Additional Context");
    parts.push(`\`\`\`json\n${JSON.stringify(extraPayload, null, 2)}\n\`\`\``);
  }

  // ---- Workstream notes ----
  if (item.workstream && notesStore) {
    try {
      const notes = notesStore.list(item.workstream, { limit: 10 });
      if (notes.length > 0) {
        const notesSummary = notesStore.summarize(notes, { maxChars: 2000 });
        if (notesSummary) {
          parts.push("");
          parts.push(notesSummary);
        }
      }
    } catch {
      // Notes injection is best-effort.
    }
  }

  // ---- Carryover context from prior task ----
  if (carryoverContext?.summary) {
    parts.push("");
    parts.push("## Previous Task Context");
    parts.push(carryoverContext.summary);
  }

  // ---- Task-specific instructions (appended last for prominence) ----
  if (payload.instructions) {
    parts.push("");
    parts.push("## Task-Specific Instructions");
    parts.push(payload.instructions);
  }

  return parts.join("\n");
}

/**
 * Build the task message sent to the agent session.
 * Includes the item title, description, and any payload.instructions.
 */
export function buildWorkerTaskMessage(item: WorkItem): string {
  const payload = readPayload(item);
  const messageParts: string[] = [item.title];

  if (item.description) {
    messageParts.push("", item.description);
  }

  if (payload.instructions) {
    messageParts.push("", payload.instructions);
  }

  return messageParts.join("\n");
}

/**
 * Resolve model/thinking/timeout from payload overrides → WorkerConfig fallbacks.
 */
export function resolveRuntimeOverrides(
  config: WorkerConfig,
  payload: WorkItemPayload,
): {
  model: string | undefined;
  thinking: string | undefined;
  timeoutSeconds: number;
} {
  return {
    model: payload.model ?? config.model ?? undefined,
    thinking: payload.thinking ?? config.thinking ?? undefined,
    timeoutSeconds: payload.timeoutSeconds ?? config.sessionTimeoutSeconds ?? 300,
  };
}
