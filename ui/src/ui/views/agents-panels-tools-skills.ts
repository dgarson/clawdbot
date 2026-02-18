import { html, nothing } from "lit";
import { normalizeToolName } from "../../../../src/agents/tool-policy.js";
import { renderActionBar, renderCardShell, renderErrorCallout } from "../components/core-cards.ts";
import { renderPolicyEditor } from "../components/policy-editor.ts";
import { renderPolicyMatrix, type PolicyMatrixSection } from "../components/policy-matrix.ts";
import { renderPolicyPresetManager } from "../components/policy-presets.ts";
import type { ToolPolicyPreset, ToolPolicyPresetInput } from "../tool-policy-presets.ts";
import type { SkillStatusEntry, SkillStatusReport } from "../types.ts";
import {
  isAllowedByPolicy,
  matchesList,
  PROFILE_OPTIONS,
  resolveAgentConfig,
  resolveToolProfile,
  TOOL_SECTIONS,
} from "./agents-utils.ts";
import type { SkillGroup } from "./skills-grouping.ts";
import { groupSkills } from "./skills-grouping.ts";
import {
  computeSkillMissing,
  computeSkillReasons,
  renderSkillStatusChips,
} from "./skills-shared.ts";

export function renderAgentTools(params: {
  agentId: string;
  allAgentIds: string[];
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  presets: ToolPolicyPreset[];
  assignments: { agents: Record<string, string>; providers: Record<string, string> };
  onProfileChange: (agentId: string, profile: string | null, clearAllow: boolean) => void;
  onOverridesChange: (agentId: string, alsoAllow: string[], deny: string[]) => void;
  onPolicyReplace: (
    agentId: string,
    profile: string | null,
    alsoAllow: string[],
    deny: string[],
  ) => void;
  onPresetCreate: (input: ToolPolicyPresetInput) => void;
  onPresetUpdate: (id: string, input: ToolPolicyPresetInput) => void;
  onPresetDuplicate: (id: string) => void;
  onPresetDelete: (id: string) => void;
  onPresetAssignAgent: (agentId: string, presetId: string | null) => void;
  onPresetAssignProvider: (providerKey: string, presetId: string | null) => void;
  onPresetBulkAssignAgents: (agentIds: string[], presetId: string | null) => void;
  onPresetBulkAssignProviders: (providerKeys: string[], presetId: string | null) => void;
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
}) {
  const config = resolveAgentConfig(params.configForm, params.agentId);
  const agentTools = config.entry?.tools ?? {};
  const globalTools = config.globalTools ?? {};
  const profile = agentTools.profile ?? globalTools.profile ?? "full";
  const profileSource = agentTools.profile
    ? "agent override"
    : globalTools.profile
      ? "global default"
      : "default";
  const hasAgentAllow = Array.isArray(agentTools.allow) && agentTools.allow.length > 0;
  const hasGlobalAllow = Array.isArray(globalTools.allow) && globalTools.allow.length > 0;
  const editable =
    Boolean(params.configForm) && !params.configLoading && !params.configSaving && !hasAgentAllow;
  const alsoAllow = hasAgentAllow
    ? []
    : Array.isArray(agentTools.alsoAllow)
      ? agentTools.alsoAllow
      : [];
  const deny = hasAgentAllow ? [] : Array.isArray(agentTools.deny) ? agentTools.deny : [];
  const globalByProvider = toPolicyRecord(globalTools.byProvider);
  const agentByProvider = toPolicyRecord(agentTools.byProvider);
  const providerKeys = Array.from(
    new Set([
      ...Object.keys(globalByProvider),
      ...Object.keys(agentByProvider),
      ...Object.keys(params.assignments.providers),
    ]),
  ).toSorted();
  const agentToAgentEnabled = globalTools.agentToAgent?.enabled === true;
  const agentToAgentAllow = Array.isArray(globalTools.agentToAgent?.allow)
    ? globalTools.agentToAgent.allow
    : [];
  const subagentsAllow = Array.isArray(globalTools.subagents?.tools?.allow)
    ? globalTools.subagents?.tools?.allow
    : [];
  const subagentsDeny = Array.isArray(globalTools.subagents?.tools?.deny)
    ? globalTools.subagents?.tools?.deny
    : [];
  const basePolicy = hasAgentAllow
    ? { allow: agentTools.allow ?? [], deny: agentTools.deny ?? [] }
    : (resolveToolProfile(profile) ?? undefined);
  const toolIds = TOOL_SECTIONS.flatMap((section) => section.tools.map((tool) => tool.id));

  const resolveAllowed = (toolId: string) => {
    const baseAllowed = isAllowedByPolicy(toolId, basePolicy);
    const extraAllowed = matchesList(toolId, alsoAllow);
    const denied = matchesList(toolId, deny);
    const allowed = (baseAllowed || extraAllowed) && !denied;
    return {
      allowed,
      baseAllowed,
      denied,
    };
  };
  const enabledCount = toolIds.filter((toolId) => resolveAllowed(toolId).allowed).length;

  const applyToolUpdates = (updates: Array<{ toolId: string; enabled: boolean }>) => {
    const nextAllow = new Set(
      alsoAllow.map((entry) => normalizeToolName(entry)).filter((entry) => entry.length > 0),
    );
    const nextDeny = new Set(
      deny.map((entry) => normalizeToolName(entry)).filter((entry) => entry.length > 0),
    );
    for (const update of updates) {
      const baseAllowed = resolveAllowed(update.toolId).baseAllowed;
      const normalized = normalizeToolName(update.toolId);
      if (update.enabled) {
        nextDeny.delete(normalized);
        if (!baseAllowed) {
          nextAllow.add(normalized);
        }
      } else {
        nextAllow.delete(normalized);
        nextDeny.add(normalized);
      }
    }
    params.onOverridesChange(params.agentId, [...nextAllow], [...nextDeny]);
  };

  const updateTool = (toolId: string, nextEnabled: boolean) => {
    applyToolUpdates([{ toolId, enabled: nextEnabled }]);
  };

  const updateAll = (nextEnabled: boolean) => {
    applyToolUpdates(toolIds.map((toolId) => ({ toolId, enabled: nextEnabled })));
  };

  const matrixSections: PolicyMatrixSection[] = TOOL_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    tools: section.tools.map((tool) => {
      const state = resolveAllowed(tool.id);
      return {
        id: tool.id,
        label: tool.label,
        description: tool.description,
        allowed: state.allowed,
        baseAllowed: state.baseAllowed,
        denied: state.denied,
      };
    }),
  }));
  const assignedPresetId = params.assignments.agents[params.agentId] ?? null;
  const assignedPreset = assignedPresetId
    ? (params.presets.find((preset) => preset.id === assignedPresetId) ?? null)
    : null;
  const isAssignedPresetInSync = assignedPreset
    ? arePoliciesEquivalent(
        {
          profile,
          alsoAllow,
          deny,
        },
        assignedPreset,
      )
    : true;

  return renderCardShell({
    title: "Tool Access",
    subtitle: "Profile, policy overrides, and effective tool matrix.",
    actions: html`
      <button class="btn btn--sm" ?disabled=${params.configLoading} @click=${params.onConfigReload}>
        Reload Config
      </button>
      <button
        class="btn btn--sm primary"
        ?disabled=${params.configSaving || !params.configDirty}
        @click=${params.onConfigSave}
      >
        ${params.configSaving ? "Saving…" : "Save"}
      </button>
    `,
    body: html`
      ${renderActionBar({
        dirty: params.configDirty,
        busy: params.configSaving,
        meta: html`<span class="mono">${enabledCount}/${toolIds.length} enabled</span>`,
      })}

      ${
        !params.configForm
          ? renderErrorCallout({
              message: "Load the gateway config to adjust tool profiles.",
              tone: "warn",
            })
          : nothing
      }
      ${
        hasAgentAllow
          ? renderErrorCallout({
              message:
                "This agent is using an explicit allowlist in config. Tool overrides are managed in the Config tab.",
              tone: "info",
            })
          : nothing
      }
      ${
        hasGlobalAllow
          ? renderErrorCallout({
              message:
                "Global tools.allow is set. Agent overrides cannot enable tools that are globally blocked.",
              tone: "info",
            })
          : nothing
      }
      ${
        assignedPreset && !isAssignedPresetInSync
          ? html`
              <div class="callout info">
                Assigned preset <span class="mono">${assignedPreset.name}</span> differs from current policy.
                <button
                  class="btn btn--sm"
                  style="margin-left: 8px;"
                  ?disabled=${!editable}
                  @click=${() =>
                    params.onPolicyReplace(
                      params.agentId,
                      assignedPreset.profile,
                      assignedPreset.alsoAllow,
                      assignedPreset.deny,
                    )}
                >
                  Re-apply Assigned
                </button>
              </div>
            `
          : nothing
      }

      <div style="margin-top: 16px;">
        ${renderPolicyEditor({
          editable,
          profile,
          profileSource,
          profiles: PROFILE_OPTIONS,
          alsoAllow,
          deny,
          onProfileChange: (nextProfile, clearAllow) =>
            params.onProfileChange(params.agentId, nextProfile, clearAllow),
          onOverridesChange: (nextAllow, nextDeny) =>
            params.onOverridesChange(params.agentId, nextAllow, nextDeny),
        })}
      </div>

      <div style="margin-top: 16px;">
        ${renderPolicyPresetManager({
          editable,
          currentAgentId: params.agentId,
          allAgentIds: params.allAgentIds,
          providerKeys,
          profile,
          alsoAllow,
          deny,
          presets: params.presets,
          assignments: params.assignments,
          onApplyPreset: (preset) =>
            params.onPolicyReplace(params.agentId, preset.profile, preset.alsoAllow, preset.deny),
          onApplyPresetToAgents: (preset, agentIds) => {
            for (const agentId of agentIds) {
              params.onPolicyReplace(agentId, preset.profile, preset.alsoAllow, preset.deny);
            }
          },
          onApplyPresetToProviders: (preset, keys) => {
            for (const key of keys) {
              params.onGlobalProviderPolicyChange(
                key,
                preset.profile,
                preset.alsoAllow,
                preset.deny,
              );
            }
          },
          onCreatePreset: params.onPresetCreate,
          onUpdatePreset: params.onPresetUpdate,
          onDuplicatePreset: params.onPresetDuplicate,
          onDeletePreset: params.onPresetDelete,
          onAssignAgent: params.onPresetAssignAgent,
          onAssignProvider: params.onPresetAssignProvider,
          onBulkAssignAgents: params.onPresetBulkAssignAgents,
          onBulkAssignProviders: params.onPresetBulkAssignProviders,
        })}
      </div>

      <div style="margin-top: 18px;">
        ${renderPolicyMatrix({
          sections: matrixSections,
          editable,
          enabledCount,
          totalCount: toolIds.length,
          onToggleTool: updateTool,
          onToggleSection: (sectionId, nextEnabled) => {
            const section = TOOL_SECTIONS.find((entry) => entry.id === sectionId);
            if (!section) {
              return;
            }
            applyToolUpdates(
              section.tools.map((tool) => ({ toolId: tool.id, enabled: nextEnabled })),
            );
          },
          onToggleAll: updateAll,
        })}
      </div>

      <details class="policy-surface" style="margin-top: 16px;" open>
        <summary class="policy-surface__summary">Provider Policies</summary>
        <div class="muted" style="margin-top: 8px;">
          Configure provider/channel-specific tool policy in both global and per-agent scopes.
        </div>
        ${
          providerKeys.length === 0
            ? html`
                <div class="callout info" style="margin-top: 10px">
                  No provider policies configured yet. Add one via config or by applying a preset to providers.
                </div>
              `
            : html`
                <div class="policy-provider-grid" style="margin-top: 10px;">
                  <section class="card">
                    <div class="card-title">Global byProvider</div>
                    <div class="card-sub mono">tools.byProvider</div>
                    <div class="policy-provider-list" style="margin-top: 10px;">
                      ${providerKeys.map((providerKey) =>
                        renderProviderPolicyRow({
                          providerKey,
                          policy: globalByProvider[providerKey],
                          assignedPresetId: params.assignments.providers[providerKey] ?? null,
                          editable,
                          onAssignPreset: (presetId) =>
                            params.onPresetAssignProvider(providerKey, presetId),
                          onChange: (next) =>
                            params.onGlobalProviderPolicyChange(
                              providerKey,
                              next.profile,
                              next.alsoAllow,
                              next.deny,
                            ),
                        }),
                      )}
                    </div>
                  </section>

                  <section class="card">
                    <div class="card-title">Agent byProvider Override</div>
                    <div class="card-sub mono">agents.list[].tools.byProvider</div>
                    <div class="policy-provider-list" style="margin-top: 10px;">
                      ${providerKeys.map((providerKey) =>
                        renderProviderPolicyRow({
                          providerKey,
                          policy: agentByProvider[providerKey],
                          assignedPresetId: params.assignments.providers[providerKey] ?? null,
                          editable,
                          onAssignPreset: (presetId) =>
                            params.onPresetAssignProvider(providerKey, presetId),
                          onChange: (next) =>
                            params.onAgentProviderPolicyChange(
                              params.agentId,
                              providerKey,
                              next.profile,
                              next.alsoAllow,
                              next.deny,
                            ),
                        }),
                      )}
                    </div>
                  </section>
                </div>
              `
        }
      </details>

      <details class="policy-surface" style="margin-top: 14px;" open>
        <summary class="policy-surface__summary">Agent-to-Agent Policy</summary>
        <div class="form-grid" style="margin-top: 10px;">
          <label class="field checkbox">
            <input
              type="checkbox"
              .checked=${agentToAgentEnabled}
              ?disabled=${!editable}
              @change=${(event: Event) =>
                params.onAgentToAgentPolicyChange(
                  (event.target as HTMLInputElement).checked,
                  agentToAgentAllow,
                )}
            />
            <span>Enable cross-agent tools (tools.agentToAgent.enabled)</span>
          </label>
          <label class="field full">
            <span>Allowed Agents (tools.agentToAgent.allow)</span>
            <textarea
              rows="2"
              ?disabled=${!editable}
              .value=${agentToAgentAllow.join(", ")}
              placeholder="main, work, *"
              @input=${(event: Event) =>
                params.onAgentToAgentPolicyChange(
                  agentToAgentEnabled,
                  parsePolicyList((event.target as HTMLTextAreaElement).value),
                )}
            ></textarea>
          </label>
        </div>
      </details>

      <details class="policy-surface" style="margin-top: 14px;" open>
        <summary class="policy-surface__summary">Subagent Policy</summary>
        <div class="muted" style="margin-top: 8px;">
          Configure subagent tool allow/deny policy (tools.subagents.tools). Subagent model lives in
          agents.defaults.subagents.model or per-agent subagents.model.
        </div>
        <div class="form-grid" style="margin-top: 10px;">
          <label class="field">
            <span>Allow (tools.subagents.tools.allow)</span>
            <textarea
              rows="2"
              ?disabled=${!editable}
              .value=${subagentsAllow.join(", ")}
              placeholder="group:fs, sessions_spawn"
              @input=${(event: Event) =>
                params.onSubagentPolicyChange(
                  parsePolicyList((event.target as HTMLTextAreaElement).value),
                  subagentsDeny,
                )}
            ></textarea>
          </label>
          <label class="field">
            <span>Deny (tools.subagents.tools.deny)</span>
            <textarea
              rows="2"
              ?disabled=${!editable}
              .value=${subagentsDeny.join(", ")}
              placeholder="exec, process"
              @input=${(event: Event) =>
                params.onSubagentPolicyChange(
                  subagentsAllow,
                  parsePolicyList((event.target as HTMLTextAreaElement).value),
                )}
            ></textarea>
          </label>
        </div>
      </details>
    `,
  });
}

