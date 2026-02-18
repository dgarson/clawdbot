import { html, nothing } from "lit";
import type { ConfigUiHints } from "../types.ts";
import { icons } from "../icons.ts";
import { renderNode } from "./config-form.node.ts";
import { hintForPath, humanize, schemaType, type JsonSchema } from "./config-form.shared.ts";

export type ConfigFormProps = {
  schema: JsonSchema | null;
  uiHints: ConfigUiHints;
  value: Record<string, unknown> | null;
  disabled?: boolean;
  unsupportedPaths?: string[];
  searchQuery?: string;
  activeSection?: string | null;
  activeSubsection?: string | null;
  onPatch: (path: Array<string | number>, value: unknown) => void;
};

// Section metadata
export const SECTION_META: Record<string, { label: string; description: string }> = {
  env: {
    label: "Environment Variables",
    description: "Environment variables passed to the gateway process",
  },
  update: { label: "Updates", description: "Auto-update settings and release channel" },
  agents: { label: "Agents", description: "Agent configurations, models, and identities" },
  auth: { label: "Authentication", description: "API keys and authentication profiles" },
  channels: {
    label: "Channels",
    description: "Messaging channels (Telegram, Discord, Slack, etc.)",
  },
  messages: { label: "Messages", description: "Message handling and routing settings" },
  commands: { label: "Commands", description: "Custom slash commands" },
  hooks: { label: "Hooks", description: "Webhooks and event hooks" },
  skills: { label: "Skills", description: "Skill packs and capabilities" },
  tools: { label: "Tools", description: "Tool configurations (browser, search, etc.)" },
  gateway: { label: "Gateway", description: "Gateway server settings (port, auth, binding)" },
  wizard: { label: "Setup Wizard", description: "Setup wizard state and history" },
  // Additional sections
  meta: { label: "Metadata", description: "Gateway metadata and version information" },
  logging: { label: "Logging", description: "Log levels and output configuration" },
  browser: { label: "Browser", description: "Browser automation settings" },
  ui: { label: "UI", description: "User interface preferences" },
  models: { label: "Models", description: "AI model configurations and providers" },
  bindings: { label: "Bindings", description: "Key bindings and shortcuts" },
  broadcast: { label: "Broadcast", description: "Broadcast and notification settings" },
  audio: { label: "Audio", description: "Audio input/output settings" },
  session: { label: "Session", description: "Session management and persistence" },
  cron: { label: "Cron", description: "Scheduled tasks and automation" },
  web: { label: "Web", description: "Web server and API settings" },
  discovery: { label: "Discovery", description: "Service discovery and networking" },
  canvasHost: { label: "Canvas Host", description: "Canvas rendering and display" },
  talk: { label: "Talk", description: "Voice and speech settings" },
  plugins: { label: "Plugins", description: "Plugin management and extensions" },
};

function matchesSearch(key: string, schema: JsonSchema, query: string): boolean {
  if (!query) {
    return true;
  }
  const q = query.toLowerCase();
  const meta = SECTION_META[key];

  // Check key name
  if (key.toLowerCase().includes(q)) {
    return true;
  }

  // Check label and description
  if (meta) {
    if (meta.label.toLowerCase().includes(q)) {
      return true;
    }
    if (meta.description.toLowerCase().includes(q)) {
      return true;
    }
  }

  return schemaMatches(schema, q);
}

function schemaMatches(schema: JsonSchema, query: string): boolean {
  if (schema.title?.toLowerCase().includes(query)) {
    return true;
  }
  if (schema.description?.toLowerCase().includes(query)) {
    return true;
  }
  if (schema.enum?.some((value) => String(value).toLowerCase().includes(query))) {
    return true;
  }

  if (schema.properties) {
    for (const [propKey, propSchema] of Object.entries(schema.properties)) {
      if (propKey.toLowerCase().includes(query)) {
        return true;
      }
      if (schemaMatches(propSchema, query)) {
        return true;
      }
    }
  }

  if (schema.items) {
    const items = Array.isArray(schema.items) ? schema.items : [schema.items];
    for (const item of items) {
      if (item && schemaMatches(item, query)) {
        return true;
      }
    }
  }

  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    if (schemaMatches(schema.additionalProperties, query)) {
      return true;
    }
  }

  const unions = schema.anyOf ?? schema.oneOf ?? schema.allOf;
  if (unions) {
    for (const entry of unions) {
      if (entry && schemaMatches(entry, query)) {
        return true;
      }
    }
  }

  return false;
}

