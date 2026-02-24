import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadBillableUsageSummary,
  readBillableUsageRecords,
  resolveBillableUsageLogPath,
  startBillableUsageMonitor,
} from "./billable-usage-store.js";
import { emitDiagnosticEvent, resetDiagnosticEventsForTest } from "./diagnostic-events.js";

function buildEnv(homeDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: homeDir,
  };
}

afterEach(() => {
  resetDiagnosticEventsForTest();
});

describe("billable usage store", () => {
  it("persists billable usage records from diagnostic events and reads them back", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-billable-"));
    const env = buildEnv(homeDir);
    const stop = startBillableUsageMonitor({ env });

    try {
      emitDiagnosticEvent({
        type: "model.usage",
        provider: "anthropic",
        model: "claude-opus",
        usage: { total: 42, input: 30, output: 12 },
      });

      // Wait briefly for async queue flush.
      await new Promise((resolve) => setTimeout(resolve, 25));

      const records = await readBillableUsageRecords({ env });
      expect(records).toHaveLength(1);
      expect(records[0]?.usage?.tokens).toBe(42);

      const summary = await loadBillableUsageSummary({ env });
      expect(summary.recordCount).toBe(1);
      expect(summary.summary.tokens).toBe(42);

      const filePath = resolveBillableUsageLogPath(env);
      const fileContent = await fs.readFile(filePath, "utf-8");
      expect(fileContent).toContain("runtime.model");
    } finally {
      stop();
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it("returns empty summary when no file exists", async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-billable-empty-"));
    const env = buildEnv(homeDir);
    try {
      const summary = await loadBillableUsageSummary({ env });
      expect(summary.recordCount).toBe(0);
      expect(summary.summary.tokens).toBe(0);
      expect(summary.limitStatuses).toEqual([]);
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });
});
