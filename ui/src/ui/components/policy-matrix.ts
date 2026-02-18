import { html } from "lit";
import { renderStatusList, type StatusListItem } from "./core-cards.ts";

export type PolicyMatrixTool = {
  id: string;
  label: string;
  description: string;
  allowed: boolean;
  baseAllowed: boolean;
  denied: boolean;
};

export type PolicyMatrixSection = {
  id: string;
  label: string;
  tools: PolicyMatrixTool[];
};

export type PolicyMatrixProps = {
  sections: PolicyMatrixSection[];
  editable: boolean;
  enabledCount: number;
  totalCount: number;
  onToggleTool: (toolId: string, enabled: boolean) => void;
  onToggleSection: (sectionId: string, enabled: boolean) => void;
  onToggleAll: (enabled: boolean) => void;
};

export function renderPolicyMatrix(props: PolicyMatrixProps) {
  const headerItems: StatusListItem[] = [
    {
      label: "Effective Access",
      value: `${props.enabledCount}/${props.totalCount} enabled`,
      tone: "ok",
    },
    {
      label: "Sections",
      value: `${props.sections.length}`,
    },
  ];

  return html`
    <section class="policy-matrix">
      <div class="policy-matrix__header">
        ${renderStatusList(headerItems, "inline")}
        <div class="row" style="gap: 8px;">
          <button class="btn btn--sm" ?disabled=${!props.editable} @click=${() => props.onToggleAll(true)}>
            Enable All
          </button>
          <button class="btn btn--sm" ?disabled=${!props.editable} @click=${() => props.onToggleAll(false)}>
            Disable All
          </button>
        </div>
      </div>

      <div class="policy-matrix__grid">
        ${props.sections.map((section) => {
          const sectionAllowed = section.tools.filter((tool) => tool.allowed).length;
          const sectionTotal = section.tools.length;
          const enableSection = sectionAllowed !== sectionTotal;
          return html`
            <div class="policy-matrix__section">
              <div class="policy-matrix__section-header">
                <div>
                  <div class="policy-matrix__section-title">${section.label}</div>
                  <div class="muted mono">${sectionAllowed}/${sectionTotal}</div>
                </div>
                <button
                  class="btn btn--sm"
                  ?disabled=${!props.editable}
                  @click=${() => props.onToggleSection(section.id, enableSection)}
                >
                  ${enableSection ? "Enable Section" : "Disable Section"}
                </button>
              </div>
              <div class="policy-matrix__tools">
                ${section.tools.map((tool) =>
                  renderPolicyToolRow({
                    tool,
                    editable: props.editable,
                    onToggle: props.onToggleTool,
                  }),
                )}
              </div>
            </div>
          `;
        })}
      </div>
    </section>
  `;
}

function renderPolicyToolRow(params: {
  tool: PolicyMatrixTool;
  editable: boolean;
  onToggle: (toolId: string, enabled: boolean) => void;
}) {
  const state = params.tool.denied ? "denied" : params.tool.allowed ? "allowed" : "blocked";
  const toneClass =
    state === "allowed"
      ? "policy-matrix__state--ok"
      : state === "denied"
        ? "policy-matrix__state--danger"
        : "policy-matrix__state--muted";
  return html`
    <div class="policy-matrix__tool-row">
      <div>
        <div class="policy-matrix__tool-title mono">${params.tool.label}</div>
        <div class="policy-matrix__tool-sub">
          ${params.tool.description}
          <span class="policy-matrix__state ${toneClass}">
            ${state}${params.tool.baseAllowed ? " · profile" : ""}
          </span>
        </div>
      </div>
      <label class="cfg-toggle">
        <input
          type="checkbox"
          .checked=${params.tool.allowed}
          ?disabled=${!params.editable}
          @change=${(event: Event) =>
            params.onToggle(params.tool.id, (event.target as HTMLInputElement).checked)}
        />
        <span class="cfg-toggle__track"></span>
      </label>
    </div>
  `;
}
