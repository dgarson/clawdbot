import { html, nothing } from "lit";
import { icons } from "../icons.ts";
import type {
  ToolPolicyPreset,
  ToolPolicyPresetAssignments,
  ToolPolicyPresetInput,
} from "../tool-policy-presets.ts";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentsListResult,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
  SkillStatusReport,
} from "../types.ts";
import { renderAgentConfigDetail } from "./agents-config-detail.ts";
import { renderAgentNetwork } from "./agents-network.ts";
import {
  renderAgentFiles,
  renderAgentChannels,
  renderAgentCron,
} from "./agents-panels-status-files.ts";
import { renderAgentTools, renderAgentSkills } from "./agents-panels-tools-skills.ts";
import {
  buildAgentContext,
  buildModelOptions,
  normalizeAgentLabel,
  normalizeModelValue,
  parseFallbackList,
  resolveAgentConfig,
  resolveAgentEmoji,
  resolveModelFallbacks,
  resolveModelLabel,
  resolveModelPrimary,
} from "./agents-utils.ts";

export type AgentsPanel =
  | "dashboard"
  | "overview"
  | "files"
  | "tools"
  | "skills"
  | "channels"
  | "cron"
  | "network";

export type AgentsProps = {
  loading: boolean;
  error: string | null;
  agentsList: AgentsListResult | null;
  selectedAgentId: string | null;
  activePanel: AgentsPanel;
  filterQuery: string;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  channelsLoading: boolean;
  channelsError: string | null;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsLastSuccess: number | null;
  cronLoading: boolean;
  cronStatus: CronStatus | null;
  cronJobs: CronJob[];
  cronError: string | null;
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFilesList: AgentsFilesListResult | null;
  agentFileActive: string | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileSaving: boolean;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  agentIdentityById: Record<string, AgentIdentityResult>;
  agentSkillsLoading: boolean;
  agentSkillsReport: SkillStatusReport | null;
  agentSkillsError: string | null;
  agentSkillsAgentId: string | null;
  skillsFilter: string;
  onRefresh: () => void;
  onSelectAgent: (agentId: string) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
  onToolsProfileChange: (agentId: string, profile: string | null, clearAllow: boolean) => void;
  onToolsOverridesChange: (agentId: string, alsoAllow: string[], deny: string[]) => void;
  onToolsPolicyReplace: (
    agentId: string,
    profile: string | null,
    alsoAllow: string[],
    deny: string[],
  ) => void;
  toolPolicyPresets: ToolPolicyPreset[];
  toolPolicyPresetAssignments: ToolPolicyPresetAssignments;
  onToolPolicyPresetCreate: (input: ToolPolicyPresetInput) => void;
  onToolPolicyPresetUpdate: (id: string, input: ToolPolicyPresetInput) => void;
  onToolPolicyPresetDuplicate: (id: string) => void;
  onToolPolicyPresetDelete: (id: string) => void;
  onToolPolicyPresetAssignAgent: (agentId: string, presetId: string | null) => void;
  onToolPolicyPresetAssignProvider: (providerKey: string, presetId: string | null) => void;
  onToolPolicyPresetBulkAssignAgents: (agentIds: string[], presetId: string | null) => void;
  onToolPolicyPresetBulkAssignProviders: (providerKeys: string[], presetId: string | null) => void;
  onGlobalProviderPolicyChange: (
    providerKey: string,
    profile: string | null,
    alsoAllow: string[],
    deny: string[],
  ) => void;
  onAgentProviderPolicyChange: (
    agentId: string,
    providerKey: string,
    profile: string | null,
    alsoAllow: string[],
    deny: string[],
  ) => void;
  onAgentToAgentPolicyChange: (enabled: boolean, allow: string[]) => void;
  onSubagentPolicyChange: (allow: string[], deny: string[]) => void;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
  onChannelsRefresh: () => void;
  onCronRefresh: () => void;
  onSkillsFilterChange: (next: string) => void;
  onSkillsRefresh: () => void;
  onAgentSkillToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  onAgentSkillsClear: (agentId: string) => void;
  onAgentSkillsDisableAll: (agentId: string) => void;
  onAgentsOnboardingStart: () => void;
  onDeleteAgent: (agentId: string) => void;
  onFilterChange: (query: string) => void;
};

