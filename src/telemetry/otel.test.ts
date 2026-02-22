import { describe, it, expect, afterEach } from "vitest";
import { initOtel, shutdownOtel, isOtelEnabled } from "./otel.js";

describe("telemetry/otel", () => {
  afterEach(async () => {
    await shutdownOtel();
  });

  it("isOtelEnabled returns false when not initialized", () => {
    expect(isOtelEnabled()).toBe(false);
  });

  it("initOtel is a no-op when otel config is missing", () => {
    initOtel({});
    expect(isOtelEnabled()).toBe(false);
  });

  it("initOtel is a no-op when otel.enabled is false", () => {
    initOtel({ otel: { enabled: false } });
    expect(isOtelEnabled()).toBe(false);
  });

  it("initOtel activates SDK when otel.enabled is true", () => {
    initOtel({
      otel: { enabled: true, endpoint: "http://localhost:4318" },
      serviceVersion: "1.0.0-test",
      environment: "test",
    });
    expect(isOtelEnabled()).toBe(true);
  });

  it("initOtel is idempotent", () => {
    initOtel({ otel: { enabled: true }, serviceVersion: "1.0.0" });
    expect(isOtelEnabled()).toBe(true);
    initOtel({ otel: { enabled: true }, serviceVersion: "2.0.0" });
    expect(isOtelEnabled()).toBe(true);
  });

  it("shutdownOtel resets enabled state", async () => {
    initOtel({ otel: { enabled: true } });
    expect(isOtelEnabled()).toBe(true);
    await shutdownOtel();
    expect(isOtelEnabled()).toBe(false);
  });

  it("shutdownOtel is safe to call when not initialized", async () => {
    await expect(shutdownOtel()).resolves.toBeUndefined();
  });
});
