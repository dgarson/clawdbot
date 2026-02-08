import type { CrnParts } from "./types.js";

export function matchCrnPattern(pattern: CrnParts, crn: CrnParts): boolean {
  if (pattern.service !== "*" && pattern.service !== crn.service) {
    return false;
  }
  if (pattern.scope !== "*" && pattern.scope !== crn.scope) {
    return false;
  }
  if (pattern.resourceType !== "*" && pattern.resourceType !== crn.resourceType) {
    return false;
  }
  const patternId = pattern.resourceId;
  if (patternId === "*") {
    return true;
  }
  if (patternId.endsWith("*")) {
    const prefix = patternId.slice(0, -1);
    return crn.resourceId.startsWith(prefix);
  }
  return patternId === crn.resourceId;
}
