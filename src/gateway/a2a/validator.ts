/**
 * Agent-to-Agent (A2A) Communication Protocol — Message Validator
 *
 * Validates incoming A2A messages against the protocol schema.
 * Returns typed results with descriptive errors.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

import type { ErrorObject } from "ajv";
import Ajv from "ajv";
import { agentRefSchema, payloadSchemas } from "./schema.js";
import {
  A2A_PROTOCOL_VERSION,
  MESSAGE_TYPES,
  PRIORITIES,
  type A2AMessage,
  type MessageType,
} from "./types.js";

// ─── Error Types ─────────────────────────────────────────────────────────────

export interface ValidationError {
  /** JSONPath-like location of the error (e.g., "/payload/taskId") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** The rule that was violated (e.g., "required", "enum", "type") */
  rule: string;
}

export type ValidationResult =
  | { valid: true; message: A2AMessage }
  | { valid: false; errors: ValidationError[] };

// ─── Validator ───────────────────────────────────────────────────────────────

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
  // coerceTypes: false — we want strict type checking
});

// Pre-compile payload validators
const payloadValidators = new Map<string, ReturnType<typeof ajv.compile>>();
for (const [type, schema] of Object.entries(payloadSchemas)) {
  payloadValidators.set(type, ajv.compile(schema));
}

// Compile agent ref validator
const validateAgentRef = ajv.compile(agentRefSchema);

/**
 * Convert AJV errors into our ValidationError format.
 */
function formatAjvErrors(errors: ErrorObject[], prefix: string): ValidationError[] {
  return errors.map((err) => {
    const path = prefix + (err.instancePath || "");
    let message: string;

    switch (err.keyword) {
      case "required":
        message = `Missing required field: ${(err.params as { missingProperty: string }).missingProperty}`;
        break;
      case "enum":
        message = `Invalid value. Allowed values: ${JSON.stringify((err.params as { allowedValues: string[] }).allowedValues)}`;
        break;
      case "type":
        message = `Expected type "${(err.params as { type: string }).type}" but got "${typeof err.data}"`;
        break;
      case "minLength":
        message = `String must not be empty (minimum length: ${(err.params as { limit: number }).limit})`;
        break;
      case "minItems":
        message = `Array must have at least ${(err.params as { limit: number }).limit} item(s)`;
        break;
      case "additionalProperties":
        message = `Unknown property: "${(err.params as { additionalProperty: string }).additionalProperty}"`;
        break;
      default:
        message = err.message || `Validation failed: ${err.keyword}`;
    }

    return { path, message, rule: err.keyword };
  });
}

/**
 * Validate the envelope (top-level fields, excluding payload which is type-specific).
 * Returns errors array (empty = valid).
 */
function validateEnvelope(input: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  // protocol
  if (!("protocol" in input)) {
    errors.push({
      path: "/protocol",
      message: 'Missing required field: "protocol"',
      rule: "required",
    });
  } else if (input.protocol !== A2A_PROTOCOL_VERSION) {
    errors.push({
      path: "/protocol",
      message: `Invalid protocol version. Expected "${A2A_PROTOCOL_VERSION}", got "${String(input.protocol)}"`,
      rule: "const",
    });
  }

  // messageId
  if (!("messageId" in input) || typeof input.messageId !== "string") {
    errors.push({
      path: "/messageId",
      message: 'Missing or invalid "messageId" (must be a non-empty string)',
      rule: "required",
    });
  } else if (input.messageId.length === 0) {
    errors.push({
      path: "/messageId",
      message: '"messageId" must not be empty',
      rule: "minLength",
    });
  }

  // timestamp
  if (!("timestamp" in input) || typeof input.timestamp !== "string") {
    errors.push({
      path: "/timestamp",
      message: 'Missing or invalid "timestamp" (must be an ISO 8601 string)',
      rule: "required",
    });
  } else if (input.timestamp.length === 0) {
    errors.push({
      path: "/timestamp",
      message: '"timestamp" must not be empty',
      rule: "minLength",
    });
  }

  // from
  if (!("from" in input) || typeof input.from !== "object" || input.from === null) {
    errors.push({
      path: "/from",
      message: 'Missing or invalid "from" (must be an AgentRef object)',
      rule: "required",
    });
  } else {
    const valid = validateAgentRef(input.from);
    if (!valid && validateAgentRef.errors) {
      errors.push(...formatAjvErrors(validateAgentRef.errors, "/from"));
    }
  }

  // to
  if (!("to" in input) || typeof input.to !== "object" || input.to === null) {
    errors.push({
      path: "/to",
      message: 'Missing or invalid "to" (must be an AgentRef object)',
      rule: "required",
    });
  } else {
    const valid = validateAgentRef(input.to);
    if (!valid && validateAgentRef.errors) {
      errors.push(...formatAjvErrors(validateAgentRef.errors, "/to"));
    }
  }

  // type
  if (!("type" in input) || typeof input.type !== "string") {
    errors.push({
      path: "/type",
      message: 'Missing or invalid "type" (must be a string)',
      rule: "required",
    });
  } else if (!MESSAGE_TYPES.includes(input.type as MessageType)) {
    errors.push({
      path: "/type",
      message: `Invalid message type "${input.type}". Allowed: ${JSON.stringify(MESSAGE_TYPES)}`,
      rule: "enum",
    });
  }

  // priority
  if (!("priority" in input) || typeof input.priority !== "string") {
    errors.push({
      path: "/priority",
      message: 'Missing or invalid "priority" (must be a string)',
      rule: "required",
    });
  } else if (!PRIORITIES.includes(input.priority as A2AMessage["priority"])) {
    errors.push({
      path: "/priority",
      message: `Invalid priority "${input.priority}". Allowed: ${JSON.stringify(PRIORITIES)}`,
      rule: "enum",
    });
  }

  // payload (must exist as object)
  if (!("payload" in input) || typeof input.payload !== "object" || input.payload === null) {
    errors.push({
      path: "/payload",
      message: 'Missing or invalid "payload" (must be an object)',
      rule: "required",
    });
  }

  return errors;
}

