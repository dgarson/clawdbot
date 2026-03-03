/**
 * Security feature types
 *
 * Types for authentication, 2FA, tokens, and audit logging.
 */

// =============================================================================
// Unlock & Session Types
// =============================================================================

export interface UnlockConfig {
  /** Whether unlock protection is enabled */
  enabled: boolean;
  /** bcrypt hash of unlock password (never exposed to client) */
  passwordHash?: string;
  /** How long unlock lasts in ms (default 24h) */
  sessionDurationMs: number;
}

export interface UnlockSession {
  /** Session ID */
  id: string;
  /** When the session was created */
  createdAt: number;
  /** When the session expires */
  expiresAt: number;
  /** Whether session is still valid */
  valid: boolean;
}

export type UnlockFailureReason =
  | "wrong_password"
  | "wrong_2fa"
  | "invalid_recovery_code"
  | "locked_out"
  | "session_expired";

export interface UnlockEvent {
  /** Event ID */
  id: string;
  /** Timestamp */
  ts: number;
  /** Whether unlock was successful */
  success: boolean;
  /** Failure reason if not successful */
  failureReason?: UnlockFailureReason;
  /** Client IP address */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Device fingerprint for grouping */
  deviceFingerprint?: string;
}

// =============================================================================
// Two-Factor Authentication Types
// =============================================================================

export interface TwoFactorConfig {
  /** Whether 2FA is enabled */
  enabled: boolean;
  /** Encrypted TOTP secret (never exposed after setup) */
  totpSecret?: string;
  /** Hashed recovery codes (8 codes) */
  backupCodes?: string[];
  /** When 2FA was enabled */
  enabledAt?: number;
}

export interface TwoFactorSetupData {
  /** Base32-encoded secret for manual entry */
  secret: string;
  /** otpauth:// URI for QR code */
  otpauthUrl: string;
  /** QR code as data URL */
  qrCodeDataUrl: string;
}

export interface RecoveryCodesData {
  /** Plain-text recovery codes (shown only once) */
  codes: string[];
  /** When codes were generated */
  generatedAt: number;
}

// =============================================================================
// API Token Types
// =============================================================================

export type TokenScope =
  | "agent:read"
  | "agent:write"
  | "config:read"
  | "config:write"
  | "audit:read"
  | "sessions:read"
  | "sessions:write"
  | "*";

export interface PersonalAccessToken {
  /** Token ID (UUIDv7) */
  id: string;
  /** User-friendly name */
  name: string;
  /** First 8 chars for display (e.g., "clb_abc1") */
  prefix: string;
  /** SHA-256 hash of full token (full token never stored) */
  hashedToken: string;
  /** Granted scopes */
  scopes: TokenScope[];
  /** Unix timestamp when created */
  createdAt: number;
  /** Unix timestamp when expires, null = never */
  expiresAt: number | null;
  /** Unix timestamp when last used */
  lastUsedAt: number | null;
  /** Unix timestamp when revoked, null = active */
  revokedAt: number | null;
}

/** Token as returned to client (without hash) */
export interface TokenInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: TokenScope[];
  createdAt: number;
  expiresAt: number | null;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

/** Token creation result (includes full token shown once) */
export interface TokenCreationResult {
  token: TokenInfo;
  /** Full token value - shown only once */
  fullToken: string;
}

// =============================================================================
// Audit Log Types
// =============================================================================

export type AuditCategory = "config" | "agent" | "security" | "token";

export type AuditSeverity = "info" | "warn" | "error";

export type ConfigAuditAction =
  | "config.get"
  | "config.patch"
  | "config.apply"
  | "config.set";

export type SecurityAuditAction =
  | "unlock.attempt"
  | "unlock.success"
  | "unlock.failure"
  | "unlock.lockout"
  | "password.setup"
  | "password.change"
  | "2fa.enable"
  | "2fa.disable"
  | "2fa.verify"
  | "2fa.recovery";

export type AgentAuditAction =
  | "tool.execute"
  | "tool.approve"
  | "tool.reject"
  | "tool.error";

export type TokenAuditAction =
  | "token.create"
  | "token.revoke"
  | "token.use";

export type AuditAction =
  | ConfigAuditAction
  | SecurityAuditAction
  | AgentAuditAction
  | TokenAuditAction;

export interface AuditEventBase {
  /** Event ID (UUIDv7) */
  id: string;
  /** Unix timestamp */
  ts: number;
  /** Event category */
  category: AuditCategory;
  /** Specific action */
  action: AuditAction;
  /** Severity level */
  severity: AuditSeverity;
  /** Actor ID (device/token/session) */
  actorId?: string;
}

