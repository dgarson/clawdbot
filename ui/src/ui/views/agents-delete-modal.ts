import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";

export function renderAgentsDeleteModal(state: AppViewState) {
  const { agentsDeleteConfirm: agentId } = state;
  if (!agentId) {
    return nothing;
  }

  return html`
    <div class="exec-approval-overlay" role="dialog" aria-modal="true" aria-live="polite">
      <div class="exec-approval-card">
        <div class="exec-approval-header">
          <div>
            <div class="exec-approval-title">Delete Agent?</div>
            <div class="exec-approval-sub">Agent ID: ${agentId}</div>
          </div>
        </div>
        <div class="callout danger" style="margin-top: 12px;">
          This will permanently delete the agent's configuration, workspace, and history. 
          This action cannot be undone.
        </div>
        <div class="exec-approval-actions">
          <button
            class="btn danger"
            ?disabled=${state.agentsLoading}
            @click=${() => state.handleAgentsDeleteConfirm()}
          >
            ${state.agentsLoading ? "Deleting..." : "Delete Permanently"}
          </button>
          <button
            class="btn"
            ?disabled=${state.agentsLoading}
            @click=${() => state.handleAgentsDeleteCancel()}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;
}
