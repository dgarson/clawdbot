import type { CrnParseMode } from "../types.js";
import { canonicalizeBrowserResourceId } from "./browser.js";
import { canonicalizeChannelResourceId } from "./channel.js";
import { canonicalizeFileResourceIdPattern } from "./file.js";

export function canonicalizeResourceId(params: {
  service: string;
  resourceType: string;
  resourceId: string;
  mode: CrnParseMode;
}): string {
  const { service, resourceType, resourceId, mode } = params;
  if (service === "channel") {
    return canonicalizeChannelResourceId(resourceId, mode);
  }
  if (service === "file") {
    return canonicalizeFileResourceIdPattern(resourceType, resourceId, mode);
  }
  if (service === "browser") {
    return canonicalizeBrowserResourceId(resourceType, resourceId, mode);
  }
  return resourceId;
}
