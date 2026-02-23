import { describe, expect, it, vi } from "vitest";
import { createMemoryService, type MemoryNode } from "./architecture.js";

function buildHookNode(params: {
  id: string;
  content: string;
  sourceId: string;
  confidenceScore: number;
}): MemoryNode {
  return {
    id: params.id,
    content: params.content,
    embedding: [0],
    metadata: {
      domain: "system_fact",
      sourceId: params.sourceId,
      confidenceScore: params.confidenceScore,
    },
    createdAt: 1,
    updatedAt: 1,
    version: 1,
  };
}

describe("Memory architecture scope isolation", () => {
  it("filters retrieve by agent and user scope", async () => {
    const service = createMemoryService({
      governance: { default: "allow" },
      shadowWrite: { enabled: false },
    });

    const aUserNode = await service.store("User A prefers Python", {
      domain: "user_pref",
      sourceId: "s1",
      agentId: "agent-a",
      userId: "user-a",
      tags: ["prefs"],
    });
    const bUserNode = await service.store("User B prefers Rust", {
      domain: "user_pref",
      sourceId: "s2",
      agentId: "agent-b",
      userId: "user-b",
      tags: ["prefs"],
    });

    expect(typeof aUserNode).toBe("string");
    expect(typeof bUserNode).toBe("string");

    const agentResults = await service.retrieve("prefers", { agentId: "agent-a" }, 10);
    expect(agentResults).toHaveLength(1);
    expect(agentResults[0]?.metadata.userId).toBe("user-a");

    const userResults = await service.retrieve("prefers", { userId: "user-b" }, 10);
    expect(userResults).toHaveLength(1);
    expect(userResults[0]?.metadata.userId).toBe("user-b");
  });

  it("supports keyword filters with scope", async () => {
    const service = createMemoryService({
      governance: { default: "allow" },
      shadowWrite: { enabled: false },
    });

    await service.store("Enable strict tenant isolation", {
      domain: "system_fact",
      sourceId: "s3",
      agentId: "tenant-1",
      tags: ["policy"],
    });
    await service.store("Enable loose mode", {
      domain: "system_fact",
      sourceId: "s4",
      agentId: "tenant-2",
      tags: ["policy"],
    });

    const tenant1 = await service.searchKeywords(["tenant", "isolation"], {
      agentId: "tenant-1",
      tags: ["policy"],
    });
    expect(tenant1).toHaveLength(1);
    expect(tenant1[0]?.metadata.agentId).toBe("tenant-1");
  });
});

describe("Memory architecture governance", () => {
  it("defaults writes to deny when no allow policy exists", async () => {
    const service = createMemoryService({
      governance: { default: "deny" },
      shadowWrite: { enabled: false },
    });

    await expect(
      service.store("Shadow write candidate", {
        domain: "agent_eval",
        sourceId: "deny-test",
      }),
    ).rejects.toMatchObject({ message: "memory write denied by governance policy" });
  });

  it("allows a scoped write when matching allow rule exists", async () => {
    const service = createMemoryService({
      governance: {
        default: "deny",
        rules: [
          {
            action: "allow",
            match: {
              agentId: "agent-allow",
            },
          },
        ],
      },
      shadowWrite: { enabled: false },
    });

    const allowedId = await service.store("Allowed fact", {
      domain: "agent_eval",
      sourceId: "allow-test",
      agentId: "agent-allow",
    });
    const denied = service.store("Denied fact", {
      domain: "agent_eval",
      sourceId: "allow-test",
      agentId: "agent-deny",
    });

    expect(typeof allowedId).toBe("string");
    await expect(denied).rejects.toMatchObject({
      message: "memory write denied by governance policy",
    });
  });
});

describe("Memory architecture hybrid read hook stubs", () => {
  it("preserves legacy retrieve path when read hooks are disabled", async () => {
    const vectorRead = vi.fn();
    const service = createMemoryService({
      governance: { default: "allow" },
      retrieval: { readPath: { enabled: false } },
      hybridReadHooks: { vectorRead },
    });

    await service.store("alpha lexical fallback", {
      domain: "system_fact",
      sourceId: "legacy",
    });

    const results = await service.retrieve("alpha", undefined, 5);

    expect(results).toHaveLength(1);
    expect(vectorRead).not.toHaveBeenCalled();
  });

  it("falls back to lexical hook when vector hook errors", async () => {
    const onFallback = vi.fn();
    const service = createMemoryService({
      governance: { default: "allow" },
      retrieval: {
        readPath: {
          enabled: true,
          lexicalFallback: "on-error",
        },
      },
      hybridReadHooks: {
        vectorRead: vi.fn(async () => {
          throw new Error("vector backend unavailable");
        }),
        lexicalRead: vi.fn(async ({ query }) => [
          buildHookNode({
            id: "lexical-1",
            content: `fallback hit for ${query}`,
            sourceId: "lexical",
            confidenceScore: 0.4,
          }),
        ]),
        onFallback,
      },
    });

    const result = await service.retrieveHybrid("fallback", undefined, 3);

    expect(result.usedPath).toBe("lexical");
    expect(result.fallbackReason).toBe("vector-error");
    expect(result.nodes).toHaveLength(1);
    expect(onFallback).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "vector-error", query: "fallback" }),
    );
  });

  it("uses lexical fallback when vector results are empty", async () => {
    const service = createMemoryService({
      governance: { default: "allow" },
      retrieval: {
        readPath: {
          enabled: true,
          lexicalFallback: "on-empty",
        },
      },
      hybridReadHooks: {
        vectorRead: vi.fn(async () => []),
        lexicalRead: vi.fn(async () => [
          buildHookNode({
            id: "lexical-empty-fallback",
            content: "keyword fallback result",
            sourceId: "lexical-empty",
            confidenceScore: 0.5,
          }),
        ]),
      },
    });

    const result = await service.retrieveHybrid("keyword", undefined, 3);

    expect(result.usedPath).toBe("lexical");
    expect(result.fallbackReason).toBe("vector-empty");
    expect(result.nodes[0]?.id).toBe("lexical-empty-fallback");
  });
});
