import {
  Globe,
  FileText,
  FileCode2,
  Code,
  Calendar,
  Mail,
  Database,
  MessageSquare,
  Image,
  Terminal,
  Settings,
  Video,
  AudioLines,
  Hash,
  Send,
} from "lucide-react";
import type { Tool, ToolCategory, CategoryConfig } from "./types";

/**
 * Category configuration with display order and defaults
 */
export const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    id: "files",
    label: "Files & Documents",
    icon: FileText,
    order: 1,
    defaultExpanded: true,
  },
  {
    id: "code",
    label: "Code & Development",
    icon: Code,
    order: 2,
    defaultExpanded: true,
  },
  {
    id: "channels",
    label: "Channels",
    icon: Hash,
    order: 3,
    defaultExpanded: false,
  },
  {
    id: "communication",
    label: "Communication",
    icon: MessageSquare,
    order: 4,
    defaultExpanded: false,
  },
  {
    id: "data",
    label: "Data & Research",
    icon: Database,
    order: 5,
    defaultExpanded: false,
  },
  {
    id: "multimodal",
    label: "Multi-Modality",
    icon: Image,
    order: 6,
    defaultExpanded: false,
  },
  {
    id: "other",
    label: "Other Tools",
    icon: Settings,
    order: 7,
    defaultExpanded: false,
  },
];

/**
 * Get category config by ID
 */
export function getCategoryConfig(category: ToolCategory): CategoryConfig {
  return (
    CATEGORY_CONFIG.find((c) => c.id === category) ?? {
      id: category,
      label: category,
      icon: Settings,
      order: 999,
      defaultExpanded: false,
    }
  );
}

/**
 * Get sorted categories
 */
export function getSortedCategories(): CategoryConfig[] {
  return [...CATEGORY_CONFIG].toSorted((a, b) => a.order - b.order);
}

/**
 * Default tools available in the system
 */
export const DEFAULT_TOOLS: Tool[] = [
  // Files & Documents
  {
    id: "read-docs",
    name: "Read Documents",
    description: "Read and analyze PDF, Word, and text documents",
    icon: FileText,
    category: "files",
    enabled: true,
    permissions: ["read"],
  },
  {
    id: "write-files",
    name: "Write Files",
    description: "Create and edit files in the workspace",
    icon: FileCode2,
    category: "files",
    enabled: true,
    permissions: ["read", "write"],
  },

  // Code & Development
  {
    id: "code-exec",
    name: "Code Execution",
    description: "Execute code snippets in a sandboxed environment",
    icon: Terminal,
    category: "code",
    enabled: false,
    permissions: ["execute"],
  },
  {
    id: "code-analysis",
    name: "Code Analysis",
    description: "Analyze and review code repositories",
    icon: Code,
    category: "code",
    enabled: true,
    permissions: ["read", "analyze"],
  },

  // Channels
  {
    id: "slack-send",
    name: "Slack",
    description: "Send messages to Slack channels",
    icon: Hash,
    category: "channels",
    enabled: false,
    permissions: ["send"],
  },
  {
    id: "discord-send",
    name: "Discord",
    description: "Send messages to Discord servers",
    icon: MessageSquare,
    category: "channels",
    enabled: false,
    permissions: ["send"],
  },
  {
    id: "telegram-send",
    name: "Telegram",
    description: "Send messages via Telegram",
    icon: Send,
    category: "channels",
    enabled: false,
    permissions: ["send"],
  },

  // Communication
  {
    id: "calendar",
    name: "Calendar Access",
    description: "View and manage calendar events and scheduling",
    icon: Calendar,
    category: "communication",
    enabled: false,
    permissions: ["read", "write"],
  },
  {
    id: "email",
    name: "Email",
    description: "Send and read email messages",
    icon: Mail,
    category: "communication",
    enabled: false,
    permissions: ["read", "send"],
  },
  {
    id: "chat",
    name: "Chat Integration",
    description: "Send messages to chat platforms",
    icon: MessageSquare,
    category: "communication",
    enabled: false,
    permissions: ["send"],
  },

  // Data & Research
  {
    id: "web-search",
    name: "Web Search",
    description: "Search the internet for information and research",
    icon: Globe,
    category: "data",
    enabled: true,
    permissions: ["read"],
  },
  {
    id: "database",
    name: "Database Query",
    description: "Query and analyze database contents",
    icon: Database,
    category: "data",
    enabled: false,
    permissions: ["read"],
  },

  // Multi-Modality
  {
    id: "image-gen",
    name: "Image Generation",
    description: "Generate images using AI models",
    icon: Image,
    category: "multimodal",
    enabled: false,
    permissions: ["generate"],
  },
  {
    id: "video-gen",
    name: "Video Generation",
    description: "Generate videos using AI models",
    icon: Video,
    category: "multimodal",
    enabled: false,
    permissions: ["generate"],
  },
  {
    id: "audio-gen",
    name: "Audio Generation",
    description: "Generate audio and speech",
    icon: AudioLines,
    category: "multimodal",
    enabled: false,
    permissions: ["generate"],
  },
];

/**
 * Group tools by category
 */
export function groupToolsByCategory(
  tools: Tool[]
): Record<ToolCategory, Tool[]> {
  return tools.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    },
    {} as Record<ToolCategory, Tool[]>
  );
}

/**
 * Count enabled tools
 */
export function countEnabledTools(tools: Tool[]): {
  enabled: number;
  total: number;
} {
  return {
    enabled: tools.filter((t) => t.enabled).length,
    total: tools.length,
  };
}
