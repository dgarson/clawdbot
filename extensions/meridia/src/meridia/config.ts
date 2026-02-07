import type { OpenClawConfig } from "openclaw/plugin-sdk";
import path from "node:path";
import type { MeridiaBackendType } from "./db/backend.js";
import type {
  ScoringConfig,
  ScoringWeights,
  ThresholdProfile,
  ToolOverrideRule,
  PatternOverrideRule,
} from "./scoring/types.js";
import { resolveUserPath } from "./paths.js";
import { DEFAULT_SCORING_CONFIG } from "./scoring/defaults.js";

// ────────────────────────────────────────────────────────────────────────────
// Raw Config Types (from user input / YAML)
// ────────────────────────────────────────────────────────────────────────────

type RawPostgresConfig = {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized?: boolean };
  poolSize?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
};

type RawSqliteConfig = {
  dbPath?: string;
};

type RawStorageConfig = {
  backend?: string;
  sqlite?: RawSqliteConfig;
  postgresql?: RawPostgresConfig;
};

type RawScoringConfig = {
  weights?: Partial<ScoringWeights>;
  activeProfile?: string;
  profiles?: Record<string, Partial<ThresholdProfile>>;
  toolOverrides?: ToolOverrideRule[];
  patternOverrides?: PatternOverrideRule[];
  includeBreakdownInTrace?: boolean;
};