type ProviderPolicy = {
  profile?: string;
  allow?: string[];
  alsoAllow?: string[];
  deny?: string[];
};

function toPolicyRecord(input: unknown): Record<string, ProviderPolicy> {
  if (!input || typeof input !== "object") {
    return {};
  }
  const record = input as Record<string, unknown>;
  const next: Record<string, ProviderPolicy> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const entry = value as Record<string, unknown>;
    next[key] = {
      profile: typeof entry.profile === "string" ? entry.profile : undefined,
      allow: Array.isArray(entry.allow)
        ? entry.allow.filter((item): item is string => typeof item === "string")
        : undefined,
      alsoAllow: Array.isArray(entry.alsoAllow)
        ? entry.alsoAllow.filter((item): item is string => typeof item === "string")
        : undefined,
      deny: Array.isArray(entry.deny)
        ? entry.deny.filter((item): item is string => typeof item === "string")
        : undefined,
    };
  }
  return next;
}

function renderProviderPolicyRow(params: {
  providerKey: string;
  policy: ProviderPolicy | undefined;
  assignedPresetId: string | null;
  editable: boolean;
  onAssignPreset: (presetId: string | null) => void;
  onChange: (next: { profile: string | null; alsoAllow: string[]; deny: string[] }) => void;
}) {
  const profile = params.policy?.profile ?? "";
  const hasAllowList = Array.isArray(params.policy?.allow) && params.policy.allow.length > 0;
  const allowListText = hasAllowList ? (params.policy?.allow?.join(", ") ?? "") : "";
  const alsoAllow = Array.isArray(params.policy?.alsoAllow) ? params.policy.alsoAllow : [];
  const deny = Array.isArray(params.policy?.deny) ? params.policy.deny : [];
  return html`
    <div class="policy-provider-row">
      <div class="row" style="justify-content: space-between; align-items: center;">
        <div class="mono">${params.providerKey}</div>
        <div class="row" style="gap: 8px;">
          ${
            params.assignedPresetId
              ? html`<span class="pill">${params.assignedPresetId}</span>`
              : nothing
          }
          <button
            class="btn btn--sm"
            ?disabled=${!params.editable}
            @click=${() => params.onAssignPreset(null)}
          >
            Clear Assign
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${!params.editable}
            @click=${() => params.onChange({ profile: null, alsoAllow: [], deny: [] })}
          >
            Clear Policy
          </button>
        </div>
      </div>
      ${
        hasAllowList
          ? html`
              <div class="callout warn" style="margin-top: 8px;">
                Explicit allowlist is set for this provider: <span class="mono">${allowListText}</span>. AlsoAllow
                edits are disabled to keep config valid.
              </div>
            `
          : nothing
      }
      <div class="form-grid" style="margin-top: 8px;">
        <label class="field">
          <span>Profile</span>
          <select
            .value=${profile}
            ?disabled=${!params.editable}
            @change=${(event: Event) =>
              params.onChange({
                profile: normalizeNullableString((event.target as HTMLSelectElement).value),
                alsoAllow,
                deny,
              })}
          >
            <option value="">(unset)</option>
            <option value="minimal">minimal</option>
            <option value="coding">coding</option>
            <option value="messaging">messaging</option>
            <option value="full">full</option>
          </select>
        </label>
        <label class="field">
          <span>Also Allow</span>
          <textarea
            rows="2"
            ?disabled=${!params.editable || hasAllowList}
            .value=${alsoAllow.join(", ")}
            @input=${(event: Event) =>
              params.onChange({
                profile: normalizeNullableString(profile),
                alsoAllow: parsePolicyList((event.target as HTMLTextAreaElement).value),
                deny,
              })}
          ></textarea>
        </label>
        <label class="field">
          <span>Deny</span>
          <textarea
            rows="2"
            ?disabled=${!params.editable}
            .value=${deny.join(", ")}
            @input=${(event: Event) =>
              params.onChange({
                profile: normalizeNullableString(profile),
                alsoAllow,
                deny: parsePolicyList((event.target as HTMLTextAreaElement).value),
              })}
          ></textarea>
        </label>
      </div>
    </div>
  `;
}

