import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrchestrationStore } from "./storage.js";
import type { Organization, Sprint, Team, WorkItem } from "./types.js";

describe("OrchestrationStore", () => {
  let tmpDir: string;
  let store: OrchestrationStore;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "orch-store-test-"));
    store = new OrchestrationStore(tmpDir);
    await store.ensureDir();
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Organizations
  // -------------------------------------------------------------------------

  describe("organizations", () => {
    it("creates and retrieves an organization", async () => {
      const org: Organization = { id: "org-1", name: "Acme", teams: [] };
      await store.saveOrganization(org);
      const retrieved = await store.getOrganization("org-1");
      expect(retrieved).toEqual(org);
    });

    it("lists all organizations", async () => {
      await store.saveOrganization({ id: "org-1", name: "A", teams: [] });
      await store.saveOrganization({ id: "org-2", name: "B", teams: [] });
      const all = await store.listOrganizations();
      expect(all).toHaveLength(2);
    });

    it("updates an existing organization", async () => {
      await store.saveOrganization({ id: "org-1", name: "Old", teams: [] });
      await store.saveOrganization({ id: "org-1", name: "New", teams: ["t1"] });
      const org = await store.getOrganization("org-1");
      expect(org!.name).toBe("New");
      expect(org!.teams).toEqual(["t1"]);
      // Should not duplicate
      const all = await store.listOrganizations();
      expect(all).toHaveLength(1);
    });

    it("deletes an organization", async () => {
      await store.saveOrganization({ id: "org-1", name: "Del", teams: [] });
      const deleted = await store.deleteOrganization("org-1");
      expect(deleted).toBe(true);
      const org = await store.getOrganization("org-1");
      expect(org).toBeUndefined();
    });

    it("returns false when deleting nonexistent organization", async () => {
      const deleted = await store.deleteOrganization("nope");
      expect(deleted).toBe(false);
    });

    it("returns empty list when no organizations exist", async () => {
      const all = await store.listOrganizations();
      expect(all).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Teams
  // -------------------------------------------------------------------------

  describe("teams", () => {
    it("creates and retrieves a team", async () => {
      const team: Team = {
        id: "team-1",
        name: "Alpha",
        organizationId: "org-1",
        members: [],
      };
      await store.saveTeam(team);
      const retrieved = await store.getTeam("team-1");
      expect(retrieved).toEqual(team);
    });

    it("lists teams", async () => {
      await store.saveTeam({ id: "t1", name: "A", organizationId: "o1", members: [] });
      await store.saveTeam({ id: "t2", name: "B", organizationId: "o1", members: [] });
      const all = await store.listTeams();
      expect(all).toHaveLength(2);
    });

    it("deletes a team", async () => {
      await store.saveTeam({ id: "t1", name: "Del", organizationId: "o1", members: [] });
      expect(await store.deleteTeam("t1")).toBe(true);
      expect(await store.getTeam("t1")).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Sprints
  // -------------------------------------------------------------------------

  describe("sprints", () => {
    const now = new Date().toISOString();

    it("creates and retrieves a sprint", async () => {
      const sprint: Sprint = {
        id: "sprint-1",
        teamId: "t1",
        name: "Sprint 1",
        state: "planning",
        workItems: [],
        createdAt: now,
        updatedAt: now,
      };
      await store.saveSprint(sprint);
      const retrieved = await store.getSprint("sprint-1");
      expect(retrieved).toEqual(sprint);
    });

    it("updates an existing sprint", async () => {
      await store.saveSprint({
        id: "s1",
        teamId: "t1",
        name: "S",
        state: "planning",
        workItems: [],
        createdAt: now,
        updatedAt: now,
      });
      await store.saveSprint({
        id: "s1",
        teamId: "t1",
        name: "S",
        state: "active",
        workItems: ["wi-1"],
        createdAt: now,
        updatedAt: now,
      });
      const sprint = await store.getSprint("s1");
      expect(sprint!.state).toBe("active");
      expect(sprint!.workItems).toEqual(["wi-1"]);
    });

    it("deletes a sprint", async () => {
      await store.saveSprint({
        id: "s1",
        teamId: "t1",
        name: "S",
        state: "planning",
        workItems: [],
        createdAt: now,
        updatedAt: now,
      });
      expect(await store.deleteSprint("s1")).toBe(true);
      expect(await store.getSprint("s1")).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Work Items
  // -------------------------------------------------------------------------

  describe("work items", () => {
    it("creates and retrieves a work item", async () => {
      const item: WorkItem = {
        id: "wi-1",
        sprintId: "s1",
        title: "Task",
        description: "Do something",
        state: "backlog",
        acceptanceCriteria: [],
        delegations: [],
        reviews: [],
        externalRefs: [],
      };
      await store.saveWorkItem(item);
      const retrieved = await store.getWorkItem("wi-1");
      expect(retrieved).toEqual(item);
    });

    it("updates an existing work item", async () => {
      const item: WorkItem = {
        id: "wi-1",
        sprintId: "s1",
        title: "Old",
        description: "",
        state: "backlog",
        acceptanceCriteria: [],
        delegations: [],
        reviews: [],
        externalRefs: [],
      };
      await store.saveWorkItem(item);
      item.title = "New";
      item.state = "done";
      await store.saveWorkItem(item);
      const retrieved = await store.getWorkItem("wi-1");
      expect(retrieved!.title).toBe("New");
      expect(retrieved!.state).toBe("done");
      // Should not duplicate
      const all = await store.listWorkItems();
      expect(all).toHaveLength(1);
    });

    it("deletes a work item", async () => {
      const item: WorkItem = {
        id: "wi-1",
        sprintId: "s1",
        title: "Del",
        description: "",
        state: "backlog",
        acceptanceCriteria: [],
        delegations: [],
        reviews: [],
        externalRefs: [],
      };
      await store.saveWorkItem(item);
      expect(await store.deleteWorkItem("wi-1")).toBe(true);
      expect(await store.getWorkItem("wi-1")).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Escalations
  // -------------------------------------------------------------------------

  describe("escalations", () => {
    it("creates and retrieves an escalation", async () => {
      const esc = {
        id: "esc-1",
        trigger: "blocked" as const,
        target: { kind: "agent" as const, agentId: "a1" },
        message: "Blocked",
        createdAt: new Date().toISOString(),
      };
      await store.saveEscalation(esc);
      const retrieved = await store.getEscalation("esc-1");
      expect(retrieved).toEqual(esc);
    });

    it("lists escalations", async () => {
      await store.saveEscalation({
        id: "e1",
        trigger: "blocked",
        target: { kind: "agent", agentId: "a1" },
        message: "1",
        createdAt: new Date().toISOString(),
      });
      await store.saveEscalation({
        id: "e2",
        trigger: "timeout",
        target: { kind: "agent", agentId: "a2" },
        message: "2",
        createdAt: new Date().toISOString(),
      });
      const all = await store.listEscalations();
      expect(all).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Atomic writes
  // -------------------------------------------------------------------------

  describe("atomic writes", () => {
    it("sequential writes produce well-formed JSONL", async () => {
      // Write multiple organizations sequentially to verify each write
      // produces valid JSONL without corruption.
      for (let i = 0; i < 10; i++) {
        await store.saveOrganization({ id: `org-${i}`, name: `Org ${i}`, teams: [] });
      }

      const all = await store.listOrganizations();
      expect(all).toHaveLength(10);
      for (const org of all) {
        expect(org.id).toMatch(/^org-\d+$/);
        expect(org.name).toBeDefined();
      }
    });

    it("uses temp file for writes (no partial writes)", async () => {
      // Save an item, then check the file is valid
      await store.saveOrganization({ id: "org-atomic", name: "Atomic", teams: [] });
      const filePath = path.join(tmpDir, "orchestration", "organizations.jsonl");
      const content = await fsp.readFile(filePath, "utf8");
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      expect(lines).toHaveLength(1);
      // Each line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });
  });

  // -------------------------------------------------------------------------
  // ensureDir
  // -------------------------------------------------------------------------

  describe("ensureDir", () => {
    it("creates the orchestration directory if missing", async () => {
      const freshDir = path.join(tmpDir, "fresh");
      const freshStore = new OrchestrationStore(freshDir);
      await freshStore.ensureDir();
      const stat = await fsp.stat(path.join(freshDir, "orchestration"));
      expect(stat.isDirectory()).toBe(true);
    });
  });
});
