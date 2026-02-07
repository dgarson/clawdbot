import type { DatabaseSync } from "node:sqlite";

/**
 * Workstream and execution tracking migration
 * Adds workstream column, retry fields, deadline tracking, and execution history tables.
 */

export async function up({ context: db }: { context: DatabaseSync }): Promise<void> {
  // Check existing columns to avoid duplicate column errors
  const cols = db.prepare("PRAGMA table_info(work_items)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));

  // Add new columns if they don't exist
  if (!colNames.has("workstream")) {
    db.exec("ALTER TABLE work_items ADD COLUMN workstream TEXT");
  }
  if (!colNames.has("retry_count")) {
    db.exec("ALTER TABLE work_items ADD COLUMN retry_count INTEGER DEFAULT 0");
  }
  if (!colNames.has("max_retries")) {
    db.exec("ALTER TABLE work_items ADD COLUMN max_retries INTEGER");
  }
  if (!colNames.has("deadline")) {
    db.exec("ALTER TABLE work_items ADD COLUMN deadline TEXT");
  }
  if (!colNames.has("last_outcome")) {
    db.exec("ALTER TABLE work_items ADD COLUMN last_outcome TEXT");
  }

  // Create workstream index
  db.exec(`CREATE INDEX IF NOT EXISTS idx_work_items_workstream ON work_items(workstream)`);

  // Create new tables for execution tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS workstream_notes (
      id TEXT PRIMARY KEY,
      workstream TEXT NOT NULL,
      item_id TEXT,
      kind TEXT NOT NULL DEFAULT 'context',
      content TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_workstream_notes_ws
      ON workstream_notes(workstream, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_workstream_notes_item
      ON workstream_notes(item_id);

    CREATE TABLE IF NOT EXISTS work_item_executions (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
      attempt_number INTEGER NOT NULL,
      session_key TEXT NOT NULL,
      outcome TEXT NOT NULL,
      error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_executions_item
      ON work_item_executions(item_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS work_item_transcripts (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
      execution_id TEXT REFERENCES work_item_executions(id) ON DELETE SET NULL,
      session_key TEXT NOT NULL,
      transcript_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transcripts_item
      ON work_item_transcripts(item_id);
  `);
}

export async function down({ context: db }: { context: DatabaseSync }): Promise<void> {
  db.exec(`
    DROP TABLE IF EXISTS work_item_transcripts;
    DROP TABLE IF EXISTS work_item_executions;
    DROP TABLE IF EXISTS workstream_notes;
    DROP INDEX IF EXISTS idx_work_items_workstream;
  `);
  // Note: Cannot drop columns in SQLite, so they remain after rollback
}
