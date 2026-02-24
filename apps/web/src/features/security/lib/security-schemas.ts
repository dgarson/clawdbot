/**
 * Zod validation schemas for security features
 */

import { z } from "zod";

// =============================================================================
// Password Validation
// =============================================================================

/** Password must be at least 8 chars, max 128 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

/** TOTP code is exactly 6 digits */
export const totpCodeSchema = z
  .string()
  .length(6, "Code must be exactly 6 digits")
  .regex(/^\d{6}$/, "Code must contain only digits");

/** Recovery code is 8 alphanumeric chars */
export const recoveryCodeSchema = z
  .string()
  .length(8, "Recovery code must be 8 characters")
  .regex(/^[A-Z0-9]{8}$/, "Invalid recovery code format");

// =============================================================================
// Unlock Schemas
// =============================================================================

export const unlockParamsSchema = z.object({
  password: passwordSchema,
  totpCode: totpCodeSchema.optional(),
  recoveryCode: recoveryCodeSchema.optional(),
});

export const setupPasswordParamsSchema = z.object({
  password: passwordSchema,
});

export const changePasswordParamsSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});

export const disableParamsSchema = z.object({
  password: passwordSchema,
});

// =============================================================================
// 2FA Schemas
// =============================================================================

export const setup2faParamsSchema = z.object({
  password: passwordSchema,
});

export const verify2faParamsSchema = z.object({
  code: totpCodeSchema,
});

export const disable2faParamsSchema = z.object({
  password: passwordSchema,
  code: totpCodeSchema,
});

// =============================================================================
// Token Schemas
// =============================================================================

export const tokenScopeSchema = z.enum([
  "agent:read",
  "agent:write",
  "config:read",
  "config:write",
  "audit:read",
  "sessions:read",
  "sessions:write",
  "*",
]);

export const tokenNameSchema = z
  .string()
  .min(1, "Token name is required")
  .max(64, "Token name must be at most 64 characters")
  .regex(/^[\w\s-]+$/, "Token name can only contain letters, numbers, spaces, and hyphens");

export const createTokenParamsSchema = z.object({
  name: tokenNameSchema,
  scopes: z.array(tokenScopeSchema).min(1, "At least one scope is required"),
  expiresInDays: z.number().int().positive().nullable().optional(),
});

export const revokeTokenParamsSchema = z.object({
  tokenId: z.string().min(1, "Token ID is required"),
});

// =============================================================================
// Audit Schemas
// =============================================================================

export const auditCategorySchema = z.enum(["config", "agent", "security", "token"]);

export const auditSeveritySchema = z.enum(["info", "warn", "error"]);

export const auditQueryParamsSchema = z.object({
  category: auditCategorySchema.optional(),
  action: z.string().optional(),
  severity: auditSeveritySchema.optional(),
  startTs: z.number().int().positive().optional(),
  endTs: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(1000).optional().default(100),
  offset: z.number().int().nonnegative().optional().default(0),
});

// =============================================================================
// History Schemas
// =============================================================================

export const getHistoryParamsSchema = z.object({
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

// =============================================================================
// Type Exports
// =============================================================================

export type UnlockParams = z.infer<typeof unlockParamsSchema>;
export type SetupPasswordParams = z.infer<typeof setupPasswordParamsSchema>;
export type ChangePasswordParams = z.infer<typeof changePasswordParamsSchema>;
export type DisableParams = z.infer<typeof disableParamsSchema>;
export type Setup2faParams = z.infer<typeof setup2faParamsSchema>;
export type Verify2faParams = z.infer<typeof verify2faParamsSchema>;
export type Disable2faParams = z.infer<typeof disable2faParamsSchema>;
export type CreateTokenParams = z.infer<typeof createTokenParamsSchema>;
export type RevokeTokenParams = z.infer<typeof revokeTokenParamsSchema>;
export type AuditQueryParams = z.infer<typeof auditQueryParamsSchema>;
export type GetHistoryParams = z.infer<typeof getHistoryParamsSchema>;
