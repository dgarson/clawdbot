import { z } from "zod";

export const NotionWebhookRoutingSchema = z
  .object({
    memoryIngest: z.boolean().optional(),
    sessionWake: z.boolean().optional(),
    systemEvent: z.boolean().optional(),
    deduplicationWindowMs: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

export const NotionContentFetchSchema = z
  .object({
    enabled: z.boolean().optional(),
    maxDepth: z.number().int().min(0).max(10).optional(),
    maxPages: z.number().int().min(1).max(100).optional(),
    timeoutMs: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

export const NotionWebhookSchema = z
  .object({
    path: z.string().optional(),
    secret: z.string().optional(),
    botId: z.string().optional(),
    enabled: z.boolean().optional(),
    routing: NotionWebhookRoutingSchema,
    contentFetch: NotionContentFetchSchema,
  })
  .strict()
  .optional();

export const NotionTargetDatabaseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    purpose: z.string(),
    dataSourceId: z.string().optional(),
  })
  .strict();

export const NotionConfigSchema = z
  .object({
    apiKey: z.string().optional(),
    apiKeyFile: z.string().optional(),
    apiVersion: z.string().optional(),
    baseUrl: z.string().url().optional(),
    rateLimitRpm: z.number().int().positive().optional(),
    webhook: NotionWebhookSchema,
    targetDatabases: z.array(NotionTargetDatabaseSchema).optional(),
  })
  .strict()
  .optional();
