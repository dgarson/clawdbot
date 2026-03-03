/**
 * Toolsets utility functions and constants
 * Separated from ToolsetsSection for React fast refresh compatibility
 */

import { DEFAULT_TOOLS, type ToolsetConfig } from "@/components/domain/tools";

// Built-in toolset presets
export const BUILT_IN_TOOLSETS: ToolsetConfig[] = [
  {
    id: "builtin-minimal",
    name: "Minimal",
    description: "Read-only tools for safe information gathering",
    createdAt: new Date(),
    updatedAt: new Date(),
    isBuiltIn: true,
    tools: DEFAULT_TOOLS.filter((t) =>
      ["read-docs", "code-analysis", "web-search"].includes(t.id)
    ).map((t) => ({ toolId: t.id, enabled: true, permissions: t.permissions })),
  },
  {
    id: "builtin-standard",
    name: "Standard",
    description: "Common tools without code execution capabilities",
    createdAt: new Date(),
    updatedAt: new Date(),
    isBuiltIn: true,
    tools: DEFAULT_TOOLS.filter(
      (t) => !["code-exec", "video-gen", "audio-gen"].includes(t.id)
    ).map((t) => ({
      toolId: t.id,
      enabled: ![
        "slack-send",
        "discord-send",
        "telegram-send",
        "database",
      ].includes(t.id),
      permissions: t.permissions,
    })),
  },
  {
    id: "builtin-full",
    name: "Full Access",
    description: "All tools enabled with full permissions",
    createdAt: new Date(),
    updatedAt: new Date(),
    isBuiltIn: true,
    tools: DEFAULT_TOOLS.map((t) => ({
      toolId: t.id,
      enabled: true,
      permissions: t.permissions,
    })),
  },
];

/**
 * Get a toolset by ID (checks both built-in and custom)
 */
export function getToolsetById(
  id: string,
  customToolsets: ToolsetConfig[]
): ToolsetConfig | undefined {
  return (
    BUILT_IN_TOOLSETS.find((t) => t.id === id) ??
    customToolsets.find((t) => t.id === id)
  );
}

/**
 * Get all toolsets (built-in + custom)
 */
export function getAllToolsets(customToolsets: ToolsetConfig[]): ToolsetConfig[] {
  return [...BUILT_IN_TOOLSETS, ...customToolsets];
}
