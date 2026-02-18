import { html } from "lit";

type PolicyProfile = {
  id: string;
  label: string;
};

export type PolicyEditorProps = {
  editable: boolean;
  profile: string;
  profileSource: string;
  profiles: readonly PolicyProfile[];
  alsoAllow: string[];
  deny: string[];
  onProfileChange: (profile: string | null, clearAllow: boolean) => void;
  onOverridesChange: (alsoAllow: string[], deny: string[]) => void;
};

export function renderPolicyEditor(props: PolicyEditorProps) {
  const allowText = props.alsoAllow.join(", ");
  const denyText = props.deny.join(", ");
  return html`
    <section class="policy-editor">
      <div class="policy-editor__meta">
        <div class="agent-kv">
          <div class="label">Profile</div>
          <div class="mono">${props.profile}</div>
        </div>
        <div class="agent-kv">
          <div class="label">Source</div>
          <div>${props.profileSource}</div>
        </div>
      </div>

      <div class="policy-editor__presets">
        <div class="label">Quick Presets</div>
        <div class="policy-editor__preset-buttons">
          ${props.profiles.map(
            (option) => html`
              <button
                class="btn btn--sm ${props.profile === option.id ? "active" : ""}"
                ?disabled=${!props.editable}
                @click=${() => props.onProfileChange(option.id, true)}
              >
                ${option.label}
              </button>
            `,
          )}
          <button
            class="btn btn--sm"
            ?disabled=${!props.editable}
            @click=${() => props.onProfileChange(null, false)}
          >
            Inherit
          </button>
        </div>
      </div>

      <div class="policy-editor__lists">
        <label class="field">
          <span>Also Allow (patterns)</span>
          <textarea
            rows="2"
            ?disabled=${!props.editable}
            .value=${allowText}
            placeholder="group:fs, web_search, plugin:*"
            @input=${(event: Event) => {
              const nextAllow = parsePolicyList((event.target as HTMLTextAreaElement).value);
              props.onOverridesChange(nextAllow, props.deny);
            }}
          ></textarea>
        </label>
        <label class="field">
          <span>Deny (patterns)</span>
          <textarea
            rows="2"
            ?disabled=${!props.editable}
            .value=${denyText}
            placeholder="exec, process, group:runtime"
            @input=${(event: Event) => {
              const nextDeny = parsePolicyList((event.target as HTMLTextAreaElement).value);
              props.onOverridesChange(props.alsoAllow, nextDeny);
            }}
          ></textarea>
        </label>
      </div>
      <div class="muted" style="margin-top: 6px;">
        Supports comma or newline separated entries. Wildcards like <span class="mono">*</span> are allowed.
      </div>
    </section>
  `;
}

function parsePolicyList(input: string): string[] {
  return input
    .split(/[\n,]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