export type AgentContext = {
  workspace: string;
  model: string;
  identityName: string;
  identityEmoji: string;
  skillsLabel: string;
  isDefault: boolean;
};

export function renderAgents(props: AgentsProps) {
  const rawAgents = props.agentsList?.agents ?? [];
  const query = (props.filterQuery ?? "").trim().toLowerCase();
  const agents =
    query.length > 0
      ? rawAgents.filter(
          (a) =>
            a.id.toLowerCase().includes(query) ||
            (a.name && a.name.toLowerCase().includes(query)) ||
            normalizeAgentLabel(a).toLowerCase().includes(query),
        )
      : rawAgents;

  const defaultId = props.agentsList?.defaultId ?? null;
  const selectedId = props.selectedAgentId ?? defaultId ?? agents[0]?.id ?? null;
  const selectedAgent = selectedId
    ? (rawAgents.find((agent) => agent.id === selectedId) ?? null)
    : null;
  const selectedContext = selectedAgent
    ? buildAgentContext(
        selectedAgent,
        props.configForm,
        props.agentFilesList,
        defaultId,
        props.agentIdentityById[selectedAgent.id] ?? null,
      )
    : null;

  return html`
    <div class="agents-layout-revamped">
      <aside class="agents-sidebar-v2">
        <div class="sidebar-header">
          <div class="sidebar-title-row">
            <h3>Agents</h3>
            <div class="sidebar-actions">
              <button class="btn btn--icon btn--sm" title="Add Agent" @click=${props.onAgentsOnboardingStart}>
                ${icons.plus}
              </button>
              <button 
                class="btn btn--icon btn--sm" 
                title="Delete Selected Agent"
                ?disabled=${!selectedId || selectedId === defaultId}
                @click=${() => selectedId && props.onDeleteAgent(selectedId)}
              >
                ${icons.minus}
              </button>
            </div>
          </div>
          <div class="sidebar-search">
            <input 
              type="text" 
              placeholder="Filter agents..." 
              class="search-input" 
              .value=${props.filterQuery}
              @input=${(e: Event) => props.onFilterChange((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>

        <div class="agent-list-v2">
          ${agents.map((agent) => {
            const isActive = selectedId === agent.id;
            const emoji = resolveAgentEmoji(agent, props.agentIdentityById[agent.id] ?? null);
            return html`
              <button
                class="agent-item-v2 ${isActive ? "active" : ""}"
                @click=${() => props.onSelectAgent(agent.id)}
              >
                <span class="agent-emoji">${emoji || "🦞"}</span>
                <span class="agent-name">${normalizeAgentLabel(agent)}</span>
                ${
                  agent.id === defaultId
                    ? html`
                        <span class="default-pill">Default</span>
                      `
                    : nothing
                }
              </button>
            `;
          })}
        </div>

        <div class="sidebar-footer">
          <button class="btn btn--block" @click=${props.onRefresh}>
            ${props.loading ? "Refreshing..." : "Refresh List"}
          </button>
        </div>
      </aside>

      <main class="agents-content-v2">
        <header class="content-top-bar">
          <div class="breadcrumb">
            <span class="muted">Agents</span>
            <span class="separator">/</span>
            <span>${selectedAgent ? normalizeAgentLabel(selectedAgent) : "Select an Agent"}</span>
          </div>
          <button class="btn primary" @click=${props.onAgentsOnboardingStart}>
            Create New Agent
          </button>
        </header>

        <div class="content-body">
          ${
            !selectedAgent
              ? html`
                  <div class="empty-state">Select an agent from the list to view and edit its configuration.</div>
                `
              : html`
                <div class="agent-tabs-v2">
                  <button class="tab-item ${props.activePanel === "dashboard" ? "active" : ""}" @click=${() => props.onSelectPanel("dashboard")}>Dashboard</button>
                  <button class="tab-item ${props.activePanel === "overview" ? "active" : ""}" @click=${() => props.onSelectPanel("overview")}>Overview</button>
                  <button class="tab-item ${props.activePanel === "files" ? "active" : ""}" @click=${() => props.onSelectPanel("files")}>Files</button>
                  <button class="tab-item ${props.activePanel === "tools" ? "active" : ""}" @click=${() => props.onSelectPanel("tools")}>Tools</button>
                  <button class="tab-item ${props.activePanel === "skills" ? "active" : ""}" @click=${() => props.onSelectPanel("skills")}>Skills</button>
                  <button class="tab-item ${props.activePanel === "network" ? "active" : ""}" @click=${() => props.onSelectPanel("network")}>Network</button>
                  <button class="tab-item ${props.activePanel === "channels" ? "active" : ""}" @click=${() => props.onSelectPanel("channels")}>Channels</button>
                  <button class="tab-item ${props.activePanel === "cron" ? "active" : ""}" @click=${() => props.onSelectPanel("cron")}>Cron</button>
                </div>

                <div class="tab-content-v2">
                  ${props.activePanel === "dashboard" ? renderAgentConfigDetail(props, selectedAgent.id) : nothing}
                  ${
                    props.activePanel === "overview"
                      ? renderAgentOverview({
                          agent: selectedAgent,
                          defaultId,
                          configForm: props.configForm,
                          agentFilesList: props.agentFilesList,
                          agentIdentity: props.agentIdentityById[selectedAgent.id] ?? null,
                          agentIdentityError: props.agentIdentityError,
                          agentIdentityLoading: props.agentIdentityLoading,
                          configLoading: props.configLoading,
                          configSaving: props.configSaving,
                          configDirty: props.configDirty,
                          onConfigReload: props.onConfigReload,
                          onConfigSave: props.onConfigSave,
                          onModelChange: props.onModelChange,
                          onModelFallbacksChange: props.onModelFallbacksChange,
                        })
                      : nothing
                  }
                  ${
                    props.activePanel === "files"
                      ? renderAgentFiles({
                          agentId: selectedAgent.id,
                          agentFilesList: props.agentFilesList,
                          agentFilesLoading: props.agentFilesLoading,
                          agentFilesError: props.agentFilesError,
                          agentFileActive: props.agentFileActive,
                          agentFileContents: props.agentFileContents,
                          agentFileDrafts: props.agentFileDrafts,
                          agentFileSaving: props.agentFileSaving,
                          onLoadFiles: props.onLoadFiles,
                          onSelectFile: props.onSelectFile,
                          onFileDraftChange: props.onFileDraftChange,
                          onFileReset: props.onFileReset,
                          onFileSave: props.onFileSave,
                        })
                      : nothing
                  }
                  ${
                    props.activePanel === "tools"
                      ? renderAgentTools({
                          agentId: selectedAgent.id,
                          allAgentIds: agents.map((agent) => agent.id),
                          configForm: props.configForm,
                          configLoading: props.configLoading,
                          configSaving: props.configSaving,
                          configDirty: props.configDirty,
                          presets: props.toolPolicyPresets,
                          assignments: props.toolPolicyPresetAssignments,
                          onProfileChange: props.onToolsProfileChange,
                          onOverridesChange: props.onToolsOverridesChange,
                          onPolicyReplace: props.onToolsPolicyReplace,
                          onPresetCreate: props.onToolPolicyPresetCreate,
                          onPresetUpdate: props.onToolPolicyPresetUpdate,
                          onPresetDuplicate: props.onToolPolicyPresetDuplicate,
                          onPresetDelete: props.onToolPolicyPresetDelete,
                          onPresetAssignAgent: props.onToolPolicyPresetAssignAgent,
                          onPresetAssignProvider: props.onToolPolicyPresetAssignProvider,
                          onPresetBulkAssignAgents: props.onToolPolicyPresetBulkAssignAgents,
                          onPresetBulkAssignProviders: props.onToolPolicyPresetBulkAssignProviders,
                          onGlobalProviderPolicyChange: props.onGlobalProviderPolicyChange,
                          onAgentProviderPolicyChange: props.onAgentProviderPolicyChange,
                          onAgentToAgentPolicyChange: props.onAgentToAgentPolicyChange,
                          onSubagentPolicyChange: props.onSubagentPolicyChange,
                          onConfigReload: props.onConfigReload,
                          onConfigSave: props.onConfigSave,
                        })
                      : nothing
                  }
                  ${
                    props.activePanel === "skills"
                      ? renderAgentSkills({
                          agentId: selectedAgent.id,
                          report: props.agentSkillsReport,
                          loading: props.agentSkillsLoading,
                          error: props.agentSkillsError,
                          activeAgentId: props.agentSkillsAgentId,
                          configForm: props.configForm,
                          configLoading: props.configLoading,
                          configSaving: props.configSaving,
                          configDirty: props.configDirty,
                          filter: props.skillsFilter,
                          onFilterChange: props.onSkillsFilterChange,
                          onRefresh: props.onSkillsRefresh,
                          onToggle: props.onAgentSkillToggle,
                          onClear: props.onAgentSkillsClear,
                          onDisableAll: props.onAgentSkillsDisableAll,
                          onConfigReload: props.onConfigReload,
                          onConfigSave: props.onConfigSave,
                        })
                      : nothing
                  }
                  ${
                    props.activePanel === "network"
                      ? renderAgentNetwork({
                          agentId: selectedAgent.id,
                          configForm: props.configForm,
                          configLoading: props.configLoading,
                          onConfigSave: props.onConfigSave,
                          onToolsOverridesChange: props.onToolsOverridesChange,
                          onToolsProfileChange: props.onToolsProfileChange,
                          onSelectPanel: props.onSelectPanel,
                        })
                      : nothing
                  }
                  ${
                    props.activePanel === "channels" && selectedContext
                      ? renderAgentChannels({
                          context: selectedContext,
                          configForm: props.configForm,
                          snapshot: props.channelsSnapshot,
                          loading: props.channelsLoading,
                          error: props.channelsError,
                          lastSuccess: props.channelsLastSuccess,
                          onRefresh: props.onChannelsRefresh,
                        })
                      : nothing
                  }
                  ${
                    props.activePanel === "cron" && selectedContext
                      ? renderAgentCron({
                          context: selectedContext,
                          agentId: selectedAgent.id,
                          jobs: props.cronJobs,
                          status: props.cronStatus,
                          loading: props.cronLoading,
                          error: props.cronError,
                          onRefresh: props.onCronRefresh,
                        })
                      : nothing
                  }
                </div>
              `
          }
        </div>
      </main>
    </div>
  `;
}

