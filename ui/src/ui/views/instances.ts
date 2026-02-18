import { html, nothing } from "lit";
import type { PresenceEntry } from "../types.ts";
import { formatPresenceAge, formatPresenceSummary } from "../presenter.ts";

export type InstancesProps = {
  loading: boolean;
  entries: PresenceEntry[];
  lastError: string | null;
  statusMessage: string | null;
  onRefresh: () => void;
};

export function renderInstances(props: InstancesProps) {
  return html`
    <oc-card title="Connected Instances" subtitle="Presence beacons from the gateway and clients.">
      <oc-button slot="actions" .loading=${props.loading} @click=${props.onRefresh}>
        Refresh
      </oc-button>
      ${
        props.lastError
          ? html`<oc-callout variant="danger">
            ${props.lastError}
          </oc-callout>`
          : nothing
      }
      ${
        props.statusMessage
          ? html`<oc-callout>
            ${props.statusMessage}
          </oc-callout>`
          : nothing
      }
      <div class="list" style="margin-top: 16px;">
        ${
          props.entries.length === 0
            ? html`
                <div class="muted">No instances reported yet.</div>
              `
            : props.entries.map((entry) => renderEntry(entry))
        }
      </div>
    </oc-card>
  `;
}

function renderEntry(entry: PresenceEntry) {
  const lastInput = entry.lastInputSeconds != null ? `${entry.lastInputSeconds}s ago` : "n/a";
  const mode = entry.mode ?? "unknown";
  const roles = Array.isArray(entry.roles) ? entry.roles.filter(Boolean) : [];
  const scopes = Array.isArray(entry.scopes) ? entry.scopes.filter(Boolean) : [];
  const scopesLabel =
    scopes.length > 0
      ? scopes.length > 3
        ? `${scopes.length} scopes`
        : `scopes: ${scopes.join(", ")}`
      : null;
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${entry.host ?? "unknown host"}</div>
        <div class="list-sub">${formatPresenceSummary(entry)}</div>
        <div class="chip-row">
          <span class="chip">${mode}</span>
          ${roles.map((role) => html`<span class="chip">${role}</span>`)}
          ${scopesLabel ? html`<span class="chip">${scopesLabel}</span>` : nothing}
          ${entry.platform ? html`<span class="chip">${entry.platform}</span>` : nothing}
          ${entry.deviceFamily ? html`<span class="chip">${entry.deviceFamily}</span>` : nothing}
          ${
            entry.modelIdentifier
              ? html`<span class="chip">${entry.modelIdentifier}</span>`
              : nothing
          }
          ${entry.version ? html`<span class="chip">${entry.version}</span>` : nothing}
        </div>
      </div>
      <div class="list-meta">
        <div>${formatPresenceAge(entry)}</div>
        <div class="muted">Last input ${lastInput}</div>
        <div class="muted">Reason ${entry.reason ?? ""}</div>
      </div>
    </div>
  `;
}
