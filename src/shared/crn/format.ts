import type { CrnParts } from "./types.js";
import { assertValidCrnLength } from "./validate.js";

export function formatCrn(parts: CrnParts): string {
  const crn = `${parts.prefix}:${parts.version}:${parts.service}:${parts.scope}:${parts.resourceType}:${parts.resourceId}`;
  assertValidCrnLength(crn);
  return crn;
}
