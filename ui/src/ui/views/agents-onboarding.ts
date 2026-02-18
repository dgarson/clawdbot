import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";
import { icons } from "../icons.ts";
import { buildModelOptions } from "./agents-utils.ts";

export function renderAgentsOnboarding(state: AppViewState) {
  if (!state.agentsOnboarding) {
    return nothing;
  }

  const { agentsOnboardingStep: step, agentsOnboardingData: data } = state;

  return html`
    <div class="exec-approval-overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div class="exec-approval-card onboarding-wizard">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">Create New Agent</div>
            <div class="exec-approval-sub">Step ${step} of 3</div>
          </div>
          <button class="btn btn--icon" @click=${state.handleAgentsOnboardingCancel}>
            ${icons.x}
          </button>
        </div>

        <div class="onboarding-content">
          ${step === 1 ? renderStep1(state) : nothing}
          ${step === 2 ? renderStep2(state) : nothing}
          ${step === 3 ? renderStep3(state) : nothing}
        </div>

        <div class="exec-approval-actions">
          ${
            step > 1
              ? html`
                <button class="btn" @click=${state.handleAgentsOnboardingBack}>
                  Back
                </button>
              `
              : html`
                <button class="btn" @click=${state.handleAgentsOnboardingCancel}>
                  Cancel
                </button>
              `
          }
          
          <div style="flex: 1;"></div>

          ${
            step < 3
              ? html`
                <button 
                  class="btn primary" 
                  ?disabled=${!isStepValid(step, data)}
                  @click=${state.handleAgentsOnboardingNext}
                >
                  Next
                </button>
              `
              : html`
                <button 
                  class="btn primary" 
                  ?disabled=${!isStepValid(step, data)}
                  @click=${state.handleAgentsOnboardingSubmit}
                >
                  Create Agent
                </button>
              `
          }
        </div>
      </div>
    </div>
  `;
}

function isStepValid(step: number, data: AppViewState["agentsOnboardingData"]): boolean {
  if (step === 1) {
    return data.name.trim().length > 0;
  }
  if (step === 2) {
    return true; // model and workspace can have defaults
  }
  return true;
}

const EMOJI_OPTIONS = ["🦞", "🤖", "👾", "🦊", "🦉", "🦄", "🧠", "⚡️", "🛡️", "🔬", "🎨", "📝"];

function renderStep1(state: AppViewState) {
  const { agentsOnboardingData: data } = state;
  return html`
    <div class="onboarding-step">
      <h3>Identity & Vibe</h3>
      <p class="muted">Define who this agent is and how they should present themselves.</p>
      
      <div class="field-group" style="margin-top: 20px;">
        <label class="field">
          <span>Agent Name</span>
          <input 
            type="text" 
            placeholder="e.g. Research Assistant" 
            .value=${data.name}
            @input=${(e: Event) => state.handleAgentsOnboardingUpdate({ name: (e.target as HTMLInputElement).value })}
          />
        </label>

        <div class="row" style="gap: 12px; align-items: flex-end;">
          <label class="field" style="width: 80px;">
            <span>Emoji</span>
            <input 
              type="text" 
              .value=${data.emoji}
              @input=${(e: Event) => state.handleAgentsOnboardingUpdate({ emoji: (e.target as HTMLInputElement).value })}
            />
          </label>
          <button 
            class="btn btn--icon" 
            style="margin-bottom: 2px;"
            title="Randomize Emoji"
            @click=${() => {
              const random = EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)];
              state.handleAgentsOnboardingUpdate({ emoji: random });
            }}
          >
            ${icons.zap}
          </button>
          <label class="field" style="flex: 1;">
            <span>Theme / Vibe</span>
            <input 
              type="text" 
              placeholder="e.g. Professional and concise" 
              .value=${data.theme}
              @input=${(e: Event) => state.handleAgentsOnboardingUpdate({ theme: (e.target as HTMLInputElement).value })}
            />
          </label>
        </div>
      </div>

      <div class="callout info" style="margin-top: 20px;">
        <strong>Smart Tip:</strong> This will automatically create an <code>IDENTITY.md</code> and seed a <code>SOUL.md</code> in your agent's workspace.
      </div>
    </div>
  `;
}

function renderStep2(state: AppViewState) {
  const { agentsOnboardingData: data } = state;
  return html`
    <div class="onboarding-step">
      <h3>Capability & Workspace</h3>
      <p class="muted">Where should this agent live and what brain should it use?</p>

      <div class="field-group" style="margin-top: 20px;">
        <label class="field">
          <span>Primary Model (Optional)</span>
          <select
            .value=${data.model}
            @change=${(e: Event) => state.handleAgentsOnboardingUpdate({ model: (e.target as HTMLSelectElement).value })}
          >
            <option value="">Use Global Default</option>
            ${buildModelOptions(state.configForm, data.model)}
          </select>
          <div class="field-hint">Leave blank to inherit global default.</div>
        </label>

        <label class="field">
          <span>Workspace Directory</span>
          <input 
            type="text" 
            placeholder="~/.openclaw/workspace-new" 
            .value=${data.workspace}
            @input=${(e: Event) => state.handleAgentsOnboardingUpdate({ workspace: (e.target as HTMLInputElement).value })}
          />
          <div class="field-hint">Absolute path where agent files will be stored.</div>
        </label>
      </div>
    </div>
  `;
}

function renderStep3(state: AppViewState) {
  const { agentsOnboardingData: data, channelsSnapshot } = state;
  const channelIds = channelsSnapshot?.channelMeta?.map((m) => m.id) || [];

  return html`
    <div class="onboarding-step">
      <h3>Connectivity</h3>
      <p class="muted">Which channels should be routed to this agent?</p>

      <div class="channel-grid" style="margin-top: 20px;">
        ${
          channelIds.length === 0
            ? html`
                <p class="muted">No channels configured. You can set this up later.</p>
              `
            : channelIds.map(
                (id) => html`
            <label class="checkbox-row">
              <input 
                type="checkbox" 
                ?checked=${data.channels.includes(id)}
                @change=${(e: Event) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  const next = checked
                    ? [...data.channels, id]
                    : data.channels.filter((c) => c !== id);
                  state.handleAgentsOnboardingUpdate({ channels: next });
                }}
              />
              <span>${id}</span>
            </label>
          `,
              )
        }
      </div>

      <div class="callout info" style="margin-top: 20px;">
        You can always change routing and add more advanced inter-agent communication rules in the <strong>Advanced</strong> panel after creation.
      </div>
    </div>
  `;
}
