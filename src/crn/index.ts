/**
 * CRN (ClawdBrain Resource Name) — canonical resource identification system.
 *
 * @module crn
 */

// Types
export type { CrnService, EntityRef, ParsedCrn, RefKind } from "./types.js";
export { CRN_SERVICES, CRN_VERSION, REF_KINDS } from "./types.js";

// Parsing
export { isCrn, isKnownService, parseCrn, validateCrn } from "./parse.js";

// Registry
export {
  buildCrn,
  getAllServicePatterns,
  getServicePattern,
  refKindToCrnParts,
  resolveUrl,
} from "./registry.js";
export type { ServiceUrlPattern } from "./registry.js";

// Canonicalization
export {
  canonicalizeRef,
  canonicalizeRefs,
  crnToUrl,
  urlToCrn,
  urlToParsedCrn,
  urlToRef,
} from "./canonicalize.js";
