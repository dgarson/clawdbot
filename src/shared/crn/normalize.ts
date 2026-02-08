import type { CrnParseMode, CrnParts } from "./types.js";
import { canonicalizeResourceId } from "./canonicalizers/index.js";
import { CRN_PREFIX, CRN_VERSION } from "./constants.js";
import { assertValidResourceId, assertValidToken } from "./validate.js";

function normalizeStructuralToken(value: string, opts?: { allowWildcard?: boolean }): string {
  const lowered = value.trim().toLowerCase();
  assertValidToken(lowered, "token", { allowWildcard: opts?.allowWildcard });
  return lowered;
}

export function normalizeCrnPartsInput(params: {
  service: string;
  scope: string;
  resourceType: string;
  resourceId: string;
  mode?: CrnParseMode;
}): CrnParts {
  const mode = params.mode ?? "concrete";
  const service = normalizeStructuralToken(params.service, { allowWildcard: mode === "pattern" });
  const scopeRaw = params.scope.trim().toLowerCase();
  const scope = scopeRaw === "-" ? "global" : scopeRaw;
  assertValidToken(scope, "scope", { allowWildcard: mode === "pattern" });
  const resourceType = normalizeStructuralToken(params.resourceType, {
    allowWildcard: mode === "pattern",
  });
  assertValidResourceId(params.resourceId, mode);
  const resourceId = canonicalizeResourceId({
    service,
    resourceType,
    resourceId: params.resourceId,
    mode,
  });
  assertValidResourceId(resourceId, mode);
  return {
    prefix: CRN_PREFIX,
    version: CRN_VERSION,
    service,
    scope,
    resourceType,
    resourceId,
  };
}
