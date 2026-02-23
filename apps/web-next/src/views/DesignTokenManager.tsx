import React, { useState } from "react";
import { cn } from "../lib/utils";

type TokenType = "color" | "spacing" | "typography" | "shadow" | "radius" | "animation";
type Theme = "dark" | "light" | "high-contrast";

interface DesignToken {
  id: string;
  name: string;
  type: TokenType;
  value: string;
  rawValue: string;
  description: string;
  usedBy: string[];
  theme: Theme;
  deprecated?: boolean;
}

interface TokenGroup {
  id: string;
  label: string;
  type: TokenType;
  description: string;
  tokens: DesignToken[];
}

const TOKEN_GROUPS: TokenGroup[] = [
  {
    id: "surface-colors",
    label: "Surface Colors",
    type: "color",
    description: "Background and surface elevation colors",
    tokens: [
      { id: "c1", name: "color.surface.base",      type: "color", value: "#09090b", rawValue: "zinc-950", description: "Page background", usedBy: ["App", "Layout"], theme: "dark" },
      { id: "c2", name: "color.surface.card",      type: "color", value: "#18181b", rawValue: "zinc-900", description: "Card and panel background", usedBy: ["Card", "Panel", "Sidebar"], theme: "dark" },
      { id: "c3", name: "color.surface.elevated",  type: "color", value: "#27272a", rawValue: "zinc-800", description: "Hover states, borders, inputs", usedBy: ["Input", "Border", "HoverRow"], theme: "dark" },
      { id: "c4", name: "color.surface.overlay",   type: "color", value: "#3f3f46", rawValue: "zinc-700", description: "Modal overlays, dropdowns", usedBy: ["Modal", "Dropdown", "Tooltip"], theme: "dark" },
    ],
  },
  {
    id: "text-colors",
    label: "Text Colors",
    type: "color",
    description: "Text and foreground colors",
    tokens: [
      { id: "t1", name: "color.text.primary",   type: "color", value: "#ffffff", rawValue: "white",    description: "Primary text", usedBy: ["Heading", "Body"], theme: "dark" },
      { id: "t2", name: "color.text.secondary", type: "color", value: "#d4d4d8", rawValue: "zinc-300", description: "Secondary text, labels", usedBy: ["Label", "Caption"], theme: "dark" },
      { id: "t3", name: "color.text.muted",     type: "color", value: "#71717a", rawValue: "zinc-500", description: "Muted/disabled text", usedBy: ["Placeholder", "Meta"], theme: "dark" },
      { id: "t4", name: "color.text.disabled",  type: "color", value: "#52525b", rawValue: "zinc-600", description: "Disabled element text", usedBy: ["Disabled"], theme: "dark" },
    ],
  },
  {
    id: "semantic-colors",
    label: "Semantic Colors",
    type: "color",
    description: "Status and semantic color tokens",
    tokens: [
      { id: "s1", name: "color.accent",    type: "color", value: "#6366f1", rawValue: "indigo-500",  description: "Primary accent, CTAs", usedBy: ["Button", "Link", "ActiveTab"], theme: "dark" },
      { id: "s2", name: "color.success",   type: "color", value: "#34d399", rawValue: "emerald-400", description: "Success states", usedBy: ["StatusBadge", "Alert", "Checkmark"], theme: "dark" },
      { id: "s3", name: "color.warning",   type: "color", value: "#fbbf24", rawValue: "amber-400",   description: "Warning states", usedBy: ["StatusBadge", "Alert"], theme: "dark" },
      { id: "s4", name: "color.error",     type: "color", value: "#fb7185", rawValue: "rose-400",    description: "Error and destructive states", usedBy: ["StatusBadge", "Alert", "ErrorText"], theme: "dark" },
      { id: "s5", name: "color.info",      type: "color", value: "#38bdf8", rawValue: "sky-400",     description: "Informational states", usedBy: ["StatusBadge", "Alert"], theme: "dark" },
    ],
  },
  {
    id: "spacing",
    label: "Spacing",
    type: "spacing",
    description: "Consistent spacing scale",
    tokens: [
      { id: "sp1", name: "spacing.1",  type: "spacing", value: "4px",  rawValue: "1",  description: "Micro spacing",      usedBy: ["icon-gap"], theme: "dark" },
      { id: "sp2", name: "spacing.2",  type: "spacing", value: "8px",  rawValue: "2",  description: "Tight spacing",      usedBy: ["badge-padding"], theme: "dark" },
      { id: "sp3", name: "spacing.3",  type: "spacing", value: "12px", rawValue: "3",  description: "Compact spacing",    usedBy: ["button-padding-y"], theme: "dark" },
      { id: "sp4", name: "spacing.4",  type: "spacing", value: "16px", rawValue: "4",  description: "Standard spacing",   usedBy: ["card-padding", "section-gap"], theme: "dark" },
      { id: "sp5", name: "spacing.6",  type: "spacing", value: "24px", rawValue: "6",  description: "Comfortable spacing", usedBy: ["page-padding", "between-sections"], theme: "dark" },
      { id: "sp6", name: "spacing.8",  type: "spacing", value: "32px", rawValue: "8",  description: "Loose spacing",      usedBy: ["between-groups"], theme: "dark" },
      { id: "sp7", name: "spacing.12", type: "spacing", value: "48px", rawValue: "12", description: "Generous spacing",   usedBy: ["hero-margin"], theme: "dark" },
    ],
  },
  {
    id: "typography",
    label: "Typography",
    type: "typography",
    description: "Font sizes and line heights",
    tokens: [
      { id: "ty1", name: "font.size.xs",   type: "typography", value: "12px", rawValue: "text-xs",   description: "Captions, labels, badges",   usedBy: ["Badge", "Caption", "Meta"], theme: "dark" },
      { id: "ty2", name: "font.size.sm",   type: "typography", value: "14px", rawValue: "text-sm",   description: "Body text, table rows",       usedBy: ["Body", "TableCell"], theme: "dark" },
      { id: "ty3", name: "font.size.base", type: "typography", value: "16px", rawValue: "text-base", description: "Default body text",           usedBy: ["Paragraph"], theme: "dark" },
      { id: "ty4", name: "font.size.lg",   type: "typography", value: "18px", rawValue: "text-lg",   description: "Subheadings",                 usedBy: ["Subheading"], theme: "dark" },
      { id: "ty5", name: "font.size.xl",   type: "typography", value: "20px", rawValue: "text-xl",   description: "Section headings",            usedBy: ["SectionHeading"], theme: "dark" },
      { id: "ty6", name: "font.size.2xl",  type: "typography", value: "24px", rawValue: "text-2xl",  description: "Page titles",                 usedBy: ["PageTitle"], theme: "dark" },
    ],
  },
  {
    id: "radius",
    label: "Border Radius",
    type: "radius",
    description: "Corner radius tokens",
    tokens: [
      { id: "r1", name: "radius.none",  type: "radius", value: "0px",   rawValue: "rounded-none", description: "No rounding",     usedBy: ["Divider"], theme: "dark" },
      { id: "r2", name: "radius.sm",    type: "radius", value: "4px",   rawValue: "rounded",      description: "Small rounding",  usedBy: ["Badge", "Tag"], theme: "dark" },
      { id: "r3", name: "radius.md",    type: "radius", value: "6px",   rawValue: "rounded-md",   description: "Medium rounding", usedBy: ["Button", "Input"], theme: "dark" },
      { id: "r4", name: "radius.lg",    type: "radius", value: "8px",   rawValue: "rounded-lg",   description: "Large rounding",  usedBy: ["Card", "Panel"], theme: "dark" },
      { id: "r5", name: "radius.full",  type: "radius", value: "9999px", rawValue: "rounded-full", description: "Pill shape",     usedBy: ["Avatar", "Pill"], theme: "dark" },
    ],
  },
  {
    id: "animation",
    label: "Animation",
    type: "animation",
    description: "Duration and easing tokens",
    tokens: [
      { id: "a1", name: "anim.duration.fast",   type: "animation", value: "100ms", rawValue: "duration-100", description: "Instant feedback",   usedBy: ["Hover", "Focus"], theme: "dark" },
      { id: "a2", name: "anim.duration.normal", type: "animation", value: "150ms", rawValue: "duration-150", description: "Standard transitions", usedBy: ["Tab", "Dropdown"], theme: "dark" },
      { id: "a3", name: "anim.duration.slow",   type: "animation", value: "300ms", rawValue: "duration-300", description: "Deliberate animations", usedBy: ["Modal", "Slide"], theme: "dark" },
      { id: "a4", name: "anim.ease.default",    type: "animation", value: "ease-in-out", rawValue: "ease-in-out", description: "Default easing", usedBy: ["*"], theme: "dark" },
    ],
  },
];

