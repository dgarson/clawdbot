import type { OpenClawConfig } from "openclaw/plugin-sdk";
import path from "node:path";
import type {
  BackendConfig,
  BackendFactory,
  MeridiaBackendType,
  MeridiaDbBackend,
} from "../backend.js";
import { resolveMeridiaPluginConfig } from "../../config.js";
import { resolveMeridiaDir } from "../../paths.js";
import { createPostgresBackend } from "./postgresql.js";
import { createSqliteBackend, resolveMeridiaDbPath } from "./sqlite.js";

// ────────────────────────────────────────────────────────────────────────────
// Backend Registry
// ────────────────────────────────────────────────────────────────────────────

/**
 * Registry for backend factories. Enables pluggable storage backends.
 * New backends can be registered at runtime before creating the backend.
 */
class BackendRegistry {
  private factories = new Map<MeridiaBackendType, BackendFactory>();

  /**
   * Register a backend factory for a given type.
   */
  register(type: MeridiaBackendType, factory: BackendFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Get a registered factory.
   */
  get(type: MeridiaBackendType): BackendFactory | undefined {
    return this.factories.get(type);
  }

  /**
   * Check if a backend type is registered.
   */
  has(type: MeridiaBackendType): boolean {
    return this.factories.has(type);
  }

  /**
   * Get all registered backend types.
   */
  getRegisteredTypes(): MeridiaBackendType[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Create a backend instance using the registered factory.
   */
  create(config: BackendConfig): MeridiaDbBackend {
    const factory = this.factories.get(config.type);
    if (!factory) {
      const registered = this.getRegisteredTypes().join(", ") || "none";
      throw new Error(
        `No backend factory registered for type "${config.type}". ` +
          `Registered types: ${registered}. ` +
          `For PostgreSQL, ensure the postgresql backend module is installed.`,
      );
    }
    return factory(config);
  }
}

/**
 * Global backend registry instance.
 */
export const backendRegistry = new BackendRegistry();

// ────────────────────────────────────────────────────────────────────────────
// Register Built-in Backends
// ────────────────────────────────────────────────────────────────────────────

// Register SQLite backend (always available)
backendRegistry.register("sqlite", (config: BackendConfig) => {
  return createSqliteBackend({
    dbPath: config.sqlite?.dbPath ?? "",
    allowAutoWipe: config.sqlite?.allowAutoWipe ?? true,
  });
});

// Register PostgreSQL backend.
// The pg module is dynamically imported inside PostgresBackend.init(), so construction
// is synchronous and doesn't require pg to be installed unless actually used.
backendRegistry.register("postgresql", (config: BackendConfig) => {
  return createPostgresBackend({
    connectionString: config.postgresql?.connectionString,
    host: config.postgresql?.host,
    port: config.postgresql?.port,
    database: config.postgresql?.database,
    user: config.postgresql?.user,
    password: config.postgresql?.password,
    ssl: config.postgresql?.ssl,
    poolSize: config.postgresql?.poolSize,
    idleTimeoutMs: config.postgresql?.idleTimeoutMs,
    connectionTimeoutMs: config.postgresql?.connectionTimeoutMs,
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Backend Instance Management
// ────────────────────────────────────────────────────────────────────────────

let cachedBackend: MeridiaDbBackend | undefined;
let cachedConfig: BackendConfig | undefined;
let initialized = false;

function configsMatch(a: BackendConfig, b: BackendConfig): boolean {
  if (a.type !== b.type) return false;

  if (a.type === "sqlite") {
    return a.sqlite?.dbPath === b.sqlite?.dbPath;
  }

  if (a.type === "postgresql") {
    const aPg = a.postgresql;
    const bPg = b.postgresql;
    return (
      aPg?.connectionString === bPg?.connectionString &&
      aPg?.host === bPg?.host &&
      aPg?.port === bPg?.port &&
      aPg?.database === bPg?.database &&
      aPg?.user === bPg?.user
    );
  }

  return false;
}

/**
 * Build a BackendConfig from OpenClawConfig.
 */
function buildBackendConfig(params?: { cfg?: OpenClawConfig; hookKey?: string }): BackendConfig {
  const cfg = params?.cfg;
  const pluginCfg = resolveMeridiaPluginConfig(cfg);
  const backendType = pluginCfg.storage.backend;

  if (backendType === "sqlite") {
    const meridiaDir = resolveMeridiaDir(cfg, params?.hookKey);
    const dbPath = pluginCfg.storage.sqlite.dbPath ?? path.join(meridiaDir, "meridia.sqlite");
    return {
      type: "sqlite",
      sqlite: {
        dbPath: path.resolve(dbPath),
        allowAutoWipe: true,
      },
    };
  }

  if (backendType === "postgresql") {
    return {
      type: "postgresql",
      postgresql: { ...pluginCfg.storage.postgresql },
    };
  }

  // Fallback to sqlite
  const meridiaDir = resolveMeridiaDir(cfg, params?.hookKey);
  return {
    type: "sqlite",
    sqlite: {
      dbPath: path.join(meridiaDir, "meridia.sqlite"),
      allowAutoWipe: true,
    },
  };
}

/**
 * Create or return a cached backend instance.
 * The backend is automatically initialized.
 */
export async function createBackendAsync(params?: {
  cfg?: OpenClawConfig;
  hookKey?: string;
  forceNew?: boolean;
}): Promise<MeridiaDbBackend> {
  const config = buildBackendConfig(params);

  // Return cached backend if config matches
  if (!params?.forceNew && cachedBackend && cachedConfig && configsMatch(config, cachedConfig)) {
    // Ensure initialized
    if (!initialized) {
      await cachedBackend.init();
      initialized = true;
    }
    return cachedBackend;
  }

  // Close existing backend if any
  if (cachedBackend) {
    try {
      await cachedBackend.close();
    } catch {
      // ignore
    }
  }

  // Create new backend
  const backend = backendRegistry.create(config);

  // Initialize and cache
  await backend.init();
  cachedBackend = backend;
  cachedConfig = config;
  initialized = true;

  return backend;
}

/**
 * Synchronous version for backwards compatibility.
 * Creates the backend but does NOT initialize it automatically.
 * Caller should call init() on the returned backend.
 *
 * @deprecated Use createBackendAsync for proper async initialization
 */
export function createBackend(params?: {
  cfg?: OpenClawConfig;
  hookKey?: string;
}): MeridiaDbBackend {
  const config = buildBackendConfig(params);

  // Return cached backend if config matches
  if (cachedBackend && cachedConfig && configsMatch(config, cachedConfig)) {
    return cachedBackend;
  }

  // Close existing backend synchronously if possible
  if (cachedBackend) {
    try {
      // For sync compat, we rely on the backend's close being sync-safe
      void cachedBackend.close();
    } catch {
      // ignore
    }
  }

  // Create new backend (not initialized yet for sync path)
  const backend = backendRegistry.create(config);
  cachedBackend = backend;
  cachedConfig = config;
  initialized = false;

  // For SQLite, init is sync-compatible, so we can call it
  if (config.type === "sqlite") {
    void backend.init().catch(() => {});
    // SQLite init is effectively sync due to node:sqlite
    initialized = true;
  }

  return backend;
}

/**
 * Close the cached backend and clear state.
 */
export async function closeBackendAsync(): Promise<void> {
  if (cachedBackend) {
    try {
      await cachedBackend.close();
    } catch {
      // ignore
    }
  }
  cachedBackend = undefined;
  cachedConfig = undefined;
  initialized = false;
}

/**
 * Synchronous close for backwards compatibility.
 * @deprecated Use closeBackendAsync
 */
export function closeBackend(): void {
  if (cachedBackend) {
    try {
      void cachedBackend.close();
    } catch {
      // ignore
    }
  }
  cachedBackend = undefined;
  cachedConfig = undefined;
  initialized = false;
}

/**
 * Get the currently cached backend, if any.
 */
export function getCachedBackend(): MeridiaDbBackend | undefined {
  return cachedBackend;
}

/**
 * Check if a backend is currently cached and initialized.
 */
export function isBackendReady(): boolean {
  return cachedBackend !== undefined && initialized;
}

// ────────────────────────────────────────────────────────────────────────────
// Re-exports for convenience
// ────────────────────────────────────────────────────────────────────────────

export { resolveMeridiaDbPath } from "./sqlite.js";
export type { MeridiaBackendType, BackendConfig, BackendFactory } from "../backend.js";
