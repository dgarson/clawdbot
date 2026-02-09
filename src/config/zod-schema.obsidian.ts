import { z } from "zod";

export const ObsidianConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    vaultPath: z.string().optional(),
    syncMode: z.enum(["direct", "rest-api", "node-bridge"]).optional(),
    restApi: z
      .object({
        url: z.string().optional(),
        apiKey: z.string().optional(),
      })
      .strict()
      .optional(),
    nodeBridge: z
      .object({
        nodeId: z.string().optional(),
        remoteVaultPath: z.string().optional(),
      })
      .strict()
      .optional(),
    watcher: z
      .object({
        enabled: z.boolean().optional(),
        debounceMs: z.number().int().nonnegative().optional(),
        extensions: z.array(z.string()).optional(),
        excludePaths: z.array(z.string()).optional(),
        maxFileSize: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    memoryIngest: z
      .object({
        enabled: z.boolean().optional(),
        includeFolders: z.array(z.string()).optional(),
        excludeFolders: z.array(z.string()).optional(),
        indexWikiLinks: z.boolean().optional(),
        indexTags: z.boolean().optional(),
        maxContentLength: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    defaultFrontmatter: z.record(z.string(), z.unknown()).optional(),
    dailyNotes: z
      .object({
        folder: z.string().optional(),
        dateFormat: z.string().optional(),
        template: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