type Tab = "tokens" | "usage" | "compare" | "export";

const TYPE_EMOJI: Record<TokenType, string> = {
  color: "🎨", spacing: "📐", typography: "📝", shadow: "🌑", radius: "⬜", animation: "✨",
};

export default function DesignTokenManager() {
  const [tab, setTab] = useState<Tab>("tokens");
  const [selectedGroup, setSelectedGroup] = useState<string>(TOKEN_GROUPS[0].id);
  const [selectedToken, setSelectedToken] = useState<DesignToken | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportFormat, setExportFormat] = useState<"css" | "json" | "ts">("css");

  const group = TOKEN_GROUPS.find(g => g.id === selectedGroup) ?? TOKEN_GROUPS[0];
  const allTokens = TOKEN_GROUPS.flatMap(g => g.tokens);

  const filteredTokens = searchQuery
    ? allTokens.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : group.tokens;

  const displayGroup = searchQuery ? null : group;

  // CSS export
  const cssExport = [
    ":root {",
    ...allTokens.map(t => `  --${t.name.replace(/\./g, "-")}: ${t.value};`),
    "}"
  ].join("\n");

  // JSON export
  const jsonExport = JSON.stringify(
    Object.fromEntries(allTokens.map(t => [t.name, { value: t.value, rawValue: t.rawValue, type: t.type, description: t.description }])),
    null, 2
  );

  // TS export
  const tsExport = [
    "export const tokens = {",
    ...TOKEN_GROUPS.map(g => [
      `  // ${g.label}`,
      ...g.tokens.map(t => `  "${t.name}": "${t.value}",`),
    ].join("\n")),
    "} as const;",
    "",
    "export type TokenName = keyof typeof tokens;",
  ].join("\n");

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "tokens",  label: "Tokens",    emoji: "🎨" },
    { id: "usage",   label: "Usage Map", emoji: "🔗" },
    { id: "compare", label: "Compare",   emoji: "⚖️" },
    { id: "export",  label: "Export",    emoji: "📦" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Design Token Manager</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {allTokens.length} tokens across {TOKEN_GROUPS.length} groups · Horizon UI Design System
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
              tab === t.id
                ? "text-white bg-zinc-800 border border-b-0 border-zinc-700"
                : "text-zinc-400 hover:text-white"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Tokens Tab */}
      {tab === "tokens" && (
        <div className="flex gap-4">
          {/* Left: group nav */}
          <div className="w-52 shrink-0">
            <div className="mb-3">
              <input
                type="text"
                placeholder="🔍 Search tokens..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-0.5">
              {TOKEN_GROUPS.map(g => (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGroup(g.id); setSearchQuery(""); }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors",
                    selectedGroup === g.id && !searchQuery
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                  )}
                >
                  <span>{TYPE_EMOJI[g.type]}</span>
                  <span className="flex-1">{g.label}</span>
                  <span className="text-xs text-zinc-600">{g.tokens.length}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: token list */}
          <div className="flex-1">
            {displayGroup && (
              <div className="mb-4">
                <div className="text-lg font-semibold text-white">{displayGroup.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{displayGroup.description}</div>
              </div>
            )}
            {searchQuery && (
              <div className="mb-3 text-xs text-zinc-500">
                {filteredTokens.length} result{filteredTokens.length !== 1 ? "s" : ""} for "{searchQuery}"
              </div>
            )}

            <div className="space-y-2">
              {filteredTokens.map(token => (
                <div
                  key={token.id}
                  onClick={() => setSelectedToken(selectedToken?.id === token.id ? null : token)}
                  className={cn(
                    "bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-colors",
                    selectedToken?.id === token.id ? "border-indigo-600" : "border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Visual preview */}
                    {token.type === "color" && (
                      <div
                        className="w-10 h-10 rounded-lg border border-zinc-700 shrink-0"
                        style={{ backgroundColor: token.value }}
                      />
                    )}
                    {token.type === "spacing" && (
                      <div className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-lg border border-zinc-700 shrink-0">
                        <div className="bg-indigo-500 h-1 rounded" style={{ width: token.value === "4px" ? "12px" : token.value === "8px" ? "20px" : token.value === "12px" ? "28px" : "36px" }} />
                      </div>
                    )}
                    {token.type === "radius" && (
                      <div className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-lg border border-zinc-700 shrink-0">
                        <div className="w-6 h-6 bg-indigo-500" style={{ borderRadius: token.value }} />
                      </div>
                    )}
                    {token.type === "typography" && (
                      <div className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-lg border border-zinc-700 shrink-0">
                        <span className="text-white font-bold" style={{ fontSize: token.value }}>A</span>
                      </div>
                    )}
                    {(token.type === "animation" || token.type === "shadow") && (
                      <div className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded-lg border border-zinc-700 shrink-0 text-lg">
                        {TYPE_EMOJI[token.type]}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-white">{token.name}</span>
                        {token.deprecated && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">deprecated</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">{token.description}</div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm text-amber-300">{token.value}</div>
                      <div className="text-xs text-zinc-500 font-mono">{token.rawValue}</div>
                    </div>
                  </div>

                  {selectedToken?.id === token.id && (
                    <div className="mt-4 border-t border-zinc-800 pt-4 space-y-3" onClick={e => e.stopPropagation()}>
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <div className="text-zinc-500 mb-1">CSS Variable</div>
                          <code className="font-mono text-sky-300">--{token.name.replace(/\./g, "-")}</code>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-1">Tailwind Class</div>
                          <code className="font-mono text-amber-300">{token.rawValue}</code>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-1">Raw Value</div>
                          <code className="font-mono text-emerald-300">{token.value}</code>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">Used By Components</div>
                        <div className="flex flex-wrap gap-1">
                          {token.usedBy.map(c => (
                            <span key={c} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Usage Map Tab */}
      {tab === "usage" && (
        <div className="space-y-4">
          <div className="text-sm text-zinc-400 mb-4">Which components reference which tokens</div>
          {TOKEN_GROUPS.map(g => (
            <div key={g.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <span>{TYPE_EMOJI[g.type]}</span>
                <span className="font-semibold text-white text-sm">{g.label}</span>
                <span className="text-xs text-zinc-500">{g.tokens.length} tokens</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Token</th>
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Value</th>
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Components</th>
                  </tr>
                </thead>
                <tbody>
                  {g.tokens.map(t => (
                    <tr key={t.id} className="border-b border-zinc-800/50">
                      <td className="px-4 py-2 font-mono text-zinc-300">{t.name}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {t.type === "color" && <div className="w-3 h-3 rounded border border-zinc-700" style={{ backgroundColor: t.value }} />}
                          <span className="text-amber-300 font-mono">{t.value}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {t.usedBy.map(c => (
                            <span key={c} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{c}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Compare Tab */}
      {tab === "compare" && (
        <div className="space-y-4">
          <div className="text-sm text-zinc-400 mb-4">Dark vs Light theme token comparison (Light theme in progress)</div>
          <div className="grid grid-cols-2 gap-4">
            {/* Dark column */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-zinc-950 border border-zinc-600" />
                <span className="text-sm font-semibold text-white">Dark Theme</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400 ml-auto">Active</span>
              </div>
              <div className="space-y-3">
                {allTokens.filter(t => t.type === "color").map(t => (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded border border-zinc-700 shrink-0" style={{ backgroundColor: t.value }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-zinc-300 truncate">{t.name}</div>
                      <div className="font-mono text-xs text-zinc-500">{t.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Light column (placeholder) */}
            <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-white border border-zinc-400" />
                <span className="text-sm font-semibold text-zinc-400">Light Theme</span>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 ml-auto">Planned</span>
              </div>
              <div className="flex flex-col items-center justify-center h-48 text-zinc-600 text-sm">
                <div className="text-3xl mb-3">☀️</div>
                <div>Light theme tokens coming in Q2 2026</div>
                <div className="text-xs text-zinc-700 mt-1">Once defined, they'll appear here for comparison</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Tab */}
      {tab === "export" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            {(["css", "json", "ts"] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => setExportFormat(fmt)}
                className={cn(
                  "px-4 py-2 text-sm rounded-lg border transition-colors font-mono",
                  exportFormat === fmt
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                {fmt === "css" ? "CSS Variables" : fmt === "json" ? "JSON" : "TypeScript"}
              </button>
            ))}
            <button className="ml-auto px-4 py-2 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
              📋 Copy to clipboard
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="text-xs text-zinc-500 mb-3 font-mono">
              {exportFormat === "css" ? "tokens.css" : exportFormat === "json" ? "tokens.json" : "tokens.ts"}
            </div>
            <pre className="font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre leading-5 max-h-[60vh] overflow-y-auto">
              {exportFormat === "css" ? cssExport : exportFormat === "json" ? jsonExport : tsExport}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
