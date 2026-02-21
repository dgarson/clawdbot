/**
 * Security API client functions
 *
 * Wrapper functions for gateway RPC security methods.
 */

import { getGatewayClient } from "@/lib/api/gateway-client";
import type {
  SecurityGetStateResult,
  SecuritySetupPasswordParams,
  SecuritySetupPasswordResult,
  SecurityChangePasswordParams,
  SecurityChangePasswordResult,
  SecurityUnlockParams,
  SecurityUnlockResult,
  SecurityLockResult,
  SecurityDisableParams,
  SecurityDisableResult,
  SecuritySetup2faParams,
  SecuritySetup2faResult,
  SecurityVerify2faParams,
  SecurityVerify2faResult,
  SecurityDisable2faParams,
  SecurityDisable2faResult,
  SecurityGetHistoryParams,
  SecurityGetHistoryResult,
  TokensListResult,
  TokensCreateParams,
  TokensCreateResult,
  TokensRevokeParams,
  TokensRevokeResult,
  AuditQueryParams,
  AuditQueryResult,
} from "../types";

// =============================================================================
// Security State
// =============================================================================

/**
 * Get current security state (lock enabled, unlocked, 2FA status).
 */
export async function getSecurityState(): Promise<SecurityGetStateResult> {
  const client = getGatewayClient();
  return client.request<SecurityGetStateResult>("security.getState", {});
}

// =============================================================================
// Password & Lock
// =============================================================================

/**
 * Set up password protection for the first time.
 */
export async function setupPassword(
  params: SecuritySetupPasswordParams
): Promise<SecuritySetupPasswordResult> {
  const client = getGatewayClient();
  return client.request<SecuritySetupPasswordResult>("security.setupPassword", params);
}

/**
 * Change the unlock password.
 */
export async function changePassword(
  params: SecurityChangePasswordParams
): Promise<SecurityChangePasswordResult> {
  const client = getGatewayClient();
  return client.request<SecurityChangePasswordResult>("security.changePassword", params);
}

/**
 * Unlock the app with password (and optional 2FA).
 */
export async function unlock(
  params: SecurityUnlockParams
): Promise<SecurityUnlockResult> {
  const client = getGatewayClient();
  return client.request<SecurityUnlockResult>("security.unlock", params);
}

/**
 * Lock the app (end current session).
 */
export async function lock(): Promise<SecurityLockResult> {
  const client = getGatewayClient();
  return client.request<SecurityLockResult>("security.lock", {});
}

/**
 * Disable password protection entirely.
 */
export async function disableLock(
  params: SecurityDisableParams
): Promise<SecurityDisableResult> {
  const client = getGatewayClient();
  return client.request<SecurityDisableResult>("security.disable", params);
}

// =============================================================================
// Two-Factor Authentication
// =============================================================================

/**
 * Start 2FA setup - returns secret and QR code.
 */
export async function setup2fa(
  params: SecuritySetup2faParams
): Promise<SecuritySetup2faResult> {
  const client = getGatewayClient();
  return client.request<SecuritySetup2faResult>("security.setup2fa", params);
}

/**
 * Verify 2FA setup with a code from authenticator app.
 * Returns recovery codes on success.
 */
export async function verify2fa(
  params: SecurityVerify2faParams
): Promise<SecurityVerify2faResult> {
  const client = getGatewayClient();
  return client.request<SecurityVerify2faResult>("security.verify2fa", params);
}

/**
 * Disable 2FA (requires password and valid 2FA code).
 */
export async function disable2fa(
  params: SecurityDisable2faParams
): Promise<SecurityDisable2faResult> {
  const client = getGatewayClient();
  return client.request<SecurityDisable2faResult>("security.disable2fa", params);
}

// =============================================================================
// Unlock History
// =============================================================================

/**
 * Get unlock attempt history.
 */
export async function getUnlockHistory(
  params: SecurityGetHistoryParams = {}
): Promise<SecurityGetHistoryResult> {
  const client = getGatewayClient();
  return client.request<SecurityGetHistoryResult>("security.getHistory", params);
}

// =============================================================================
// API Tokens
// =============================================================================

/**
 * List all API tokens.
 */
export async function listTokens(): Promise<TokensListResult> {
  const client = getGatewayClient();
  return client.request<TokensListResult>("tokens.list", {});
}

/**
 * Create a new API token.
 * Returns the full token value (shown only once).
 */
export async function createToken(
  params: TokensCreateParams
): Promise<TokensCreateResult> {
  const client = getGatewayClient();
  return client.request<TokensCreateResult>("tokens.create", params);
}

/**
 * Revoke an API token.
 */
export async function revokeToken(
  params: TokensRevokeParams
): Promise<TokensRevokeResult> {
  const client = getGatewayClient();
  return client.request<TokensRevokeResult>("tokens.revoke", params);
}

// =============================================================================
// Audit Log
// =============================================================================

/**
 * Query audit log events.
 */
export async function queryAuditLog(
  params: AuditQueryParams = {}
): Promise<AuditQueryResult> {
  const client = getGatewayClient();
  return client.request<AuditQueryResult>("audit.query", params);
}
