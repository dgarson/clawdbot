import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, loadConfig, ConfigSchema } from "../src/config/schema.js";

describe("MemClawd Config", () => {
  it("DEFAULT_CONFIG is valid and complete", () => {
    expect(DEFAULT_CONFIG).toBeDefined();
    expect(Value.Check(ConfigSchema, DEFAULT_CONFIG)).toBe(true);
  });

  it("DEFAULT_CONFIG has sensible server defaults", () => {
    expect(DEFAULT_CONFIG.server.host).toBe("0.0.0.0");
    expect(DEFAULT_CONFIG.server.port).toBe(8080);
    expect(DEFAULT_CONFIG.server.basePath).toBe("/");
    expect(DEFAULT_CONFIG.server.requestTimeoutMs).toBe(30000);
  });

  it("DEFAULT_CONFIG has auth mode none", () => {
    expect(DEFAULT_CONFIG.auth.mode).toBe("none");
  });

  it("DEFAULT_CONFIG has all pipeline stages enabled", () => {
    const stages = DEFAULT_CONFIG.pipeline.stages;
    expect(stages.normalize.enabled).toBe(true);
    expect(stages.extract.enabled).toBe(true);
    expect(stages.classify.enabled).toBe(true);
    expect(stages.enrich.enabled).toBe(true);
    expect(stages.entity_extract.enabled).toBe(true);
    expect(stages.embed.enabled).toBe(true);
    expect(stages.graph_write.enabled).toBe(true);
    expect(stages.vector_index.enabled).toBe(true);
    expect(stages.audit.enabled).toBe(true);
  });

  it("DEFAULT_CONFIG has model defaults", () => {
    expect(DEFAULT_CONFIG.models.hotPath.provider).toBe("openai");
    expect(DEFAULT_CONFIG.models.hotPath.model).toBe("gpt-4o-mini");
    expect(DEFAULT_CONFIG.models.throughputPath.provider).toBe("openai");
    expect(DEFAULT_CONFIG.models.throughputPath.model).toBe("gpt-4o-mini");
  });

  it("DEFAULT_CONFIG has experiential defaults", () => {
    expect(DEFAULT_CONFIG.experiential.enabled).toBe(true);
    expect(DEFAULT_CONFIG.experiential.retentionDays).toBe(180);
    expect(DEFAULT_CONFIG.experiential.reconstitutionDepth).toBe(5);
  });

  it("DEFAULT_CONFIG has observability defaults", () => {
    expect(DEFAULT_CONFIG.observability.logging.level).toBe("info");
    expect(DEFAULT_CONFIG.observability.logging.pretty).toBe(false);
    expect(DEFAULT_CONFIG.observability.tracing.enabled).toBe(false);
    expect(DEFAULT_CONFIG.observability.metrics.enabled).toBe(true);
    expect(DEFAULT_CONFIG.observability.metrics.port).toBe(9464);
  });

  it("DEFAULT_CONFIG has empty storage by default", () => {
    expect(DEFAULT_CONFIG.storage.graphiti).toBeUndefined();
    expect(DEFAULT_CONFIG.storage.postgres).toBeUndefined();
    expect(DEFAULT_CONFIG.storage.sqlite).toBeUndefined();
    expect(DEFAULT_CONFIG.storage.redis).toBeUndefined();
  });

  it("loadConfig works with empty environment", () => {
    const original = process.env.MEMCLAWD_CONFIG;
    delete process.env.MEMCLAWD_CONFIG;
    try {
      const config = loadConfig();
      expect(config).toBeDefined();
      expect(config.server.port).toBe(8080);
    } finally {
      if (original !== undefined) {
        process.env.MEMCLAWD_CONFIG = original;
      }
    }
  });

  it("loadConfig merges partial overrides", () => {
    const original = process.env.MEMCLAWD_CONFIG;
    process.env.MEMCLAWD_CONFIG = JSON.stringify({
      server: { port: 9090 },
    });
    try {
      const config = loadConfig();
      expect(config.server.port).toBe(9090);
      expect(config.server.host).toBe("0.0.0.0"); // default preserved
      expect(config.auth.mode).toBe("none"); // default preserved
    } finally {
      if (original !== undefined) {
        process.env.MEMCLAWD_CONFIG = original;
      } else {
        delete process.env.MEMCLAWD_CONFIG;
      }
    }
  });

  it("loadConfig rejects invalid config", () => {
    const original = process.env.MEMCLAWD_CONFIG;
    process.env.MEMCLAWD_CONFIG = JSON.stringify({
      server: { port: "not-a-number" },
    });
    try {
      expect(() => loadConfig()).toThrow("Invalid MemClawd config");
    } finally {
      if (original !== undefined) {
        process.env.MEMCLAWD_CONFIG = original;
      } else {
        delete process.env.MEMCLAWD_CONFIG;
      }
    }
  });
});