function parsePolicyList(input: string): string[] {
  return input
    .split(/[\n,]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeNullableString(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function arePoliciesEquivalent(
  current: { profile: string; alsoAllow: string[]; deny: string[] },
  preset: ToolPolicyPreset,
) {
  if (current.profile !== preset.profile) {
    return false;
  }
  return (
    areStringSetsEqual(current.alsoAllow, preset.alsoAllow) &&
    areStringSetsEqual(current.deny, preset.deny)
  );
}

function areStringSetsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  const leftSet = new Set(left.map((entry) => entry.trim()).filter(Boolean));
  const rightSet = new Set(right.map((entry) => entry.trim()).filter(Boolean));
  if (leftSet.size !== rightSet.size) {
    return false;
  }
  for (const value of leftSet) {
    if (!rightSet.has(value)) {
      return false;
    }
  }
  return true;
}

export function renderAgentSkills(params: {
  agentId: string;
  report: SkillStatusReport | null;
  loading: boolean;
  error: string | null;
  activeAgentId: string | null;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  filter: string;
  onFilterChange: (next: string) => void;
  onRefresh: () => void;
  onToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  onClear: (agentId: string) => void;
  onDisableAll: (agentId: string) => void;
  onConfigReload: () => void;
  onConfigSave: () => void;
}) {
  const editable = Boolean(params.configForm) && !params.configLoading && !params.configSaving;
  const config = resolveAgentConfig(params.configForm, params.agentId);
  const allowlist = Array.isArray(config.entry?.skills) ? config.entry?.skills : undefined;
  const allowSet = new Set((allowlist ?? []).map((name) => name.trim()).filter(Boolean));
  const usingAllowlist = allowlist !== undefined;
  const reportReady = Boolean(params.report && params.activeAgentId === params.agentId);
  const rawSkills = reportReady ? (params.report?.skills ?? []) : [];
  const filter = params.filter.trim().toLowerCase();
  const filtered = filter
    ? rawSkills.filter((skill) =>
        [skill.name, skill.description, skill.source].join(" ").toLowerCase().includes(filter),
      )
    : rawSkills;
  const groups = groupSkills(filtered);
  const enabledCount = usingAllowlist
    ? rawSkills.filter((skill) => allowSet.has(skill.name)).length
    : rawSkills.length;
  const totalCount = rawSkills.length;

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Skills</div>
          <div class="card-sub">
            Per-agent skill allowlist and workspace skills.
            ${
              totalCount > 0
                ? html`<span class="mono">${enabledCount}/${totalCount}</span>`
                : nothing
            }
          </div>
        </div>
        <div class="row" style="gap: 8px;">
          <button class="btn btn--sm" ?disabled=${!editable} @click=${() => params.onClear(params.agentId)}>
            Use All
          </button>
          <button
            class="btn btn--sm"
            ?disabled=${!editable}
            @click=${() => params.onDisableAll(params.agentId)}
          >
            Disable All
          </button>
          <button class="btn btn--sm" ?disabled=${params.configLoading} @click=${params.onConfigReload}>
            Reload Config
          </button>
          <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
            ${params.loading ? "Loading…" : "Refresh"}
          </button>
          <button
            class="btn btn--sm primary"
            ?disabled=${params.configSaving || !params.configDirty}
            @click=${params.onConfigSave}
          >
            ${params.configSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      ${
        !params.configForm
          ? html`
              <div class="callout info" style="margin-top: 12px">
                Load the gateway config to set per-agent skills.
              </div>
            `
          : nothing
      }
      ${
        usingAllowlist
          ? html`
              <div class="callout info" style="margin-top: 12px">This agent uses a custom skill allowlist.</div>
            `
          : html`
              <div class="callout info" style="margin-top: 12px">
                All skills are enabled. Disabling any skill will create a per-agent allowlist.
              </div>
            `
      }
      ${
        !reportReady && !params.loading
          ? html`
              <div class="callout info" style="margin-top: 12px">
                Load skills for this agent to view workspace-specific entries.
              </div>
            `
          : nothing
      }
      ${
        params.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${params.error}</div>`
          : nothing
      }

      <div class="filters" style="margin-top: 14px;">
        <label class="field" style="flex: 1;">
          <span>Filter</span>
          <input
            .value=${params.filter}
            @input=${(e: Event) => params.onFilterChange((e.target as HTMLInputElement).value)}
            placeholder="Search skills"
          />
        </label>
        <div class="muted">${filtered.length} shown</div>
      </div>

      ${
        filtered.length === 0
          ? html`
              <div class="muted" style="margin-top: 16px">No skills found.</div>
            `
          : html`
              <div class="agent-skills-groups" style="margin-top: 16px;">
                ${groups.map((group) =>
                  renderAgentSkillGroup(group, {
                    agentId: params.agentId,
                    allowSet,
                    usingAllowlist,
                    editable,
                    onToggle: params.onToggle,
                  }),
                )}
              </div>
            `
      }
    </section>
  `;
}

function renderAgentSkillGroup(
  group: SkillGroup,
  params: {
    agentId: string;
    allowSet: Set<string>;
    usingAllowlist: boolean;
    editable: boolean;
    onToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  },
) {
  const collapsedByDefault = group.id === "workspace" || group.id === "built-in";
  return html`
    <details class="agent-skills-group" ?open=${!collapsedByDefault}>
      <summary class="agent-skills-header">
        <span>${group.label}</span>
        <span class="muted">${group.skills.length}</span>
      </summary>
      <div class="list skills-grid">
        ${group.skills.map((skill) =>
          renderAgentSkillRow(skill, {
            agentId: params.agentId,
            allowSet: params.allowSet,
            usingAllowlist: params.usingAllowlist,
            editable: params.editable,
            onToggle: params.onToggle,
          }),
        )}
      </div>
    </details>
  `;
}

function renderAgentSkillRow(
  skill: SkillStatusEntry,
  params: {
    agentId: string;
    allowSet: Set<string>;
    usingAllowlist: boolean;
    editable: boolean;
    onToggle: (agentId: string, skillName: string, enabled: boolean) => void;
  },
) {
  const enabled = params.usingAllowlist ? params.allowSet.has(skill.name) : true;
  const missing = computeSkillMissing(skill);
  const reasons = computeSkillReasons(skill);
  return html`
    <div class="list-item agent-skill-row">
      <div class="list-main">
        <div class="list-title">${skill.emoji ? `${skill.emoji} ` : ""}${skill.name}</div>
        <div class="list-sub">${skill.description}</div>
        ${renderSkillStatusChips({ skill })}
        ${
          missing.length > 0
            ? html`<div class="muted" style="margin-top: 6px;">Missing: ${missing.join(", ")}</div>`
            : nothing
        }
        ${
          reasons.length > 0
            ? html`<div class="muted" style="margin-top: 6px;">Reason: ${reasons.join(", ")}</div>`
            : nothing
        }
      </div>
      <div class="list-meta">
        <label class="cfg-toggle">
          <input
            type="checkbox"
            .checked=${enabled}
            ?disabled=${!params.editable}
            @change=${(e: Event) =>
              params.onToggle(params.agentId, skill.name, (e.target as HTMLInputElement).checked)}
          />
          <span class="cfg-toggle__track"></span>
        </label>
      </div>
    </div>
  `;
}
