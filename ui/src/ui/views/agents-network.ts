import { html, nothing } from "lit";
import { resolveAgentConfig } from "./agents-utils.ts";
import type { AgentsPanel } from "./agents.ts";

export function renderAgentNetwork(params: {
  agentId: string;
  configForm: Record<string, unknown> | null;
  configLoading: boolean;
  onConfigSave: () => void;
  onToolsOverridesChange: (agentId: string, alsoAllow: string[], deny: string[]) => void;
  onToolsProfileChange: (agentId: string, profile: string | null, clearAllow: boolean) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
}) {
  const config = resolveAgentConfig(params.configForm, params.agentId);
  const tools = config.entry?.tools || {};

  const profile = tools.profile;
  // If no profile is set, we are in "Explicit Allow" mode (unless tools is empty/undefined, which implies default profile?).
  // Actually, undefined tools usually means "inherit defaults" or "no tools".

  const allowList = tools.allow || [];
  const alsoAllowList = tools.alsoAllow || [];
  const denyList = tools.deny || [];

  // Helper to check if tool is effectively allowed
  const isAllowed = (tool: string) => {
    // 1. Explicitly denied?
    if (denyList.includes(tool)) {
      return false;
    }

    // 2. Explicitly allowed in overrides?
    if (alsoAllowList.includes(tool)) {
      return true;
    }

    // 3. Allowed by profile?
    if (profile === "full" || profile === "coding") {
      return true;
    }
    if (
      profile === "messaging" &&
      [
        "group:messaging",
        "sessions_list",
        "sessions_history",
        "sessions_send",
        "session_status",
      ].includes(tool)
    ) {
      return true;
    }
    if (profile === "minimal" && tool === "session_status") {
      return true;
    }

    // 4. In explicit allow list (if no profile)?
    if (!profile && allowList.includes(tool)) {
      return true;
    }

    return false;
  };

  const canSpawn = isAllowed("sessions_spawn") || isAllowed("group:sessions");

  const handleToggleSpawn = (enabled: boolean) => {
    const tool = "sessions_spawn";

    if (enabled) {
      // Enable logic
      let nextDeny = denyList.filter((t) => t !== tool);
      let nextAlsoAllow = [...alsoAllowList];
      let nextAllow = [...allowList];

      if (profile) {
        // With profile: ensure not denied, and add to alsoAllow if needed
        if (!isAllowed(tool)) {
          // Check if profile covers it
          if (!nextAlsoAllow.includes(tool)) {
            nextAlsoAllow.push(tool);
          }
        }
        params.onToolsOverridesChange(params.agentId, nextAlsoAllow, nextDeny);
      } else {
        // Without profile: add to allow
        if (!nextAllow.includes(tool)) {
          nextAllow.push(tool);
        }
        // We use onToolsProfileChange to update 'allow' if onToolsOverridesChange only handles alsoAllow/deny?
        // ui/src/ui/views/agents.ts passes onToolsOverridesChange which updates 'alsoAllow' and 'deny'.
        // onToolsProfileChange updates 'profile' and can clear 'allow'.
        // We might need a way to update 'allow' specifically.
        // Let's check AppViewState/handlers.
        // updateConfigFormValue can update any path.
        // But here we are passed specific handlers.

        // If we are in "Explicit Mode" (no profile), we should probably treat `alsoAllow` as just `allow`?
        // Or we might need to fix the props passed to this component to allow editing `allow`.

        // For safety/consistency with existing Tools panel logic, let's assume we use 'alsoAllow'
        // as an override even if profile is missing, OR we force a switch to a profile?
        // Actually, let's just use `alsoAllow`. It merges into `allow` in the policy resolver.
        if (!nextAlsoAllow.includes(tool)) {
          nextAlsoAllow.push(tool);
        }
        params.onToolsOverridesChange(params.agentId, nextAlsoAllow, nextDeny);
      }
    } else {
      // Disable logic
      // Add to deny list
      let nextDeny = [...denyList];
      if (!nextDeny.includes(tool)) {
        nextDeny.push(tool);
      }

      // Also remove from alsoAllow/allow to be clean
      let nextAlsoAllow = alsoAllowList.filter((t) => t !== tool);
      // We can't easily edit 'allow' via onToolsOverridesChange.
      // But adding to 'deny' trumps everything.

      params.onToolsOverridesChange(params.agentId, nextAlsoAllow, nextDeny);
    }
  };

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Network & Orchestration</div>
          <div class="card-sub">Manage how this agent interacts with other agents.</div>
        </div>
        <button class="btn btn--sm primary" @click=${params.onConfigSave} ?disabled=${params.configLoading}>
          Save Changes
        </button>
      </div>

      <div class="stat-grid" style="margin-top: 20px;">
        <div class="stat">
          <div class="stat-label">Sub-Agent Spawning</div>
          <div class="row" style="margin-top: 8px;">
            <label class="switch">
              <input 
                type="checkbox" 
                ?checked=${canSpawn} 
                @change=${(e: Event) => handleToggleSpawn((e.target as HTMLInputElement).checked)}
              />
              <span class="slider round"></span>
            </label>
            <span class="stat-value" style="font-size: 1.1rem;">${canSpawn ? "Allowed" : "Denied"}</span>
          </div>
          <div class="stat-sub" style="margin-top: 8px;">
            ${
              canSpawn
                ? "Agent can spawn and delegate tasks to sub-agents."
                : "Agent cannot spawn new sub-agent sessions."
            }
          </div>
        </div>
      </div>

      ${
        profile
          ? html`
            <div class="callout info" style="margin-top: 20px;">
              <div style="font-weight: 500; margin-bottom: 4px;">Configuration Mode: ${profile} Profile</div>
              Permissions are derived from the <strong>${profile}</strong> tool profile. 
              ${
                canSpawn && !alsoAllowList.includes("sessions_spawn")
                  ? "Spawning is enabled by default in this profile."
                  : ""
              }
              ${
                canSpawn && alsoAllowList.includes("sessions_spawn")
                  ? "Spawning is explicitly enabled via override."
                  : ""
              }
              ${
                !canSpawn && denyList.includes("sessions_spawn")
                  ? "Spawning is explicitly denied."
                  : ""
              }
            </div>
          `
          : nothing
      }
      
      <div style="margin-top: 32px;">
        <div class="card-title" style="font-size: 0.95rem; margin-bottom: 12px;">Delegation Rules</div>
        <div class="callout info">
          To configure specific delegation logic (e.g. "If user asks about code, call the Coding Agent"), 
          edit the <strong>AGENTS.md</strong> file in the <a href="#" @click=${(e: Event) => {
            e.preventDefault();
            params.onSelectPanel("files");
          }}>Files</a> panel. 
          Use the <code>sessions_spawn</code> tool description or system prompt instructions to guide the agent.
        </div>
      </div>

      <!-- Graph Visualization Placeholder -->
      <div style="margin-top: 32px;">
        <div class="card-title" style="font-size: 0.95rem; margin-bottom: 12px;">Topology Visualization</div>
        <div class="network-graph-placeholder" style="
          height: 240px; 
          background: var(--bg-dim); 
          border-radius: var(--radius-md); 
          display: flex; 
          flex-direction: column;
          align-items: center; 
          justify-content: center;
          color: var(--muted);
          border: 1px dashed var(--border);
          position: relative;
          overflow: hidden;
        ">
          <!-- Fake Node Graph -->
          <svg width="200" height="120" viewBox="0 0 200 120" style="opacity: 0.4;">
            <circle cx="100" cy="20" r="15" fill="currentColor" />
            <line x1="100" y1="35" x2="60" y2="80" stroke="currentColor" stroke-width="2" />
            <line x1="100" y1="35" x2="140" y2="80" stroke="currentColor" stroke-width="2" />
            <circle cx="60" cy="80" r="10" fill="currentColor" />
            <circle cx="140" cy="80" r="10" fill="currentColor" />
          </svg>
          <div style="margin-top: 12px; font-weight: 500;">Network Graph</div>
          <div style="font-size: 0.8rem;">Visualize active parent/child relationships.</div>
        </div>
      </div>
    </section>
  `;
}
