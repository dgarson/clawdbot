import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const StageConfig = Type.Object(
  {
    enabled: Type.Boolean({ default: true }),
    timeoutMs: Type.Optional(Type.Number({ default: 30000 })),
  },
  { additionalProperties: false },
);

const StorageConnection = Type.Object(
  {
    enabled: Type.Boolean({ default: false }),
    url: Type.String(),
    poolSize: Type.Optional(Type.Number({ default: 10 })),
  },
  { additionalProperties: false },
);

const ModelEndpoint = Type.Object(
  {
    provider: Type.String({ default: "openai" }),
    model: Type.String(),
    baseUrl: Type.Optional(Type.String()),
    apiKey: Type.Optional(Type.String()),
    gpu: Type.Optional(Type.Number()),
    timeoutMs: Type.Optional(Type.Number({ default: 60000 })),
  },
  { additionalProperties: false },
);

export const ConfigSchema = Type.Object(
  {
    server: Type.Object(
      {
        host: Type.String({ default: "0.0.0.0" }),
        port: Type.Number({ default: 8080 }),
        basePath: Type.String({ default: "/" }),
        requestTimeoutMs: Type.Number({ default: 30000 }),
      },
      { additionalProperties: false },
    ),
    auth: Type.Object(
      {
        mode: Type.Union([Type.Literal("none"), Type.Literal("apiKey"), Type.Literal("jwt")], {
          default: "none",
        }),
        apiKeys: Type.Optional(Type.Array(Type.String())),
        jwtIssuer: Type.Optional(Type.String()),
        jwtAudience: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    pipeline: Type.Object(
      {
        stages: Type.Object(
          {
            normalize: StageConfig,
            extract: StageConfig,
            classify: StageConfig,
            enrich: StageConfig,
            entity_extract: StageConfig,
            embed: StageConfig,
            graph_write: StageConfig,
            vector_index: StageConfig,
            audit: StageConfig,
          },
          { additionalProperties: false },
        ),
        maxRetries: Type.Number({ default: 3 }),
        deadLetterQueue: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    storage: Type.Object(
      {
        graphiti: Type.Optional(
          Type.Object(
            {
              enabled: Type.Boolean({ default: false }),
              url: Type.String(),
              apiKey: Type.Optional(Type.String()),
            },
            { additionalProperties: false },
          ),
        ),
        postgres: Type.Optional(
          Type.Object(
            {
              enabled: Type.Boolean({ default: false }),
              url: Type.String(),
              schema: Type.Optional(Type.String({ default: "public" })),
              vectorTable: Type.Optional(Type.String({ default: "memclawd_vectors" })),
              telemetryTable: Type.Optional(Type.String({ default: "memclawd_audit" })),
            },
            { additionalProperties: false },
          ),
        ),
        sqlite: Type.Optional(
          Type.Object(
            {
              enabled: Type.Boolean({ default: false }),
              filePath: Type.String({ default: "./memclawd.sqlite" }),
              enableVectorExtension: Type.Optional(Type.Boolean({ default: true })),
            },
            { additionalProperties: false },
          ),
        ),
        redis: Type.Optional(
          Type.Object(
            {
              enabled: Type.Boolean({ default: false }),
              url: Type.String(),
              ingestQueue: Type.Optional(Type.String({ default: "memclawd:ingest" })),
              queryQueue: Type.Optional(Type.String({ default: "memclawd:query" })),
            },
            { additionalProperties: false },
          ),
        ),
        connections: Type.Optional(
          Type.Object(
            {
              graph: StorageConnection,
              vector: StorageConnection,
              relational: StorageConnection,
            },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
    models: Type.Object(
      {
        hotPath: ModelEndpoint,
        throughputPath: ModelEndpoint,
      },
      { additionalProperties: false },
    ),
    experiential: Type.Object(
      {
        enabled: Type.Boolean({ default: true }),
        retentionDays: Type.Number({ default: 180 }),
        captureQueue: Type.String({ default: "memclawd:experiential:capture" }),
        reconstitutionDepth: Type.Number({ default: 5 }),
      },
      { additionalProperties: false },
    ),
    observability: Type.Object(
      {
        logging: Type.Object(
          {
            level: Type.String({ default: "info" }),
            pretty: Type.Boolean({ default: false }),
          },
          { additionalProperties: false },
        ),
        tracing: Type.Object(
          {
            enabled: Type.Boolean({ default: false }),
            exporter: Type.String({ default: "otlp" }),
            sampleRate: Type.Number({ default: 0.1 }),
          },
          { additionalProperties: false },
        ),
        metrics: Type.Object(
          {
            enabled: Type.Boolean({ default: true }),
            port: Type.Number({ default: 9464 }),
            path: Type.String({ default: "/metrics" }),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export type MemclawdConfig = Static<typeof ConfigSchema>;

export const DEFAULT_CONFIG: MemclawdConfig = Value.Default(ConfigSchema, {});

export const loadConfig = (): MemclawdConfig => {
  const rawConfig = process.env.MEMCLAWD_CONFIG ? JSON.parse(process.env.MEMCLAWD_CONFIG) : {};
  const merged = Value.Default(ConfigSchema, rawConfig);

  if (!Value.Check(ConfigSchema, merged)) {
    const errors = [...Value.Errors(ConfigSchema, merged)].map((error) => error.message).join(", ");
    throw new Error(`Invalid MemClawd config: ${errors}`);
  }

  return merged;
};
