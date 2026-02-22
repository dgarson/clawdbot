/**
 * Zod validation schemas for import operations.
 *
 * Validates configuration and conversation imports to ensure
 * data integrity before applying changes.
 */

import { z } from "zod";

// ============================================================================
// Constants
// ============================================================================

/** Maximum import file size (10MB) */
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

/** Current export format version */
export const CURRENT_EXPORT_VERSION = "1.0";

// ============================================================================
// Configuration Import Schemas
// ============================================================================

const notificationPreferenceSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  enabled: z.boolean(),
});

const profileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  avatar: z.string().url().optional().or(z.literal("")),
  bio: z.string().optional(),
});

const preferencesSchema = z.object({
  timezone: z.string().optional(),
  language: z.string().optional(),
  defaultAgentId: z.string().optional(),
  notifications: z.array(notificationPreferenceSchema).optional(),
});

const uiSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  sidebarCollapsed: z.boolean().optional(),
  powerUserMode: z.boolean().optional(),
});

const agentEntrySchema = z.object({
  name: z.string().optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const agentsConfigSchema = z.record(
  z.string(),
  z.union([z.string(), agentEntrySchema])
).optional();

const channelEntrySchema = z.object({
  enabled: z.boolean().optional(),
});

const channelsConfigSchema = z.record(z.string(), channelEntrySchema).optional();

const gatewayConfigSchema = z.object({
  agents: agentsConfigSchema,
  channels: channelsConfigSchema,
});

const toolEntrySchema = z.object({
  toolId: z.string(),
  enabled: z.boolean(),
  permissions: z.array(z.string()).optional(),
});

const toolsetConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  isBuiltIn: z.boolean().optional(),
  tools: z.array(toolEntrySchema),
});

const toolsetsDataSchema = z.object({
  configs: z.array(toolsetConfigSchema),
  defaultToolsetId: z.string().nullable(),
});

export const configurationExportSchema = z.object({
  version: z.literal("1.0"),
  exportedAt: z.string().datetime(),
  sections: z.array(z.enum(["profile", "preferences", "uiSettings", "gatewayConfig", "toolsets"])),
  data: z.object({
    profile: profileSchema.optional(),
    preferences: preferencesSchema.optional(),
    uiSettings: uiSettingsSchema.optional(),
    gatewayConfig: gatewayConfigSchema.optional(),
    toolsets: toolsetsDataSchema.optional(),
  }),
});

export type ValidatedConfigurationExport = z.infer<typeof configurationExportSchema>;

// ============================================================================
// Conversation Import Schemas
// ============================================================================

const exportedMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string(),
});

const exportedConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  agentId: z.string().optional(),
  agentName: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messages: z.array(exportedMessageSchema),
});

export const conversationExportSchema = z.object({
  version: z.literal("1.0"),
  exportedAt: z.string().datetime(),
  conversations: z.array(exportedConversationSchema),
});

export type ValidatedConversationExport = z.infer<typeof conversationExportSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export interface ImportValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate a configuration import file
 */
export function validateConfigurationImport(
  content: unknown
): ImportValidationResult<ValidatedConfigurationExport> {
  const result = configurationExportSchema.safeParse(content);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return { success: false, errors };
}

/**
 * Validate a conversation import file
 */
export function validateConversationImport(
  content: unknown
): ImportValidationResult<ValidatedConversationExport> {
  const result = conversationExportSchema.safeParse(content);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return { success: false, errors };
}

/**
 * Parse and validate an import file
 */
export async function parseImportFile(
  file: File
): Promise<ImportValidationResult<unknown>> {
  // Check file size
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return {
      success: false,
      errors: [`File size exceeds maximum allowed (${Math.round(MAX_IMPORT_FILE_SIZE / 1024 / 1024)}MB)`],
    };
  }

  // Check file type
  if (!file.name.endsWith(".json")) {
    return {
      success: false,
      errors: ["Only JSON files are supported for import"],
    };
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Check version
    if (data.version && data.version !== CURRENT_EXPORT_VERSION) {
      return {
        success: false,
        errors: [`Unsupported export version: ${data.version}. Expected: ${CURRENT_EXPORT_VERSION}`],
      };
    }

    return { success: true, data };
  } catch {
    return {
      success: false,
      errors: ["Invalid JSON file format"],
    };
  }
}

/**
 * Detect the type of export file
 */
export function detectExportType(
  data: unknown
): "configuration" | "conversation" | "unknown" {
  if (!data || typeof data !== "object") {return "unknown";}

  const obj = data as Record<string, unknown>;

  if ("sections" in obj && Array.isArray(obj.sections)) {
    return "configuration";
  }

  if ("conversations" in obj && Array.isArray(obj.conversations)) {
    return "conversation";
  }

  return "unknown";
}
