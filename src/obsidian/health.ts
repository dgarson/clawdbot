import type { ObsidianConfig } from "../config/types.obsidian.js";
import type { LinkIndex } from "./link-index.js";
import type { VaultAccessLayer } from "./vault-access.js";

export type ObsidianHealthSnapshot = {
  enabled: boolean;
  syncMode: string;
  vaultPath: string;
  watcherActive: boolean;
  lastChangeAt: string | null;
  filesIndexed: number;
  linksIndexed: number;
  tagsIndexed: number;
};

export type ObsidianHealthState = {
  watcherActive: boolean;
  lastChangeAt: string | null;
};

export function createObsidianHealthState(): ObsidianHealthState {
  return {
    watcherActive: false,
    lastChangeAt: null,
  };
}

export function getObsidianHealthSnapshot(params: {
  config?: ObsidianConfig;
  vault?: VaultAccessLayer;
  linkIndex?: LinkIndex;
  healthState: ObsidianHealthState;
}): ObsidianHealthSnapshot | null {
  if (!params.config?.enabled || !params.vault) {
    return null;
  }

  const filesIndexed = params.linkIndex?.allNotes.size ?? 0;
  const linksIndexed = params.linkIndex
    ? Array.from(params.linkIndex.forward.values()).reduce((acc, set) => acc + set.size, 0)
    : 0;
  const tagsIndexed = params.linkIndex?.tags.size ?? 0;

  return {
    enabled: true,
    syncMode: params.config.syncMode ?? "direct",
    vaultPath: params.vault.getVaultPath(),
    watcherActive: params.healthState.watcherActive,
    lastChangeAt: params.healthState.lastChangeAt,
    filesIndexed,
    linksIndexed,
    tagsIndexed,
  };
}
