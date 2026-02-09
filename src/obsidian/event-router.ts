import type { VaultFileEvent } from "./watcher.js";
import { recordVaultEvent } from "./metrics.js";

export type VaultEventRouterDeps = {
  ingestMemory?: (params: {
    text: string;
    source: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  wakeSession?: (params: { text: string; mode: "now" | "next-heartbeat" }) => void;
  logSystem?: (msg: string) => void;
  addGraphitiMemory?: (params: { name: string; body: string; source: string }) => Promise<void>;
  log?: (msg: string) => void;
};

export function createVaultEventRouter(deps: VaultEventRouterDeps) {
  return async (event: VaultFileEvent): Promise<void> => {
    switch (event.type) {
      case "created":
      case "modified": {
        if (!event.content) {
          recordVaultEvent(event.type, false, "missing_content");
          return;
        }
        if (deps.ingestMemory) {
          await deps.ingestMemory({
            text: event.content,
            source: "obsidian-vault",
            metadata: {
              vaultPath: event.path,
              eventType: event.type,
              frontmatter: event.frontmatter,
              modifiedAt: event.modifiedAt?.toISOString(),
            },
          });
        }

        if (deps.addGraphitiMemory) {
          await deps.addGraphitiMemory({
            name: `Obsidian: ${event.path}`,
            body: event.content,
            source: "obsidian-vault",
          });
        }
        recordVaultEvent(event.type, true);
        break;
      }

      case "deleted": {
        const message = `Note deleted from Obsidian vault: ${event.path}`;
        deps.logSystem?.(`[obsidian-vault] ${message}`);
        deps.wakeSession?.({ text: message, mode: "next-heartbeat" });
        recordVaultEvent(event.type, true);
        break;
      }

      case "renamed":
      default:
        deps.log?.(`vault watcher: unhandled event ${event.type} for ${event.path}`);
        recordVaultEvent(event.type, false, "unsupported_event");
        break;
    }
  };
}
