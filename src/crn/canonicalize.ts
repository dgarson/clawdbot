/**
 * CRN Canonicalization — convert URLs to canonical CRN form, and
 * automatically enrich EntityRef objects with resolved URIs and CRNs.
 */

import type { EntityRef, ParsedCrn } from "./types.js";
import { parseCrn } from "./parse.js";
import {
  buildCrn,
  getAllServicePatterns,
  getServicePattern,
  refKindToCrnParts,
  resolveUrl,
} from "./registry.js";
import { CRN_VERSION } from "./types.js";

// ---------------------------------------------------------------------------
// URL → CRN
// ---------------------------------------------------------------------------

/**
 * Attempt to canonicalize a URL into a CRN string.
 *
 * Iterates through all registered service patterns trying to match the URL.
 * Returns the CRN string or null if no pattern matches.
 *
 * @example
 * urlToCrn("https://chatgpt.com/codex/tasks/task_e_abc123")
 * // → "crn:1:codex-web:*:task:task_e_abc123"
 *
 * urlToCrn("https://github.com/dgarson/clawdbrain/pull/347")
 * // → "crn:1:github:dgarson/clawdbrain:pr:347"
 */
export function urlToCrn(url: string): string | null {
  for (const [_service, pattern] of getAllServicePatterns()) {
    const parsed = pattern.parseUrl(url);
    if (parsed) {
      return buildCrn(parsed.service, parsed.scope, parsed.resourceType, parsed.resourceId);
    }
  }
  return null;
}

/**
 * Attempt to parse a URL into CRN components.
 * Returns null if no registered service pattern matches.
 */
export function urlToParsedCrn(url: string): ParsedCrn | null {
  for (const [_service, pattern] of getAllServicePatterns()) {
    const parsed = pattern.parseUrl(url);
    if (parsed) {
      return {
        scheme: "crn",
        version: CRN_VERSION,
        ...parsed,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// CRN → URL
// ---------------------------------------------------------------------------

/**
 * Resolve a CRN string to a fully-qualified URL.
 * Returns undefined if the CRN is invalid or the service/resource type is not registered.
 *
 * @example
 * crnToUrl("crn:1:codex-web:*:task:task_e_abc123")
 * // → "https://chatgpt.com/codex/tasks/task_e_abc123"
 */
export function crnToUrl(crn: string): string | undefined {
  const parsed = parseCrn(crn);
  if (!parsed) {
    return undefined;
  }
  return resolveUrl(parsed);
}

// ---------------------------------------------------------------------------
// EntityRef canonicalization
// ---------------------------------------------------------------------------

/**
 * Canonicalize an EntityRef: enrich it with CRN and/or URI as appropriate.
 *
 * Logic:
 * 1. If `ref.id` is already a CRN string, parse it and resolve the URL
 * 2. If `ref.uri` is set and looks like a URL, attempt URL→CRN conversion
 * 3. If `ref.kind` is namespaced (e.g. "codex-web:task"), build a CRN from kind + id
 *
 * The original ref is not mutated — a new object is returned.
 */
export function canonicalizeRef(ref: EntityRef): EntityRef {
  const result = { ...ref };

  // Case 1: id is already a CRN
  if (ref.id.startsWith("crn:")) {
    result.crn = ref.id;
    const parsed = parseCrn(ref.id);
    if (parsed && !result.uri) {
      const url = resolveUrl(parsed);
      if (url) {
        result.uri = url;
      }
    }
    return result;
  }

  // Case 2: URI is set — try to canonicalize it
  if (ref.uri && !result.crn) {
    const crn = urlToCrn(ref.uri);
    if (crn) {
      result.crn = crn;
    }
  }

  // Case 3: Build CRN from kind + id for external services
  if (!result.crn) {
    const crnParts = refKindToCrnParts(ref.kind);
    if (crnParts) {
      const pattern = getServicePattern(crnParts.service);
      if (pattern) {
        // For external services, we can build a CRN and resolve the URL
        result.crn = buildCrn(crnParts.service, "*", crnParts.resourceType, ref.id);
        if (!result.uri) {
          const parsed = parseCrn(result.crn);
          if (parsed) {
            const url = resolveUrl(parsed);
            if (url) {
              result.uri = url;
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * Canonicalize an array of EntityRefs.
 */
export function canonicalizeRefs(refs: EntityRef[]): EntityRef[] {
  return refs.map(canonicalizeRef);
}

/**
 * Given a URL, attempt to create an EntityRef with the appropriate kind and CRN.
 * Returns null if the URL doesn't match any registered service.
 */
export function urlToRef(url: string): EntityRef | null {
  for (const [_service, pattern] of getAllServicePatterns()) {
    const parsed = pattern.parseUrl(url);
    if (parsed) {
      const kind = pattern.refKindMap?.[parsed.resourceType];
      if (!kind) {
        continue;
      }

      const crn = buildCrn(parsed.service, parsed.scope, parsed.resourceType, parsed.resourceId);
      return {
        kind,
        id: parsed.resourceId,
        uri: url,
        crn,
      };
    }
  }
  return null;
}
