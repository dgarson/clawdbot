import { buildCrn } from "../build.js";

export function buildCronJobCrn(params: { jobId: string; scope?: string }): string {
  return buildCrn({
    service: "cron",
    scope: params.scope ?? "main",
    resourceType: "job",
    resourceId: params.jobId,
  });
}
