/**
 * Telemetry Sink — writes structured JSON events to file and/or stdout.
 *
 * File output uses append mode with one JSON object per line (JSONL).
 * Writes are non-blocking best-effort: a failure to write never blocks
 * the agent runtime.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { TelemetryEvent, TelemetrySinkConfig } from "./types.js";

export class TelemetrySink {
  private config: TelemetrySinkConfig;
  private dirEnsured = false;

  constructor(config: TelemetrySinkConfig) {
    this.config = config;
  }

  async write(event: TelemetryEvent): Promise<void> {
    const line = JSON.stringify(event) + "\n";

    const promises: Promise<void>[] = [];

    if (this.config.stdout) {
      promises.push(this.writeStdout(line));
    }

    if (this.config.file) {
      promises.push(this.writeFile(this.config.file, line));
    }

    await Promise.allSettled(promises);
  }

  private async writeStdout(line: string): Promise<void> {
    process.stdout.write(`[telemetry] ${line}`);
  }

  private async writeFile(filePath: string, line: string): Promise<void> {
    if (!this.dirEnsured) {
      await mkdir(dirname(filePath), { recursive: true });
      this.dirEnsured = true;
    }
    await appendFile(filePath, line, "utf-8");
  }
}