type RawMeridiaPluginConfig = {
  storage?: RawStorageConfig;
  // Legacy db config for backwards compatibility
  db?: {
    type?: string;
    sqlite?: RawSqliteConfig;
  };
  scoring?: RawScoringConfig;
  debug?: {
    writeTraceJsonl?: boolean;
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Resolved Config Types
// ────────────────────────────────────────────────────────────────────────────

export type ResolvedSqliteConfig = {
  dbPath?: string;
};

export type ResolvedPostgresConfig = {
  connectionString?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl: boolean | { rejectUnauthorized?: boolean };
  poolSize: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
};

export type ResolvedStorageConfig = {
  backend: MeridiaBackendType;
  sqlite: ResolvedSqliteConfig;
  postgresql: ResolvedPostgresConfig;
};

export type ResolvedMeridiaPluginConfig = {
  storage: ResolvedStorageConfig;
  // Legacy compat alias
  db: {
    type: MeridiaBackendType;
    sqlite: ResolvedSqliteConfig;
  };
  scoring: ScoringConfig;
  debug: {
    writeTraceJsonl: boolean;
  };
};

// ────────────────────────────────────────────────────────────────────────────
// Default Values
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_BACKEND: MeridiaBackendType = "sqlite";

const DEFAULT_POSTGRES_CONFIG: ResolvedPostgresConfig = {
  host: "localhost",
  port: 5432,
  database: "meridia",
  user: "meridia",
  ssl: false,
  poolSize: 10,
  idleTimeoutMs: 30_000,
  connectionTimeoutMs: 10_000,
};

// ────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readMeridiaPluginConfig(cfg?: OpenClawConfig): RawMeridiaPluginConfig {
  const plugins = asRecord(cfg?.plugins);
  const entries = asRecord(plugins?.entries);
  const meridiaEntry = asRecord(entries?.meridia);
  const config = meridiaEntry ? meridiaEntry.config : undefined;
  return (asRecord(config) ?? {}) as RawMeridiaPluginConfig;
}

function parseBackendType(value: string | undefined): MeridiaBackendType {
  const normalized = value?.toLowerCase().trim();
  if (normalized === "postgresql" || normalized === "postgres" || normalized === "pg") {
    return "postgresql";
  }
  return "sqlite";
}

function resolvePostgresConfig(raw?: RawPostgresConfig): ResolvedPostgresConfig {
  if (!raw) {
    return { ...DEFAULT_POSTGRES_CONFIG };
  }

  return {
    connectionString: raw.connectionString,
    host: raw.host ?? DEFAULT_POSTGRES_CONFIG.host,
    port: raw.port ?? DEFAULT_POSTGRES_CONFIG.port,
    database: raw.database ?? DEFAULT_POSTGRES_CONFIG.database,
    user: raw.user ?? DEFAULT_POSTGRES_CONFIG.user,
    password: raw.password,
    ssl: raw.ssl ?? DEFAULT_POSTGRES_CONFIG.ssl,
    poolSize: raw.poolSize ?? DEFAULT_POSTGRES_CONFIG.poolSize,
    idleTimeoutMs: raw.idleTimeoutMs ?? DEFAULT_POSTGRES_CONFIG.idleTimeoutMs,
    connectionTimeoutMs: raw.connectionTimeoutMs ?? DEFAULT_POSTGRES_CONFIG.connectionTimeoutMs,
  };
}

function resolveScoringConfig(raw?: RawScoringConfig): ScoringConfig {
  if (!raw) return { ...DEFAULT_SCORING_CONFIG };

  const weights: ScoringWeights = {
    ...DEFAULT_SCORING_CONFIG.weights,
    ...(raw.weights ?? {}),
  };

  // Merge user profiles with defaults
  const profiles: Record<string, ThresholdProfile> = {
    ...DEFAULT_SCORING_CONFIG.profiles,
  };
  if (raw.profiles) {
    for (const [name, partial] of Object.entries(raw.profiles)) {
      const base = profiles[name] ?? DEFAULT_SCORING_CONFIG.profiles["standard"]!;
      profiles[name] = {
        name,
        captureThreshold: partial.captureThreshold ?? base.captureThreshold,
        llmEvalThreshold: partial.llmEvalThreshold ?? base.llmEvalThreshold,
        highValueThreshold: partial.highValueThreshold ?? base.highValueThreshold,
      };
    }
  }

  return {
    weights,
    activeProfile: raw.activeProfile ?? DEFAULT_SCORING_CONFIG.activeProfile,
    profiles,
    toolOverrides: raw.toolOverrides ?? DEFAULT_SCORING_CONFIG.toolOverrides,
    patternOverrides: raw.patternOverrides ?? DEFAULT_SCORING_CONFIG.patternOverrides,
    includeBreakdownInTrace:
      raw.includeBreakdownInTrace ?? DEFAULT_SCORING_CONFIG.includeBreakdownInTrace,
  };
}

function resolveSqliteConfig(raw?: RawSqliteConfig): ResolvedSqliteConfig {
  const dbPathRaw = raw?.dbPath;
  const dbPathValue = typeof dbPathRaw === "string" ? dbPathRaw.trim() : "";
  const dbPath = dbPathValue ? path.resolve(resolveUserPath(dbPathValue)) : undefined;

  return {
    ...(dbPath ? { dbPath } : {}),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Main Config Resolution
// ────────────────────────────────────────────────────────────────────────────

export function resolveMeridiaPluginConfig(cfg?: OpenClawConfig): ResolvedMeridiaPluginConfig {
  const raw = readMeridiaPluginConfig(cfg);

  // Support both new storage.backend and legacy db.type
  const backendTypeRaw = raw.storage?.backend ?? raw.db?.type;
  const backend = parseBackendType(backendTypeRaw);

  // Resolve SQLite config (from storage.sqlite or legacy db.sqlite)
  const sqliteConfig = resolveSqliteConfig(raw.storage?.sqlite ?? raw.db?.sqlite);

  // Resolve PostgreSQL config
  const postgresConfig = resolvePostgresConfig(raw.storage?.postgresql);

  // Resolve scoring config
  const scoringConfig = resolveScoringConfig(raw.scoring);

  const writeTraceJsonl =
    raw.debug?.writeTraceJsonl === undefined ? true : raw.debug.writeTraceJsonl === true;

  return {
    storage: {
      backend,
      sqlite: sqliteConfig,
      postgresql: postgresConfig,
    },
    // Legacy compat
    db: {
      type: backend,
      sqlite: sqliteConfig,
    },
    scoring: scoringConfig,
    debug: {
      writeTraceJsonl,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Config Validation
// ────────────────────────────────────────────────────────────────────────────

export type ConfigValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateMeridiaConfig(config: ResolvedMeridiaPluginConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.storage.backend === "postgresql") {
    const pg = config.storage.postgresql;

    // If no connection string, require host/port/database/user
    if (!pg.connectionString) {
      if (!pg.host)
        errors.push("PostgreSQL host is required when connectionString is not provided");
      if (!pg.database) errors.push("PostgreSQL database name is required");
      if (!pg.user) errors.push("PostgreSQL user is required");
    }

    // Pool size validation
    if (pg.poolSize < 1) {
      errors.push("PostgreSQL poolSize must be at least 1");
    } else if (pg.poolSize > 100) {
      warnings.push("PostgreSQL poolSize > 100 may cause resource issues");
    }

    // Timeout validation
    if (pg.connectionTimeoutMs < 1000) {
      warnings.push("PostgreSQL connectionTimeoutMs < 1000ms may cause connection failures");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
