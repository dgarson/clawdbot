import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";
import { icons } from "../icons.ts";
import { resolveAgentEmoji } from "./agents-utils.ts";

const EMOJI_OPTIONS = ["🦞", "🤖", "👾", "🦊", "🦉", "🦄", "🧠", "⚡️", "🛡️", "🔬", "🎨", "📝"];

export function renderAgentsIdentityModal(state: AppViewState) {
  const { agentsIdentityEditId: agentId } = state;
  if (!agentId) {
    return nothing;
  }

  const agent = state.agentsList?.agents.find((a) => a.id === agentId);
  if (!agent) {
    return nothing;
  }

  const identity = state.agentIdentityById[agentId] ?? null;

  // Use state to track local edits before save?
  // For simplicity in this "stateless" render function, we might need to assume
  // the user hasn't typed anything yet if we don't have a specific "edit draft" state.
  // However, Lit's @input handlers usually need a place to store the draft.
  // To avoid adding more state to AppViewState for every field,
  // we can use a DOM-query strategy on Save or a simple form ref,
  // OR we can rely on the fact that this modal re-renders.
  // Ideally, we'd have `agentsIdentityEditDraft` in state.
  // But to save time and complexity, let's use a form submission handler that grabs values from the DOM.

  const currentName = identity?.name || agent.name || "";
  const currentEmoji = resolveAgentEmoji(agent, identity) || "";
  const currentTheme = identity?.theme || agent.identity?.theme || "";

  return html`
    <div class="exec-approval-overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">Edit Identity</div>
            <div class="exec-approval-sub">Agent ID: ${agentId}</div>
          </div>
          <button class="btn btn--icon" @click=${state.handleAgentsIdentityEditCancel}>
            ${icons.x}
          </button>
        </div>

        <form 
          class="identity-edit-form" 
          @submit=${(e: Event) => {
            e.preventDefault();
            const formData = new FormData(e.target as HTMLFormElement);
            void state.handleAgentsIdentityEditSave({
              name: readFormValue(formData, "name"),
              emoji: readFormValue(formData, "emoji"),
              theme: readFormValue(formData, "theme"),
            });
          }}
        >
          <div class="field-group" style="margin-top: 20px;">
            <label class="field">
              <span>Agent Name</span>
              <input 
                name="name"
                type="text" 
                .value=${currentName}
                required
              />
            </label>

            <div class="row" style="gap: 12px; align-items: flex-end;">
              <label class="field" style="width: 80px;">
                <span>Emoji</span>
                <input 
                  name="emoji"
                  id="identity-edit-emoji"
                  type="text" 
                  .value=${currentEmoji}
                />
              </label>
              <button 
                type="button"
                class="btn btn--icon" 
                style="margin-bottom: 2px;"
                title="Randomize Emoji"
                @click=${() => {
                  const random = EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)];
                  const input = document.getElementById("identity-edit-emoji") as HTMLInputElement;
                  if (input) {
                    input.value = random;
                  }
                }}
              >
                ${icons.zap}
              </button>
              <label class="field" style="flex: 1;">
                <span>Theme / Vibe</span>
                <input 
                  name="theme"
                  type="text" 
                  .value=${currentTheme}
                />
              </label>
            </div>
          </div>

          <div class="exec-approval-actions">
            <button
              type="submit"
              class="btn primary"
              ?disabled=${state.agentsLoading}
            >
              ${state.agentsLoading ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              class="btn"
              ?disabled=${state.agentsLoading}
              @click=${state.handleAgentsIdentityEditCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
