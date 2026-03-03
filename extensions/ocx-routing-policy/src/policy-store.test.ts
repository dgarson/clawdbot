import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { loadPolicies, savePolicies, loadContributors, saveContributors } from "./policy-store.js";
import type { PromptContributor, RoutingPolicy } from "./types.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "routing-policy-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Routing Policies
// ---------------------------------------------------------------------------

describe("loadPolicies / savePolicies", () => {
  it("saves and loads policies", () => {
    const filePath = join(tempDir, "policies.json");
    const policies: RoutingPolicy[] = [
      {
        id: "p1",
        conditions: [{ kind: "agent", agentId: "a1" }],
        target: { model: "gpt-4" },
        priority: 1,
      },
      {
        id: "p2",
        conditions: [{ kind: "channel", channel: "telegram" }],
        target: { model: "claude", provider: "anthropic" },
        priority: 2,
      },
    ];

    savePolicies(filePath, policies);
    const loaded = loadPolicies(filePath);

    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe("p1");
    expect(loaded[1].id).toBe("p2");
    expect(loaded[1].target.provider).toBe("anthropic");
  });

  it("returns empty array for missing file", () => {
    const filePath = join(tempDir, "nonexistent.json");
    expect(loadPolicies(filePath)).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    const filePath = join(tempDir, "bad.json");
    const { writeFileSync } = require("node:fs");
    writeFileSync(filePath, "not json!", "utf-8");
    expect(loadPolicies(filePath)).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    const filePath = join(tempDir, "obj.json");
    const { writeFileSync } = require("node:fs");
    writeFileSync(filePath, JSON.stringify({ id: "p1" }), "utf-8");
    expect(loadPolicies(filePath)).toEqual([]);
  });

  it("filters out invalid policy entries", () => {
    const filePath = join(tempDir, "mixed.json");
    const { writeFileSync } = require("node:fs");
    writeFileSync(
      filePath,
      JSON.stringify([
        // Valid
        {
          id: "p1",
          conditions: [{ kind: "agent", agentId: "a1" }],
          target: { model: "gpt-4" },
          priority: 1,
        },
        // Invalid: missing id
        { conditions: [], target: {}, priority: 1 },
        // Invalid: conditions not array
        { id: "p3", conditions: "nope", target: {}, priority: 1 },
        // Invalid: missing target
        { id: "p4", conditions: [], priority: 1 },
        // Invalid: priority not number
        { id: "p5", conditions: [], target: {}, priority: "high" },
        // Invalid: null
        null,
      ]),
      "utf-8",
    );
    const loaded = loadPolicies(filePath);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("p1");
  });

  it("creates parent directories when saving", () => {
    const nested = join(tempDir, "a", "b", "c", "policies.json");
    savePolicies(nested, [
      {
        id: "p1",
        conditions: [],
        target: { model: "m" },
        priority: 0,
      },
    ]);
    expect(existsSync(nested)).toBe(true);
    const loaded = loadPolicies(nested);
    expect(loaded).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Prompt Contributors
// ---------------------------------------------------------------------------

describe("loadContributors / saveContributors", () => {
  it("saves and loads contributors", () => {
    const filePath = join(tempDir, "contributors.json");
    const contributors: PromptContributor[] = [
      {
        id: "c1",
        priority: 0,
        conditions: [],
        optional: false,
        content: "System prompt",
      },
      {
        id: "c2",
        priority: 10,
        conditions: [{ kind: "agent", agentId: "a1" }],
        optional: true,
        content: "Extra context",
      },
    ];

    saveContributors(filePath, contributors);
    const loaded = loadContributors(filePath);

    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe("c1");
    expect(loaded[1].optional).toBe(true);
  });

  it("returns empty array for missing file", () => {
    const filePath = join(tempDir, "nonexistent.json");
    expect(loadContributors(filePath)).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    const filePath = join(tempDir, "bad.json");
    const { writeFileSync } = require("node:fs");
    writeFileSync(filePath, "{broken", "utf-8");
    expect(loadContributors(filePath)).toEqual([]);
  });

  it("filters out invalid contributor entries", () => {
    const filePath = join(tempDir, "mixed.json");
    const { writeFileSync } = require("node:fs");
    writeFileSync(
      filePath,
      JSON.stringify([
        // Valid
        { id: "c1", priority: 0, conditions: [], optional: false, content: "ok" },
        // Invalid: missing id
        { priority: 0, conditions: [], optional: false, content: "ok" },
        // Invalid: optional not boolean
        { id: "c3", priority: 0, conditions: [], optional: "yes", content: "ok" },
        // Invalid: content not string
        { id: "c4", priority: 0, conditions: [], optional: false, content: 42 },
        // Invalid: null
        null,
      ]),
      "utf-8",
    );
    const loaded = loadContributors(filePath);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("c1");
  });
});
