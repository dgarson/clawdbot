import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalMarkdownIssueTrackerProvider } from "./local-md-provider.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

async function createProvider() {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-issues-"));
  tempDirs.push(baseDir);
  return new LocalMarkdownIssueTrackerProvider({ baseDir });
}

describe("LocalMarkdownIssueTrackerProvider", () => {
  it("creates and reloads tickets from markdown", async () => {
    const provider = await createProvider();
    const created = await provider.createTicket({
      title: "Add issue tracking registry",
      body: "Need a common provider abstraction.",
      status: "in_progress",
      labels: ["engineering", "architecture"],
      classifications: [
        { dimension: "complexity", value: "medium", source: "agent" },
        { dimension: "business_domain", value: "engineering", source: "human" },
      ],
    });

    const loaded = await provider.getTicket(created.id);
    expect(loaded?.title).toBe(created.title);
    expect(loaded?.classifications).toHaveLength(2);
    expect(loaded?.labels).toContain("engineering");
  });

  it("filters with blocked relationships and agent capability", async () => {
    const provider = await createProvider();
    const target = await provider.createTicket({
      title: "Deploy webhook",
      status: "blocked",
      labels: ["ops"],
      classifications: [
        { dimension: "complexity", value: "high" },
        { dimension: "business_domain", value: "engineering" },
      ],
      relationships: [{ kind: "blocked_by", ticketId: "123" }],
    });

    await provider.createTicket({
      title: "Write marketing email",
      status: "ready",
      labels: ["marketing"],
      classifications: [{ dimension: "business_domain", value: "marketing" }],
    });

    const matches = await provider.queryTickets({
      blockedOnly: true,
      assignedAgent: {
        agentId: "agent-alpha",
        maxComplexity: "high",
        supportedDomains: ["engineering"],
      },
    });

    expect(matches.map((ticket) => ticket.id)).toEqual([target.id]);
  });

  it("serializes concurrent relationship updates from multiple processes", async () => {
    const provider = await createProvider();
    const created = await provider.createTicket({
      title: "Concurrency test",
      status: "in_progress",
    });

    await Promise.all([
      provider.addRelationship(created.id, { kind: "blocks", ticketId: "ticket-a" }),
      provider.addRelationship(created.id, { kind: "related", ticketId: "ticket-b" }),
    ]);

    const reloaded = await provider.getTicket(created.id);
    expect(reloaded?.relationships).toEqual(
      expect.arrayContaining([
        { kind: "blocks", ticketId: "ticket-a" },
        { kind: "related", ticketId: "ticket-b" },
      ]),
    );
    expect(reloaded?.relationships).toHaveLength(2);
  });

  it("returns a focused dependency DAG", async () => {
    const provider = await createProvider();
    const root = await provider.createTicket({
      title: "Root",
      relationships: [{ kind: "blocks", ticketId: "pending" }],
    });
    const child = await provider.createTicket({
      title: "Child",
      relationships: [{ kind: "blocks", ticketId: root.id }],
    });
    await provider.updateTicket(root.id, {
      appendRelationships: [{ kind: "blocks", ticketId: child.id }],
    });

    const dag = await provider.queryDag({
      rootTicketIds: [root.id],
      relationshipKinds: ["blocks"],
      direction: "outbound",
      maxDepth: 2,
    });

    expect(dag.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([root.id, child.id]));
    expect(dag.edges).toEqual(
      expect.arrayContaining([{ fromTicketId: root.id, toTicketId: child.id, kind: "blocks" }]),
    );
  });
});
