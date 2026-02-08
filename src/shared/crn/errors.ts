export type CrnErrorCode =
  | "invalid_format"
  | "invalid_prefix"
  | "invalid_version"
  | "invalid_token"
  | "invalid_scope"
  | "invalid_resource_id"
  | "invalid_pattern"
  | "too_long";

export class CrnError extends Error {
  readonly code: CrnErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: CrnErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
