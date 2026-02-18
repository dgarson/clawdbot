import { html, nothing } from "lit";
import type { ConfigUiHints } from "../types.ts";
import { hintForPath, humanize, schemaType, type JsonSchema } from "./config-form.shared.ts";
import { analyzeConfigSchema, renderConfigForm, SECTION_META } from "./config-form.ts";

export type ConfigProps = {
  raw: string;
  originalRaw: string;
  valid: boolean | null;
  issues: unknown[];
  loading: boolean;
  saving: boolean;
  applying: boolean;
  updating: boolean;
  connected: boolean;
  schema: unknown;
  schemaLoading: boolean;
  uiHints: ConfigUiHints;
  formMode: "form" | "raw";
  formValue: Record<string, unknown> | null;
  originalValue: Record<string, unknown> | null;
  searchQuery: string;
  activeSection: string | null;
  activeSubsection: string | null;
  onRawChange: (next: string) => void;
  onFormModeChange: (mode: "form" | "raw") => void;
  onFormPatch: (path: Array<string | number>, value: unknown) => void;
  onSearchChange: (query: string) => void;
  onSectionChange: (section: string | null) => void;
  onSubsectionChange: (section: string | null) => void;
  onReload: () => void;
  onSave: () => void;
  onApply: () => void;
  onUpdate: () => void;
};

// Section definitions
const SECTIONS: Array<{ key: string; label: string }> = [
  { key: "env", label: "Environment" },
  { key: "update", label: "Updates" },
  { key: "agents", label: "Agents" },
  { key: "auth", label: "Authentication" },
  { key: "channels", label: "Channels" },
  { key: "messages", label: "Messages" },
  { key: "commands", label: "Commands" },
  { key: "hooks", label: "Hooks" },
  { key: "skills", label: "Skills" },
  { key: "tools", label: "Tools" },
  { key: "gateway", label: "Gateway" },
  { key: "wizard", label: "Setup Wizard" },
];

type SubsectionEntry = {
  key: string;
  label: string;
  description?: string;
  order: number;
};

const ALL_SUBSECTION = "__all__";

function resolveSectionMeta(
  key: string,
  schema?: JsonSchema,
): {
  label: string;
  description?: string;
} {
  const meta = SECTION_META[key];
  if (meta) {
    return meta;
  }
  return {
    label: schema?.title ?? humanize(key),
    description: schema?.description ?? "",
  };
}

function resolveSubsections(params: {
  key: string;
  schema: JsonSchema | undefined;
  uiHints: ConfigUiHints;
}): SubsectionEntry[] {
  const { key, schema, uiHints } = params;
  if (!schema || schemaType(schema) !== "object" || !schema.properties) {
    return [];
  }
  const entries = Object.entries(schema.properties).map(([subKey, node]) => {
    const hint = hintForPath([key, subKey], uiHints);
    const label = hint?.label ?? node.title ?? humanize(subKey);
    const description = hint?.help ?? node.description ?? "";
    const order = hint?.order ?? 50;
    return { key: subKey, label, description, order };
  });
  entries.sort((a, b) => (a.order !== b.order ? a.order - b.order : a.key.localeCompare(b.key)));
  return entries;
}

function computeDiff(
  original: Record<string, unknown> | null,
  current: Record<string, unknown> | null,
): Array<{ path: string; from: unknown; to: unknown }> {
  if (!original || !current) {
    return [];
  }
  const changes: Array<{ path: string; from: unknown; to: unknown }> = [];

  function compare(orig: unknown, curr: unknown, path: string) {
    if (orig === curr) {
      return;
    }
    if (typeof orig !== typeof curr) {
      changes.push({ path, from: orig, to: curr });
      return;
    }
    if (typeof orig !== "object" || orig === null || curr === null) {
      if (orig !== curr) {
        changes.push({ path, from: orig, to: curr });
      }
      return;
    }
    if (Array.isArray(orig) && Array.isArray(curr)) {
      if (JSON.stringify(orig) !== JSON.stringify(curr)) {
        changes.push({ path, from: orig, to: curr });
      }
      return;
    }
    const origObj = orig as Record<string, unknown>;
    const currObj = curr as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(origObj), ...Object.keys(currObj)]);
    for (const key of allKeys) {
      compare(origObj[key], currObj[key], path ? `${path}.${key}` : key);
    }
  }

  compare(original, current, "");
  return changes;
}

function truncateValue(value: unknown, maxLen = 40): string {
  let str: string;
  try {
    const json = JSON.stringify(value);
    str = json ?? String(value);
  } catch {
    str = String(value);
  }
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 3) + "...";
}

