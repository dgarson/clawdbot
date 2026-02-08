export type MemoryCrn = `crn:1:memory:${string}:${string}:${string}`;

export type MemoryCrnParts = {
  version: "1";
  namespace: "memory";
  agentId: string;
  resourceType: string;
  resourceId: string;
};

export const formatMemoryCrn = (parts: MemoryCrnParts): MemoryCrn =>
  `crn:${parts.version}:${parts.namespace}:${parts.agentId}:${parts.resourceType}:${parts.resourceId}`;

export const parseMemoryCrn = (crn: string): MemoryCrnParts | null => {
  const match =
    /^crn:(?<version>\d+):(?<namespace>memory):(?<agentId>[^:]+):(?<resourceType>[^:]+):(?<resourceId>[^:]+)$/.exec(
      crn,
    );

  if (!match?.groups || match.groups.version !== "1") {
    return null;
  }

  return {
    version: "1",
    namespace: "memory",
    agentId: match.groups.agentId,
    resourceType: match.groups.resourceType,
    resourceId: match.groups.resourceId,
  };
};
