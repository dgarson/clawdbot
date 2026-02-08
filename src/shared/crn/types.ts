export type CrnParseMode = "concrete" | "pattern";

export type CrnParts = {
  prefix: "crn";
  version: "v1";
  service: string;
  scope: string;
  resourceType: string;
  resourceId: string;
};

export type CrnPattern = CrnParts;
