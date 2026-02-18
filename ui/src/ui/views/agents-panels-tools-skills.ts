import { html, nothing } from "lit";
import type { SkillStatusEntry, SkillStatusReport } from "../types.ts";
import type { SkillGroup } from "./skills-grouping.ts";
import { normalizeToolName } from "../../../../src/agents/tool-policy.js";
import {
  isAllowedByPolicy,
  matchesList,
  PROFILE_OPTIONS,
  resolveAgentConfig,
  resolveToolProfile,
  TOOL_SECTIONS,
} from "./agents-utils.ts";
import { groupSkills } from "./skills-grouping.ts";
import {
  computeSkillMissing,
  computeSkillReasons,
  renderSkillStatusChips,
} from "./skills-shared.ts";

export function renderAgentTools(params: {
  agentId: string;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  configSaving: boolean;
  configDirty: boolean;
  onProfileChange: (agentId: string, profile: string | null, clearAllow: boolean) => void;
  onOverridesChange: (agentId: string, alsoAllow: string[], deny: string[]) => void;
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

  const updateTool = (toolId: string, nextEnabled: boolean) => {
    const nextAllow = new Set(
      alsoAllow.map((entry) => normalizeToolName(entry)).filter((entry) => entry.length > 0),
    );
    const nextDeny = new Set(
      deny.map((entry) => normalizeToolName(entry)).filter((entry) => entry.length > 0),
    );
    const baseAllowed = resolveAllowed(toolId).baseAllowed;
    const normalized = normalizeToolName(toolId);
    if (nextEnabled) {
      nextDeny.delete(normalized);
      if (!baseAllowed) {
        nextAllow.add(normalized);
      }
    } else {
      nextAllow.delete(normalized);
      nextDeny.add(normalized);
    }
    params.onOverridesChange(params.agentId, [...nextAllow], [...nextDeny]);
  };

  const updateAll = (nextEnabled: boolean) => {
    const nextAllow = new Set(
      alsoAllow.map((entry) => normalizeToolName(entry)).filter((entry) => entry.length > 0),
    );
    const nextDeny = new Set(
      deny.map((entry) => normalizeToolName(entry)).filter((entry) => entry.length > 0),
    );
    for (const toolId of toolIds) {
      const baseAllowed = resolveAllowed(toolId).baseAllowed;
      const normalized = normalizeToolName(toolId);
      if (nextEnabled) {
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

  return html`
    <oc-card title="Tool Access" subtitle="Profile + per-tool overrides for this agent.">
      <div class="row" slot="actions" style="gap: 8px;">
        <button class="btn btn--sm" ?disabled=${!editable} @click=${() => updateAll(true)}>
          Enable All
        </button>
        <button class="btn btn--sm" ?disabled=${!editable} @click=${() => updateAll(false)}>
          Disable All
        </button>
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
      </div>
      <div class="muted" style="margin-bottom: 8px;"><span class="mono">${enabledCount}/${toolIds.length}</span> enabled.</div>

      ${
        !params.configForm
          ? html`
              <oc-callout variant="info"> Load the gateway config to adjust tool profiles. </oc-callout>
            `
          : nothing
      }
      ${
        hasAgentAllow
          ? html`
              <oc-callout variant="info">
                This agent is using an explicit allowlist in config. Tool overrides are managed in the Config tab.
              </oc-callout>
            `
          : nothing
      }
      ${
        hasGlobalAllow
          ? html`
              <oc-callout variant="info">
                Global tools.allow is set. Agent overrides cannot enable tools that are globally blocked.
              </oc-callout>
            `
          : nothing
      }

      <div class="agent-tools-meta" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">Profile</div>
          <div class="mono">${profile}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Source</div>
          <div>${profileSource}</div>
        </div>
        ${
          params.configDirty
            ? html`
                <div class="agent-kv">
                  <div class="label">Status</div>
                  <div class="mono">unsaved</div>
                </div>
              `
            : nothing
        }
      </div>

      <div class="agent-tools-presets" style="margin-top: 16px;">
        <div class="label">Quick Presets</div>
        <div class="agent-tools-buttons">
          ${PROFILE_OPTIONS.map(
            (option) => html`
              <button
                class="btn btn--sm ${profile === option.id ? "active" : ""}"
                ?disabled=${!editable}
                @click=${() => params.onProfileChange(params.agentId, option.id, true)}
              >
                ${option.label}
              </button>
            `,
          )}
          <button
            class="btn btn--sm"
            ?disabled=${!editable}
            @click=${() => params.onProfileChange(params.agentId, null, false)}
          >
            Inherit
          </button>
        </div>
      </div>

      <div class="agent-tools-grid" style="margin-top: 20px;">
        ${TOOL_SECTIONS.map(
          (section) =>
            html`
              <div class="agent-tools-section">
                <div class="agent-tools-header">${section.label}</div>
                <div class="agent-tools-list">
                  ${section.tools.map((tool) => {
                    const { allowed } = resolveAllowed(tool.id);
                    return html`
                      <div class="agent-tool-row">
                        <div>
                          <div class="agent-tool-title mono">${tool.label}</div>
                          <div class="agent-tool-sub">${tool.description}</div>
                        </div>
                        <oc-toggle
                          .checked=${allowed}
                          ?disabled=${!editable}
                          @oc-change=${(e: CustomEvent<{ checked: boolean }>) =>
                            updateTool(tool.id, e.detail.checked)}
                        ></oc-toggle>
                      </div>
                    `;
                  })}
                </div>
              </div>
            `,
        )}
      </div>
    </oc-card>
  `;
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
    <oc-card title="Skills" subtitle="Per-agent skill allowlist and workspace skills.">
      <div class="row" slot="actions" style="gap: 8px;">
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
      ${totalCount > 0 ? html`<div class="muted" style="margin-bottom: 8px;"><span class="mono">${enabledCount}/${totalCount}</span> enabled.</div>` : nothing}

      ${
        !params.configForm
          ? html`
              <oc-callout variant="info"> Load the gateway config to set per-agent skills. </oc-callout>
            `
          : nothing
      }
      ${
        usingAllowlist
          ? html`
              <oc-callout variant="info">This agent uses a custom skill allowlist.</oc-callout>
            `
          : html`
              <oc-callout variant="info">
                All skills are enabled. Disabling any skill will create a per-agent allowlist.
              </oc-callout>
            `
      }
      ${
        !reportReady && !params.loading
          ? html`
              <oc-callout variant="info">
                Load skills for this agent to view workspace-specific entries.
              </oc-callout>
            `
          : nothing
      }
      ${params.error ? html`<oc-callout variant="danger">${params.error}</oc-callout>` : nothing}

      <div class="filters" style="margin-top: 14px;">
        <oc-field label="Filter" style="flex: 1;">
          <input
            .value=${params.filter}
            @input=${(e: Event) => params.onFilterChange((e.target as HTMLInputElement).value)}
            placeholder="Search skills"
          />
        </oc-field>
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
    </oc-card>
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
    <oc-collapsible ?open=${!collapsedByDefault}>
      <span slot="header" class="agent-skills-header">
        <span>${group.label}</span>
        <span class="muted">${group.skills.length}</span>
      </span>
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
    </oc-collapsible>
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
        <oc-toggle
          .checked=${enabled}
          ?disabled=${!params.editable}
          @oc-change=${(e: CustomEvent<{ checked: boolean }>) =>
            params.onToggle(params.agentId, skill.name, e.detail.checked)}
        ></oc-toggle>
      </div>
    </div>
  `;
}
