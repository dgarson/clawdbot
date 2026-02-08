import type { CrnParseMode } from "./types.js";
import {
  CRN_MAX_LENGTH,
  RESOURCE_ID_MAX_LENGTH,
  STRUCTURAL_TOKEN_MAX_LENGTH,
  STRUCTURAL_TOKEN_RE,
} from "./constants.js";
import { CrnError } from "./errors.js";
import { assertNoControlChars } from "./sanitize.js";

export function assertValidToken(
  value: string,
  label: string,
  opts?: { allowWildcard?: boolean },
): void {
  if (opts?.allowWildcard && value === "*") {
    return;
  }
  if (value.length === 0 || value.length > STRUCTURAL_TOKEN_MAX_LENGTH) {
    throw new CrnError(
      "invalid_token",
      `${label} must be 1..${STRUCTURAL_TOKEN_MAX_LENGTH} chars`,
      {
        label,
        value,
      },
    );
  }
  if (!STRUCTURAL_TOKEN_RE.test(value)) {
    throw new CrnError("invalid_token", `${label} contains invalid characters`, {
      label,
      value,
    });
  }
}

export function assertValidResourceId(resourceId: string, mode: CrnParseMode): void {
  if (resourceId.length === 0 || resourceId.length > RESOURCE_ID_MAX_LENGTH) {
    throw new CrnError(
      "invalid_resource_id",
      `resource-id must be 1..${RESOURCE_ID_MAX_LENGTH} chars`,
      { resourceId },
    );
  }
  assertNoControlChars(resourceId, "resource-id");

  const starIndex = resourceId.indexOf("*");
  if (mode === "concrete" && starIndex !== -1) {
    throw new CrnError("invalid_resource_id", "resource-id cannot contain wildcards", {
      resourceId,
    });
  }
  if (mode === "pattern" && starIndex !== -1) {
    if (resourceId !== "*" && !resourceId.endsWith("*")) {
      throw new CrnError("invalid_pattern", "resource-id wildcard must be terminal", {
        resourceId,
      });
    }
    const prefix = resourceId === "*" ? "" : resourceId.slice(0, -1);
    if (prefix.includes("*")) {
      throw new CrnError("invalid_pattern", "resource-id wildcard must be terminal", {
        resourceId,
      });
    }
  }
}

export function assertValidCrnLength(crn: string): void {
  if (crn.length > CRN_MAX_LENGTH) {
    throw new CrnError("too_long", `CRN exceeds max length ${CRN_MAX_LENGTH}`, {
      length: crn.length,
    });
  }
}
