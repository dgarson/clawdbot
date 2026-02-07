/**
 * Security Feature Module
 *
 * Self-contained module for security features:
 * - App lock (password protection)
 * - Two-factor authentication (TOTP)
 * - API tokens
 * - Audit logging
 *
 * Integration: Wrap app with SecurityProvider in main.tsx
 *
 * @example
 * ```tsx
 * import { SecurityProvider } from './features/security';
 *
 * <SecurityProvider>
 *   <App />
 * </SecurityProvider>
 * ```
 */

// Main provider and context
export { SecurityProvider, useSecurity, useNeedsUnlock, securityKeys } from "./SecurityProvider";

// Components
export * from "./components";

// Hooks
export * from "./hooks";

// Types (canonical type definitions)
export * from "./types";

// API
export * from "./lib/security-api";

// Schemas (Zod schemas for validation) - rename conflicting types
export {
  passwordSchema,
  totpCodeSchema,
  recoveryCodeSchema,
  unlockParamsSchema,
  setupPasswordParamsSchema,
  changePasswordParamsSchema,
  disableParamsSchema,
  setup2faParamsSchema,
  verify2faParamsSchema,
  disable2faParamsSchema,
  tokenScopeSchema,
  tokenNameSchema,
  createTokenParamsSchema,
  revokeTokenParamsSchema,
  auditCategorySchema,
  auditSeveritySchema,
  auditQueryParamsSchema,
  getHistoryParamsSchema,
} from "./lib/security-schemas";

// Config
export * from "./lib/security-config";
