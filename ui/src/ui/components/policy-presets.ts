import { html, nothing } from "lit";
import { formatRelativeTimestamp } from "../format.ts";
import type {
  ToolPolicyPreset,
  ToolPolicyPresetAssignments,
  ToolPolicyPresetInput,
} from "../tool-policy-presets.ts";

export type PolicyPresetManagerProps = {
  editable: boolean;
  currentAgentId: string;
  allAgentIds: string[];
  providerKeys: string[];
  profile: string;
  alsoAllow: string[];
  deny: string[];
  presets: ToolPolicyPreset[];
  assignments: ToolPolicyPresetAssignments;
  onApplyPreset: (preset: ToolPolicyPreset) => void;
  onApplyPresetToAgents: (preset: ToolPolicyPreset, agentIds: string[]) => void;
  onApplyPresetToProviders: (preset: ToolPolicyPreset, providerKeys: string[]) => void;
  onCreatePreset: (input: ToolPolicyPresetInput) => void;
  onUpdatePreset: (id: string, input: ToolPolicyPresetInput) => void;
  onDuplicatePreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onAssignAgent: (agentId: string, presetId: string | null) => void;
  onAssignProvider: (providerKey: string, presetId: string | null) => void;
  onBulkAssignAgents: (agentIds: string[], presetId: string | null) => void;
  onBulkAssignProviders: (providerKeys: string[], presetId: string | null) => void;
};

export function renderPolicyPresetManager(props: PolicyPresetManagerProps) {
  const hasProviderTargets = props.providerKeys.length > 0;
  const currentAgentAssignment = props.assignments.agents[props.currentAgentId] ?? null;
  return html`
    <section class="policy-presets">
      <div class="policy-presets__header">
        <div>
          <div class="label">Reusable Presets</div>
          <div class="muted">
            Save versioned presets, assign them, and bulk-apply across agents and provider/channel policies.
          </div>
          ${
            currentAgentAssignment
              ? html`
                  <div class="muted">
                    Current agent assignment:
                    <span class="mono">${resolvePresetName(props.presets, currentAgentAssignment) ?? "unknown"}</span>
                  </div>
                `
              : nothing
          }
        </div>
      </div>

      ${renderCreateForm(props)}

      ${
        props.presets.length === 0
          ? html`
              <div class="muted">No presets yet. Create one from the current policy above.</div>
            `
          : html`
              <div class="list policy-presets__list">
                ${props.presets.map((preset) =>
                  renderPresetRow({
                    preset,
                    props,
                    hasProviderTargets,
                    currentAgentAssignment,
                  }),
                )}
              </div>
            `
      }
    </section>
  `;
}

function renderCreateForm(props: PolicyPresetManagerProps) {
  return html`
    <form class="policy-presets__form" @submit=${(event: Event) => onCreateSubmit(event, props)}>
      <div class="policy-presets__form-grid">
        <label class="field">
          <span>Name</span>
          <input name="name" placeholder="e.g. Secure Messaging Agent" ?disabled=${!props.editable} required />
        </label>
        <label class="field">
          <span>Description</span>
          <input name="description" placeholder="Optional context" ?disabled=${!props.editable} />
        </label>
        <label class="field">
          <span>Profile</span>
          <select name="profile" .value=${props.profile} ?disabled=${!props.editable}>
            <option value="minimal">minimal</option>
            <option value="coding">coding</option>
            <option value="messaging">messaging</option>
            <option value="full">full</option>
          </select>
        </label>
      </div>

      <div class="policy-presets__form-grid">
        <label class="field">
          <span>Also Allow</span>
          <textarea
            name="alsoAllow"
            rows="2"
            ?disabled=${!props.editable}
            .value=${props.alsoAllow.join(", ")}
          ></textarea>
        </label>
        <label class="field">
          <span>Deny</span>
          <textarea name="deny" rows="2" ?disabled=${!props.editable} .value=${props.deny.join(", ")}></textarea>
        </label>
      </div>

      <div class="row" style="justify-content: flex-end; gap: 8px;">
        <button class="btn btn--sm primary" type="submit" ?disabled=${!props.editable}>
          Create Preset
        </button>
      </div>
    </form>
  `;
}

