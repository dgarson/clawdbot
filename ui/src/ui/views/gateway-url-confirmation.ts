import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";

export function renderGatewayUrlConfirmation(state: AppViewState) {
  const { pendingGatewayUrl } = state;
  if (!pendingGatewayUrl) {
    return nothing;
  }

  return html`
    <oc-modal heading="Change Gateway URL" open .dismissible=${false}>
      <div class="exec-approval-sub">This will reconnect to a different gateway server</div>
      <div class="exec-approval-command mono">${pendingGatewayUrl}</div>
      <oc-callout variant="danger">
        Only confirm if you trust this URL. Malicious URLs can compromise your system.
      </oc-callout>

      <oc-button
        slot="footer"
        variant="primary"
        @click=${() => state.handleGatewayUrlConfirm()}
      >
        Confirm
      </oc-button>
      <oc-button
        slot="footer"
        @click=${() => state.handleGatewayUrlCancel()}
      >
        Cancel
      </oc-button>
    </oc-modal>
  `;
}
