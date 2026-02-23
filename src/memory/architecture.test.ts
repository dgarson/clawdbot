import { describe, expect, it } from "vitest";
import { createMemoryService, migrateLegacyMemoryNode } from "./architecture.js";

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

  it("retrieves memories in hierarchy order session → project → role → org", async () => {
    const service = createMemoryService({
      governance: { default: "allow" },
      shadowWrite: { enabled: false },
    });

    await service.store("deploy checklist for this session", {
      domain: "session_summary",
      sourceId: "session-note",
      scope: {
        session: "sess-1",
        project: "proj-1",
        role: "reliability",
        org: "openclaw",
      },
    });

    await service.store("deploy checklist for this project", {
      domain: "system_fact",
      sourceId: "project-note",
      scope: {
        project: "proj-1",
        role: "reliability",
        org: "openclaw",
      },
    });

    await service.store("deploy checklist for this role", {
      domain: "system_fact",
      sourceId: "role-note",
      scope: {
        role: "reliability",
        org: "openclaw",
      },
    });

    await service.store("deploy checklist for this org", {
      domain: "system_fact",
      sourceId: "org-note",
      scope: {
        org: "openclaw",
      },
    });

    const results = await service.retrieveScoped("deploy checklist", {
      session: "sess-1",
      project: "proj-1",
      role: "reliability",
      org: "openclaw",
    });

    expect(results).toHaveLength(4);
    expect(results[0]?.metadata.scopeLevel).toBe("session");
    expect(results[1]?.metadata.scopeLevel).toBe("project");
    expect(results[2]?.metadata.scopeLevel).toBe("role");
    expect(results[3]?.metadata.scopeLevel).toBe("org");
  });

  it("stores provenance metadata for each memory node", async () => {
    const service = createMemoryService({
      governance: { default: "allow" },
      shadowWrite: { enabled: false },
    });

    await service.store("service x has 30s timeout", {
      domain: "system_fact",
      sourceId: "incident-123",
      confidenceScore: 0.7,
      provenance: {
        timestamp: 1_706_000_000_000,
      },
      scope: {
        project: "proj-1",
      },
    });

    const [result] = await service.retrieve("service x", undefined, 1);
    expect(result).toBeDefined();
    expect(result?.metadata.provenance.source).toBe("incident-123");
    expect(result?.metadata.provenance.timestamp).toBe(1_706_000_000_000);
    expect(result?.metadata.provenance.confidence).toBe(0.7);
  });

  it("migrates legacy node metadata into the v2 schema", () => {
    const migrated = migrateLegacyMemoryNode({
      id: "legacy-1",
      content: "legacy memory",
      embedding: [],
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_010_000,
      metadata: {
        domain: "system_fact",
        sourceId: "legacy-source",
        ttlSec: 120,
        confidenceScore: 2,
        scope: { project: "proj-legacy" },
      },
    });

    expect(migrated.version).toBe(2);
    expect(migrated.metadata.scopeLevel).toBe("project");
    expect(migrated.metadata.provenance.source).toBe("legacy-source");
    expect(migrated.metadata.provenance.timestamp).toBe(1_700_000_010_000);
    expect(migrated.metadata.provenance.confidence).toBe(1);
    expect(migrated.metadata.retention?.ttlSec).toBe(120);
    expect(migrated.embedding.length).toBeGreaterThan(0);
  });

  it("deletes by scope with cascade semantics", async () => {
    const service = createMemoryService({
      governance: { default: "allow" },
      shadowWrite: { enabled: false },
    });

    await service.store("org-wide memory", {
      domain: "system_fact",
      sourceId: "org",
      scope: { org: "openclaw" },
    });
    await service.store("role memory", {
      domain: "system_fact",
      sourceId: "role",
      scope: { role: "reliability", org: "openclaw" },
    });
    await service.store("project memory", {
      domain: "system_fact",
      sourceId: "project",
      scope: { project: "proj-1", role: "reliability", org: "openclaw" },
    });
    await service.store("session memory", {
      domain: "session_summary",
      sourceId: "session",
      scope: {
        session: "sess-1",
        project: "proj-1",
        role: "reliability",
        org: "openclaw",
      },
    });

    const removed = await service.deleteByScope({ role: "reliability" }, { cascade: true });
    expect(removed).toBe(3);

    const remaining = await service.retrieve("memory", undefined, 10);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.metadata.scopeLevel).toBe("org");
  });

  it("deletes only the target scope level when cascade is false", async () => {
    const service = createMemoryService({
      governance: { default: "allow" },
      shadowWrite: { enabled: false },
    });

    await service.store("role memory", {
      domain: "system_fact",
      sourceId: "role",
      scope: { role: "reliability", org: "openclaw" },
    });
    await service.store("project memory", {
      domain: "system_fact",
      sourceId: "project",
      scope: { project: "proj-1", role: "reliability", org: "openclaw" },
    });

    const removed = await service.deleteByScope({ role: "reliability" }, { cascade: false });
    expect(removed).toBe(1);

    const remaining = await service.retrieve("memory", undefined, 10);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.metadata.scopeLevel).toBe("project");
  });

  it("keeps session deletion constrained by parent scope when provided", async () => {
    const service = createMemoryService({
      governance: { default: "allow" },
      shadowWrite: { enabled: false },
    });

    await service.store("session memory in proj-1", {
      domain: "session_summary",
      sourceId: "session-a",
      scope: {
        session: "sess-1",
        project: "proj-1",
        role: "reliability",
        org: "openclaw",
      },
    });

    await service.store("session memory in proj-2", {
      domain: "session_summary",
      sourceId: "session-b",
      scope: {
        session: "sess-1",
        project: "proj-2",
        role: "reliability",
        org: "openclaw",
      },
    });

    const removed = await service.deleteByScope({ session: "sess-1", project: "proj-1" });
    expect(removed).toBe(1);

    const remaining = await service.retrieve("session memory", undefined, 10);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.metadata.scope?.project).toBe("proj-2");
  });

  it("keeps project deletion constrained by role/org when provided", async () => {
    const service = createMemoryService({
      governance: { default: "allow" },
      shadowWrite: { enabled: false },
    });

    await service.store("project memory in reliability", {
      domain: "system_fact",
      sourceId: "project-a",
      scope: {
        project: "proj-1",
        role: "reliability",
        org: "openclaw",
      },
    });

    await service.store("project memory in platform", {
      domain: "system_fact",
      sourceId: "project-b",
      scope: {
        project: "proj-1",
        role: "platform",
        org: "openclaw",
      },
    });

    const removed = await service.deleteByScope(
      { project: "proj-1", role: "reliability", org: "openclaw" },
      { cascade: true },
    );
    expect(removed).toBe(1);

    const remaining = await service.retrieve("project memory", undefined, 10);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.metadata.scope?.role).toBe("platform");
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
