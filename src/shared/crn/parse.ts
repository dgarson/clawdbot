import type { CrnParseMode, CrnParts } from "./types.js";
import { CRN_PREFIX, CRN_VERSION } from "./constants.js";
import { CrnError } from "./errors.js";
import { normalizeCrnPartsInput } from "./normalize.js";
import { assertNoControlChars, trimCrnInput } from "./sanitize.js";
import { splitCrn } from "./split.js";

export function parseCrn(input: string, opts?: { mode?: CrnParseMode }): CrnParts {
  const mode = opts?.mode ?? "concrete";
  const trimmed = trimCrnInput(input);
  if (!trimmed) {
    throw new CrnError("invalid_format", "CRN is empty", { input });
  }
  assertNoControlChars(trimmed, "crn");

  const parts = splitCrn(trimmed);
  if (parts.length !== 6) {
    throw new CrnError("invalid_format", "CRN must have 6 segments", { input, parts });
  }

  const prefix = parts[0]?.trim().toLowerCase();
  if (prefix !== CRN_PREFIX) {
    throw new CrnError("invalid_prefix", "CRN must start with crn", { input, prefix });
  }
  const version = parts[1]?.trim().toLowerCase();
  if (version !== CRN_VERSION) {
    throw new CrnError("invalid_version", "CRN version must be v1", { input, version });
  }

  return normalizeCrnPartsInput({
    service: parts[2] ?? "",
    scope: parts[3] ?? "",
    resourceType: parts[4] ?? "",
    resourceId: parts[5] ?? "",
    mode,
  });
}
