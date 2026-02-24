import { beforeEach, describe, expect, it } from "vitest";
import {
  resetMemoryToolMockState,
  setMemoryBackend,
  setMemoryReadFileImpl,
  setMemorySearchImpl,
  type MemoryReadParams,
} from "../../../test/helpers/memory-tool-manager-mock.js";
import type { OpenClawConfig } from "../../config/config.js";
import { createMemoryGetTool, createMemorySearchTool } from "./memory-tool.js";

function asOpenClawConfig(config: Partial<OpenClawConfig>): OpenClawConfig {
  return config as OpenClawConfig;
}

beforeEach(() => {
  resetMemoryToolMockState({
    backend: "builtin",
    searchImpl: async () => [
      {
        path: "MEMORY.md",
        startLine: 5,
        endLine: 7,
        score: 0.9,
        snippet: "@@ -5,3 @@\nAssistant: noted",
        source: "memory" as const,
      },
    ],
    readFileImpl: async (params: MemoryReadParams) => ({ text: "", path: params.relPath }),
  });
});

describe("memory search citations", () => {
  it("appends source information when citations are enabled", async () => {
    setMemoryBackend("builtin");
    const cfg = asOpenClawConfig({
      memory: { citations: "on" },
      agents: { list: [{ id: "main", default: true }] },
    });
    const tool = createMemorySearchTool({ config: cfg });
    if (!tool) {
      throw new Error("tool missing");
    }
    const result = await tool.execute("call_citations_on", { query: "notes" });
    const details = result.details as { results: Array<{ snippet: string; citation?: string }> };
    expect(details.results[0]?.snippet).toMatch(/Source: MEMORY.md#L5-L7/);
    expect(details.results[0]?.citation).toBe("MEMORY.md#L5-L7");
  });

  it("leaves snippet untouched when citations are off", async () => {
    setMemoryBackend("builtin");
    const cfg = asOpenClawConfig({
      memory: { citations: "off" },
      agents: { list: [{ id: "main", default: true }] },
    });
    const tool = createMemorySearchTool({ config: cfg });
    if (!tool) {
      throw new Error("tool missing");
    }
    const result = await tool.execute("call_citations_off", { query: "notes" });
    const details = result.details as { results: Array<{ snippet: string; citation?: string }> };
    expect(details.results[0]?.snippet).not.toMatch(/Source:/);
    expect(details.results[0]?.citation).toBeUndefined();
  });

  it("clamps decorated snippets to qmd injected budget", async () => {
    setMemoryBackend("qmd");
    const cfg = asOpenClawConfig({
      memory: { citations: "on", backend: "qmd", qmd: { limits: { maxInjectedChars: 20 } } },
      agents: { list: [{ id: "main", default: true }] },
    });
    const tool = createMemorySearchTool({ config: cfg });
    if (!tool) {
      throw new Error("tool missing");
    }
    const result = await tool.execute("call_citations_qmd", { query: "notes" });
    const details = result.details as { results: Array<{ snippet: string; citation?: string }> };
    expect(details.results[0]?.snippet.length).toBeLessThanOrEqual(20);
  });

  it("honors auto mode for direct chats", async () => {
    setMemoryBackend("builtin");
    const cfg = asOpenClawConfig({
      memory: { citations: "auto" },
      agents: { list: [{ id: "main", default: true }] },
    });
    const tool = createMemorySearchTool({
      config: cfg,
      agentSessionKey: "agent:main:discord:dm:u123",
    });
    if (!tool) {
      throw new Error("tool missing");
    }
    const result = await tool.execute("auto_mode_direct", { query: "notes" });
    const details = result.details as { results: Array<{ snippet: string }> };
    expect(details.results[0]?.snippet).toMatch(/Source:/);
  });

  it("suppresses citations for auto mode in group chats", async () => {
    setMemoryBackend("builtin");
    const cfg = asOpenClawConfig({
      memory: { citations: "auto" },
      agents: { list: [{ id: "main", default: true }] },
    });
    const tool = createMemorySearchTool({
      config: cfg,
      agentSessionKey: "agent:main:discord:group:c123",
    });
    if (!tool) {
      throw new Error("tool missing");
    }
    const result = await tool.execute("auto_mode_group", { query: "notes" });
    const details = result.details as { results: Array<{ snippet: string }> };
    expect(details.results[0]?.snippet).not.toMatch(/Source:/);
  });
});

describe("memory-search evaluation telemetry", () => {
  it("includes relevance, latency, and cost guardrail telemetry", async () => {
    const cfg = asOpenClawConfig({
      memory: { citations: "on" },
      agents: { list: [{ id: "main", default: true }] },
      models: {
        providers: {
          openai: {
            models: [
              {
                id: "text-embedding-3-small",
                provider: "openai",
                cost: { input: 0.02, output: 0, cacheRead: 0, cacheWrite: 0 },
              },
            ],
          },
        },
      },
    });

    const tool = createMemorySearchTool({ config: cfg });
    if (!tool) {
      throw new Error("tool missing");
    }

    const result = await tool.execute("call_eval_metadata", {
      query: "release notes for 2026-02-20",
    });
    const details = result.details as {
      evaluation: {
        relevance: {
          passing: boolean;
          topScore: number;
          resultCount: number;
          minScoreThreshold: number;
        };
        latency: { passing: boolean; measuredMs: number; maxMs: number };
        cost: {
          passing: boolean;
          estimatedCostUsd?: number;
          maxCostUsd: number;
          estimatedInputTokens: number;
        };
      };
    };

    expect(details.evaluation.relevance.passing).toBe(true);
    expect(details.evaluation.relevance.resultCount).toBe(1);
    expect(details.evaluation.latency.measuredMs).toBeGreaterThanOrEqual(0);
    expect(details.evaluation.cost.estimatedInputTokens).toBeGreaterThan(0);
    expect(details.evaluation.cost.estimatedCostUsd).toBeGreaterThan(0);
    expect(details.evaluation.cost.maxCostUsd).toBeGreaterThan(0);
  });

  it("marks relevance and cost guardrails as failed when limits are violated", async () => {
    setMemorySearchImpl(async () => [
      {
        path: "MEMORY.md",
        startLine: 1,
        endLine: 1,
        score: 0.2,
        snippet: "A weak match",
        source: "memory" as const,
      },
    ]);

    const cfg = asOpenClawConfig({
      memory: { citations: "on", query: { minScore: 0.8 } },
      agents: { list: [{ id: "main", default: true }] },
      models: {
        providers: {
          openai: {
            models: [
              {
                id: "text-embedding-3-small",
                provider: "openai",
                cost: { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 },
              },
            ],
          },
        },
      },
    });

    const tool = createMemorySearchTool({ config: cfg });
    if (!tool) {
      throw new Error("tool missing");
    }
    const result = await tool.execute("call_eval_guardrails", {
      query: "x".repeat(12_000),
      minScore: 0.8,
    });

    const details = result.details as {
      evaluation: {
        relevance: { passing: boolean; topScore: number };
        cost: { passing: boolean; estimatedCostUsd: number };
      };
    };

    expect(details.evaluation.relevance.passing).toBe(false);
    expect(details.evaluation.relevance.topScore).toBe(0.2);
    expect(details.evaluation.cost.passing).toBe(false);
    expect(details.evaluation.cost.estimatedCostUsd).toBeGreaterThan(0);
  });
});

describe("memory tools", () => {
  it("does not throw when memory_search fails (e.g. embeddings 429)", async () => {
    setMemorySearchImpl(async () => {
      throw new Error("openai embeddings failed: 429 insufficient_quota");
    });

    const cfg = { agents: { list: [{ id: "main", default: true }] } };
    const tool = createMemorySearchTool({ config: cfg });
    expect(tool).not.toBeNull();
    if (!tool) {
      throw new Error("tool missing");
    }

    const result = await tool.execute("call_1", { query: "hello" });
    expect(result.details).toEqual({
      results: [],
      disabled: true,
      unavailable: true,
      error: "openai embeddings failed: 429 insufficient_quota",
      warning: "Memory search is unavailable because the embedding provider quota is exhausted.",
      action: "Top up or switch embedding provider, then retry memory_search.",
    });
  });

  it("does not throw when memory_get fails", async () => {
    setMemoryReadFileImpl(async (_params: MemoryReadParams) => {
      throw new Error("path required");
    });

    const cfg = { agents: { list: [{ id: "main", default: true }] } };
    const tool = createMemoryGetTool({ config: cfg });
    expect(tool).not.toBeNull();
    if (!tool) {
      throw new Error("tool missing");
    }

    const result = await tool.execute("call_2", { path: "memory/NOPE.md" });
    expect(result.details).toEqual({
      path: "memory/NOPE.md",
      text: "",
      disabled: true,
      error: "path required",
    });
  });

  it("returns empty text without error when file does not exist (ENOENT)", async () => {
    setMemoryReadFileImpl(async (_params: MemoryReadParams) => {
      return { text: "", path: "memory/2026-02-19.md" };
    });

    const cfg = { agents: { list: [{ id: "main", default: true }] } };
    const tool = createMemoryGetTool({ config: cfg });
    expect(tool).not.toBeNull();
    if (!tool) {
      throw new Error("tool missing");
    }

    const result = await tool.execute("call_enoent", { path: "memory/2026-02-19.md" });
    expect(result.details).toEqual({
      text: "",
      path: "memory/2026-02-19.md",
    });
  });
});
