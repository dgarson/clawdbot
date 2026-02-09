import type { ObsidianConfig } from "../config/types.obsidian.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { MemoryIngestDependencies } from "../memory/pipeline/ingest.js";
import type { VaultAccessLayer } from "./vault-access.js";
import { GraphitiClient } from "../memory/graphiti/client.js";
import { runMemoryIngestionPipeline } from "../memory/pipeline/ingest.js";
import { DirectVaultAccess } from "./backends/direct.js";
import { NodeBridgeVaultAccess, type NodeBridgeInvoke } from "./backends/node-bridge.js";
import { RestApiVaultAccess } from "./backends/rest-api.js";
import { createVaultEventRouter } from "./event-router.js";
import { createObsidianHealthState, type ObsidianHealthState } from "./health.js";
import { buildLinkIndex, updateLinkIndex, type LinkIndex } from "./link-index.js";
import { VaultSelfAuthoredFilter } from "./self-authored-filter.js";
import { createVaultWatcher } from "./watcher.js";

export type ObsidianRuntime = {
  vault: VaultAccessLayer;
  linkIndex?: LinkIndex;
  selfAuthoredFilter: VaultSelfAuthoredFilter;
  health: ObsidianHealthState;
  stop: () => void;
};

let runtime: ObsidianRuntime | null = null;

export function getObsidianRuntime(): ObsidianRuntime | null {
  return runtime;
}

function resolveObsidianConfig(config?: OpenClawConfig): ObsidianConfig | undefined {
  if (!config?.obsidian?.enabled) {
    return undefined;
  }
  return config.obsidian;
}

function buildVaultAccess(
  config: ObsidianConfig,
  invokeNodeCommand?: NodeBridgeInvoke,
): VaultAccessLayer {
  const syncMode = config.syncMode ?? "direct";

  if (syncMode === "rest-api") {
    const baseUrl = config.restApi?.url ?? "http://localhost:27123";
    return new RestApiVaultAccess(baseUrl, config.restApi?.apiKey, config.vaultPath);
  }

  if (syncMode === "node-bridge") {
    if (!config.nodeBridge?.nodeId || !config.nodeBridge?.remoteVaultPath || !invokeNodeCommand) {
      throw new Error("node-bridge mode requires nodeId, remoteVaultPath, and invoke command");
    }
    return new NodeBridgeVaultAccess(
      config.nodeBridge.nodeId,
      config.nodeBridge.remoteVaultPath,
      invokeNodeCommand,
    );
  }

  if (!config.vaultPath) {
    throw new Error("obsidian.vaultPath is required for direct mode");
  }
  return new DirectVaultAccess(config.vaultPath);
}

function buildPipelineDeps(config?: OpenClawConfig): MemoryIngestDependencies {
  const deps: MemoryIngestDependencies = {};

  const graphitiCfg = config?.memory?.graphiti;
  if (graphitiCfg?.enabled) {
    deps.graphiti = new GraphitiClient({
      serverHost: graphitiCfg.serverHost,
      servicePort: graphitiCfg.servicePort,
      apiKey: graphitiCfg.apiKey,
      timeoutMs: graphitiCfg.timeoutMs,
    });
  }

  const entityCfg = config?.memory?.entityExtraction;
  if (entityCfg) {
    deps.entityExtractor = {
      enabled: entityCfg.enabled,
      minTextLength: entityCfg.minTextLength,
      maxEntitiesPerEpisode: entityCfg.maxEntitiesPerEpisode,
    };
  }

  return deps;
}

function shouldIngestPath(config: ObsidianConfig, relativePath: string): boolean {
  const include = config.memoryIngest?.includeFolders ?? [];
  const exclude = config.memoryIngest?.excludeFolders ?? ["templates", "archive"];

  const normalized = relativePath.replace(/^[./]+/, "");
  if (exclude.some((folder) => normalized.startsWith(folder))) {
    return false;
  }
  if (include.length === 0) {
    return true;
  }
  return include.some((folder) => normalized.startsWith(folder));
}

export async function startObsidianIntegration(params: {
  config: OpenClawConfig;
  invokeNodeCommand?: NodeBridgeInvoke;
  log?: (msg: string) => void;
  logSystem?: (msg: string) => void;
  wakeSession?: (params: { text: string; mode: "now" | "next-heartbeat" }) => void;
}): Promise<ObsidianRuntime | null> {
  const obsidianConfig = resolveObsidianConfig(params.config);
  if (!obsidianConfig) {
    return null;
  }

  const vault = buildVaultAccess(obsidianConfig, params.invokeNodeCommand);
  const selfAuthoredFilter = new VaultSelfAuthoredFilter();
  const health = createObsidianHealthState();

  const shouldIndexLinks = obsidianConfig.memoryIngest?.indexWikiLinks !== false;
  const shouldIndexTags = obsidianConfig.memoryIngest?.indexTags !== false;
  const shouldIndex = shouldIndexLinks || shouldIndexTags;

  const linkIndex = shouldIndex ? await buildLinkIndex(vault) : undefined;

  const ingestMemory =
    obsidianConfig.memoryIngest?.enabled !== false
      ? async (payload: { text: string; source: string; metadata?: Record<string, unknown> }) => {
          const maxContentLength = obsidianConfig.memoryIngest?.maxContentLength ?? 50000;
          const clipped = payload.text.slice(0, maxContentLength);
          await runMemoryIngestionPipeline(
            {
              source: payload.source,
              items: [
                {
                  text: clipped,
                  metadata: payload.metadata,
                },
              ],
            },
            buildPipelineDeps(params.config),
          );
        }
      : undefined;

  const router = createVaultEventRouter({
    ingestMemory,
    wakeSession: params.wakeSession,
    logSystem: params.logSystem,
    log: params.log,
  });

  const watcherEnabled =
    obsidianConfig.watcher?.enabled !== false && (obsidianConfig.syncMode ?? "direct") === "direct";
  const watcher = watcherEnabled
    ? createVaultWatcher({
        vaultPath: vault.getVaultPath(),
        debounceMs: obsidianConfig.watcher?.debounceMs,
        extensions: obsidianConfig.watcher?.extensions,
        excludePaths: obsidianConfig.watcher?.excludePaths,
        maxFileSize: obsidianConfig.watcher?.maxFileSize,
        onFileChanged: async (event) => {
          health.lastChangeAt = new Date().toISOString();
          if (linkIndex) {
            updateLinkIndex(linkIndex, event);
          }
          if (selfAuthoredFilter.isOurs(event.path)) {
            return;
          }
          if (!event.content) {
            await router(event);
            return;
          }
          if (!shouldIngestPath(obsidianConfig, event.path)) {
            return;
          }
          await router(event);
        },
        log: params.log,
      })
    : null;

  watcher?.start();
  health.watcherActive = Boolean(watcher);

  runtime = {
    vault,
    linkIndex,
    selfAuthoredFilter,
    health,
    stop: () => {
      watcher?.stop();
      health.watcherActive = false;
    },
  };

  params.log?.(
    `obsidian: integration started (${obsidianConfig.syncMode ?? "direct"}) at ${vault.getVaultPath()}`,
  );

  return runtime;
}

export function stopObsidianIntegration(): void {
  runtime?.stop();
  runtime = null;
}
