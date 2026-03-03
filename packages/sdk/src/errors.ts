import { z } from "zod";

export interface OpenClawErrorMetadata {
  requestId?: string;
  spanId?: string;
  statusCode?: number;
}

export interface OpenClawErrorPayload {
  code: string;
  message: string;
  statusCode?: number;
  requestId?: string;
  spanId?: string;
}

export class OpenClawError extends Error {
  public name = "OpenClawError";
  public code = "OPEN_CLAW_ERROR";
  public requestId?: string;
  public spanId?: string;
  public statusCode?: number;

  public constructor(message: string, metadata: OpenClawErrorMetadata = {}) {
    super(message);

    this.requestId = metadata.requestId;
    this.spanId = metadata.spanId;
    this.statusCode = metadata.statusCode;
  }
}

export class ValidationError extends OpenClawError {
  public name = "ValidationError";
  public cause?: z.ZodError;

  public constructor(message: string, metadata: OpenClawErrorMetadata = {}, cause?: z.ZodError) {
    super(message, metadata);
    this.code = "VALIDATION_ERROR";
    this.cause = cause;
  }
}

export class TransportError extends OpenClawError {
  public name = "TransportError";

  public constructor(message: string, metadata: OpenClawErrorMetadata = {}) {
    super(message, metadata);
    this.code = "TRANSPORT_ERROR";
  }
}

export class AuthError extends OpenClawError {
  public name = "AuthError";

  public constructor(message: string, metadata: OpenClawErrorMetadata = {}) {
    super(message, metadata);
    this.code = "AUTH_ERROR";
  }
}

export class ToolRuntimeError extends OpenClawError {
  public name = "ToolRuntimeError";

  public constructor(message: string, metadata: OpenClawErrorMetadata = {}) {
    super(message, metadata);
    this.code = "TOOL_RUNTIME_ERROR";
  }
}

export class SandboxUnavailableError extends OpenClawError {
  public name = "SandboxUnavailableError";

  public constructor(
    message = "Sandbox runtime is not configured",
    metadata: OpenClawErrorMetadata = {},
  ) {
    super(message, metadata);
    this.code = "SANDBOX_UNAVAILABLE";
  }
}

export const parseErrorPayload = (raw: unknown): OpenClawErrorPayload => {
  if (typeof raw === "object" && raw !== null) {
    const result = z
      .object({
        code: z.string().default("OPEN_CLAW_ERROR"),
        message: z.string().default("Unknown OpenClaw error"),
        statusCode: z.number().int().positive().optional(),
        requestId: z.string().optional(),
        spanId: z.string().optional(),
      })
      .partial()
      .passthrough()
      .safeParse(raw);

    if (result.success) {
      const payload = result.data;
      return {
        code: payload.code ?? "OPEN_CLAW_ERROR",
        message: payload.message ?? "Unknown OpenClaw error",
        statusCode: payload.statusCode,
        requestId: payload.requestId,
        spanId: payload.spanId,
      };
    }
  }

  return {
    code: "OPEN_CLAW_ERROR",
    message: "Unknown OpenClaw error",
  };
};
