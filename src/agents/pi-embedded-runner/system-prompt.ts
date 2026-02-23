import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import type { SessionClassification } from "../../config/sessions/types.js";
import type { PromptContributorConfig } from "../../config/types.agent-defaults.js";
import type { MemoryCitationsMode } from "../../config/types.memory.js";
import type { ResolvedTimeFormat } from "../date-time.js";
import type { EmbeddedContextFile } from "../pi-embedded-helpers.js";
import {
  PromptContributorRegistry,
  getGlobalPromptContributorRegistry,
} from "../prompt-contributors/registry.js";
import type { ContributorTag } from "../prompt-contributors/types.js";
import { buildAgentSystemPrompt, type PromptMode } from "../system-prompt.js";
import { buildToolSummaryMap } from "../tool-summaries.js";
import type { EmbeddedSandboxInfo } from "./types.js";
import type { ReasoningLevel, ThinkLevel } from "./utils.js";

/**
 * Build a PromptContributorRegistry that includes the global registry plus any
 * config-driven contributors from agents.defaults.promptContributors.
 */
function buildContributorRegistry(
  configContributors: PromptContributorConfig[] | undefined,
): PromptContributorRegistry | undefined {
  if (!configContributors || configContributors.length === 0) {
    // No config contributors; let buildAgentSystemPrompt use the global registry directly.
    return undefined;
  }

  const registry = new PromptContributorRegistry();

  // Copy all global registrations first.
  const global = getGlobalPromptContributorRegistry();
  for (const contributor of global.resolve({
    agentId: "",
    availableTools: new Set(),
    promptMode: "full",
    runtime: "pi",
    workspaceDir: "",
  })) {
    registry.register(contributor, "plugin");
  }

  // Add config-driven contributors.
  for (const cfg of configContributors) {
    const tags: ContributorTag[] = (cfg.tags ?? []).map((t) => ({
      dimension: t.dimension as ContributorTag["dimension"],
      value: t.value,
    }));
    registry.register(
      {
        id: cfg.id,
        tags,
        priority: cfg.priority ?? 100,
        contribute: () => ({
          heading: cfg.heading,
          content: cfg.content,
          maxChars: cfg.maxChars,
        }),
      },
      "config",
    );
  }

  return registry;
}

export function buildEmbeddedSystemPrompt(params: {
  workspaceDir: string;
  defaultThinkLevel?: ThinkLevel;
  reasoningLevel?: ReasoningLevel;
  extraSystemPrompt?: string;
  ownerNumbers?: string[];
  ownerDisplay?: "raw" | "hash";
  ownerDisplaySecret?: string;
  reasoningTagHint: boolean;
  heartbeatPrompt?: string;
  skillsPrompt?: string;
  docsPath?: string;
  ttsHint?: string;
  reactionGuidance?: {
    level: "minimal" | "extensive";
    channel: string;
  };
  workspaceNotes?: string[];
  /** Controls which hardcoded sections to include. Defaults to "full". */
  promptMode?: PromptMode;
  /** Session classification from auto-label pass; enables tag-based contributor selection. */
  classification?: SessionClassification;
  /** Config-driven prompt contributors from agents.defaults.promptContributors. */
  configContributors?: PromptContributorConfig[];
  /** Agent runtime to pass to contributors for runtime-specific guidance. */
  agentRuntime?: "pi" | "claude-sdk";
  runtimeInfo: {
    agentId?: string;
    host: string;
    os: string;
    arch: string;
    node: string;
    model: string;
    provider?: string;
    capabilities?: string[];
    channel?: string;
    /** Supported message actions for the current channel (e.g., react, edit, unsend) */
    channelActions?: string[];
  };
  messageToolHints?: string[];
  sandboxInfo?: EmbeddedSandboxInfo;
  tools: AgentTool[];
  modelAliasLines: string[];
  userTimezone: string;
  userTime?: string;
  userTimeFormat?: ResolvedTimeFormat;
  contextFiles?: EmbeddedContextFile[];
  memoryCitationsMode?: MemoryCitationsMode;
}): string {
  return buildAgentSystemPrompt({
    workspaceDir: params.workspaceDir,
    defaultThinkLevel: params.defaultThinkLevel,
    reasoningLevel: params.reasoningLevel,
    extraSystemPrompt: params.extraSystemPrompt,
    ownerNumbers: params.ownerNumbers,
    ownerDisplay: params.ownerDisplay,
    ownerDisplaySecret: params.ownerDisplaySecret,
    reasoningTagHint: params.reasoningTagHint,
    heartbeatPrompt: params.heartbeatPrompt,
    skillsPrompt: params.skillsPrompt,
    docsPath: params.docsPath,
    ttsHint: params.ttsHint,
    workspaceNotes: params.workspaceNotes,
    reactionGuidance: params.reactionGuidance,
    promptMode: params.promptMode,
    runtimeInfo: params.runtimeInfo,
    messageToolHints: params.messageToolHints,
    sandboxInfo: params.sandboxInfo,
    toolNames: params.tools.map((tool) => tool.name),
    toolSummaries: buildToolSummaryMap(params.tools),
    modelAliasLines: params.modelAliasLines,
    userTimezone: params.userTimezone,
    userTime: params.userTime,
    userTimeFormat: params.userTimeFormat,
    contextFiles: params.contextFiles,
    memoryCitationsMode: params.memoryCitationsMode,
    classification: params.classification,
    agentRuntime: params.agentRuntime,
    contributorRegistry: buildContributorRegistry(params.configContributors),
  });
}

export function createSystemPromptOverride(
  systemPrompt: string,
): (defaultPrompt?: string) => string {
  const override = systemPrompt.trim();
  return (_defaultPrompt?: string) => override;
}

export function applySystemPromptOverrideToSession(
  session: AgentSession,
  override: string | ((defaultPrompt?: string) => string),
) {
  const prompt = typeof override === "function" ? override() : override.trim();
  session.agent.setSystemPrompt(prompt);
  const mutableSession = session as unknown as {
    _baseSystemPrompt?: string;
    _rebuildSystemPrompt?: (toolNames: string[]) => string;
  };
  mutableSession._baseSystemPrompt = prompt;
  mutableSession._rebuildSystemPrompt = () => prompt;
}
