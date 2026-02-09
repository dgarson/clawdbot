export type VaultSyncState = {
  mtimes: Map<string, number>;
  pendingWrites: Set<string>;
  lastSync: Date;
};

export function createVaultSyncState(): VaultSyncState {
  return {
    mtimes: new Map(),
    pendingWrites: new Set(),
    lastSync: new Date(0),
  };
}