export function renderConfigForm(props: ConfigFormProps) {
  if (!props.schema) {
    return html`
      <div class="muted">Schema unavailable.</div>
    `;
  }
  const schema = props.schema;
  const value = props.value ?? {};
  if (schemaType(schema) !== "object" || !schema.properties) {
    return html`
      <oc-callout variant="danger">Unsupported schema. Use Raw.</oc-callout>
    `;
  }
  const unsupported = new Set(props.unsupportedPaths ?? []);
  const properties = schema.properties;
  const searchQuery = props.searchQuery ?? "";
  const activeSection = props.activeSection;
  const activeSubsection = props.activeSubsection ?? null;

  const entries = Object.entries(properties).toSorted((a, b) => {
    const orderA = hintForPath([a[0]], props.uiHints)?.order ?? 50;
    const orderB = hintForPath([b[0]], props.uiHints)?.order ?? 50;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a[0].localeCompare(b[0]);
  });

  const filteredEntries = entries.filter(([key, node]) => {
    if (activeSection && key !== activeSection) {
      return false;
    }
    if (searchQuery && !matchesSearch(key, node, searchQuery)) {
      return false;
    }
    return true;
  });

  let subsectionContext: { sectionKey: string; subsectionKey: string; schema: JsonSchema } | null =
    null;
  if (activeSection && activeSubsection && filteredEntries.length === 1) {
    const sectionSchema = filteredEntries[0]?.[1];
    if (
      sectionSchema &&
      schemaType(sectionSchema) === "object" &&
      sectionSchema.properties &&
      sectionSchema.properties[activeSubsection]
    ) {
      subsectionContext = {
        sectionKey: activeSection,
        subsectionKey: activeSubsection,
        schema: sectionSchema.properties[activeSubsection],
      };
    }
  }

  if (filteredEntries.length === 0) {
    return html`
      <div class="config-empty">
        <div class="config-empty__icon">${icons.search}</div>
        <div class="config-empty__text">
          ${searchQuery ? `No settings match "${searchQuery}"` : "No settings in this section"}
        </div>
      </div>
    `;
  }

  return html`
    <div class="config-form config-form--modern">
      ${
        subsectionContext
          ? (() => {
              const { sectionKey, subsectionKey, schema: node } = subsectionContext;
              const hint = hintForPath([sectionKey, subsectionKey], props.uiHints);
              const label = hint?.label ?? node.title ?? humanize(subsectionKey);
              const description = hint?.help ?? node.description ?? "";
              const sectionValue = value[sectionKey];
              const scopedValue =
                sectionValue && typeof sectionValue === "object"
                  ? (sectionValue as Record<string, unknown>)[subsectionKey]
                  : undefined;
              const id = `config-section-${sectionKey}-${subsectionKey}`;
              return html`
              <section class="config-section-card" id=${id}>
                <div class="config-section-card__header">
                  <span class="config-section-card__icon"><oc-icon .name=${sectionKey} weight="light"></oc-icon></span>
                  <div class="config-section-card__titles">
                    <h3 class="config-section-card__title">${label}</h3>
                    ${
                      description
                        ? html`<p class="config-section-card__desc">${description}</p>`
                        : nothing
                    }
                  </div>
                </div>
                <div class="config-section-card__content">
                  ${renderNode({
                    schema: node,
                    value: scopedValue,
                    path: [sectionKey, subsectionKey],
                    hints: props.uiHints,
                    unsupported,
                    disabled: props.disabled ?? false,
                    showLabel: false,
                    onPatch: props.onPatch,
                  })}
                </div>
              </section>
            `;
            })()
          : filteredEntries.map(([key, node]) => {
              const meta = SECTION_META[key] ?? {
                label: key.charAt(0).toUpperCase() + key.slice(1),
                description: node.description ?? "",
              };

              return html`
              <section class="config-section-card" id="config-section-${key}">
                <div class="config-section-card__header">
                  <span class="config-section-card__icon"><oc-icon .name=${key} weight="light"></oc-icon></span>
                  <div class="config-section-card__titles">
                    <h3 class="config-section-card__title">${meta.label}</h3>
                    ${
                      meta.description
                        ? html`<p class="config-section-card__desc">${meta.description}</p>`
                        : nothing
                    }
                  </div>
                </div>
                <div class="config-section-card__content">
                  ${renderNode({
                    schema: node,
                    value: value[key],
                    path: [key],
                    hints: props.uiHints,
                    unsupported,
                    disabled: props.disabled ?? false,
                    showLabel: false,
                    onPatch: props.onPatch,
                  })}
                </div>
              </section>
            `;
            })
      }
    </div>
  `;
}
