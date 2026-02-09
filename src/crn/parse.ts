/**
 * CRN Parsing — convert CRN strings to structured ParsedCrn objects.
 */

import type { CrnService, ParsedCrn } from "./types.js";
import { CRN_SERVICES, CRN_VERSION } from "./types.js";

const CRN_PREFIX = "crn:";

const serviceSet = new Set<string>(CRN_SERVICES);

/**
 * Parse a CRN string into its structured components.
 *
 * Format: crn:{version}:{service}:{scope}:{resource-type}:{resource-id}
 *
 * The resource-id field is **greedy** — everything from the 6th colon onward
 * is treated as the resource ID, so embedded colons in IDs are safe.
 *
 * @returns ParsedCrn or null if the string is not a valid CRN
 */
export function parseCrn(crn: string): ParsedCrn | null {
  if (!crn.startsWith(CRN_PREFIX)) {
    return null;
  }

  // Split into at most 6 parts: crn, version, service, scope, resourceType, resourceId(greedy)
  const parts = crn.split(":");
  if (parts.length < 6) {
    return null;
  }

  const [_scheme, version, service, scope, resourceType, ...resourceIdParts] = parts;

  // Validate version
  if (!version) {
    return null;
  }

  // Validate service (allow unknown services for forward compatibility)
  if (!service) {
    return null;
  }

  // Validate scope
  if (scope === undefined || scope === "") {
    return null;
  }

  // Validate resource type
  if (!resourceType) {
    return null;
  }

  // Greedy resource ID — rejoin with ":"
  const resourceId = resourceIdParts.join(":");
  if (!resourceId) {
    return null;
  }

  return {
    scheme: "crn",
    version,
    service: service as CrnService,
    scope,
    resourceType,
    resourceId,
  };
}

/**
 * Check if a string is a valid CRN.
 */
export function isCrn(value: string): boolean {
  return parseCrn(value) !== null;
}

/**
 * Check if a CRN uses a known/registered service.
 */
export function isKnownService(service: string): service is CrnService {
  return serviceSet.has(service);
}

/**
 * Validate a CRN string strictly — checks version, service, and structure.
 * Returns an error message or null if valid.
 */
export function validateCrn(crn: string): string | null {
  if (!crn.startsWith(CRN_PREFIX)) {
    return `CRN must start with "crn:" prefix`;
  }

  const parsed = parseCrn(crn);
  if (!parsed) {
    return `Invalid CRN format. Expected: crn:{version}:{service}:{scope}:{resource-type}:{resource-id}`;
  }

  if (parsed.version !== CRN_VERSION) {
    return `Unsupported CRN version "${parsed.version}" (expected "${CRN_VERSION}")`;
  }

  if (!isKnownService(parsed.service)) {
    return `Unknown CRN service "${parsed.service}". Known services: ${CRN_SERVICES.join(", ")}`;
  }

  return null;
}