export function renderConfig(props: ConfigProps) {
  const validity = props.valid == null ? "unknown" : props.valid ? "valid" : "invalid";
  const analysis = analyzeConfigSchema(props.schema);
  const formUnsafe = analysis.schema ? analysis.unsupportedPaths.length > 0 : false;

  // Get available sections from schema
  const schemaProps = analysis.schema?.properties ?? {};
  const availableSections = SECTIONS.filter((s) => s.key in schemaProps);

  // Add any sections in schema but not in our list
  const knownKeys = new Set(SECTIONS.map((s) => s.key));
  const extraSections = Object.keys(schemaProps)
    .filter((k) => !knownKeys.has(k))
    .map((k) => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }));

  const allSections = [...availableSections, ...extraSections];

  const activeSectionSchema =
    props.activeSection && analysis.schema && schemaType(analysis.schema) === "object"
      ? analysis.schema.properties?.[props.activeSection]
      : undefined;
  const activeSectionMeta = props.activeSection
    ? resolveSectionMeta(props.activeSection, activeSectionSchema)
    : null;
  const subsections = props.activeSection
    ? resolveSubsections({
        key: props.activeSection,
        schema: activeSectionSchema,
        uiHints: props.uiHints,
      })
    : [];
  const allowSubnav =
    props.formMode === "form" && Boolean(props.activeSection) && subsections.length > 0;
  const isAllSubsection = props.activeSubsection === ALL_SUBSECTION;
  const effectiveSubsection = props.searchQuery
    ? null
    : isAllSubsection
      ? null
      : (props.activeSubsection ?? subsections[0]?.key ?? null);

  // Compute diff for showing changes (works for both form and raw modes)
  const diff = props.formMode === "form" ? computeDiff(props.originalValue, props.formValue) : [];
  const hasRawChanges = props.formMode === "raw" && props.raw !== props.originalRaw;
  const hasChanges = props.formMode === "form" ? diff.length > 0 : hasRawChanges;

  // Save/apply buttons require actual changes to be enabled.
  // Note: formUnsafe warns about unsupported schema paths but shouldn't block saving.
  const canSaveForm = Boolean(props.formValue) && !props.loading && Boolean(analysis.schema);
  const canSave =
    props.connected &&
    !props.saving &&
    hasChanges &&
    (props.formMode === "raw" ? true : canSaveForm);
  const canApply =
    props.connected &&
    !props.applying &&
    !props.updating &&
    hasChanges &&
    (props.formMode === "raw" ? true : canSaveForm);
  const canUpdate = props.connected && !props.applying && !props.updating;

  return html`
    <div class="config-layout">
      <!-- Sidebar -->
      <aside class="config-sidebar">
        <div class="config-sidebar__header">
          <div class="config-sidebar__title">Settings</div>
          <oc-pill size="sm" variant=${validity === "valid" ? "ok" : validity === "invalid" ? "danger" : ""}>${validity}</oc-pill>
        </div>

        <!-- Search -->
        <div class="config-search">
          <svg
            class="config-search__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            class="config-search__input"
            placeholder="Search settings..."
            .value=${props.searchQuery}
            @input=${(e: Event) => props.onSearchChange((e.target as HTMLInputElement).value)}
          />
          ${
            props.searchQuery
              ? html`
                <button
                  class="config-search__clear"
                  @click=${() => props.onSearchChange("")}
                >
                  ×
                </button>
              `
              : nothing
          }
        </div>

        <!-- Section nav -->
        <nav class="config-nav">
          <button
            class="config-nav__item ${props.activeSection === null ? "active" : ""}"
            @click=${() => props.onSectionChange(null)}
          >
            <span class="config-nav__icon"><oc-icon name="all"></oc-icon></span>
            <span class="config-nav__label">All Settings</span>
          </button>
          ${allSections.map(
            (section) => html`
              <button
                class="config-nav__item ${props.activeSection === section.key ? "active" : ""}"
                @click=${() => props.onSectionChange(section.key)}
              >
                <span class="config-nav__icon"><oc-icon .name=${section.key}></oc-icon></span>
                <span class="config-nav__label">${section.label}</span>
              </button>
            `,
          )}
        </nav>

        <!-- Mode toggle at bottom -->
        <div class="config-sidebar__footer">
          <div class="config-mode-toggle">
            <button
              class="config-mode-toggle__btn ${props.formMode === "form" ? "active" : ""}"
              ?disabled=${props.schemaLoading || !props.schema}
              @click=${() => props.onFormModeChange("form")}
            >
              Form
            </button>
            <button
              class="config-mode-toggle__btn ${props.formMode === "raw" ? "active" : ""}"
              @click=${() => props.onFormModeChange("raw")}
            >
              Raw
            </button>
          </div>
        </div>
      </aside>

      <!-- Main content -->
      <main class="config-main">
        <!-- Action bar -->
        <div class="config-actions">
          <div class="config-actions__left">
            ${
              hasChanges
                ? html`
                  <span class="config-changes-badge"
                    >${
                      props.formMode === "raw"
                        ? "Unsaved changes"
                        : `${diff.length} unsaved change${diff.length !== 1 ? "s" : ""}`
                    }</span
                  >
                `
                : html`
                    <span class="config-status muted">No changes</span>
                  `
            }
          </div>
          <div class="config-actions__right">
            <oc-button
              size="sm"
              .loading=${props.loading}
              @click=${props.onReload}
            >
              Reload
            </oc-button>
            <oc-button
              size="sm"
              variant="primary"
              .loading=${props.saving}
              ?disabled=${!canSave}
              @click=${props.onSave}
            >
              Save
            </oc-button>
            <oc-button
              size="sm"
              .loading=${props.applying}
              ?disabled=${!canApply}
              @click=${props.onApply}
            >
              Apply
            </oc-button>
            <oc-button
              size="sm"
              .loading=${props.updating}
              ?disabled=${!canUpdate}
              @click=${props.onUpdate}
            >
              Update
            </oc-button>
          </div>
        </div>

        <!-- Diff panel (form mode only - raw mode doesn't have granular diff) -->
        ${
          hasChanges && props.formMode === "form"
            ? html`
              <oc-collapsible class="config-diff">
                <span slot="header" class="config-diff__summary">
                  <span
                    >View ${diff.length} pending
                    change${diff.length !== 1 ? "s" : ""}</span
                  >
                </span>
                <div class="config-diff__content">
                  ${diff.map(
                    (change) => html`
                      <div class="config-diff__item">
                        <div class="config-diff__path">${change.path}</div>
                        <div class="config-diff__values">
                          <span class="config-diff__from"
                            >${truncateValue(change.from)}</span
                          >
                          <span class="config-diff__arrow">→</span>
                          <span class="config-diff__to"
                            >${truncateValue(change.to)}</span
                          >
                        </div>
                      </div>
                    `,
                  )}
                </div>
              </oc-collapsible>
            `
            : nothing
        }
        ${
          activeSectionMeta && props.formMode === "form"
            ? html`
              <div class="config-section-hero">
                <div class="config-section-hero__icon">
                  <oc-icon .name=${props.activeSection ?? "default"}></oc-icon>
                </div>
                <div class="config-section-hero__text">
                  <div class="config-section-hero__title">
                    ${activeSectionMeta.label}
                  </div>
                  ${
                    activeSectionMeta.description
                      ? html`<div class="config-section-hero__desc">
                        ${activeSectionMeta.description}
                      </div>`
                      : nothing
                  }
                </div>
              </div>
            `
            : nothing
        }
        ${
          allowSubnav
            ? html`
              <div class="config-subnav">
                <button
                  class="config-subnav__item ${effectiveSubsection === null ? "active" : ""}"
                  @click=${() => props.onSubsectionChange(ALL_SUBSECTION)}
                >
                  All
                </button>
                ${subsections.map(
                  (entry) => html`
                    <button
                      class="config-subnav__item ${
                        effectiveSubsection === entry.key ? "active" : ""
                      }"
                      title=${entry.description || entry.label}
                      @click=${() => props.onSubsectionChange(entry.key)}
                    >
                      ${entry.label}
                    </button>
                  `,
                )}
              </div>
            `
            : nothing
        }

        <!-- Form content -->
        <div class="config-content">
          ${
            props.formMode === "form"
              ? html`
                ${
                  props.schemaLoading
                    ? html`
                        <oc-empty-state variant="loading" title="Loading schema…"></oc-empty-state>
                      `
                    : renderConfigForm({
                        schema: analysis.schema,
                        uiHints: props.uiHints,
                        value: props.formValue,
                        disabled: props.loading || !props.formValue,
                        unsupportedPaths: analysis.unsupportedPaths,
                        onPatch: props.onFormPatch,
                        searchQuery: props.searchQuery,
                        activeSection: props.activeSection,
                        activeSubsection: effectiveSubsection,
                      })
                }
                ${
                  formUnsafe
                    ? html`
                        <oc-callout variant="danger">
                          Form view can't safely edit some fields. Use Raw to avoid losing config entries.
                        </oc-callout>
                      `
                    : nothing
                }
              `
              : html`
                <oc-field label="Raw JSON5" class="config-raw-field">
                  <textarea
                    .value=${props.raw}
                    @input=${(e: Event) =>
                      props.onRawChange((e.target as HTMLTextAreaElement).value)}
                  ></textarea>
                </oc-field>
              `
          }
        </div>

        ${
          props.issues.length > 0
            ? html`<oc-callout variant="danger">
              <pre class="code-block">
${JSON.stringify(props.issues, null, 2)}</pre
              >
            </oc-callout>`
            : nothing
        }
      </main>
    </div>
  `;
}
