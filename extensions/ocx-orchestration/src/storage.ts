// ---------------------------------------------------------------------------
// JSONL-based storage for all orchestration domain entities.
// Each entity collection is persisted to its own JSONL file inside
// {stateDir}/orchestration/.
// ---------------------------------------------------------------------------

import fsp from "node:fs/promises";
import path from "node:path";
import type { EscalationRecord, Organization, Sprint, Team, WorkItem } from "./types.js";

/** Read all lines from a JSONL file and parse each as T. */
async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const data = await fsp.readFile(filePath, "utf8");
    const lines = data.split("\n").filter((l) => l.trim().length > 0);
    return lines.map((line) => JSON.parse(line) as T);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/** Rewrite the full JSONL file with the provided records (atomic write). */
async function writeJsonl<T>(filePath: string, records: T[]): Promise<void> {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });
  const content =
    records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : "");
  const tmp = filePath + ".tmp." + process.pid;
  await fsp.writeFile(tmp, content, "utf8");
  await fsp.rename(tmp, filePath);
}

// ---------------------------------------------------------------------------
// OrchestrationStore
// ---------------------------------------------------------------------------

export class OrchestrationStore {
  private readonly dir: string;
  private readonly writeQueues = new Map<string, Promise<unknown>>();

  constructor(stateDir: string) {
    this.dir = path.join(stateDir, "orchestration");
  }

  private file(collection: string): string {
    return path.join(this.dir, `${collection}.jsonl`);
  }

  private withCollectionWriteLock<T>(collection: string, op: () => Promise<T>): Promise<T> {
    const previous = this.writeQueues.get(collection) ?? Promise.resolve();
    const operation = previous.then(op, op);
    this.writeQueues.set(
      collection,
      operation.then(
        () => undefined,
        () => undefined,
      ),
    );
    return operation;
  }

  // -- Organizations -------------------------------------------------------

  async listOrganizations(): Promise<Organization[]> {
    return readJsonl<Organization>(this.file("organizations"));
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const all = await this.listOrganizations();
    return all.find((o) => o.id === id);
  }

  async saveOrganization(org: Organization): Promise<void> {
    await this.withCollectionWriteLock("organizations", async () => {
      const all = await readJsonl<Organization>(this.file("organizations"));
      const idx = all.findIndex((o) => o.id === org.id);
      if (idx >= 0) {
        all[idx] = org;
      } else {
        all.push(org);
      }
      await writeJsonl(this.file("organizations"), all);
    });
  }

  async deleteOrganization(id: string): Promise<boolean> {
    return this.withCollectionWriteLock("organizations", async () => {
      const all = await readJsonl<Organization>(this.file("organizations"));
      const filtered = all.filter((o) => o.id !== id);
      if (filtered.length === all.length) return false;
      await writeJsonl(this.file("organizations"), filtered);
      return true;
    });
  }

  // -- Teams ---------------------------------------------------------------

  async listTeams(): Promise<Team[]> {
    return readJsonl<Team>(this.file("teams"));
  }

  async getTeam(id: string): Promise<Team | undefined> {
    const all = await this.listTeams();
    return all.find((t) => t.id === id);
  }

  async saveTeam(team: Team): Promise<void> {
    await this.withCollectionWriteLock("teams", async () => {
      const all = await readJsonl<Team>(this.file("teams"));
      const idx = all.findIndex((t) => t.id === team.id);
      if (idx >= 0) {
        all[idx] = team;
      } else {
        all.push(team);
      }
      await writeJsonl(this.file("teams"), all);
    });
  }

  async deleteTeam(id: string): Promise<boolean> {
    return this.withCollectionWriteLock("teams", async () => {
      const all = await readJsonl<Team>(this.file("teams"));
      const filtered = all.filter((t) => t.id !== id);
      if (filtered.length === all.length) return false;
      await writeJsonl(this.file("teams"), filtered);
      return true;
    });
  }

  // -- Sprints -------------------------------------------------------------

  async listSprints(): Promise<Sprint[]> {
    return readJsonl<Sprint>(this.file("sprints"));
  }

  async getSprint(id: string): Promise<Sprint | undefined> {
    const all = await this.listSprints();
    return all.find((s) => s.id === id);
  }

  async saveSprint(sprint: Sprint): Promise<void> {
    await this.withCollectionWriteLock("sprints", async () => {
      const all = await readJsonl<Sprint>(this.file("sprints"));
      const idx = all.findIndex((s) => s.id === sprint.id);
      if (idx >= 0) {
        all[idx] = sprint;
      } else {
        all.push(sprint);
      }
      await writeJsonl(this.file("sprints"), all);
    });
  }

  async deleteSprint(id: string): Promise<boolean> {
    return this.withCollectionWriteLock("sprints", async () => {
      const all = await readJsonl<Sprint>(this.file("sprints"));
      const filtered = all.filter((s) => s.id !== id);
      if (filtered.length === all.length) return false;
      await writeJsonl(this.file("sprints"), filtered);
      return true;
    });
  }

  // -- Work Items ----------------------------------------------------------

  async listWorkItems(): Promise<WorkItem[]> {
    return readJsonl<WorkItem>(this.file("work-items"));
  }

  async getWorkItem(id: string): Promise<WorkItem | undefined> {
    const all = await this.listWorkItems();
    return all.find((w) => w.id === id);
  }

  async saveWorkItem(item: WorkItem): Promise<void> {
    await this.withCollectionWriteLock("work-items", async () => {
      const all = await readJsonl<WorkItem>(this.file("work-items"));
      const idx = all.findIndex((w) => w.id === item.id);
      if (idx >= 0) {
        all[idx] = item;
      } else {
        all.push(item);
      }
      await writeJsonl(this.file("work-items"), all);
    });
  }

  async deleteWorkItem(id: string): Promise<boolean> {
    return this.withCollectionWriteLock("work-items", async () => {
      const all = await readJsonl<WorkItem>(this.file("work-items"));
      const filtered = all.filter((w) => w.id !== id);
      if (filtered.length === all.length) return false;
      await writeJsonl(this.file("work-items"), filtered);
      return true;
    });
  }

  // -- Escalations ---------------------------------------------------------

  async listEscalations(): Promise<EscalationRecord[]> {
    return readJsonl<EscalationRecord>(this.file("escalations"));
  }

  async getEscalation(id: string): Promise<EscalationRecord | undefined> {
    const all = await this.listEscalations();
    return all.find((e) => e.id === id);
  }

  async saveEscalation(record: EscalationRecord): Promise<void> {
    await this.withCollectionWriteLock("escalations", async () => {
      const all = await readJsonl<EscalationRecord>(this.file("escalations"));
      const idx = all.findIndex((e) => e.id === record.id);
      if (idx >= 0) {
        all[idx] = record;
      } else {
        all.push(record);
      }
      await writeJsonl(this.file("escalations"), all);
    });
  }

  // -- Utility: ensure directory exists ------------------------------------

  async ensureDir(): Promise<void> {
    await fsp.mkdir(this.dir, { recursive: true });
  }
}
