import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { createWorkQueueLogger, type WorkQueueLogger } from "./logger.js";

/** Build a minimal config with optional debugging overrides. */
function makeConfig(debugging?: OpenClawConfig["debugging"]): OpenClawConfig {
  return { debugging } as OpenClawConfig;
}

describe("createWorkQueueLogger", () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── info / warn / error always emit ───────────────────────────────

  it("info always emits regardless of config", () => {
    const log = createWorkQueueLogger(() => makeConfig());
    log.info("hello");
    expect(consoleSpy.log).toHaveBeenCalledWith("[work-queue] hello");
  });

  it("warn always emits regardless of config", () => {
    const log = createWorkQueueLogger(() => makeConfig());
    log.warn("danger");
    expect(consoleSpy.warn).toHaveBeenCalledWith("[work-queue] danger");
  });

  it("error always emits regardless of config", () => {
    const log = createWorkQueueLogger(() => makeConfig());
    log.error("oops");
    expect(consoleSpy.error).toHaveBeenCalledWith("[work-queue] oops");
  });

  // ── debug gating ──────────────────────────────────────────────────

  it("suppresses debug when no debugging config exists", () => {
    const log = createWorkQueueLogger(() => makeConfig());
    log.debug("poll");
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  it("suppresses debug when debugging config exists but workqueue channel is absent", () => {
    const log = createWorkQueueLogger(() => makeConfig({ channels: {} }));
    log.debug("poll");
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  it("suppresses debug when workqueue channel exists but verbose is not set", () => {
    const log = createWorkQueueLogger(() => makeConfig({ channels: { workqueue: {} } }));
    log.debug("poll");
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  it("suppresses debug when workqueue.verbose is false", () => {
    const log = createWorkQueueLogger(() =>
      makeConfig({ channels: { workqueue: { verbose: false } } }),
    );
    log.debug("poll");
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  it("suppresses debug when workqueue.verbose is truthy but not exactly true", () => {
    const log = createWorkQueueLogger(() =>
      makeConfig({ channels: { workqueue: { verbose: "yes" } } }),
    );
    log.debug("poll");
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  it("emits debug when workqueue.verbose is true", () => {
    const log = createWorkQueueLogger(() =>
      makeConfig({ channels: { workqueue: { verbose: true } } }),
    );
    log.debug("polling for work");
    expect(consoleSpy.debug).toHaveBeenCalledWith("[work-queue] polling for work");
  });

  // ── hot-reload via config getter ──────────────────────────────────

  it("picks up config changes without recreating the logger", () => {
    let config = makeConfig();
    const log = createWorkQueueLogger(() => config);

    // Initially suppressed.
    log.debug("before");
    expect(consoleSpy.debug).not.toHaveBeenCalled();

    // Simulate hot-reload: swap the config reference.
    config = makeConfig({ channels: { workqueue: { verbose: true } } });

    log.debug("after");
    expect(consoleSpy.debug).toHaveBeenCalledWith("[work-queue] after");
  });

  it("re-suppresses debug when config is hot-reloaded to disable verbose", () => {
    let config = makeConfig({ channels: { workqueue: { verbose: true } } });
    const log = createWorkQueueLogger(() => config);

    log.debug("on");
    expect(consoleSpy.debug).toHaveBeenCalledTimes(1);

    // Disable verbose.
    config = makeConfig({ channels: { workqueue: { verbose: false } } });

    log.debug("off");
    expect(consoleSpy.debug).toHaveBeenCalledTimes(1); // no new call
  });

  // ── prefix formatting ─────────────────────────────────────────────

  it("prefixes all levels with [work-queue]", () => {
    const log = createWorkQueueLogger(() =>
      makeConfig({ channels: { workqueue: { verbose: true } } }),
    );
    log.info("i");
    log.warn("w");
    log.error("e");
    log.debug("d");

    expect(consoleSpy.log).toHaveBeenCalledWith("[work-queue] i");
    expect(consoleSpy.warn).toHaveBeenCalledWith("[work-queue] w");
    expect(consoleSpy.error).toHaveBeenCalledWith("[work-queue] e");
    expect(consoleSpy.debug).toHaveBeenCalledWith("[work-queue] d");
  });

  // ── type compatibility ────────────────────────────────────────────

  it("is assignable to WorkerDeps.log shape (accepts optional meta param)", () => {
    // WorkerDeps.log has signature (msg: string, meta?: Record<string, unknown>) => void.
    // Our logger only accepts (msg: string) but TS allows assigning a function with fewer
    // params to a type expecting more. This test ensures the type stays compatible.
    const log: WorkQueueLogger = createWorkQueueLogger(() => makeConfig());
    const workerLog: {
      info: (msg: string, meta?: Record<string, unknown>) => void;
      warn: (msg: string, meta?: Record<string, unknown>) => void;
      error: (msg: string, meta?: Record<string, unknown>) => void;
      debug: (msg: string, meta?: Record<string, unknown>) => void;
    } = log;
    // Should not throw when called with extra meta arg (it's simply ignored).
    expect(() => workerLog.info("test", { key: "val" })).not.toThrow();
    expect(() => workerLog.debug("test", { key: "val" })).not.toThrow();
  });
});
