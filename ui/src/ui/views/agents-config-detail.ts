import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";
import {
  normalizeAgentLabel,
  resolveAgentEmoji,
  resolveAgentConfig,
  resolveModelLabel,
} from "./agents-utils.ts";

export function renderAgentConfigDetail(state: AppViewState, agentId: string) {
  const agent = state.agentsList?.agents.find((a) => a.id === agentId);
  if (!agent) {
    return nothing;
  }

  const config = resolveAgentConfig(state.configForm, agent.id);
  const identity = state.agentIdentityById[agentId] ?? null;

  return html`
    <div class="agent-config-detail">
      <div class="detail-header">
        <div class="agent-avatar agent-avatar--lg">
          ${resolveAgentEmoji(agent, identity) || normalizeAgentLabel(agent).slice(0, 1)}
        </div>
        <div class="detail-title-group">
          <h2>${normalizeAgentLabel(agent)}</h2>
          <div class="mono muted">${agent.id}</div>
        </div>
      </div>

      <div class="config-grid">
        ${renderConfigGroup(
          "Identity",
          html`
          <div class="agent-kv">
            <div class="label">Name</div>
            <div>${identity?.name || agent.name || "-"}</div>
          </div>
          <div class="agent-kv">
            <div class="label">Emoji</div>
            <div>${identity?.emoji || agent.identity?.emoji || "-"}</div>
          </div>
          <div class="agent-kv">
            <div class="label">Theme</div>
            <div>${identity?.theme || agent.identity?.theme || "-"}</div>
          </div>
        `,
          () => state.handleAgentsIdentityEditStart(agentId),
        )}

        ${renderConfigGroup(
          "Model & Brain",
          html`
          <div class="agent-kv">
            <div class="label">Primary Model</div>
            <div class="mono">${resolveModelLabel(config.entry?.model) || "Inherited"}</div>
          </div>
          <div class="agent-kv">
            <div class="label">Workspace</div>
            <div class="mono">${config.entry?.workspace || "Default"}</div>
          </div>
        `,
          () => (state.agentsPanel = "overview"),
        )}

        ${renderConfigGroup(
          "Capabilities (Skills)",
          html`
          <div class="skill-summary">
            ${
              Array.isArray(config.entry?.skills)
                ? html`<span class="chip">${config.entry.skills.length} skills enabled</span>`
                : html`
                    <span class="chip chip-ok">All skills available</span>
                  `
            }
          </div>
        `,
          () => (state.agentsPanel = "skills"),
        )}

        ${renderConfigGroup(
          "Connectivity",
          html`
          <div class="agent-kv">
            <div class="label">Active Channels</div>
            <div>${agent.bindings?.length || "0"}</div>
          </div>
          ${
            agent.bindings && agent.bindings.length > 0
              ? html`
                <div class="channel-chips" style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px;">
                  ${agent.bindings.map((b) => html`<span class="chip">${b.channel}</span>`)}
                </div>
              `
              : nothing
          }
        `,
          () => (state.agentsPanel = "channels"),
        )}
      </div>
    </div>
  `;
}

function renderConfigGroup(title: string, content: ReturnType<typeof html>, onEdit: () => void) {
  return html`
    <section class="card config-group">
      <div class="card-header row" style="justify-content: space-between; margin-bottom: 12px;">
        <div class="card-title" style="font-size: 0.9rem;">${title}</div>
        <button class="btn btn--sm" @click=${onEdit}>Edit</button>
      </div>
      <div class="config-group-content">
        ${content}
      </div>
    </section>
  `;
}