export interface ConfigAuditEvent extends AuditEventBase {
  category: "config";
  action: ConfigAuditAction;
  detail: {
    path?: string;
    previousValue?: unknown;
    newValue?: unknown;
  };
}

export interface SecurityAuditEvent extends AuditEventBase {
  category: "security";
  action: SecurityAuditAction;
  detail: {
    method?: "password" | "2fa" | "recovery";
    ipAddress?: string;
    userAgent?: string;
    failureReason?: UnlockFailureReason;
  };
}

export interface AgentAuditEvent extends AuditEventBase {
  category: "agent";
  action: AgentAuditAction;
  detail: {
    runId: string;
    agentId?: string;
    toolName: string;
    toolCallId: string;
    phase: "start" | "end" | "error";
    input?: Record<string, unknown>;
    output?: unknown;
    durationMs?: number;
  };
}

export interface TokenAuditEvent extends AuditEventBase {
  category: "token";
  action: TokenAuditAction;
  detail: {
    tokenId: string;
    tokenName?: string;
    scopes?: TokenScope[];
  };
}

export type AuditEvent =
  | ConfigAuditEvent
  | SecurityAuditEvent
  | AgentAuditEvent
  | TokenAuditEvent;

// =============================================================================
// Security State Types (for UI)
// =============================================================================

export interface SecurityState {
  /** Whether unlock protection is enabled */
  lockEnabled: boolean;
  /** Whether currently unlocked */
  isUnlocked: boolean;
  /** Current session info if unlocked */
  session: UnlockSession | null;
  /** Whether 2FA is enabled */
  twoFactorEnabled: boolean;
  /** Whether 2FA setup is in progress */
  twoFactorSetupPending: boolean;
}

export interface SecurityConfig {
  unlock: UnlockConfig;
  twoFactor: TwoFactorConfig;
}

// =============================================================================
// RPC Request/Response Types
// =============================================================================

// security.getState
export interface SecurityGetStateResult {
  lockEnabled: boolean;
  isUnlocked: boolean;
  session: UnlockSession | null;
  twoFactorEnabled: boolean;
  requiresSetup: boolean;
}

// security.setupPassword
export interface SecuritySetupPasswordParams {
  password: string;
}

export interface SecuritySetupPasswordResult {
  success: boolean;
  session: UnlockSession;
}

// security.changePassword
export interface SecurityChangePasswordParams {
  currentPassword: string;
  newPassword: string;
}

export interface SecurityChangePasswordResult {
  success: boolean;
}

// security.unlock
export interface SecurityUnlockParams {
  password: string;
  totpCode?: string;
  recoveryCode?: string;
}

export interface SecurityUnlockResult {
  success: boolean;
  session?: UnlockSession;
  requires2fa?: boolean;
  failureReason?: UnlockFailureReason;
  attemptsRemaining?: number;
}

// security.lock
export interface SecurityLockResult {
  success: boolean;
}

// security.disable
export interface SecurityDisableParams {
  password: string;
}

export interface SecurityDisableResult {
  success: boolean;
}

// security.setup2fa
export interface SecuritySetup2faParams {
  password: string;
}

export interface SecuritySetup2faResult {
  setupData: TwoFactorSetupData;
}

// security.verify2fa
export interface SecurityVerify2faParams {
  code: string;
}

export interface SecurityVerify2faResult {
  success: boolean;
  recoveryCodes?: RecoveryCodesData;
}

// security.disable2fa
export interface SecurityDisable2faParams {
  password: string;
  code: string;
}

export interface SecurityDisable2faResult {
  success: boolean;
}

// security.getHistory
export interface SecurityGetHistoryParams {
  limit?: number;
  offset?: number;
}

export interface SecurityGetHistoryResult {
  events: UnlockEvent[];
  total: number;
}

// tokens.list
export interface TokensListResult {
  tokens: TokenInfo[];
}

// tokens.create
export interface TokensCreateParams {
  name: string;
  scopes: TokenScope[];
  expiresInDays?: number | null;
}

export interface TokensCreateResult {
  token: TokenInfo;
  fullToken: string;
}

// tokens.revoke
export interface TokensRevokeParams {
  tokenId: string;
}

export interface TokensRevokeResult {
  success: boolean;
}

// audit.query
export interface AuditQueryParams {
  category?: AuditCategory;
  action?: AuditAction;
  severity?: AuditSeverity;
  startTs?: number;
  endTs?: number;
  limit?: number;
  offset?: number;
}

export interface AuditQueryResult {
  events: AuditEvent[];
  total: number;
  hasMore: boolean;
}
