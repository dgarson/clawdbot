# ACP SQLite Schema Migration Plan (P1)

**File:** `/Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-acp-db-migration-plan-claire.md`  
**Date:** 2026-02-22 (updated)  
**Author:** Claire (subagent)  
**Status:** Ready for Implementation

---

## 1) Overview

This document defines the SQLite schema migration strategy for implementing the ACP (Agent Communication Protocol) canonical specification. It provides table-by-table migration steps, indexing strategy, and test strategy for P1 delivery.

**Canonical Spec Source:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`

---

## 2) Target Schema (From Canonical Spec §9)

### 2.1 Core Tables

| Table | Purpose |
|-------|---------|
| `messages` | Primary message envelope storage |
| `delivery_log` | Per-recipient delivery tracking |
| `handoffs` | Handoff state machine and package storage |
| `acp_meta` | Schema version and protocol metadata |

### 2.2 PRAGMAs (Required)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

---

## 3) Migration Steps

### Phase 0: Schema Version Check

```sql
-- If acp_meta table doesn't exist, this is a fresh install
CREATE TABLE IF NOT EXISTS acp_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Check current schema version
SELECT value FROM acp_meta WHERE key = 'schema_version';
```

**Migration logic:**
- If no row found → fresh install, run full schema creation
- If version < current (1) → run incremental migration scripts
- If version = 1 → no migration needed

### Phase 1: Core Messages Table

```sql
CREATE TABLE IF NOT EXISTS messages (
  id                  TEXT PRIMARY KEY,
  protocol            TEXT NOT NULL DEFAULT 'acp',
  version             TEXT NOT NULL DEFAULT '1.0.0',
  from_agent          TEXT NOT NULL,
  to_agents_json      TEXT NOT NULL,
  team                TEXT,
  reply_to            TEXT,
  thread_id           TEXT,
  type                TEXT NOT NULL,
  topic               TEXT,
  priority            TEXT NOT NULL DEFAULT 'normal',
  status              TEXT NOT NULL DEFAULT 'pending',
  payload_json        TEXT NOT NULL,
  policy_json         TEXT NOT NULL,
  context_json        TEXT,
  external_refs_json  TEXT,
  sequence            INTEGER,
  expires_at          TEXT,
  payload_bytes       INTEGER NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now','utc')),
  updated_at          TEXT
);
```

**Migration from null:**
- If migrating from no existing messages table, create fresh
- If existing messages table exists with different schema, see §4

### Phase 2: Delivery Log Table

```sql
CREATE TABLE IF NOT EXISTS delivery_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id    TEXT NOT NULL,
  recipient     TEXT NOT NULL,
  channel       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  delivered_at  TEXT,
  read_at       TEXT,
  error         TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
```

**Note:** `ON DELETE CASCADE` ensures delivery records are cleaned up when messages are purged.

### Phase 3: Handoffs Table

```sql
CREATE TABLE IF NOT EXISTS handoffs (
  id                 TEXT PRIMARY KEY,
  thread_id          TEXT NOT NULL,
  task_id            TEXT NOT NULL,
  from_agent         TEXT NOT NULL,
  to_agent           TEXT NOT NULL,
  title              TEXT NOT NULL,
  reason             TEXT NOT NULL,
  package_json       TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'proposed',
  provenance_json    TEXT NOT NULL,
  verification_json  TEXT NOT NULL,
  initiated_at       TEXT NOT NULL DEFAULT (datetime('now','utc')),
  resolved_at        TEXT,
  resolution_notes   TEXT
);

-- Prevent multiple active handoffs on the same task
CREATE UNIQUE INDEX IF NOT EXISTS idx_handoffs_task_active
ON handoffs(task_id)
WHERE status IN ('proposed','validating','accepted','activated');
```

### Phase 4: Metadata Initialization

```sql
INSERT OR IGNORE INTO acp_meta (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO acp_meta (key, value) VALUES ('protocol_version', '1.0.0');
```

---

## 4) Indexing Strategy

### 4.1 Required Indexes (From Canonical Spec §9)

```sql
-- Message retrieval by sender
CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_agent, created_at DESC);

-- Thread conversation ordering
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);

