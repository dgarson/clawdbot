import type { DatabaseSync } from "node:sqlite";

/**
 * Baseline schema migration - creates work_queues and work_items tables
 * This represents the initial schema before workstream and execution tracking features.
 */

export async function up({ context: db }: { context: DatabaseSync }): Promise<void> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_queues (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      concurrency_limit INTEGER DEFAULT 1,
      default_priority TEXT DEFAULT 'medium',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL REFERENCES work_queues(id),
      title TEXT NOT NULL,
      description TEXT,
      payload_json TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      status_reason TEXT,
      parent_item_id TEXT REFERENCES work_items(id),
      depends_on_json TEXT,
      blocked_by_json TEXT,
      created_by_json TEXT,
      assigned_to_json TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      tags_json TEXT,
      result_json TEXT,
      error_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_work_items_queue_status
      ON work_items(queue_id, status);
    CREATE INDEX IF NOT EXISTS idx_work_items_priority
      ON work_items(priority, created_at);
    CREATE INDEX IF NOT EXISTS idx_work_items_parent
      ON work_items(parent_item_id);
  `);
}

export async function down({ context: db }: { context: DatabaseSync }): Promise<void> {
  db.exec(`
    DROP TABLE IF EXISTS work_items;
    DROP TABLE IF EXISTS work_queues;
  `);
}
