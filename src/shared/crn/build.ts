import type { CrnParseMode } from "./types.js";
import { formatCrn } from "./format.js";
import { normalizeCrnPartsInput } from "./normalize.js";

export function buildCrn(params: {
  service: string;
  scope: string;
  resourceType: string;
  resourceId: string;
  mode?: CrnParseMode;
}): string {
  return formatCrn(
    normalizeCrnPartsInput({
      service: params.service,
      scope: params.scope,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      mode: params.mode,
    }),
  );
}