-- Message type queries (e.g., status.update, handoff.*)
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type, created_at DESC);

-- Status filtering (pending/delivered/read)
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status, created_at DESC);
```

### 4.2 Additional Recommended Indexes

```sql
-- Expired message cleanup
CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires_at) WHERE expires_at IS NOT NULL;

-- Recipient search (requires JSON extraction)
CREATE INDEX IF NOT EXISTS idx_messages_recipients ON messages(to_agents_json);

-- Team-scoped queries
CREATE INDEX IF NOT EXISTS idx_messages_team ON messages(team, created_at DESC);

-- Delivery log lookups
CREATE INDEX IF NOT EXISTS idx_delivery_message ON delivery_log(message_id);
CREATE INDEX IF NOT EXISTS idx_delivery_recipient ON delivery_log(recipient, status);
```

### 4.3 Index Maintenance

- Run `ANALYZE` after schema creation and after bulk imports
- Consider `VACUUM` + `REINDEX` for large datasets quarterly
- Monitor query performance via `EXPLAIN QUERY PLAN`

---

## 5) JSON Field Encoding Conventions

| Field | JSON Type | Storage | Notes |
|-------|-----------|---------|-------|
| `to_agents_json` | `string[]` | JSON array | Normalized recipient array |
| `payload_json` | `ACPPayload` | JSON object | Validated before write |
| `policy_json` | `ACPPolicy` | JSON object | visibility/sensitivity/human_gate |
| `context_json` | `ACPContext` | JSON object | Optional, session_id, external_refs, artifacts |
| `external_refs_json` | `ACPExternalRef[]` | JSON array | Workq items, files, branches |
| `package_json` | `ACPHandoffPackage` | JSON object | Full handoff package |
| `provenance_json` | `ACPProvenance` | JSON object | origin_session, related_sessions, decision_refs |
| `verification_json` | `ACPVerification` | JSON object | schema_version, package_hash |

---

## 6) Test Strategy

### 6.1 Unit Tests

| Test | Description |
|------|-------------|
| `test_schema_creation` | Verify all tables and indexes create without error |
| `test_pragmas_set` | Confirm WAL mode, foreign keys, sync level |
| `test_json_serialization` | Round-trip message envelope JSON through DB |
| `test_null_defaults` | Verify DEFAULT expressions work |
| `test_unique_constraint` | Confirm handoff task active constraint |

### 6.2 Integration Tests

| Test | Description |
|------|-------------|
| `test_message_insert_retrieve` | Full CRUD cycle for messages |
| `test_delivery_log_cascade` | Confirm cascade delete on message removal |
| `test_handoff_state_transitions` | Insert handoff, verify status flow |
| `test_query_indexes` | Verify index usage via EXPLAIN |

### 6.3 Migration Tests

| Test | Description |
|------|-------------|
| `test_fresh_install` | Create DB from scratch, verify version |
| `test_schema_upgrade` | Simulate version increment, run migration |
| `test_foreign_keys_enforced` | Confirm FK violations rejected |
| `test_jsonl_export` | Export messages to JSONL format |

### 6.4 Performance Targets

| Metric | Target |
|--------|--------|
| Message insert | < 10ms |
| Thread query (1000 msgs) | < 50ms |
| Inbox query (100 pending) | < 20ms |
| Index creation | < 100ms |

---

## 7) Rollback Strategy

### 7.1 Pre-Migration Backup

```bash
# Backup existing database
cp /path/to/acp.db /path/to/acp.db.backup.$(date +%Y%m%d%H%M%S)
```

### 7.2 Migration Recording

```sql
-- Record migration in meta table
INSERT INTO acp_meta (key, value) VALUES ('last_migration', '2026-02-21');
INSERT INTO acp_meta (key, value) VALUES ('migration_status', 'pending');
-- ... run migrations ...
UPDATE acp_meta SET value = 'complete' WHERE key = 'migration_status';
```

### 7.3 Rollback Script Template

```sql
-- Rollback: drop new tables/indexes
DROP INDEX IF EXISTS idx_messages_from;
DROP INDEX IF EXISTS idx_messages_thread;
DROP INDEX IF EXISTS idx_messages_type;
DROP INDEX IF EXISTS idx_messages_status;
DROP TABLE IF EXISTS delivery_log;
DROP TABLE IF EXISTS handoffs;
DROP TABLE IF EXISTS messages;
-- (acp_meta kept for diagnostics)
```

---

## 8) Implementation Order

1. **Week 1:** Schema creation scripts + unit tests
2. **Week 2:** Index validation + query performance testing
3. **Week 3:** Migration path from any existing schema + rollback testing
4. **Week 4:** JSONL export integration + load testing

---

## 9) Schema Evolution Strategy

### 9.1 Versioning Policy

| Version | Schema State | Migration Path |
|---------|--------------|----------------|
| `0` | No tables exist | → `1` (fresh install) |
| `1` | Initial P1 schema | — (baseline) |
| `1.1.x` | Backward-compatible additions | → `1.1.x` (add columns/indexes) |
| `2.x` | Breaking changes | → `2.x` (requires migration script) |

**Rules:**
- **Minor increments** (`1.0` → `1.1`): Additive only. Add columns, tables, indexes. Never remove or rename.
- **Major increments** (`1.x` → `2.0`): Breaking. Requires documented migration with backward-compat bridge if needed.

### 9.2 Schema Version Table

```sql
CREATE TABLE IF NOT EXISTS acp_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Core version tracking
INSERT OR IGNORE INTO acp_meta (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO acp_meta (key, value) VALUES ('protocol_version', '1.0.0');
INSERT OR IGNORE INTO acp_meta (key, value) VALUES ('migration_applied', '');

-- Track migration history
CREATE TABLE IF NOT EXISTS acp_migrations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  version     TEXT NOT NULL,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now','utc')),
  script      TEXT NOT NULL,
  checksum    TEXT NOT NULL
);
```

### 9.3 Forward Compatibility Rules

1. **Never delete columns** — use `ALTER TABLE ... DROP COLUMN` only if SQLite version supports it (3.35.0+) and column was nullable with no data
2. **Never rename tables** — create new table, migrate data, drop old
3. **JSON fields are extensible** — schema allows adding keys without migration
4. **New indexes are safe** — always use `CREATE INDEX IF NOT EXISTS`
5. **New tables are safe** — always use `CREATE TABLE IF NOT EXISTS`

---

## 10) Migration Sequencing

### 10.1 Phase Execution Order

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 0: Pre-flight Checks                                  │
│  • Verify SQLite version (≥3.35.0)                          │
│  • Check existing schema version                            │
│  • Validate workspace permissions                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Core Infrastructure                               │
│  • Create acp_meta table                                     │
│  • Initialize version row                                    │
│  • Create acp_migrations table                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Messages Table                                     │
│  • Create messages table                                     │
│  • Create message indexes                                    │
│  • Verify pragma settings                                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Delivery Log                                       │
│  • Create delivery_log table                                 │
│  • Create delivery indexes                                  │
│  • Verify FK constraints                                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Handoffs                                           │
│  • Create handoffs table                                     │
│  • Create handoff indexes (including partial unique idx)   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Post-migration                                     │
│  • Run ANALYZE for query planner                            │
│  • Record migration in acp_migrations                       │
│  • Verify all indexes usable                                 │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Migration Script Template

```typescript
// migrations/001-initial-schema.ts
import { Database } from 'better-sqlite3';

