import type { DatabaseSync } from "node:sqlite";

/**
 * Work item heartbeat tracking.
 * Adds last_heartbeat_at for lease/heartbeat tracking.
 */
export async function up({ context: db }: { context: DatabaseSync }): Promise<void> {
  const cols = db.prepare("PRAGMA table_info(work_items)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));

  if (!colNames.has("last_heartbeat_at")) {
    db.exec("ALTER TABLE work_items ADD COLUMN last_heartbeat_at TEXT");
  }
}

export async function down(_params: { context: DatabaseSync }): Promise<void> {
  // SQLite can't drop columns, so leave it in place.
}
