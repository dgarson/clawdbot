import type { AgentDefaultsConfig, AgentRuntimeKind } from "./types.agent-defaults.js";
import type { HumanDelayConfig, IdentityConfig } from "./types.base.js";
import type { GroupChatConfig } from "./types.messages.js";
import type {
  SandboxBrowserSettings,
  SandboxDockerSettings,
  SandboxPruneSettings,
} from "./types.sandbox.js";
import type { AgentToolsConfig, MemorySearchConfig } from "./types.tools.js";

export type AgentModelConfig =
  | string
  | {
      /** Primary model (provider/model). */
      primary?: string;
      /** Per-agent model fallbacks (provider/model). */
      fallbacks?: string[];
    };

/** Model tier configuration for Claude Code SDK. */
export type CcSdkModelTiers = {
  /** Model for fast/simple tasks (maps to ANTHROPIC_DEFAULT_HAIKU_MODEL). */
  haiku?: string;
  /** Model for balanced tasks (maps to ANTHROPIC_DEFAULT_SONNET_MODEL). */
  sonnet?: string;
  /** Model for complex reasoning (maps to ANTHROPIC_DEFAULT_OPUS_MODEL). */
  opus?: string;
};

/** Claude Code SDK runtime configuration. */
export type AgentCcSdkConfig = {
  /** Enable Claude Code lifecycle hooks (pre-tool, post-tool, etc.). */
  hooksEnabled?: boolean;
  /** Additional SDK options passed to the runner. */
  options?: Record<string, unknown>;
  /** 3-tier model configuration for Claude Code SDK. */
  models?: CcSdkModelTiers;
};

export type AgentConfig = {
  id: string;
  default?: boolean;
  name?: string;
  /** Agent runtime backend (pi or ccsdk). Overrides agents.defaults.runtime. */
  runtime?: AgentRuntimeKind;
  /** Claude Code SDK configuration when runtime is "ccsdk". */
  ccsdk?: AgentCcSdkConfig;
  workspace?: string;
  agentDir?: string;
  model?: AgentModelConfig;
  memorySearch?: MemorySearchConfig;
  /** Human-like delay between block replies for this agent. */
  humanDelay?: HumanDelayConfig;
  /** Optional per-agent heartbeat overrides. */
  heartbeat?: AgentDefaultsConfig["heartbeat"];
  identity?: IdentityConfig;
  groupChat?: GroupChatConfig;
  subagents?: {
    /** Allow spawning sub-agents under other agent ids. Use "*" to allow any. */
    allowAgents?: string[];
    /** Per-agent default model for spawned sub-agents (string or {primary,fallbacks}). */
    model?: string | { primary?: string; fallbacks?: string[] };
  };
  sandbox?: {
    mode?: "off" | "non-main" | "all";
    /** Agent workspace access inside the sandbox. */
    workspaceAccess?: "none" | "ro" | "rw";
    /**
     * Session tools visibility for sandboxed sessions.
     * - "spawned": only allow session tools to target sessions spawned from this session (default)
     * - "all": allow session tools to target any session
     */
    sessionToolsVisibility?: "spawned" | "all";
    /** Container/workspace scope for sandbox isolation. */
    scope?: "session" | "agent" | "shared";
    /** Legacy alias for scope ("session" when true, "shared" when false). */
    perSession?: boolean;
    workspaceRoot?: string;
    /** Docker-specific sandbox overrides for this agent. */
    docker?: SandboxDockerSettings;
    /** Optional sandboxed browser overrides for this agent. */
    browser?: SandboxBrowserSettings;
    /** Auto-prune overrides for this agent. */
    prune?: SandboxPruneSettings;
  };
  tools?: AgentToolsConfig;
};

export type AgentsConfig = {
  defaults?: AgentDefaultsConfig;
  list?: AgentConfig[];
};

export type AgentBinding = {
  agentId: string;
  match: {
    channel: string;
    accountId?: string;
    peer?: { kind: "dm" | "group" | "channel"; id: string };
    guildId?: string;
    teamId?: string;
  };
};
