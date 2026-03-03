import { describe, expect, it } from "vitest";
import {
  extractPidsFromLogLines,
  parseWatchdogConfig,
  type CompiledLogRule,
} from "./system-watchdog.js";

describe("system watchdog helpers", () => {
  it("extracts PIDs from matching error lines", () => {
    const lines = [
      "2026-02-23T00:00:00Z fatal duplicate gateway pid=9123 address already in use",
      "2026-02-23T00:00:01Z info heartbeat ok",
      "2026-02-23T00:00:02Z duplicate gateway PID: 8123",
    ];
    const rules: CompiledLogRule[] = [
      {
        name: "duplicate",
        match: /duplicate gateway/i,
        pid: /pid[:= ]\s*(\d+)/i,
      },
    ];

    expect(extractPidsFromLogLines(lines, rules)).toEqual([9123, 8123]);
  });

  it("parses defaults and normalizes paths", () => {
    const cfg = parseWatchdogConfig({});

    expect(cfg.expectedBranch).toBe("dgarson/fork");
    expect(cfg.intervalMs).toBeGreaterThan(0);
    expect(cfg.branchCheckIntervalMs).toBeGreaterThan(0);
    expect(cfg.deploymentDir).toContain("openclaw");
    expect(cfg.systemStatus.channel).toBe("slack");
    expect(cfg.systemStatus.targets).toEqual([]);
  });
});