function renderPresetRow(params: {
  preset: ToolPolicyPreset;
  props: PolicyPresetManagerProps;
  hasProviderTargets: boolean;
  currentAgentAssignment: string | null;
}) {
  const { preset, props, hasProviderTargets, currentAgentAssignment } = params;
  const assignedToCurrentAgent = currentAgentAssignment === preset.id;
  return html`
    <div class="list-item policy-presets__item">
      <div class="list-main">
        <div class="list-title">${preset.name}</div>
        ${preset.description ? html`<div class="list-sub">${preset.description}</div>` : nothing}
        <div class="list-sub mono">
          v${preset.version} · profile=${preset.profile} · allow=${preset.alsoAllow.length} · deny=${preset.deny.length}
        </div>
      </div>
      <div class="list-meta">
        <div class="muted">Updated ${formatRelativeTimestamp(preset.updatedAtMs)}</div>
        <div class="row" style="justify-content: flex-end; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn--sm" ?disabled=${!props.editable} @click=${() => props.onApplyPreset(preset)}>
            Apply Here
          </button>
          <button class="btn btn--sm" ?disabled=${!props.editable} @click=${() => props.onDuplicatePreset(preset.id)}>
            Duplicate
          </button>
          ${
            assignedToCurrentAgent
              ? html`
                  <button
                    class="btn btn--sm"
                    ?disabled=${!props.editable}
                    @click=${() => props.onAssignAgent(props.currentAgentId, null)}
                  >
                    Unassign Here
                  </button>
                `
              : html`
                  <button
                    class="btn btn--sm"
                    ?disabled=${!props.editable}
                    @click=${() => props.onAssignAgent(props.currentAgentId, preset.id)}
                  >
                    Assign Here
                  </button>
                `
          }
          <button
            class="btn btn--sm"
            ?disabled=${!props.editable || props.allAgentIds.length === 0}
            @click=${() => {
              props.onApplyPresetToAgents(preset, props.allAgentIds);
              props.onBulkAssignAgents(props.allAgentIds, preset.id);
            }}
          >
            Apply to All Agents
          </button>
          ${
            hasProviderTargets
              ? html`
                  <button
                    class="btn btn--sm"
                    ?disabled=${!props.editable}
                    @click=${() => {
                      props.onApplyPresetToProviders(preset, props.providerKeys);
                      props.onBulkAssignProviders(props.providerKeys, preset.id);
                    }}
                  >
                    Apply to Providers/Channels
                  </button>
                `
              : nothing
          }
        </div>
        <details class="policy-presets__edit">
          <summary class="btn btn--sm">Edit</summary>
          <form @submit=${(event: Event) => onUpdateSubmit(event, props, preset.id)}>
            <div class="policy-presets__form-grid">
              <label class="field">
                <span>Name</span>
                <input name="name" .value=${preset.name} ?disabled=${!props.editable} required />
              </label>
              <label class="field">
                <span>Description</span>
                <input name="description" .value=${preset.description} ?disabled=${!props.editable} />
              </label>
              <label class="field">
                <span>Profile</span>
                <select name="profile" .value=${preset.profile} ?disabled=${!props.editable}>
                  <option value="minimal">minimal</option>
                  <option value="coding">coding</option>
                  <option value="messaging">messaging</option>
                  <option value="full">full</option>
                </select>
              </label>
            </div>
            <div class="policy-presets__form-grid">
              <label class="field">
                <span>Also Allow</span>
                <textarea
                  name="alsoAllow"
                  rows="2"
                  ?disabled=${!props.editable}
                  .value=${preset.alsoAllow.join(", ")}
                ></textarea>
              </label>
              <label class="field">
                <span>Deny</span>
                <textarea
                  name="deny"
                  rows="2"
                  ?disabled=${!props.editable}
                  .value=${preset.deny.join(", ")}
                ></textarea>
              </label>
            </div>
            <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 8px;">
              <button class="btn btn--sm primary" type="submit" ?disabled=${!props.editable}>
                Save v${preset.version + 1}
              </button>
            </div>
          </form>
        </details>
        <details class="policy-presets__delete">
          <summary class="btn btn--sm danger">Delete</summary>
          <div class="callout warn" style="margin-top: 8px;">
            Delete preset <span class="mono">${preset.name}</span>? This also clears any assignments.
          </div>
          <div class="row" style="justify-content: flex-end; gap: 8px; margin-top: 8px;">
            <button class="btn btn--sm danger" ?disabled=${!props.editable} @click=${() => props.onDeletePreset(preset.id)}>
              Confirm Delete
            </button>
          </div>
        </details>
      </div>
    </div>
  `;
}

function resolvePresetName(presets: ToolPolicyPreset[], presetId: string) {
  return presets.find((preset) => preset.id === presetId)?.name ?? null;
}

function onCreateSubmit(event: Event, props: PolicyPresetManagerProps) {
  event.preventDefault();
  if (!props.editable) {
    return;
  }
  const form = event.currentTarget as HTMLFormElement;
  const input = readPresetForm(form);
  props.onCreatePreset({
    ...input,
    profile: input.profile || props.profile,
  });
  form.reset();
}

function onUpdateSubmit(event: Event, props: PolicyPresetManagerProps, presetId: string) {
  event.preventDefault();
  if (!props.editable) {
    return;
  }
  const form = event.currentTarget as HTMLFormElement;
  const input = readPresetForm(form);
  props.onUpdatePreset(presetId, input);
}

function readPresetForm(form: HTMLFormElement): ToolPolicyPresetInput {
  const formData = new FormData(form);
  return {
    name: readFormString(formData, "name").trim(),
    description: readFormString(formData, "description").trim(),
    profile: readFormString(formData, "profile", "full").trim() || "full",
    alsoAllow: parsePolicyList(readFormString(formData, "alsoAllow")),
    deny: parsePolicyList(readFormString(formData, "deny")),
  };
}

function readFormString(formData: FormData, key: string, fallback = ""): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : fallback;
}

function parsePolicyList(input: string): string[] {
  return input
    .split(/[\n,]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