function renderAgentOverview(params: {
  agent: AgentsListResult["agents"][number];
  defaultId: string | null;
  configForm: Record<string, unknown> | null;
  agentFilesList: AgentsFilesListResult | null;
  agentIdentity: AgentIdentityResult | null;
  agentIdentityLoading: boolean;
  agentIdentityError: string | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  onConfigReload: () => void;
  onConfigSave: () => void;
  onModelChange: (agentId: string, modelId: string | null) => void;
  onModelFallbacksChange: (agentId: string, fallbacks: string[]) => void;
}) {
  const {
    agent,
    configForm,
    agentFilesList,
    agentIdentity,
    agentIdentityLoading,
    agentIdentityError,
    configLoading,
    configSaving,
    configDirty,
    onConfigReload,
    onConfigSave,
    onModelChange,
    onModelFallbacksChange,
  } = params;
  const config = resolveAgentConfig(configForm, agent.id);
  const workspaceFromFiles =
    agentFilesList && agentFilesList.agentId === agent.id ? agentFilesList.workspace : null;
  const workspace =
    workspaceFromFiles || config.entry?.workspace || config.defaults?.workspace || "default";
  const model = config.entry?.model
    ? resolveModelLabel(config.entry?.model)
    : resolveModelLabel(config.defaults?.model);
  const defaultModel = resolveModelLabel(config.defaults?.model);
  const modelPrimary =
    resolveModelPrimary(config.entry?.model) || (model !== "-" ? normalizeModelValue(model) : null);
  const defaultPrimary =
    resolveModelPrimary(config.defaults?.model) ||
    (defaultModel !== "-" ? normalizeModelValue(defaultModel) : null);
  const effectivePrimary = modelPrimary ?? defaultPrimary ?? null;
  const modelFallbacks = resolveModelFallbacks(config.entry?.model);
  const fallbackText = modelFallbacks ? modelFallbacks.join(", ") : "";
  const identityName =
    agentIdentity?.name?.trim() ||
    agent.identity?.name?.trim() ||
    agent.name?.trim() ||
    config.entry?.name ||
    "-";
  const resolvedEmoji = resolveAgentEmoji(agent, agentIdentity);
  const identityEmoji = resolvedEmoji || "-";
  const skillFilter = Array.isArray(config.entry?.skills) ? config.entry?.skills : null;
  const skillCount = skillFilter?.length ?? null;
  const identityStatus = agentIdentityLoading
    ? "Loading…"
    : agentIdentityError
      ? "Unavailable"
      : "";
  const isDefault = Boolean(params.defaultId && agent.id === params.defaultId);

  return html`
    <section class="card">
      <div class="card-title">Overview</div>
      <div class="card-sub">Workspace paths and identity metadata.</div>
      <div class="agents-overview-grid" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">Workspace</div>
          <div class="mono">${workspace}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Primary Model</div>
          <div class="mono">${model}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Identity Name</div>
          <div>${identityName}</div>
          ${identityStatus ? html`<div class="agent-kv-sub muted">${identityStatus}</div>` : nothing}
        </div>
        <div class="agent-kv">
          <div class="label">Default</div>
          <div>${isDefault ? "yes" : "no"}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Identity Emoji</div>
          <div>${identityEmoji}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Skills Filter</div>
          <div>${skillFilter ? `${skillCount} selected` : "all skills"}</div>
        </div>
      </div>

      <div class="agent-model-select" style="margin-top: 20px;">
        <div class="label">Model Selection</div>
        <div class="row" style="gap: 12px; flex-wrap: wrap;">
          <label class="field" style="min-width: 260px; flex: 1;">
            <span>Primary model${isDefault ? " (default)" : ""}</span>
            <select
              .value=${effectivePrimary ?? ""}
              ?disabled=${!configForm || configLoading || configSaving}
              @change=${(e: Event) =>
                onModelChange(agent.id, (e.target as HTMLSelectElement).value || null)}
            >
              ${
                isDefault
                  ? nothing
                  : html`
                      <option value="">
                        ${defaultPrimary ? `Inherit default (${defaultPrimary})` : "Inherit default"}
                      </option>
                    `
              }
              ${buildModelOptions(configForm, effectivePrimary ?? undefined)}
            </select>
          </label>
          <label class="field" style="min-width: 260px; flex: 1;">
            <span>Fallbacks (comma-separated)</span>
            <input
              .value=${fallbackText}
              ?disabled=${!configForm || configLoading || configSaving}
              placeholder="provider/model, provider/model"
              @input=${(e: Event) =>
                onModelFallbacksChange(
                  agent.id,
                  parseFallbackList((e.target as HTMLInputElement).value),
                )}
            />
          </label>
        </div>
        <div class="row" style="justify-content: flex-end; gap: 8px;">
          <button class="btn btn--sm" ?disabled=${configLoading} @click=${onConfigReload}>
            Reload Config
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${configSaving || !configDirty}
            @click=${onConfigSave}
          >
            ${configSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </section>
  `;
}
