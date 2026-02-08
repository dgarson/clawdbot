import { buildCrn } from "../build.js";

export function buildSessionKeyCrn(params: { sessionKey: string; scope?: string }): string {
  return buildCrn({
    service: "session",
    scope: params.scope ?? "main",
    resourceType: "key",
    resourceId: params.sessionKey,
  });
}

export function buildSessionIdCrn(params: { sessionId: string; scope?: string }): string {
  return buildCrn({
    service: "session",
    scope: params.scope ?? "main",
    resourceType: "id",
    resourceId: params.sessionId,
  });
}