/**
 * Validate semantic rules that go beyond structural JSON Schema validation.
 * E.g., task_response requires "reason" when action is declined/failed/blocked.
 */
function validateSemantics(type: string, payload: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (type === "task_response") {
    const action = payload.action as string;
    const reason = payload.reason;
    if (["declined", "failed", "blocked"].includes(action)) {
      if (
        reason === undefined ||
        reason === null ||
        (typeof reason === "string" && reason.trim().length === 0)
      ) {
        errors.push({
          path: "/payload/reason",
          message: `"reason" is required when action is "${action}"`,
          rule: "semantic_required",
        });
      }
    }
  }

  if (type === "review_response") {
    const verdict = payload.verdict as string;
    const unresolvedConcerns = payload.unresolvedConcerns as unknown[] | undefined;
    if (verdict === "changes_requested") {
      if (
        !unresolvedConcerns ||
        !Array.isArray(unresolvedConcerns) ||
        unresolvedConcerns.length === 0
      ) {
        errors.push({
          path: "/payload/unresolvedConcerns",
          message:
            '"unresolvedConcerns" must be a non-empty array when verdict is "changes_requested"',
          rule: "semantic_required",
        });
      }
    }
  }

  return errors;
}

/**
 * Validate an unknown input as an A2A message.
 *
 * Returns either a typed A2AMessage on success, or descriptive errors on failure.
 */
export function validateA2AMessage(input: unknown): ValidationResult {
  // Basic type guard
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      valid: false,
      errors: [{ path: "/", message: "A2A message must be a non-null object", rule: "type" }],
    };
  }

  const obj = input as Record<string, unknown>;

  // Validate envelope
  const envelopeErrors = validateEnvelope(obj);

  // If type is invalid or payload is missing, we can't validate the payload further
  const messageType = obj.type as string;
  const hasValidType =
    typeof messageType === "string" && MESSAGE_TYPES.includes(messageType as MessageType);
  const hasPayload = typeof obj.payload === "object" && obj.payload !== null;

  if (!hasValidType || !hasPayload) {
    return { valid: false, errors: envelopeErrors };
  }

  // Validate payload against type-specific schema
  const payloadValidator = payloadValidators.get(messageType);
  const payloadErrors: ValidationError[] = [];

  if (payloadValidator) {
    const valid = payloadValidator(obj.payload);
    if (!valid && payloadValidator.errors) {
      payloadErrors.push(...formatAjvErrors(payloadValidator.errors, "/payload"));
    }
  }

  // Validate semantic rules
  const semanticErrors = validateSemantics(messageType, obj.payload as Record<string, unknown>);

  const allErrors = [...envelopeErrors, ...payloadErrors, ...semanticErrors];

  if (allErrors.length > 0) {
    return { valid: false, errors: allErrors };
  }

  return { valid: true, message: input as A2AMessage };
}
