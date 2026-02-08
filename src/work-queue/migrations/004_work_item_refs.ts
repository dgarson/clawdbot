import type { DatabaseSync } from "node:sqlite";

/**
 * Work item refs migration
 * Adds a normalized table for cross-entity references.
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
}

export async function down({ context: db }: { context: DatabaseSync }): Promise<void> {
  db.exec(`
    DROP TABLE IF EXISTS work_item_refs;
    DROP INDEX IF EXISTS idx_work_item_refs_item;
    DROP INDEX IF EXISTS idx_work_item_refs_kind_id;
  `);
}
