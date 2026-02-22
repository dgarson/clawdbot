/**
 * ACP Registry Tests — Phase 1
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAcpRegistry, AcpRegistry } from "./registry.js";

describe("AcpRegistry", () => {
  let tempDir: string;
  let registry: AcpRegistry;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "acp-registry-test-"));
    registry = createAcpRegistry(tempDir);
    await registry.initialize();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("initialize", () => {
    it("should create all subdirectories", async () => {
      const fs = await import("node:fs/promises");
      
      const subdirs = ["handoffs", "messages", "decisions", "artifacts", "roles"];
      
      for (const subdir of subdirs) {
        const dir = join(tempDir, subdir);
        await expect(fs.access(dir)).resolves.toBeUndefined();
      }
    });

    it("should use custom subdirs if provided", async () => {
      const customRegistry = new AcpRegistry({
        basePath: tempDir,
        subdirs: {
          handoffs: "custom-handoffs",
          messages: "custom-messages",
        },
      });

      await customRegistry.initialize();

      const fs = await import("node:fs/promises");
      
      await expect(fs.access(join(tempDir, "custom-handoffs"))).resolves.toBeUndefined();
      await expect(fs.access(join(tempDir, "custom-messages"))).resolves.toBeUndefined();
    });
  });

  describe("append", () => {
    it("should append entry to JSONL file", async () => {
      const entry = await registry.append("handoff", {
        handoff_id: "h-001",
        task_id: "task-001",
        from_agent: "sender",
        to_agent: "receiver",
      });

      expect(entry.id).toBeDefined();
      expect(entry.type).toBe("handoff");
      expect(entry.timestamp).toBeDefined();
      expect(entry.hash).toBeDefined();
      expect(entry.data).toEqual({
        handoff_id: "h-001",
        task_id: "task-001",
        from_agent: "sender",
        to_agent: "receiver",
      });
    });

    it("should compute consistent hash", async () => {
      const data = { test: "data" };
      
      const entry1 = await registry.append("message", data);
      const entry2 = await registry.append("message", data);

      expect(entry1.hash).toBe(entry2.hash);
    });

    it("should throw error for unknown type", async () => {
      await expect(
        registry.append("unknown-type" as any, { test: "data" })
      ).rejects.toThrow("Unknown registry type");
    });

    it("should append to correct file", async () => {
      await registry.append("handoff", { id: "h1" });
      await registry.append("message", { id: "m1" });

      const handoffsContent = await readFile(
        join(tempDir, "handoffs", "handoffs.jsonl"),
        "utf-8"
      );
      const messagesContent = await readFile(
        join(tempDir, "messages", "messages.jsonl"),
        "utf-8"
      );

      expect(handoffsContent).toContain('"id":"h1"');
      expect(messagesContent).toContain('"id":"m1"');
    });
  });

  describe("query", () => {
    it("should return empty array for non-existent file", async () => {
      const entries = await registry.query("handoff");
      expect(entries).toEqual([]);
    });

    it("should return all entries without filters", async () => {
      await registry.append("handoff", { id: "h1", value: 1 });
      await registry.append("handoff", { id: "h2", value: 2 });
      await registry.append("handoff", { id: "h3", value: 3 });

      const entries = await registry.query("handoff");

      expect(entries).toHaveLength(3);
      expect(entries.map(e => (e.data as any).id)).toEqual(["h1", "h2", "h3"]);
    });

    it("should filter by time range", async () => {
      // Create entries with different timestamps
      const entry1 = await registry.append("message", { id: "m1" });
      await new Promise(resolve => setTimeout(resolve, 10));
      const entry2 = await registry.append("message", { id: "m2" });
      await new Promise(resolve => setTimeout(resolve, 10));
      const entry3 = await registry.append("message", { id: "m3" });

      // Query entries after entry1
      const since = await registry.query("message", { since: entry2.timestamp });
      expect(since).toHaveLength(2);

      // Query entries before entry3
      const until = await registry.query("message", { until: entry2.timestamp });
      expect(until).toHaveLength(2);
    });

    it("should apply custom filter", async () => {
      await registry.append("handoff", { id: "h1", priority: "P0" });
      await registry.append("handoff", { id: "h2", priority: "P1" });
      await registry.append("handoff", { id: "h3", priority: "P0" });

      const highPriority = await registry.query("handoff", {
        filter: entry => (entry.data as any).priority === "P0",
      });

      expect(highPriority).toHaveLength(2);
      expect(highPriority.map(e => (e.data as any).id)).toEqual(["h1", "h3"]);
    });

    it("should apply limit", async () => {
      for (let i = 0; i < 10; i++) {
        await registry.append("decision", { id: `d${i}` });
      }

      const limited = await registry.query("decision", { limit: 5 });

      expect(limited).toHaveLength(5);
    });

    it("should skip malformed entries", async () => {
      await registry.append("message", { id: "m1" });
      
      // Manually add malformed entry
      const filePath = join(tempDir, "messages", "messages.jsonl");
      await writeFile(filePath, "not valid json\n", { flag: "a" });
      
      await registry.append("message", { id: "m2" });

      const entries = await registry.query("message");

      expect(entries).toHaveLength(2);
      expect(entries.map(e => (e.data as any).id)).toEqual(["m1", "m2"]);
    });
  });

  describe("getLatest", () => {
    it("should return null for empty registry", async () => {
      const latest = await registry.getLatest("handoff");
      expect(latest).toBeNull();
    });

    it("should return most recent entry", async () => {
      await registry.append("handoff", { id: "h1" });
      await registry.append("handoff", { id: "h2" });
      const last = await registry.append("handoff", { id: "h3" });

      const latest = await registry.getLatest("handoff");

      expect(latest?.id).toBe(last.id);
    });
  });

  describe("verifyIntegrity", () => {
    it("should pass for valid entries", async () => {
      await registry.append("handoff", { id: "h1", data: "test" });
      await registry.append("handoff", { id: "h2", data: "test2" });

      const result = await registry.verifyIntegrity("handoff");

      expect(result.valid).toBe(true);
      expect(result.corrupted).toEqual([]);
    });

    it("should detect corrupted entries", async () => {
      await registry.append("handoff", { id: "h1", data: "test" });

      // Manually corrupt the entry
      const filePath = join(tempDir, "handoffs", "handoffs.jsonl");
      const content = await readFile(filePath, "utf-8");
      const corrupted = content.replace('"data":"test"', '"data":"corrupted"');
      await writeFile(filePath, corrupted);

      const result = await registry.verifyIntegrity("handoff");

      expect(result.valid).toBe(false);
      expect(result.corrupted.length).toBeGreaterThan(0);
    });
  });

  describe("getStats", () => {
    it("should return stats for registry", async () => {
      await registry.append("handoff", { id: "h1" });
      await new Promise(resolve => setTimeout(resolve, 10));
      await registry.append("handoff", { id: "h2" });

      const stats = await registry.getStats("handoff");

      expect(stats.count).toBe(2);
      expect(stats.oldest).toBeDefined();
      expect(stats.newest).toBeDefined();
      expect(stats.sizeBytes).toBeGreaterThan(0);
      expect(stats.newest! > stats.oldest!).toBe(true);
    });

    it("should return empty stats for non-existent file", async () => {
      const stats = await registry.getStats("artifact");

      expect(stats.count).toBe(0);
      expect(stats.oldest).toBeUndefined();
      expect(stats.newest).toBeUndefined();
    });
  });

  describe("export", () => {
    it("should export entries for time range", async () => {
      const entry1 = await registry.append("decision", { id: "d1" });
      await new Promise(resolve => setTimeout(resolve, 10));
      await registry.append("decision", { id: "d2" });
      await new Promise(resolve => setTimeout(resolve, 10));
      const entry3 = await registry.append("decision", { id: "d3" });

      const exported = await registry.export(
        "decision",
        entry1.timestamp,
        entry3.timestamp
      );

      expect(exported.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("replay", () => {
    it("should replay entries in order", async () => {
      await registry.append("message", { id: "m1" });
      await registry.append("message", { id: "m2" });
      await registry.append("message", { id: "m3" });

      const replayed: string[] = [];
      await registry.replay("message", async (entry) => {
        replayed.push((entry.data as any).id);
      });

      expect(replayed).toEqual(["m1", "m2", "m3"]);
    });
  });

  describe("multiple types", () => {
    it("should handle multiple entry types independently", async () => {
      await registry.append("handoff", { type: "handoff", id: "h1" });
      await registry.append("message", { type: "message", id: "m1" });
      await registry.append("decision", { type: "decision", id: "d1" });
      await registry.append("artifact", { type: "artifact", id: "a1" });
      await registry.append("role", { type: "role", id: "r1" });

      const handoffs = await registry.query("handoff");
      const messages = await registry.query("message");
      const decisions = await registry.query("decision");
      const artifacts = await registry.query("artifact");
      const roles = await registry.query("role");

      expect(handoffs).toHaveLength(1);
      expect(messages).toHaveLength(1);
      expect(decisions).toHaveLength(1);
      expect(artifacts).toHaveLength(1);
      expect(roles).toHaveLength(1);
    });
  });
});
