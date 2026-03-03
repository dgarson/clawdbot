/**
 * Zod validation schemas for config forms.
 * Provides real-time validation for API keys, gateway config, and channel credentials.
 */
import { z } from "zod";

// ============================================================================
// API Key Validation Schemas
// ============================================================================

/**
 * Anthropic API key: starts with "sk-ant-"
 */
export const anthropicApiKeySchema = z
  .string()
  .min(1, "API key is required")
  .refine(
    (key) => key.startsWith("sk-ant-"),
    "Anthropic API key must start with 'sk-ant-'"
  );

/**
 * OpenAI API key: starts with "sk-"
 */
export const openaiApiKeySchema = z
  .string()
  .min(1, "API key is required")
  .refine(
    (key) => key.startsWith("sk-"),
    "OpenAI API key must start with 'sk-'"
  );

/**
 * Google API key: typically alphanumeric with dashes
 */
export const googleApiKeySchema = z
  .string()
  .min(1, "API key is required")
  .min(20, "API key appears too short");

/**
 * X.AI (Grok) API key: starts with "xai-"
 */
export const xaiApiKeySchema = z
  .string()
  .min(1, "API key is required")
  .refine(
    (key) => key.startsWith("xai-"),
    "X.AI API key must start with 'xai-'"
  );

/**
 * OpenRouter API key: starts with "sk-or-"
 */
export const openrouterApiKeySchema = z
  .string()
  .min(1, "API key is required")
  .refine(
    (key) => key.startsWith("sk-or-"),
    "OpenRouter API key must start with 'sk-or-'"
  );

/**
 * Generic API key schema for unknown providers
 */
export const genericApiKeySchema = z
  .string()
  .min(1, "API key is required")
  .min(10, "API key appears too short");

/**
 * Get the appropriate API key schema for a provider
 */
export function getApiKeySchemaForProvider(providerId: string): z.ZodType<string> {
  switch (providerId) {
    case "anthropic":
      return anthropicApiKeySchema;
    case "openai":
      return openaiApiKeySchema;
    case "google":
      return googleApiKeySchema;
    case "zai":
      return xaiApiKeySchema;
    case "openrouter":
      return openrouterApiKeySchema;
    default:
      return genericApiKeySchema;
  }
}

// ============================================================================
// Gateway Configuration Schemas
// ============================================================================

/**
 * Port number: 1024-65535 (user ports)
 */
export const portSchema = z
  .number()
  .int("Port must be a whole number")
  .min(1024, "Port must be at least 1024 (reserved ports not allowed)")
  .max(65535, "Port must be at most 65535");

/**
 * Port as string input (for form handling)
 */
export const portStringSchema = z
  .string()
  .min(1, "Port is required")
  .refine(
    (val) => !isNaN(parseInt(val, 10)),
    "Port must be a number"
  )
  .transform((val) => parseInt(val, 10))
  .pipe(portSchema);

/**
 * IP address (IPv4)
 */
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Hostname pattern (simple validation)
 */
const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

/**
 * Custom bind address: IP or hostname
 */
export const bindAddressSchema = z
  .string()
  .min(1, "Bind address is required")
  .refine(
    (addr) => addr === "0.0.0.0" || addr === "localhost" || ipv4Regex.test(addr) || hostnameRegex.test(addr),
    "Must be a valid IP address (e.g., 0.0.0.0, 192.168.1.1) or hostname"
  );

/**
 * Access mode enum
 */
export const accessModeSchema = z.enum(["local", "network", "custom"], {
  message: "Invalid access mode",
});

/**
 * Full gateway configuration schema
 */
export const gatewayConfigSchema = z.object({
  port: portSchema,
  accessMode: accessModeSchema,
  customBind: z.string().optional(),
}).refine(
  (data) => {
    // If custom mode, require valid bind address
    if (data.accessMode === "custom") {
      return data.customBind && bindAddressSchema.safeParse(data.customBind).success;
    }
    return true;
  },
  {
    message: "Custom bind address is required when using custom access mode",
    path: ["customBind"],
  }
);

// ============================================================================
// Channel Credential Schemas
// ============================================================================

/**
 * Telegram bot token: format "123456789:ABCdefGHI..."
 * Bot tokens are in format: <bot_id>:<token_string>
 */
export const telegramBotTokenSchema = z
  .string()
  .min(1, "Bot token is required")
  .refine(
    (token) => /^\d+:[A-Za-z0-9_-]+$/.test(token),
    "Telegram bot token must be in format '123456789:ABCdefGHI...'"
  );

/**
 * Discord bot token: base64-like string with periods
 * Format: <encoded_user_id>.<timestamp>.<hmac>
 */
export const discordBotTokenSchema = z
  .string()
  .min(1, "Bot token is required")
  .refine(
    (token) => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token),
    "Discord bot token must be in format 'MTIzNDU2.XXXXXX.XXXXXXXXX'"
  );

/**
 * Slack bot token: starts with "xoxb-" (bot tokens) or "xoxp-" (user tokens)
 */
export const slackBotTokenSchema = z
  .string()
  .min(1, "Bot token is required")
  .refine(
    (token) => token.startsWith("xoxb-") || token.startsWith("xoxp-"),
    "Slack bot token must start with 'xoxb-' or 'xoxp-'"
  );

/**
 * Get channel credential schema by channel type
 */
export function getChannelCredentialSchema(channelType: string): z.ZodType<string> {
  switch (channelType) {
    case "telegram":
      return telegramBotTokenSchema;
    case "discord":
      return discordBotTokenSchema;
    case "slack":
      return slackBotTokenSchema;
    default:
      // Generic non-empty string for unknown channels
      return z.string().min(1, "Credential is required");
  }
}

// ============================================================================
// Validation Helper Types
// ============================================================================

export type ApiKeyValidationResult = {
  isValid: boolean;
  error: string | null;
};

export type GatewayConfigInput = z.input<typeof gatewayConfigSchema>;
export type GatewayConfigOutput = z.output<typeof gatewayConfigSchema>;

/**
 * Validate a value against a schema and return structured result
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): ApiKeyValidationResult {
  const result = schema.safeParse(value);
  if (result.success) {
    return { isValid: true, error: null };
  }
  // Return the first error message
  const firstError = result.error.issues[0];
  return {
    isValid: false,
    error: firstError?.message ?? "Invalid value",
  };
}
