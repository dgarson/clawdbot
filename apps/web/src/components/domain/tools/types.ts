import type { LucideIcon } from "lucide-react";

/**
 * Tool category for grouping related tools
 */
export type ToolCategory =
  | "files"
  | "code"
  | "channels"
  | "communication"
  | "data"
  | "multimodal"
  | "other";

/**
 * Individual tool definition
 */
export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: ToolCategory;
  enabled: boolean;
  permissions?: string[];
}

/**
 * Tool permission within a toolset
 */
export interface ToolPermission {
  toolId: string;
  enabled: boolean;
  permissions?: string[];
}

/**
 * Reusable toolset configuration
 */
export interface ToolsetConfig {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  tools: ToolPermission[];
  isBuiltIn?: boolean;
}

/**
 * Category metadata for display
 */
export interface CategoryConfig {
  id: ToolCategory;
  label: string;
  icon: LucideIcon;
  order: number;
  defaultExpanded: boolean;
}
