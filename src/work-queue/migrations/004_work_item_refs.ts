import type { DatabaseSync } from "node:sqlite";
import { formatRef, readRefs } from "../refs.js";

/**
 * Work item refs migration
 * Adds a normalized table for cross-entity references and backfills payload refs.
 */

export async function up({ context: db }: { context: DatabaseSync }): Promise<void> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_item_refs (
      item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      label TEXT,
      uri TEXT,
      PRIMARY KEY (item_id, kind, ref_id)
    );

    CREATE INDEX IF NOT EXISTS idx_work_item_refs_item
      ON work_item_refs(item_id);

    CREATE INDEX IF NOT EXISTS idx_work_item_refs_kind_id
      ON work_item_refs(kind, ref_id);
  `);

  const rows = db
    .prepare("SELECT id, payload_json FROM work_items WHERE payload_json IS NOT NULL")
    .all() as Array<{ id: string; payload_json: string }>;

  if (rows.length === 0) {
    return;
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO work_item_refs (item_id, kind, ref_id, label, uri)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const row of rows) {
    let payload: unknown = null;
    try {
      payload = JSON.parse(row.payload_json);
    } catch {
      continue;
    }
    const refs = readRefs(payload as Record<string, unknown>);
    if (refs.length === 0) {
      continue;
    }
    for (const ref of refs) {
      insert.run(row.id, ref.kind, ref.id, ref.label ?? null, ref.uri ?? formatRef(ref));
    }
  }
}

export async function down({ context: db }: { context: DatabaseSync }): Promise<void> {
  db.exec(`
    DROP TABLE IF EXISTS work_item_refs;
    DROP INDEX IF EXISTS idx_work_item_refs_item;
    DROP INDEX IF EXISTS idx_work_item_refs_kind_id;
  `);
}