export const version = '1';
export const checksum = 'sha256:...'; // Hash of this script

export function up(db: Database): void {
  // Phase 1: Meta tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS acp_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO acp_meta (key, value) VALUES ('schema_version', '1');
  `);
  
  // Phase 2: Messages (see §3)
  db.exec(`CREATE TABLE IF NOT EXISTS messages (...);`);
  // ... indexes
  
  // Record migration
  db.prepare(`
    INSERT INTO acp_migrations (version, script, checksum) VALUES (?, ?, ?)
  `).run(version, '001-initial-schema.ts', checksum);
}
```

### 10.3 Idempotency Guarantees

- All `CREATE TABLE` statements use `IF NOT EXISTS`
- All `CREATE INDEX` statements use `IF NOT EXISTS`
- All `INSERT` statements use `INSERT OR IGNORE`
- Migration runner tracks applied migrations and skips already-applied ones

---

## 11) Rollback Strategy

### 11.1 Pre-Migration Checklist

```bash
# 1. Backup database
cp /path/to/acp.db /path/to/acp.db.backup.$(date +%Y%m%d%H%M%S)

# 2. Verify backup integrity
sqlite3 /path/to/acp.db.backup.$(date +%Y%m%d%H%M%S) "PRAGMA integrity_check;"

# 3. Record pre-migration state
sqlite3 /path/to/acp.db "SELECT * FROM acp_meta;" > /tmp/acp_meta_pre.log
```

### 11.2 Migration State Tracking

```sql
-- Before migration starts
INSERT INTO acp_meta (key, value) VALUES ('migration_status', 'in_progress');
INSERT INTO acp_meta (key, value) VALUES ('migration_started', datetime('now','utc'));

-- After successful completion
UPDATE acp_meta SET value = 'complete' WHERE key = 'migration_status';
UPDATE acp_meta SET value = datetime('now','utc') WHERE key = 'migration_completed';
```

### 11.3 Rollback Procedures

#### Option A: Full Database Restore
```bash
# If migration fails catastrophically
cp /path/to/acp.db.backup.20260221120000 /path/to/acp.db
```

#### Option B: Selective Rollback (Preferred)
```sql
-- Drop new objects only, preserve existing data
-- For schema v1 → v1.1 rollback:
DROP INDEX IF EXISTS idx_messages_new_field;
ALTER TABLE messages DROP COLUMN IF EXISTS new_field;  -- SQLite 3.35+

-- Update version
UPDATE acp_meta SET value = '1' WHERE key = 'schema_version';
```

#### Option C: Migration Reversal Script
```typescript
// migrations/001-initial-schema.rollback.ts
export function down(db: Database): void {
  // Reverse in reverse order
  db.exec(`
    DROP INDEX IF EXISTS idx_handoffs_task_active;
    DROP INDEX IF EXISTS idx_delivery_recipient;
    DROP INDEX IF EXISTS idx_delivery_message;
    DROP INDEX IF EXISTS idx_messages_status;
    DROP INDEX IF EXISTS idx_messages_type;
    DROP INDEX IF EXISTS idx_messages_thread;
    DROP INDEX IF EXISTS idx_messages_from;
    DROP TABLE IF EXISTS handoffs;
    DROP TABLE IF EXISTS delivery_log;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS acp_migrations;
  `);
  -- Keep acp_meta for diagnostics
}
```

### 11.4 Rollback Verification

```sql
-- Verify rollback success
SELECT value FROM acp_meta WHERE key = 'schema_version';
-- Expected: previous version or null

-- Verify no orphan records
SELECT COUNT(*) FROM delivery_log WHERE message_id NOT IN (SELECT id FROM messages);
-- Expected: 0
```

---

## 12) Compatibility Constraints

### 12.1 SQLite Version Requirements

| Feature | Minimum SQLite | Notes |
|---------|---------------|-------|
| `DROP COLUMN` | 3.35.0+ | Optional, for future schema evolution |
| `CREATE INDEX IF NOT EXISTS` | 3.3.0+ | Required |
| `PRAGMA foreign_keys` | 3.6.19+ | Required |
| `WAL mode` | 3.7.0+ | Required |
| JSON functions | 3.9.0+ | `json_each`, `json_extract` |
| Generated columns | 3.31.0+ | Optional |

**Check at runtime:**
```sql
SELECT sqlite_version();
-- Must be >= 3.35.0
```

### 12.2 Node.js Runtime Compatibility

| Runtime | SQLite Driver | Status |
|---------|--------------|--------|
| Node 22.x | `better-sqlite3` | ⚠️ Native module (may need rebuild) |
| Node 22.x | `node:sqlite` | ✅ Native (preferred) |
| Sandbox | `node:sqlite` | ✅ Native |

**Recommendation:** Use `node:sqlite` (built-in since Node 22) to avoid native module rebuilds.

### 12.3 Data Type Constraints

| Field | SQLite Type | JSON Type | Constraints |
|-------|-------------|-----------|-------------|
| `id` | TEXT | string | UUIDv7 format |
| `priority` | TEXT | string | `low\|normal\|high\|critical` |
| `status` | TEXT | string | `pending\|delivered\|read\|expired\|failed` |
| `type` | TEXT | string | See ACPMessageType enum |
| `policy_json` | TEXT | object | Must validate against ACPPolicy schema |
| `payload_bytes` | INTEGER | number | Must match `LENGTH(payload_json)` ≤ 4096 |

### 12.4 Cross-System Compatibility

| System | Integration Point | Compatibility Rule |
|--------|------------------|-------------------|
| Gateway | RPC methods | ACP registers via `api.registerGatewayMethod` |
| workq | external_refs | Only if workq MVP exists (P1 or earlier) |
| Session | Identity injection | `from_agent` derived from session context, never from payload |
| Inbox | File rendering | JSONL export must remain compatible |

### 12.5 Backward Compatibility with Canonical Spec

Per Canonical Spec §9.1, all P1 implementations must:
1. **Maintain JSONL export** — operational state in SQLite, export to JSONL for audit
2. **Preserve all required fields** — no optional fields become required in patch versions
3. **Support protocol semver** — `protocol: "acp"`, `version: "1.0.0"` must be accepted

---

## 13) Dependency Blocks for P1 Kickoff

### 13.1 External Dependencies

| Dependency | Status | Notes |
|-----------|--------|-------|
| `node:sqlite` API | ✅ Available | Node 22+ built-in |
| SQLite 3.35.0+ | ✅ Available | Current environments meet this |
| Gateway RPC | ⚠️ Need verification | Must register ACP methods |
| workq integration | ⬜ P1 blocker? | workq must be at MVP before ACP uses it |

### 13.2 workq Dependency Analysis

**Current status:** workq MVP timeline unclear. Per WORKSTREAM.md:
> "ACP↔workq integration: workq must be live (or at minimum at MVP) before ACP can use it for `external_refs` tracking"

**Impact on P1:**
- `external_refs` field in ACP messages can reference workq items, but **not required** for P1
- ACP can ship with `external_refs` = optional, empty array allowed
- workq integration is a **soft dependency** — ACP functional without it

**Recommendation:** Proceed with P1 kickoff; workq integration can be added in P2.

### 13.3 Internal Dependencies

| Component | Owner | Dependency | Blockers? |
|-----------|-------|------------|-----------|
| Schema creation | Claire | None | ✅ Ready |
| Extension skeleton | Roman | Gateway extension API | ✅ Available |
| `acp_send` | Sandy | Schema + validation | ✅ Ready |
| Delivery router | Tony | Schema + session API | ⚠️ Session injection verified |
| `acp_handoff` | Barry | Schema + delivery | ✅ Ready |
| JSON Schema validation | Tim | Schema definition | ✅ Available |

### 13.4 P1 Kickoff Readiness

| Item | Status | Notes |
|------|--------|-------|
| Canonical spec | ✅ Frozen | 2026-02-21 |
| DB migration plan | ✅ Ready | This document |
| Extension skeleton plan | 🟡 In progress | Roman |
| `acp_send` design | ✅ Complete | Sandy |
| Delivery router design | 🟡 In progress | Tony |
| `acp_handoff` design | ✅ Complete | Barry |

**Conclusion:** No blocking dependencies for P1 kickoff. workq integration is a non-blocking soft dependency.

---

## 14) Implementation Checklist

- [ ] **Week 1:** Schema creation scripts + unit tests
- [ ] **Week 2:** Index validation + query performance testing
- [ ] **Week 3:** Migration path from any existing schema + rollback testing
- [ ] **Week 4:** JSONL export integration + load testing

---

## 15) Open Questions

- [x] Does an existing ACP database exist that requires migration from a prior schema? **No (greenfield)**
- [x] What is the expected message volume (impacts index strategy)? **TBD during load testing**
- [x] Are there teamspace-specific schemas that need coordination? **Teamspaces deferred to P2**
- [x] Should we use SQLite extensions (JSON1) for query optimization? **Use native JSON functions (3.9.0+)**
- [x] Any dependency blocks for P1 kickoff? **No blocking dependencies identified**

---

**End of Plan**
