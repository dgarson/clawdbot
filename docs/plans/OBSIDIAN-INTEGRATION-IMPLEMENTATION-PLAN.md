# Obsidian and OpenClaw Integration: Comprehensive Implementation Plan

> **Document:** `docs/plans/OBSIDIAN-INTEGRATION-IMPLEMENTATION-PLAN.md`  
> **Created:** 2026-02-08  
> **Author:** Claw (requested by David Garson)  
> **Priority:** Design Phase  
> **Status:** Greenfield — no existing implementation  
> **Companion Doc:** `docs/plans/NOTION-INTEGRATION-IMPLEMENTATION-PLAN.md`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Obsidian vs Notion: Architectural Comparison](#2-obsidian-vs-notion-architectural-comparison)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 1: Foundation - Vault Access and File System Bridge](#4-phase-1-foundation---vault-access-and-file-system-bridge)
5. [Phase 2: Outbound - MCP Tools (OpenClaw to Obsidian Vault)](#5-phase-2-outbound---mcp-tools-openclaw-to-obsidian-vault)
6. [Phase 3: Inbound - File System Watcher (Vault to OpenClaw)](#6-phase-3-inbound---file-system-watcher-vault-to-openclaw)
7. [Phase 4: Obsidian Specific Features - Links, Tags, Frontmatter](#7-phase-4-obsidian-specific-features---links-tags-frontmatter)
8. [Phase 5: Obsidian Plugin and Community Integration](#8-phase-5-obsidian-plugin-and-community-integration)
9. [Phase 6: Bidirectional Sync and Conflict Resolution](#9-phase-6-bidirectional-sync-and-conflict-resolution)
10. [Phase 7: End to End Workflows and Templates](#10-phase-7-end-to-end-workflows-and-templates)
11. [Phase 8: Polish - Observability, Edge Cases, and Tuning](#11-phase-8-polish---observability-edge-cases-and-tuning)
12. [Data Flow Diagrams](#12-data-flow-diagrams)
13. [Obsidian Vault Structure Reference](#13-obsidian-vault-structure-reference)
14. [Configuration Reference](#14-configuration-reference)
15. [File Map](#15-file-map)
16. [Testing Strategy](#16-testing-strategy)
17. [Debugging Guide](#17-debugging-guide)
18. [Security Considerations](#18-security-considerations)
19. [Risk Register and Mitigations](#19-risk-register-and-mitigations)
20. [Timeline and Dependencies](#20-timeline-and-dependencies)
21. [Success Criteria](#21-success-criteria)
22. [Comparison Matrix: Notion vs Obsidian Integration](#22-comparison-matrix-notion-vs-obsidian-integration)
23. [Appendices](#23-appendices)

---

## 1. Executive Summary

### Goal

Build a **production-grade, bidirectional integration** between Obsidian and OpenClaw that allows:

1. **Outbound (OpenClaw to Obsidian Vault):** Agents can read, create, update, search, and manage markdown files in an Obsidian vault — respecting Obsidian's vault-oriented storage paradigm, wiki-link conventions, YAML frontmatter, and plugin ecosystem.
2. **Inbound (Obsidian Vault to OpenClaw):** When files change in the vault (via Obsidian app or direct filesystem edits), changes are detected and flow into OpenClaw's memory ingest pipeline, knowledge graph, and agent context.

### Why Obsidian?

Obsidian is fundamentally different from Notion:

- **Local-first:** All data lives as plain Markdown files on disk — no cloud API needed for read/write
- **Vault-centric:** Everything is organized in a "vault" (a directory of `.md` files)
- **Link-centric:** Knowledge is connected via `[[wiki-links]]` and backlinks
- **Plugin-extensible:** Rich community plugin ecosystem, including REST API plugins
- **No vendor lock-in:** Files are plain Markdown; any tool can read/write them

This makes Obsidian integration both simpler (direct file access) and more complex (no official API, need to respect conventions, plugin bridge for sync).

### Key Design Principle

**Obsidian's vault is the source of truth.** OpenClaw reads from and writes to the vault filesystem directly (when co-located) or through a sync bridge (when remote). Unlike Notion where an API mediates all access, Obsidian's paradigm is fundamentally file-based.

### Integration Modes

| Mode                               | How It Works                                                       | When to Use                                                     |
| ---------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| **Direct Vault Access**            | OpenClaw reads/writes `.md` files directly on the local filesystem | Vault is on the same machine as OpenClaw                        |
| **Obsidian Local REST API Plugin** | OpenClaw connects to Obsidian's REST API plugin (localhost)        | Obsidian is running on the same machine with the plugin enabled |
| **Remote Sync Bridge**             | OpenClaw syncs with vault via Obsidian Sync / Git / Syncthing      | Vault is on a different machine (e.g., David's laptop)          |
| **OpenClaw Node Bridge**           | OpenClaw node app on David's device reads vault + sends to gateway | Vault is on David's mobile/laptop with OpenClaw node installed  |

---

## 2. Obsidian vs Notion: Architectural Comparison

Understanding the fundamental differences is critical for a correct design:

| Dimension             | Notion                                  | Obsidian                                          |
| --------------------- | --------------------------------------- | ------------------------------------------------- |
| **Storage**           | Cloud-hosted proprietary database       | Local filesystem (`.md` files)                    |
| **Access Model**      | REST API with OAuth/API key             | Direct file I/O or REST API plugin                |
| **Data Format**       | Proprietary JSON block model            | Standard Markdown + YAML frontmatter              |
| **Change Detection**  | Webhook events (HTTP POST)              | Filesystem watcher (`fs.watch` / `chokidar`)      |
| **Authentication**    | API key / OAuth2 tokens                 | None (filesystem access) or API key (REST plugin) |
| **Content Structure** | Blocks (paragraph, heading, list, etc.) | Markdown syntax                                   |
| **Metadata**          | Properties (typed fields per database)  | YAML frontmatter                                  |
| **Links**             | Page references by ID                   | `[[wiki-links]]` by filename                      |
| **Search**            | API-based full-text search              | Filesystem search / embedded search               |
| **Multi-device Sync** | Built-in (cloud)                        | Obsidian Sync / Git / Syncthing / iCloud          |
| **Rate Limits**       | 3 req/sec API limit                     | No limits (filesystem I/O)                        |
| **Offline Support**   | Limited                                 | Full (local-first)                                |
| **Plugin Ecosystem**  | Database automations only               | 1500+ community plugins                           |

### Implications for Integration Design

1. **No webhook equivalent** — We use filesystem watchers instead of HTTP webhooks
2. **No API key needed** for local vault access — but the REST API plugin needs one
3. **Markdown is native** — No block-to-text conversion needed; agents write Markdown directly
4. **Wiki-links are critical** — `[[wiki-links]]` links create the knowledge graph; must be preserved and understood
5. **Frontmatter is metadata** — YAML headers serve the same role as Notion properties
6. **No rate limits** — But filesystem I/O has its own considerations (batching, atomicity)
7. **Multi-device sync is the hard part** — Conflict resolution when both OpenClaw and Obsidian app edit the same file

---

## 3. Architecture Overview

### 3.1 System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                      OBSIDIAN VAULT (on disk)                        │
│                                                                      │
│  ~/vault/                                                            │
│  ├── daily/                  ┌────────────────────────────┐          │
│  │   ├── 2026-02-08.md       │  Obsidian App              │          │
│  │   └── 2026-02-07.md       │  (Desktop / Mobile)        │          │
│  ├── projects/               │                            │          │
│  │   ├── openclaw.md         │  ┌──────────────────────┐  │          │
│  │   └── meridia.md          │  │ Local REST API Plugin│  │          │
│  ├── meetings/               │  │ (localhost:27123)     │  │          │
│  │   └── standup-02-08.md    │  └──────────┬───────────┘  │          │
│  ├── inbox/                  │             │              │          │
│  │   └── quick-note.md       │             │              │          │
│  ├── templates/              └─────────────┼──────────────┘          │
│  │   └── daily-note.md                     │                         │
│  └── .obsidian/                            │  REST API (optional)    │
│      ├── plugins/                          │                         │
│      └── workspace.json                    │                         │
└──────────────────────┬─────────────────────┼─────────────────────────┘
                       │                     │
         ┌─────────────┼─────────────────────┼──────────────┐
         │ FILESYSTEM   │                     │  REST API    │
         │ WATCHER      │     DIRECT FILE     │  (if plugin  │
         │ (chokidar)   │     I/O             │   enabled)   │
         ▼              │                     ▼              │
┌────────────────────────────────────────────────────────────────────┐
│                      OPENCLAW GATEWAY                              │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Vault Filesystem Watcher                                   │    │
│  │  ┌─────────────────────────────────────────┐               │    │
│  │  │  chokidar / fs.watch                     │               │    │
│  │  │  ├─ Watch: *.md files in vault path      │               │    │
│  │  │  ├─ Debounce: 500ms                      │               │    │
│  │  │  ├─ Filter: ignore .obsidian/, .trash/   │               │    │
│  │  │  ├─ Detect: add / change / unlink        │               │    │
│  │  │  └─ Route event:                         │               │    │
│  │  │     ├─ add    → ingestMemory()           │               │    │
│  │  │     ├─ change → ingestMemory()           │               │    │
│  │  │     └─ unlink → logSystem()              │               │    │
│  │  └─────────────────────────────────────────┘               │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  MCP Tool Registry                                          │    │
│  │  ┌──────────────────────┐  ┌──────────────────────────┐    │    │
│  │  │  vault_search        │  │  vault_create_note       │    │    │
│  │  │  vault_read_note     │  │  vault_update_note       │    │    │
│  │  │  vault_list_notes    │  │  vault_append_to_note    │    │    │
│  │  │  vault_get_links     │  │  vault_delete_note       │    │    │
│  │  │  vault_get_tags      │  │  vault_move_note         │    │    │
│  │  │  vault_get_backlinks │  │  vault_get_frontmatter   │    │    │
│  │  │  vault_query         │  │  vault_set_frontmatter   │    │    │
│  │  └──────────────────────┘  └──────────────────────────┘    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Obsidian Content Parser                                    │    │
│  │  ├─ YAML frontmatter extraction                             │    │
│  │  ├─ Wiki-link resolution ([[page]] → file path)             │    │
│  │  ├─ Tag extraction (#tag, nested tags #project/openclaw)    │    │
│  │  ├─ Block reference extraction (^block-id)                  │    │
│  │  ├─ Embed resolution (![[embedded-note]])                   │    │
│  │  └─ Markdown → structured data conversion                  │    │
│  │  └────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Config                                                     │    │
│  │  obsidian:                                                  │    │
│  │    vaultPath: ~/Documents/ObsidianVault                     │    │
│  │    watchEnabled: true                                       │    │
│  │    watchDebounceMs: 500                                     │    │
│  │    excludePaths: [".obsidian", ".trash", "templates"]       │    │
│  │    restApiUrl: http://localhost:27123                        │    │
│  │    restApiKey: optional-api-key                              │    │
│  │    syncMode: direct | rest-api | node-bridge                │    │
│  │  └────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────┐  ┌───────────────────────────────┐      │
│  │  Memory Ingest       │  │  Knowledge Graph (Graphiti)    │      │
│  │  Pipeline            │  │  (wiki-link → graph edges)     │      │
│  └──────────────────────┘  └───────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 Integration Modes Deep Dive

#### Mode 1: Direct Vault Access (Preferred for Co-located)

```
OpenClaw Gateway ──── fs.readFile/writeFile ────> ~/vault/*.md
                 ──── chokidar.watch ────────────> ~/vault/
```

- **Fastest**: No network overhead
- **Simplest**: No additional services needed
- **Limitation**: Vault must be on same machine as gateway

#### Mode 2: Obsidian Local REST API Plugin

```
OpenClaw Gateway ──── HTTP GET/PUT/POST ────> localhost:27123/vault/*
```

- Uses the community plugin [obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api)
- **Advantage**: Works even if Obsidian manages the vault exclusively
- **Advantage**: Plugin provides search, read, write, list operations
- **Limitation**: Obsidian must be running with the plugin enabled

#### Mode 3: Remote Sync Bridge

```
David's Device                                    OpenClaw Gateway
┌──────────────┐                                  ┌──────────────┐
│ Obsidian Vault│ ──── Git/Syncthing/Sync ──────> │ Local Mirror  │
│ ~/vault/      │                                  │ ~/vault/      │
└──────────────┘                                  └──────────────┘
                                                   chokidar watches
                                                   the local mirror
```

- **Works across machines**: David edits on laptop, OpenClaw processes on server
- **Options**: Git (commit/push/pull), Syncthing (real-time P2P), Obsidian Sync (Obsidian's paid service), iCloud/Dropbox

#### Mode 4: OpenClaw Node Bridge

```
David's iPhone/Laptop                             OpenClaw Gateway
┌──────────────────────┐                          ┌──────────────┐
│ OpenClaw Node App     │ ── invoke commands ───> │ vault_* tools │
│ + Obsidian Vault      │ ← invoke responses ──── │               │
│ invoke: vault.read    │                          │               │
│ invoke: vault.write   │                          │               │
│ invoke: vault.search  │                          │               │
└──────────────────────┘                          └──────────────┘
```

- **Leverages existing OpenClaw node infrastructure**
- **Works for mobile**: David's iPhone has both Obsidian and OpenClaw node
- **Implementation**: Add `vault.*` invoke commands to the node app

---

## 4. Phase 1: Foundation - Vault Access and File System Bridge

### 4.1 Objective

Establish the foundational vault access layer that all subsequent phases build on.

### 4.2 Tasks

#### 4.2.1 Create Config Types

**File:** `src/config/types.obsidian.ts`

```typescript
import { Type, Static } from "@sinclair/typebox";

export const ObsidianConfigSchema = Type.Object({
  /** Enable/disable the Obsidian integration. */
  enabled: Type.Optional(Type.Boolean({ default: false })),

  /** Absolute or ~ path to the Obsidian vault root directory. */
  vaultPath: Type.Optional(Type.String()),

  /** Integration mode: how OpenClaw accesses the vault. */
  syncMode: Type.Optional(
    Type.Union(
      [
        Type.Literal("direct"), // Direct filesystem access
        Type.Literal("rest-api"), // Via Obsidian Local REST API plugin
        Type.Literal("node-bridge"), // Via OpenClaw node app on remote device
      ],
      { default: "direct" },
    ),
  ),

  /** Obsidian Local REST API plugin settings (for rest-api mode). */
  restApi: Type.Optional(
    Type.Object({
      /** URL of the REST API. Default: http://localhost:27123 */
      url: Type.Optional(Type.String({ default: "http://localhost:27123" })),
      /** API key for authentication (if configured in the plugin). */
      apiKey: Type.Optional(Type.String()),
    }),
  ),

  /** Node bridge settings (for node-bridge mode). */
  nodeBridge: Type.Optional(
    Type.Object({
      /** Node ID to use for vault operations. */
      nodeId: Type.Optional(Type.String()),
      /** Vault path on the remote device. */
      remoteVaultPath: Type.Optional(Type.String()),
    }),
  ),

  /** File watcher settings. */
  watcher: Type.Optional(
    Type.Object({
      /** Enable/disable file watching. Default: true */
      enabled: Type.Optional(Type.Boolean({ default: true })),
      /** Debounce interval in ms. Default: 500 */
      debounceMs: Type.Optional(Type.Number({ default: 500 })),
      /** File extensions to watch. Default: [".md"] */
      extensions: Type.Optional(Type.Array(Type.String(), { default: [".md"] })),
      /** Paths to exclude from watching (relative to vault root). */
      excludePaths: Type.Optional(
        Type.Array(Type.String(), {
          default: [".obsidian", ".trash", ".git", "node_modules"],
        }),
      ),
      /** Max file size to process (bytes). Default: 1MB */
      maxFileSize: Type.Optional(Type.Number({ default: 1048576 })),
    }),
  ),

  /** Memory ingest configuration. */
  memoryIngest: Type.Optional(
    Type.Object({
      /** Whether to ingest file changes into memory. Default: true */
      enabled: Type.Optional(Type.Boolean({ default: true })),
      /** Folders to ingest (relative to vault root). Empty = all. */
      includeFolders: Type.Optional(Type.Array(Type.String())),
      /** Folders to skip for memory ingest. */
      excludeFolders: Type.Optional(
        Type.Array(Type.String(), {
          default: ["templates", "archive"],
        }),
      ),
      /** Extract and index wiki-links as graph edges. Default: true */
      indexWikiLinks: Type.Optional(Type.Boolean({ default: true })),
      /** Extract and index tags. Default: true */
      indexTags: Type.Optional(Type.Boolean({ default: true })),
      /** Maximum content length for ingest (chars). Default: 50000 */
      maxContentLength: Type.Optional(Type.Number({ default: 50000 })),
    }),
  ),

  /** Default frontmatter to include when creating new notes. */
  defaultFrontmatter: Type.Optional(Type.Record(Type.String(), Type.Unknown())),

  /** Daily notes configuration. */
  dailyNotes: Type.Optional(
    Type.Object({
      /** Folder for daily notes. Default: "daily" */
      folder: Type.Optional(Type.String({ default: "daily" })),
      /** Date format for filenames. Default: "YYYY-MM-DD" */
      dateFormat: Type.Optional(Type.String({ default: "YYYY-MM-DD" })),
      /** Template file to use for new daily notes. */
      template: Type.Optional(Type.String()),
    }),
  ),
});

export type ObsidianConfig = Static<typeof ObsidianConfigSchema>;
```

#### 4.2.2 Create Vault Access Layer

**File:** `src/obsidian/vault-access.ts`

This is the abstraction layer that provides a consistent interface regardless of integration mode.

```typescript
export interface VaultFile {
  /** Relative path from vault root (e.g., "projects/openclaw.md") */
  path: string;
  /** File content (markdown) */
  content: string;
  /** Parsed YAML frontmatter */
  frontmatter: Record<string, unknown>;
  /** Body content (without frontmatter) */
  body: string;
  /** File stats */
  stats: {
    createdAt: Date;
    modifiedAt: Date;
    size: number;
  };
}

export interface VaultSearchResult {
  /** Relative path */
  path: string;
  /** Matching line numbers */
  matches: { line: number; text: string }[];
  /** Relevance score (0-1) */
  score: number;
}

export interface VaultAccessLayer {
  /** Read a file from the vault. */
  readFile(path: string): Promise<VaultFile | null>;

  /** Write a file to the vault (creates parent dirs if needed). */
  writeFile(path: string, content: string): Promise<void>;

  /** Append content to an existing file. */
  appendToFile(path: string, content: string): Promise<void>;

  /** Delete a file from the vault. */
  deleteFile(path: string): Promise<void>;

  /** Move/rename a file. */
  moveFile(oldPath: string, newPath: string): Promise<void>;

  /** List all files in the vault (or a subdirectory). */
  listFiles(directory?: string): Promise<string[]>;

  /** Full-text search across vault files. */
  search(
    query: string,
    options?: { folder?: string; extensions?: string[] },
  ): Promise<VaultSearchResult[]>;

  /** Check if a file exists. */
  exists(path: string): Promise<boolean>;

  /** Get vault root path. */
  getVaultPath(): string;
}
```

#### 4.2.3 Implement Direct Filesystem Backend

**File:** `src/obsidian/backends/direct.ts`

```typescript
import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import matter from "gray-matter";

export class DirectVaultAccess implements VaultAccessLayer {
  constructor(private vaultPath: string) {}

  async readFile(relativePath: string): Promise<VaultFile | null> {
    const fullPath = path.join(this.vaultPath, relativePath);
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const stats = await fs.stat(fullPath);
      const parsed = matter(content);

      return {
        path: relativePath,
        content,
        frontmatter: parsed.data as Record<string, unknown>,
        body: parsed.content,
        stats: {
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          size: stats.size,
        },
      };
    } catch {
      return null;
    }
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
  }

  async appendToFile(relativePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, relativePath);
    await fs.appendFile(fullPath, content, "utf-8");
  }

  // ... other methods
}
```

#### 4.2.4 Implement REST API Backend

**File:** `src/obsidian/backends/rest-api.ts`

Uses the [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin.

API endpoints:

- `GET /vault/{path}` — Read file content
- `PUT /vault/{path}` — Write file
- `PATCH /vault/{path}` — Append to file
- `DELETE /vault/{path}` — Delete file
- `GET /vault/` — List files
- `POST /search/simple/` — Full-text search
- `POST /search/` — JSON Logic search
- `GET /periodic/daily/` — Today's daily note

```typescript
export class RestApiVaultAccess implements VaultAccessLayer {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
    private vaultPath?: string,
  ) {}

  private async fetch(path: string, options?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/markdown",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });
  }

  async readFile(relativePath: string): Promise<VaultFile | null> {
    const res = await this.fetch(`/vault/${encodeURIComponent(relativePath)}`);
    if (!res.ok) return null;
    const content = await res.text();
    const parsed = matter(content);
    return {
      path: relativePath,
      content,
      frontmatter: parsed.data as Record<string, unknown>,
      body: parsed.content,
      stats: {
        /* from headers if available */
      },
    };
  }

  // ... other methods
}
```

#### 4.2.5 Implement Node Bridge Backend

**File:** `src/obsidian/backends/node-bridge.ts`

Leverages OpenClaw's existing node invoke infrastructure:

```typescript
export class NodeBridgeVaultAccess implements VaultAccessLayer {
  constructor(
    private nodeId: string,
    private remoteVaultPath: string,
    private invokeCommand: (nodeId: string, command: string, params: unknown) => Promise<unknown>,
  ) {}

  async readFile(relativePath: string): Promise<VaultFile | null> {
    const result = await this.invokeCommand(this.nodeId, "vault.read", {
      path: `${this.remoteVaultPath}/${relativePath}`,
    });
    // Parse response...
  }

  // ... other methods
}
```

### 4.3 Verification

- [ ] Direct backend can read a `.md` file from a test vault
- [ ] Direct backend can write a new `.md` file
- [ ] Frontmatter parsing extracts YAML correctly
- [ ] REST API backend connects to Obsidian plugin (when running)
- [ ] Config types compile without errors

### 4.4 Estimated Effort

**4–6 hours** — Vault access layer + 2 backends + config types.

---

## 5. Phase 2: Outbound - MCP Tools (OpenClaw to Obsidian Vault)

### 5.1 Objective

Create a comprehensive set of MCP tools that agents can use to interact with Obsidian vaults, respecting Obsidian conventions (wiki-links, frontmatter, tags).

### 5.2 Tool Inventory

#### Read Operations (R0 — read-only)

| Tool                    | Description                                                                       | Parameters                          |
| ----------------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
| `vault_search`          | Full-text search across vault files                                               | `query`, `folder?`, `limit?`        |
| `vault_read_note`       | Read a note's content (returns markdown + frontmatter)                            | `path`                              |
| `vault_list_notes`      | List notes in a folder or the entire vault                                        | `folder?`, `recursive?`, `pattern?` |
| `vault_get_frontmatter` | Get YAML frontmatter for a note                                                   | `path`                              |
| `vault_get_links`       | Get all outgoing `[[wiki-links]]` from a note                                     | `path`                              |
| `vault_get_backlinks`   | Find all notes that link TO a given note                                          | `noteName`                          |
| `vault_get_tags`        | Get all tags used in a note or across the vault                                   | `path?` (omit for vault-wide)       |
| `vault_query`           | Advanced query: find notes by frontmatter fields, tags, links, folder, date range | `filter` object                     |

#### Write Operations (R2 — write-external)

| Tool                    | Description                                              | Parameters                                     |
| ----------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `vault_create_note`     | Create a new markdown note with optional frontmatter     | `path`, `content`, `frontmatter?`, `template?` |
| `vault_update_note`     | Replace the entire content of a note                     | `path`, `content`                              |
| `vault_append_to_note`  | Append content to the end of a note                      | `path`, `content`, `section?`                  |
| `vault_set_frontmatter` | Update YAML frontmatter fields (merge, not replace)      | `path`, `fields`                               |
| `vault_delete_note`     | Move a note to `.trash/` (Obsidian convention) or delete | `path`, `permanent?`                           |
| `vault_move_note`       | Move/rename a note (updates backlinks if possible)       | `oldPath`, `newPath`                           |

### 5.3 Tool Specifications

#### `vault_search`

```typescript
{
  name: 'vault_search',
  description: 'Search for content across all notes in the Obsidian vault. ' +
    'Returns matching notes with relevant excerpts. ' +
    'Supports full-text search across markdown content and frontmatter.',
  parameters: {
    query: { type: 'string', description: 'Search query (full-text)' },
    folder: { type: 'string', description: 'Restrict search to this folder', optional: true },
    limit: { type: 'number', description: 'Max results (default: 20)', optional: true },
    tags: { type: 'array', items: 'string', description: 'Filter by tags', optional: true },
  },
  riskLevel: 'R0',
}
```

#### `vault_create_note`

```typescript
{
  name: 'vault_create_note',
  description: 'Create a new note in the Obsidian vault. ' +
    'Path should be relative to vault root (e.g., "projects/new-idea.md"). ' +
    'Supports YAML frontmatter and Obsidian template expansion. ' +
    'Use [[wiki-links]] in content to link to other notes.',
  parameters: {
    path: { type: 'string', description: 'Relative path for the new note (e.g., "meetings/standup-2026-02-08.md")' },
    content: { type: 'string', description: 'Markdown content of the note' },
    frontmatter: {
      type: 'object',
      description: 'YAML frontmatter fields (e.g., { tags: ["meeting"], date: "2026-02-08", status: "draft" })',
      optional: true,
    },
    template: { type: 'string', description: 'Template note path to use (from vault\'s templates folder)', optional: true },
  },
  riskLevel: 'R2',
}
```

#### `vault_query` (Advanced)

```typescript
{
  name: 'vault_query',
  description: 'Advanced query to find notes by frontmatter fields, tags, links, folder, or date range. ' +
    'Returns matching note paths with selected metadata.',
  parameters: {
    filter: {
      type: 'object',
      description: 'Query filter object',
      properties: {
        folder: { type: 'string', description: 'Restrict to folder' },
        tags: { type: 'array', items: 'string', description: 'Notes must have ALL these tags' },
        tagsAny: { type: 'array', items: 'string', description: 'Notes must have ANY of these tags' },
        linksTo: { type: 'string', description: 'Notes that link to this note name' },
        linkedFrom: { type: 'string', description: 'Notes linked from this note' },
        frontmatter: { type: 'object', description: 'Frontmatter field conditions (e.g., { status: "active" })' },
        modifiedAfter: { type: 'string', description: 'ISO date — only notes modified after this date' },
        modifiedBefore: { type: 'string', description: 'ISO date — only notes modified before this date' },
        namePattern: { type: 'string', description: 'Glob pattern for note names' },
      },
    },
    fields: { type: 'array', items: 'string', description: 'Frontmatter fields to return', optional: true },
    limit: { type: 'number', default: 50, optional: true },
  },
}
```

#### `vault_get_backlinks`

```typescript
{
  name: 'vault_get_backlinks',
  description: 'Find all notes in the vault that contain a [[wiki-link]] to the specified note. ' +
    'This is the inverse of vault_get_links — it shows what links TO a note.',
  parameters: {
    noteName: { type: 'string', description: 'Note name (without .md extension, e.g., "OpenClaw")' },
  },
}
```

### 5.4 Obsidian Content Parser

**File:** `src/obsidian/parser.ts`

A dedicated parser that understands Obsidian-specific markdown extensions:

```typescript
export interface ParsedNote {
  frontmatter: Record<string, unknown>;
  body: string;
  wikiLinks: WikiLink[];
  tags: string[];
  blockReferences: string[];
  embeds: string[];
  headings: { level: number; text: string; line: number }[];
}

export interface WikiLink {
  /** Target note name */
  target: string;
  /** Display alias (from [[target|alias]]) */
  alias?: string;
  /** Block/heading reference (from [[target#heading]] or [[target^block]]) */
  reference?: string;
  /** Position in source */
  line: number;
  column: number;
}

/**
 * Parse Obsidian-specific markdown content.
 */
export function parseObsidianNote(content: string): ParsedNote {
  const parsed = matter(content);

  return {
    frontmatter: parsed.data,
    body: parsed.content,
    wikiLinks: extractWikiLinks(parsed.content),
    tags: extractTags(parsed.content, parsed.data),
    blockReferences: extractBlockReferences(parsed.content),
    embeds: extractEmbeds(parsed.content),
    headings: extractHeadings(parsed.content),
  };
}

/** Extract [[wiki-links]], including aliases and block/heading refs. */
function extractWikiLinks(content: string): WikiLink[] {
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links: WikiLink[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const [, targetRaw, alias] = match;
    const [target, reference] = targetRaw.split(/[#^]/, 2);
    const line = content.substring(0, match.index).split("\n").length;

    links.push({
      target: target.trim(),
      alias: alias?.trim(),
      reference: reference?.trim(),
      line,
      column: match.index - content.lastIndexOf("\n", match.index) - 1,
    });
  }

  return links;
}

/** Extract #tags, including nested tags like #project/openclaw. */
function extractTags(content: string, frontmatter: Record<string, unknown>): string[] {
  const inlineTags = new Set<string>();
  const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/\-]*)/g;
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    inlineTags.add(match[1]);
  }

  // Also extract from frontmatter tags field
  if (Array.isArray(frontmatter.tags)) {
    for (const tag of frontmatter.tags) {
      if (typeof tag === "string") inlineTags.add(tag);
    }
  }

  return [...inlineTags];
}

/** Extract ![[embeds]] — notes or images embedded in the current note. */
function extractEmbeds(content: string): string[] {
  const regex = /!\[\[([^\]]+)\]\]/g;
  const embeds: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    embeds.add(match[1]);
  }
  return embeds;
}

/** Extract ^block-id references. */
function extractBlockReferences(content: string): string[] {
  const regex = /\^([a-zA-Z0-9-]+)$/gm;
  const refs: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}
```

### 5.5 Frontmatter Helper

```typescript
import matter from "gray-matter";

/**
 * Compose a markdown file with YAML frontmatter.
 */
export function composeNote(body: string, frontmatter?: Record<string, unknown>): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return body;
  }
  return matter.stringify(body, frontmatter);
}

/**
 * Merge new frontmatter fields into existing frontmatter.
 * Does not remove existing fields unless explicitly set to null.
 */
export function mergeFrontmatter(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
```

### 5.6 Tool Risk Classification

| Tool                    | Risk Level | Rationale                          |
| ----------------------- | ---------- | ---------------------------------- |
| `vault_search`          | R0         | Read-only                          |
| `vault_read_note`       | R0         | Read-only                          |
| `vault_list_notes`      | R0         | Read-only                          |
| `vault_get_frontmatter` | R0         | Read-only                          |
| `vault_get_links`       | R0         | Read-only                          |
| `vault_get_backlinks`   | R0         | Read-only                          |
| `vault_get_tags`        | R0         | Read-only                          |
| `vault_query`           | R0         | Read-only                          |
| `vault_create_note`     | R2         | Creates file on filesystem         |
| `vault_update_note`     | R2         | Modifies existing file             |
| `vault_append_to_note`  | R2         | Modifies existing file             |
| `vault_set_frontmatter` | R2         | Modifies existing file             |
| `vault_delete_note`     | R3         | Destructive — deletes/trashes file |
| `vault_move_note`       | R2         | Moves file, could break links      |

### 5.7 Verification

- [ ] All read tools return correct data from a test vault
- [ ] `vault_create_note` creates a properly formatted note with frontmatter
- [ ] `vault_search` finds notes by content
- [ ] `vault_get_backlinks` correctly identifies all notes linking to a target
- [ ] `vault_query` filters by tags, frontmatter, and date range
- [ ] Tool descriptions are clear and helpful for agents

### 5.8 Estimated Effort

**6–8 hours** — 14 tools + parser + frontmatter helpers.

---

## 6. Phase 3: Inbound - File System Watcher (Vault to OpenClaw)

### 6.1 Objective

Detect changes to vault files in real-time and route them through OpenClaw's ingest pipeline — the Obsidian equivalent of Notion's webhook system.

### 6.2 Design: Filesystem Watcher

Unlike Notion's HTTP webhooks, Obsidian changes are detected via filesystem watching. We use `chokidar` (or `node:fs/promises.watch`) to monitor the vault directory.

**File:** `src/obsidian/watcher.ts`

```typescript
import chokidar from "chokidar";
import path from "node:path";

export interface VaultWatcherOptions {
  vaultPath: string;
  debounceMs?: number;
  extensions?: string[];
  excludePaths?: string[];
  maxFileSize?: number;
  onFileChanged: (event: VaultFileEvent) => Promise<void>;
  log?: (msg: string) => void;
}

export interface VaultFileEvent {
  /** Event type */
  type: "created" | "modified" | "deleted" | "renamed";
  /** Relative path from vault root */
  path: string;
  /** Full absolute path */
  fullPath: string;
  /** File content (for created/modified, null for deleted) */
  content?: string;
  /** Parsed frontmatter (for created/modified) */
  frontmatter?: Record<string, unknown>;
  /** File size in bytes */
  size?: number;
  /** Modification timestamp */
  modifiedAt?: Date;
}

export function createVaultWatcher(options: VaultWatcherOptions): {
  start: () => void;
  stop: () => void;
} {
  const {
    vaultPath,
    debounceMs = 500,
    extensions = [".md"],
    excludePaths = [".obsidian", ".trash", ".git", "node_modules"],
    maxFileSize = 1048576,
    onFileChanged,
    log,
  } = options;

  // Build ignore patterns
  const ignored = excludePaths.map((p) => path.join(vaultPath, p));

  let watcher: chokidar.FSWatcher | null = null;

  // Debounce map: path → timeout
  const debounceMap = new Map<string, NodeJS.Timeout>();

  function debounced(filePath: string, callback: () => void): void {
    const existing = debounceMap.get(filePath);
    if (existing) clearTimeout(existing);
    debounceMap.set(
      filePath,
      setTimeout(() => {
        debounceMap.delete(filePath);
        callback();
      }, debounceMs),
    );
  }

  function shouldProcess(filePath: string): boolean {
    const ext = path.extname(filePath);
    if (!extensions.includes(ext)) return false;
    const relative = path.relative(vaultPath, filePath);
    return !excludePaths.some((p) => relative.startsWith(p));
  }

  async function handleChange(
    eventType: "created" | "modified" | "deleted",
    filePath: string,
  ): Promise<void> {
    if (!shouldProcess(filePath)) return;

    const relativePath = path.relative(vaultPath, filePath);

    let content: string | undefined;
    let frontmatter: Record<string, unknown> | undefined;
    let size: number | undefined;
    let modifiedAt: Date | undefined;

    if (eventType !== "deleted") {
      try {
        const stats = await fs.stat(filePath);
        if (stats.size > maxFileSize) {
          log?.(`vault watcher: skipping large file ${relativePath} (${stats.size} bytes)`);
          return;
        }
        size = stats.size;
        modifiedAt = stats.mtime;

        const raw = await fs.readFile(filePath, "utf-8");
        const parsed = matter(raw);
        content = raw;
        frontmatter = parsed.data;
      } catch {
        return; // File may have been deleted between event and read
      }
    }

    const event: VaultFileEvent = {
      type: eventType,
      path: relativePath,
      fullPath: filePath,
      content,
      frontmatter,
      size,
      modifiedAt,
    };

    log?.(`vault watcher: ${eventType} ${relativePath}`);

    await onFileChanged(event).catch((err) => {
      log?.(`vault watcher: handler error: ${String(err)}`);
    });
  }

  return {
    start() {
      watcher = chokidar.watch(vaultPath, {
        ignored,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: debounceMs,
          pollInterval: 100,
        },
      });

      watcher
        .on("add", (fp) => debounced(fp, () => handleChange("created", fp)))
        .on("change", (fp) => debounced(fp, () => handleChange("modified", fp)))
        .on("unlink", (fp) => debounced(fp, () => handleChange("deleted", fp)));

      log?.(`vault watcher: watching ${vaultPath}`);
    },

    stop() {
      if (watcher) {
        watcher.close();
        watcher = null;
        debounceMap.clear();
        log?.("vault watcher: stopped");
      }
    },
  };
}
```

### 6.3 Event Router

```typescript
export function createVaultEventRouter(deps: {
  ingestMemory: (params: {
    text: string;
    source: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  wakeSession?: (params: { text: string; mode: "now" | "next-heartbeat" }) => void;
  logSystem?: (msg: string) => void;
  addGraphitiMemory?: (params: { name: string; body: string; source: string }) => Promise<void>;
  log?: (msg: string) => void;
}): (event: VaultFileEvent) => Promise<void> {
  return async (event: VaultFileEvent) => {
    switch (event.type) {
      case "created":
      case "modified": {
        if (!event.content) break;

        // Ingest into memory
        await deps.ingestMemory({
          text: event.content,
          source: "obsidian-vault",
          metadata: {
            vaultPath: event.path,
            eventType: event.type,
            frontmatter: event.frontmatter,
            modifiedAt: event.modifiedAt?.toISOString(),
          },
        });

        // Optionally add to Graphiti for link-based knowledge graph
        if (deps.addGraphitiMemory && event.content) {
          await deps.addGraphitiMemory({
            name: `Obsidian: ${event.path}`,
            body: event.content,
            source: "obsidian-vault",
          });
        }

        break;
      }

      case "deleted": {
        deps.logSystem?.(`[vault] Note deleted: ${event.path}`);
        deps.wakeSession?.({
          text: `Note deleted from Obsidian vault: ${event.path}`,
          mode: "next-heartbeat",
        });
        break;
      }
    }
  };
}
```

### 6.4 Self-Authored Change Detection

When OpenClaw writes to the vault, it triggers the filesystem watcher. We need to filter these out:

```typescript
class VaultSelfAuthoredFilter {
  /** Tracks paths recently written by OpenClaw */
  private recentWrites = new Map<string, number>();
  private windowMs: number;

  constructor(windowMs = 3000) {
    this.windowMs = windowMs;
  }

  /** Call this BEFORE writing a file */
  markAsOurs(path: string): void {
    this.recentWrites.set(path, Date.now());
  }

  /** Call this when a watcher event fires — returns true if WE wrote it */
  isOurs(path: string): boolean {
    const ts = this.recentWrites.get(path);
    if (!ts) return false;
    if (Date.now() - ts < this.windowMs) {
      this.recentWrites.delete(path);
      return true;
    }
    this.recentWrites.delete(path);
    return false;
  }
}
```

### 6.5 Verification

- [ ] Watcher detects new `.md` files created in vault
- [ ] Watcher detects modifications to existing files
- [ ] Watcher detects file deletions
- [ ] Debouncing prevents duplicate events for rapid saves
- [ ] `.obsidian/` and `.trash/` directories are ignored
- [ ] Self-authored changes (via `vault_create_note`) are filtered out
- [ ] Memory ingest receives note content correctly

### 6.6 Estimated Effort

**3–5 hours** — Watcher + event router + self-authored filter.

---

## 7. Phase 4: Obsidian Specific Features - Links, Tags, Frontmatter

### 7.1 Objective

Build features unique to Obsidian's vault paradigm that have no Notion equivalent.

### 7.2 Wiki-Link Graph

Obsidian's power comes from `[[wiki-links]]` creating a knowledge graph. OpenClaw should understand and leverage this.

#### 7.2.1 Link Index

**File:** `src/obsidian/link-index.ts`

Build and maintain an in-memory index of all wiki-links in the vault:

```typescript
export interface LinkIndex {
  /** Forward links: note → notes it links to */
  forward: Map<string, Set<string>>;
  /** Backward links: note → notes that link to it */
  backward: Map<string, Set<string>>;
  /** All unique note names in the vault */
  allNotes: Set<string>;
  /** Tags index: tag → notes with that tag */
  tags: Map<string, Set<string>>;
}

export async function buildLinkIndex(vault: VaultAccessLayer): Promise<LinkIndex> {
  const index: LinkIndex = {
    forward: new Map(),
    backward: new Map(),
    allNotes: new Set(),
    tags: new Map(),
  };

  const files = await vault.listFiles();

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const note = await vault.readFile(file);
    if (!note) continue;

    const noteName = path.basename(file, ".md");
    index.allNotes.add(noteName);

    const parsed = parseObsidianNote(note.content);

    // Forward links
    const targets = new Set(parsed.wikiLinks.map((l) => l.target));
    index.forward.set(noteName, targets);

    // Backward links
    for (const target of targets) {
      if (!index.backward.has(target)) {
        index.backward.set(target, new Set());
      }
      index.backward.get(target)!.add(noteName);
    }

    // Tags
    for (const tag of parsed.tags) {
      if (!index.tags.has(tag)) {
        index.tags.set(tag, new Set());
      }
      index.tags.get(tag)!.add(noteName);
    }
  }

  return index;
}
```

#### 7.2.2 Incremental Index Updates

When the watcher detects a file change, update the index incrementally rather than rebuilding:

```typescript
export function updateLinkIndex(index: LinkIndex, event: VaultFileEvent): void {
  const noteName = path.basename(event.path, ".md");

  if (event.type === "deleted") {
    // Remove forward links
    const oldTargets = index.forward.get(noteName);
    if (oldTargets) {
      for (const target of oldTargets) {
        index.backward.get(target)?.delete(noteName);
      }
    }
    index.forward.delete(noteName);
    index.allNotes.delete(noteName);
    return;
  }

  if (event.content) {
    const parsed = parseObsidianNote(event.content);

    // Remove old forward links
    const oldTargets = index.forward.get(noteName);
    if (oldTargets) {
      for (const target of oldTargets) {
        index.backward.get(target)?.delete(noteName);
      }
    }

    // Set new forward links
    const newTargets = new Set(parsed.wikiLinks.map((l) => l.target));
    index.forward.set(noteName, newTargets);
    index.allNotes.add(noteName);

    // Update backward links
    for (const target of newTargets) {
      if (!index.backward.has(target)) {
        index.backward.set(target, new Set());
      }
      index.backward.get(target)!.add(noteName);
    }

    // Update tags
    // (remove old tags for this note, add new ones)
    for (const [tag, notes] of index.tags) {
      notes.delete(noteName);
    }
    for (const tag of parsed.tags) {
      if (!index.tags.has(tag)) {
        index.tags.set(tag, new Set());
      }
      index.tags.get(tag)!.add(noteName);
    }
  }
}
```

### 7.3 Wiki-Link to Graphiti Integration

Map Obsidian's wiki-link graph to OpenClaw's Graphiti knowledge graph:

```typescript
// When a note is ingested, create Graphiti nodes for linked entities
async function ingestNoteToGraphiti(
  note: VaultFile,
  parsed: ParsedNote,
  graphiti: GraphitiClient,
): Promise<void> {
  // Create/update a node for this note
  await graphiti.addMemory({
    name: `Note: ${path.basename(note.path, ".md")}`,
    body: note.content,
    source: "json",
    sourceDescription: `Obsidian vault note at ${note.path}`,
  });

  // Wiki-links become relationship edges in the knowledge graph
  // Graphiti's LLM-based extraction will identify entities naturally
  // from the markdown content including [[wiki-links]]
}
```

### 7.4 Tag System

Obsidian tags (`#tag`, `#project/openclaw`, nested tags) should be:

- Extracted during ingest
- Searchable via `vault_query`
- Mapped to categories in memory

### 7.5 Daily Notes Support

Special handling for Obsidian's daily notes pattern:

```typescript
export function getDailyNotePath(
  date: Date,
  folder: string = "daily",
  format: string = "YYYY-MM-DD",
): string {
  const formatted = formatDate(date, format);
  return `${folder}/${formatted}.md`;
}

// Tool: vault_daily_note — get or create today's daily note
export function createVaultDailyNoteTool(opts: {
  vault: VaultAccessLayer;
  config: ObsidianConfig;
}) {
  return {
    name: "vault_daily_note",
    description: "Get or create today's daily note. Creates from template if configured.",
    handler: async () => {
      const notePath = getDailyNotePath(new Date(), opts.config.dailyNotes?.folder);
      const existing = await opts.vault.readFile(notePath);

      if (existing) return existing;

      // Create from template
      const template = opts.config.dailyNotes?.template;
      let content = `# ${new Date().toLocaleDateString()}\n\n`;

      if (template) {
        const tmpl = await opts.vault.readFile(template);
        if (tmpl) {
          content = tmpl.body
            .replace(/{{date}}/g, new Date().toISOString().split("T")[0])
            .replace(/{{title}}/g, new Date().toLocaleDateString());
        }
      }

      await opts.vault.writeFile(notePath, content);
      return opts.vault.readFile(notePath);
    },
  };
}
```

### 7.6 Verification

- [ ] Link index correctly maps forward and backward links
- [ ] Incremental updates work when files are added/modified/deleted
- [ ] `vault_get_backlinks` uses the link index for fast lookups
- [ ] Tags are extracted from both inline `#tags` and frontmatter `tags:` array
- [ ] Daily note tool creates and reads notes correctly

### 7.7 Estimated Effort

**4–6 hours** — Link index + Graphiti mapping + daily notes.

---

## 8. Phase 5: Obsidian Plugin and Community Integration

### 8.1 Objective

Provide a deeper integration with Obsidian through plugins, enabling features that plain file access cannot provide.

### 8.2 Option A: Use Existing Community Plugin

**Obsidian Local REST API Plugin** ([GitHub](https://github.com/coddingtonbear/obsidian-local-rest-api))

This plugin provides a REST API on `localhost:27123` with endpoints for:

- Reading/writing vault files
- Full-text search
- Opening notes in Obsidian
- Getting periodic notes (daily/weekly/monthly/quarterly/yearly)
- Creating new notes
- Listing/navigating vault structure

**Setup:**

1. Install "Local REST API" from Obsidian Community Plugins
2. Enable the plugin
3. Copy the API key from plugin settings
4. Set in OpenClaw config:
   ```yaml
   obsidian:
     syncMode: rest-api
     restApi:
       url: http://localhost:27123
       apiKey: "your-api-key"
   ```

### 8.3 Option B: Build Custom OpenClaw Obsidian Plugin

A custom Obsidian plugin specifically designed for OpenClaw integration:

**Features beyond what REST API provides:**

- Real-time change streaming (WebSocket/SSE)
- Cursor position and active note tracking
- Command palette integration ("Send to Claw", "Ask Claw about this")
- Status bar widget showing OpenClaw connection state
- Sidebar panel for agent interactions
- Selection-aware context (highlight text → send to agent)

**Plugin Architecture:**

```
obsidian-openclaw-plugin/
├── manifest.json
├── main.ts
├── src/
│   ├── plugin.ts          # Main plugin class
│   ├── websocket.ts       # WebSocket connection to OpenClaw gateway
│   ├── commands.ts        # Command palette commands
│   ├── views/
│   │   ├── sidebar.ts     # Sidebar panel view
│   │   └── status-bar.ts  # Status bar widget
│   ├── events/
│   │   ├── file-change.ts # File change event streaming
│   │   └── active-note.ts # Active note tracking
│   └── settings.ts        # Plugin settings
└── styles.css
```

**This is a Phase 5+ feature** — not required for MVP but enables the richest possible integration.

### 8.4 Option C: Node Bridge Mode

If David's Obsidian vault is on his iPhone/iPad or a separate laptop, the OpenClaw node app can serve as a bridge:

```typescript
// iOS/macOS node app adds vault invoke commands:
registerInvokeCommand("vault.read", async (params) => {
  const content = await FileManager.readFile(params.path);
  return { content, exists: true };
});

registerInvokeCommand("vault.write", async (params) => {
  await FileManager.writeFile(params.path, params.content);
  return { success: true };
});

registerInvokeCommand("vault.search", async (params) => {
  // Use Spotlight / filesystem search
  const results = await spotlightSearch(params.query, vaultPath);
  return { results };
});

registerInvokeCommand("vault.watch", async (params) => {
  // Start FS event stream, send changes to gateway
  startFSEventStream(vaultPath, (event) => {
    sendToGateway("vault.change", event);
  });
});
```

### 8.5 Estimated Effort

- **Option A (REST API plugin):** 2–3 hours (just config + backend adapter)
- **Option B (Custom plugin):** 20–30 hours (full Obsidian plugin development)
- **Option C (Node bridge):** 4–6 hours (invoke commands in existing node app)

---

## 9. Phase 6: Bidirectional Sync and Conflict Resolution

### 9.1 Objective

Handle the complex case where both Obsidian (human) and OpenClaw (agent) modify the same files, potentially concurrently.

### 9.2 Conflict Scenarios

| Scenario                                      | Resolution Strategy                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| Human edits note → OpenClaw detects change    | **No conflict** — watcher ingests the change                               |
| Agent creates new note → watcher fires        | **Self-authored filter** — agent marks path, watcher skips                 |
| Human and agent edit different notes          | **No conflict** — independent operations                                   |
| Human and agent edit same note simultaneously | **Last-write-wins** with backup — see below                                |
| Human edits note while agent is appending     | **Section-based merge** — agent appends to end, human edits do not overlap |

### 9.3 Conflict Resolution Strategy

#### Strategy 1: Append-Only Agent Writes (Recommended for MVP)

The agent only **appends** to notes (using `vault_append_to_note`), never replaces entire content. This eliminates most conflicts since the human's edits and the agent's additions are in different parts of the file.

#### Strategy 2: Shadow Copy + Merge

For cases where the agent needs to update content:

1. Before writing, snapshot the current file
2. Write the updated content
3. If the file was modified between snapshot and write (detected via mtime), create a `.conflict` backup
4. Log a warning for human review

```typescript
async function safeWrite(
  vault: VaultAccessLayer,
  path: string,
  content: string,
  expectedMtime?: Date,
): Promise<{ success: boolean; conflict: boolean }> {
  const existing = await vault.readFile(path);

  if (existing && expectedMtime) {
    if (existing.stats.modifiedAt.getTime() !== expectedMtime.getTime()) {
      // File was modified since we last read it — conflict!
      const conflictPath = path.replace(".md", `.conflict-${Date.now()}.md`);
      await vault.writeFile(conflictPath, existing.content);
      // Still write our version (last-write-wins)
      await vault.writeFile(path, content);
      return { success: true, conflict: true };
    }
  }

  await vault.writeFile(path, content);
  return { success: true, conflict: false };
}
```

#### Strategy 3: Dedicated Agent Folder

Agent writes go to a dedicated folder (e.g., `vault/openclaw/`) that the human does not edit directly. This completely eliminates conflicts.

### 9.4 Sync State Tracking

```typescript
interface VaultSyncState {
  /** Last known mtime for each file */
  mtimes: Map<string, number>;
  /** Files currently being written by the agent */
  pendingWrites: Set<string>;
  /** Last sync timestamp */
  lastSync: Date;
}
```

### 9.5 Estimated Effort

**3–4 hours** — Conflict resolution + sync state tracking.

---

## 10. Phase 7: End to End Workflows and Templates

### 10.1 Workflow 1: Vault to Memory Sync

**Trigger:** David writes a note in Obsidian  
**Flow:**

1. Watcher detects the new/changed `.md` file
2. Content is parsed (frontmatter, body, wiki-links, tags)
3. Content ingested into memory pipeline
4. Wiki-links are mapped to Graphiti edges
5. Agent's next session has full context

### 10.2 Workflow 2: Agent to Vault Report Publishing

**Trigger:** Agent completes research or analysis  
**Flow:**

1. Agent uses `vault_create_note` with path `reports/2026-02-08-notion-plan.md`
2. Note is created with proper frontmatter (`status: published`, `tags: [report, notion]`)
3. Body includes `[[wiki-links]]` to related notes
4. David sees the note in Obsidian with all links and tags

### 10.3 Workflow 3: Daily Note Enhancement

**Trigger:** David creates today's daily note  
**Flow:**

1. Watcher detects `daily/2026-02-08.md` creation
2. Agent wakes and appends: weather, calendar summary, pending tasks, memory highlights
3. All additions go to a `## Claw Notes` section at the bottom

### 10.4 Workflow 4: Knowledge Graph Exploration

**Trigger:** David asks "what's connected to the Meridia project?"  
**Flow:**

1. Agent uses `vault_get_backlinks("Meridia")`
2. Gets all notes linking to `[[Meridia]]`
3. For each linked note, reads content and summarizes
4. Presents a knowledge map to David

### 10.5 Workflow 5: Meeting Notes to Tasks

**Trigger:** David saves meeting notes with `#meeting` tag  
**Flow:**

1. Watcher detects change to a file with `#meeting` tag
2. Agent reads the note, identifies action items
3. Creates task notes in `tasks/` folder with `[[meeting-note]]` backlinks
4. Optionally creates work items in OpenClaw work queue

### 10.6 Templates

```typescript
const VAULT_TEMPLATES = {
  "daily-note": {
    path: "daily/{{date}}.md",
    frontmatter: {
      tags: ["daily"],
      date: "{{date}}",
    },
    content: `# {{date}}

## Tasks
- [ ] 

## Notes


## Claw Notes
<!-- Agent-managed section -->
`,
  },

  "project-note": {
    path: "projects/{{name}}.md",
    frontmatter: {
      tags: ["project"],
      status: "active",
      created: "{{date}}",
    },
    content: `# {{name}}

## Overview


## Goals
- 

## Links
- 

## Progress


## Related
`,
  },

  "meeting-note": {
    path: "meetings/{{date}}-{{title}}.md",
    frontmatter: {
      tags: ["meeting"],
      date: "{{date}}",
      attendees: [],
    },
    content: `# {{title}}

**Date:** {{date}}
**Attendees:** 

## Agenda


## Notes


## Action Items
- [ ] 

## Decisions


`,
  },
};
```

### 10.7 Estimated Effort

**4–6 hours** — Workflows + templates + daily note integration.

---

## 11. Phase 8: Polish - Observability, Edge Cases, and Tuning

### 11.1 Observability

#### Metrics

```
vault.watcher.events_total (counter, labels: event_type)
vault.watcher.events_processed_total (counter)
vault.watcher.events_dropped_total (counter, labels: reason)
vault.tools.calls_total (counter, labels: tool_name)
vault.tools.duration_ms (histogram)
vault.sync.files_indexed (gauge)
vault.sync.links_indexed (gauge)
vault.sync.tags_indexed (gauge)
```

#### Health Check

```json
{
  "obsidian": {
    "enabled": true,
    "syncMode": "direct",
    "vaultPath": "~/Documents/ObsidianVault",
    "watcherActive": true,
    "lastChangeAt": "2026-02-08T18:30:00.000Z",
    "filesIndexed": 342,
    "linksIndexed": 1247,
    "tagsIndexed": 89
  }
}
```

### 11.2 Edge Cases

| Edge Case                            | Handling                                                   |
| ------------------------------------ | ---------------------------------------------------------- |
| Vault path does not exist            | Log error, disable integration, suggest config fix         |
| File permissions denied              | Skip file, log warning, continue processing others         |
| Binary files in vault                | Extension filter skips non-`.md` files                     |
| Symbolic links in vault              | Follow symlinks by default; option to skip                 |
| Very large vault (10K+ files)        | Lazy loading; initial index build is async; tools paginate |
| Concurrent file writes               | Atomic writes with temp file + rename                      |
| Frontmatter parsing error            | Fall back to raw content without frontmatter               |
| Wiki-link target does not exist      | Index as dangling link; do not error                       |
| File encoding issues                 | Default to UTF-8; skip non-UTF-8 files                     |
| Vault path changes (USB drive, etc.) | Watch for path availability; auto-reconnect                |
| `.obsidian/workspace.json` changes   | Filtered out by exclude paths                              |

### 11.3 Tuning Knobs

| Knob                  | Config Path                            | Default                           | Description                    |
| --------------------- | -------------------------------------- | --------------------------------- | ------------------------------ |
| Enable/disable        | `obsidian.enabled`                     | `false`                           | Master switch                  |
| Vault path            | `obsidian.vaultPath`                   | —                                 | Path to Obsidian vault         |
| Sync mode             | `obsidian.syncMode`                    | `direct`                          | How to access the vault        |
| Watch enabled         | `obsidian.watcher.enabled`             | `true`                            | Enable file watching           |
| Watch debounce        | `obsidian.watcher.debounceMs`          | `500`                             | Debounce interval              |
| Exclude paths         | `obsidian.watcher.excludePaths`        | `[".obsidian", ".trash", ".git"]` | Paths to ignore                |
| Max file size         | `obsidian.watcher.maxFileSize`         | `1MB`                             | Skip files larger than this    |
| Memory ingest enabled | `obsidian.memoryIngest.enabled`        | `true`                            | Ingest changes to memory       |
| Include folders       | `obsidian.memoryIngest.includeFolders` | `[]` (all)                        | Only ingest from these folders |
| Exclude folders       | `obsidian.memoryIngest.excludeFolders` | `["templates", "archive"]`        | Skip these for ingest          |
| Index wiki-links      | `obsidian.memoryIngest.indexWikiLinks` | `true`                            | Build link index               |
| Index tags            | `obsidian.memoryIngest.indexTags`      | `true`                            | Build tag index                |
| Daily notes folder    | `obsidian.dailyNotes.folder`           | `"daily"`                         | Where daily notes live         |
| Daily notes format    | `obsidian.dailyNotes.dateFormat`       | `"YYYY-MM-DD"`                    | Filename date format           |

### 11.4 Estimated Effort

**3–4 hours** — Observability + edge case handling + tuning.

---

## 12. Data Flow Diagrams

### 12.1 Inbound Flow (Vault to OpenClaw)

```
Obsidian App (David edits a note)
  │
  ▼
Filesystem change detected by chokidar
  │
  ├── .obsidian/ or .trash/ → IGNORED
  ├── Non-*.md file → IGNORED
  ├── Self-authored (by OpenClaw) → FILTERED
  │
  ▼ (debounced, 500ms)
Read file content
  │
  ├── Parse YAML frontmatter
  ├── Extract [[wiki-links]]
  ├── Extract #tags
  ├── Extract headings
  │
  ▼
Route event
  │
  ├── created/modified → Memory Ingest Pipeline
  │                      └── Graphiti (wiki-links → edges)
  │
  └── deleted → System Log + Wake Session
```

### 12.2 Outbound Flow (OpenClaw to Vault)

```
Agent decides to write to Obsidian vault
  │
  ▼
vault_create_note / vault_update_note / vault_append_to_note
  │
  ├── Compose markdown (body + frontmatter)
  ├── Mark path as self-authored (watcher filter)
  │
  ▼
VaultAccessLayer.writeFile()
  │
  ├── Direct: fs.writeFile()
  ├── REST API: PUT /vault/{path}
  └── Node Bridge: invoke vault.write
  │
  ▼
File appears in Obsidian vault
David sees it in Obsidian app (auto-refreshes)
```

---

## 13. Obsidian Vault Structure Reference

### 13.1 Typical Vault Layout

```
vault/
├── .obsidian/               # Obsidian config (EXCLUDED from processing)
│   ├── plugins/
│   ├── themes/
│   ├── workspace.json
│   ├── app.json
│   └── core-plugins.json
├── .trash/                  # Obsidian's trash (EXCLUDED)
├── daily/                   # Daily notes
│   ├── 2026-02-08.md
│   └── 2026-02-07.md
├── projects/                # Project notes
│   ├── openclaw.md
│   └── meridia.md
├── meetings/                # Meeting notes
│   └── standup-02-08.md
├── people/                  # People notes (CRM-style)
│   └── david-garson.md
├── inbox/                   # Quick capture
│   └── random-idea.md
├── templates/               # Templates (EXCLUDED from ingest)
│   ├── daily-note.md
│   ├── meeting-note.md
│   └── project-note.md
├── archive/                 # Archived notes (EXCLUDED from ingest)
│   └── old-project.md
├── attachments/             # Images, PDFs, etc.
│   └── screenshot.png
└── openclaw/                # Agent-managed folder
    ├── reports/
    ├── research/
    └── tasks/
```

### 13.2 Note Anatomy

```markdown
---
tags: [project, active]
status: in-progress
created: 2026-02-08
related: [[Meridia]], [[OpenClaw]]
---

# Project Name

## Overview

This is a project about...

## Related Notes

- [[Meridia]] — the experiential continuity system
- [[David Garson]] — project lead
- See also: [[Meeting Notes 2026-02-08]]

## Tasks

- [ ] First task #todo
- [x] Completed task #done

## Tags

#project/openclaw #ai #integration

Some text with a ^block-reference

![[embedded-image.png]]
```

---

## 14. Configuration Reference

### 14.1 Complete Configuration Schema

```yaml
obsidian:
  # Master switch
  enabled: true

  # Vault location
  vaultPath: "~/Documents/ObsidianVault"

  # Access mode
  syncMode: "direct" # "direct" | "rest-api" | "node-bridge"

  # REST API plugin settings (for rest-api mode)
  restApi:
    url: "http://localhost:27123"
    apiKey: "optional-api-key"

  # Node bridge settings (for node-bridge mode)
  nodeBridge:
    nodeId: "davids-iphone"
    remoteVaultPath: "/var/mobile/Documents/ObsidianVault"

  # File watcher
  watcher:
    enabled: true
    debounceMs: 500
    extensions: [".md"]
    excludePaths: [".obsidian", ".trash", ".git", "node_modules"]
    maxFileSize: 1048576 # 1MB

  # Memory ingest
  memoryIngest:
    enabled: true
    includeFolders: [] # Empty = all
    excludeFolders: ["templates", "archive"]
    indexWikiLinks: true
    indexTags: true
    maxContentLength: 50000

  # Default frontmatter for new notes
  defaultFrontmatter:
    source: "openclaw"

  # Daily notes
  dailyNotes:
    folder: "daily"
    dateFormat: "YYYY-MM-DD"
    template: "templates/daily-note.md"
```

### 14.2 Environment Variables

| Variable                | Required         | Description                 |
| ----------------------- | ---------------- | --------------------------- |
| `OBSIDIAN_VAULT_PATH`   | Yes (if enabled) | Path to Obsidian vault      |
| `OBSIDIAN_REST_API_KEY` | No               | API key for REST API plugin |
| `OBSIDIAN_REST_API_URL` | No               | URL for REST API plugin     |

---

## 15. File Map

### 15.1 Files to Create

| File                                   | Purpose                                             | Phase   |
| -------------------------------------- | --------------------------------------------------- | ------- |
| `src/config/types.obsidian.ts`         | Config TypeBox schema                               | Phase 1 |
| `src/obsidian/vault-access.ts`         | Vault access interface                              | Phase 1 |
| `src/obsidian/backends/direct.ts`      | Direct filesystem backend                           | Phase 1 |
| `src/obsidian/backends/rest-api.ts`    | REST API plugin backend                             | Phase 1 |
| `src/obsidian/backends/node-bridge.ts` | Node bridge backend                                 | Phase 5 |
| `src/obsidian/parser.ts`               | Obsidian markdown parser (wiki-links, tags, embeds) | Phase 2 |
| `src/obsidian/frontmatter.ts`          | Frontmatter compose/merge helpers                   | Phase 2 |
| `src/obsidian/tools/`                  | MCP tool implementations (14 tools)                 | Phase 2 |
| `src/obsidian/tools/index.ts`          | Tool barrel export + `createVaultTools()`           | Phase 2 |
| `src/obsidian/watcher.ts`              | Filesystem watcher (chokidar)                       | Phase 3 |
| `src/obsidian/event-router.ts`         | Event routing (memory/wake/system)                  | Phase 3 |
| `src/obsidian/self-authored-filter.ts` | Self-authored change detection                      | Phase 3 |
| `src/obsidian/link-index.ts`           | Wiki-link forward/backward index                    | Phase 4 |
| `src/obsidian/startup.ts`              | Gateway startup wiring                              | Phase 4 |
| `src/obsidian/sync-state.ts`           | Sync state tracking                                 | Phase 6 |
| `src/obsidian/conflict-resolver.ts`    | Conflict resolution logic                           | Phase 6 |
| `skills/obsidian/SKILL.md`             | Agent skill reference                               | Phase 2 |
| `docs/OBSIDIAN-INTEGRATION-SETUP.md`   | Setup guide                                         | Phase 1 |

### 15.2 Dependencies

```json
{
  "chokidar": "^4.0.0", // Filesystem watching
  "gray-matter": "^4.0.3", // YAML frontmatter parsing
  "glob": "^11.0.0" // File globbing
}
```

---

## 16. Testing Strategy

### 16.1 Unit Tests

| Test File                              | Coverage                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `src/obsidian/parser.test.ts`          | Wiki-link extraction, tag extraction, embed extraction, heading extraction |
| `src/obsidian/frontmatter.test.ts`     | Compose, merge, parse, edge cases (empty, invalid YAML)                    |
| `src/obsidian/link-index.test.ts`      | Build, update, forward/backward lookups                                    |
| `src/obsidian/watcher.test.ts`         | File events, debouncing, filtering, self-authored detection                |
| `src/obsidian/backends/direct.test.ts` | Read, write, delete, list, search                                          |
| `src/obsidian/tools/*.test.ts`         | Each tool: parameter validation, response formatting                       |

### 16.2 Integration Tests

| Test           | Description                                                 |
| -------------- | ----------------------------------------------------------- |
| Vault E2E      | Create a temp vault → write files → read back → verify      |
| Watcher E2E    | Start watcher → create file → verify event fires            |
| Link Index E2E | Build index from test vault → verify forward/backward links |
| Tool E2E       | All 14 tools against a test vault                           |

### 16.3 Test Vault Fixture

Create a small test vault in `test/fixtures/obsidian-vault/` with:

- Daily notes
- Project notes with wiki-links
- Notes with various frontmatter
- Nested folders
- Template files
- Files with tags

---

## 17. Debugging Guide

### 17.1 Common Issues

| Symptom                      | Likely Cause                     | Fix                                                        |
| ---------------------------- | -------------------------------- | ---------------------------------------------------------- |
| Watcher does not fire        | Vault path incorrect             | Verify `OBSIDIAN_VAULT_PATH` resolves to actual vault      |
| Duplicate memory entries     | Debounce too short               | Increase `watcher.debounceMs`                              |
| Agent writes trigger watcher | Self-authored filter not working | Check `markAsOurs()` is called before writes               |
| REST API returns 401         | API key wrong                    | Check `OBSIDIAN_REST_API_KEY` matches plugin config        |
| REST API returns 404         | Obsidian not running             | Start Obsidian with REST API plugin enabled                |
| Frontmatter not parsed       | Invalid YAML syntax              | Check for tabs (use spaces), colons in values (quote them) |
| Wiki-links not detected      | Non-standard link format         | Check for `[[link]]` pattern; exclude bare URLs            |
| Large vault slow to index    | Too many files                   | Use `includeFolders` to limit scope                        |

### 17.2 Diagnostic Commands

```bash
# Verify vault path
ls -la "$OBSIDIAN_VAULT_PATH"

# Count markdown files
find "$OBSIDIAN_VAULT_PATH" -name "*.md" | wc -l

# Test frontmatter parsing
head -20 "$OBSIDIAN_VAULT_PATH/projects/openclaw.md"

# Check REST API
curl -s http://localhost:27123/vault/ \
  -H "Authorization: Bearer $OBSIDIAN_REST_API_KEY" | jq '.files | length'

# Watch filesystem events (debug)
fswatch -r "$OBSIDIAN_VAULT_PATH" --include='\.md$'
```

---

## 18. Security Considerations

### 18.1 File System Access

- Agent has read/write access to the vault directory
- **Scope limitation:** Agent should NOT write outside the vault path
- **Path traversal prevention:** All paths must be validated as within vault root
- Symlinks should be checked to prevent escaping vault boundary

```typescript
function isWithinVault(vaultPath: string, targetPath: string): boolean {
  const resolved = path.resolve(vaultPath, targetPath);
  return resolved.startsWith(path.resolve(vaultPath));
}
```

### 18.2 Content Sensitivity

- Vault may contain private notes (journals, passwords, etc.)
- Consider folder-level access control (agent can only read/write certain folders)
- Config option: `obsidian.memoryIngest.excludeFolders: ["private", "journal"]`

### 18.3 Agent Write Boundaries

- Agent writes should be clearly marked (frontmatter: `source: openclaw`)
- Dedicated agent folder (`vault/openclaw/`) limits blast radius
- `vault_delete_note` should default to trash, not permanent delete

---

## 19. Risk Register and Mitigations

| Risk                                          | Impact                        | Probability | Mitigation                                                 |
| --------------------------------------------- | ----------------------------- | ----------- | ---------------------------------------------------------- |
| File corruption from concurrent writes        | Data loss                     | Low         | Atomic writes (temp + rename); conflict detection          |
| Obsidian re-indexes on external file changes  | Performance                   | Medium      | Debounce writes; batch operations                          |
| Very large vaults (50K+ files)                | Slow startup, memory pressure | Low         | Lazy indexing; pagination; folder filtering                |
| Vault on network drive (NFS, SMB)             | Slow I/O, unreliable watching | Medium      | Use polling mode in chokidar; longer debounce              |
| Multi-device sync conflicts                   | Inconsistent state            | Medium      | Append-only agent writes; dedicated agent folder           |
| Obsidian settings changes break integration   | Tools fail silently           | Low         | Health check verifies vault structure                      |
| Frontmatter format changes (Obsidian updates) | Parser breaks                 | Low         | gray-matter handles standard YAML; test against edge cases |
| Path with special characters                  | File I/O errors               | Medium      | URL-encode paths; normalize Unicode                        |

---

## 20. Timeline and Dependencies

### 20.1 Implementation Timeline

```
Phase 1: Foundation (Vault Access)             ─── 4-6 hours  ─── No deps
Phase 2: Outbound (MCP Tools)                  ─── 6-8 hours  ─── After Phase 1
Phase 3: Inbound (Watcher)                     ─── 3-5 hours  ─── After Phase 1
Phase 4: Obsidian Features (Links, Tags, etc.) ─── 4-6 hours  ─── After Phase 2+3
Phase 5: Plugin / Community Integration        ─── 2-6 hours  ─── After Phase 2 (optional)
Phase 6: Sync and Conflict Resolution          ─── 3-4 hours  ─── After Phase 3
Phase 7: End to End Workflows and Templates    ─── 4-6 hours  ─── After Phase 4
Phase 8: Polish and Observability              ─── 3-4 hours  ─── After Phase 4
                                                 ────────────
                                                 Total: 29-45 hours
```

**Phases 2 and 3 can run in parallel** after Phase 1.

### 20.2 Dependencies

- Obsidian vault exists at a known path
- For REST API mode: Obsidian running with Local REST API plugin
- For Node Bridge mode: OpenClaw node app installed on target device
- `chokidar`, `gray-matter`, `glob` npm packages

### 20.3 Priority Order

1. **Phase 1** — Vault access layer (everything else depends on this)
2. **Phase 2** — MCP tools (agents can start reading/writing immediately)
3. **Phase 3** — Watcher (enables inbound flow)
4. **Phase 4** — Links/tags (Obsidian's core differentiator)
5. **Phase 7** — Workflows (practical value)
6. **Phase 6** — Sync/conflicts (production hardening)
7. **Phase 8** — Polish
8. **Phase 5** — Plugin (nice-to-have)

---

## 21. Success Criteria

### Must Have (MVP)

- [ ] Agents can read notes from an Obsidian vault via `vault_read_note`
- [ ] Agents can search vault content via `vault_search`
- [ ] Agents can create new notes via `vault_create_note`
- [ ] Vault changes trigger filesystem watcher events
- [ ] Changed note content is ingested into memory pipeline
- [ ] YAML frontmatter is correctly parsed and preserved

### Should Have

- [ ] All 14 MCP tools functional
- [ ] Wiki-link extraction and backlink resolution
- [ ] Tag extraction and indexing
- [ ] Self-authored change filtering (no infinite loops)
- [ ] Daily notes support
- [ ] SKILL.md documents all vault tools

### Nice to Have

- [ ] Obsidian REST API plugin integration
- [ ] Link index → Graphiti knowledge graph mapping
- [ ] Template system for common note types
- [ ] Conflict resolution for concurrent edits
- [ ] Node bridge mode for remote vaults
- [ ] Custom Obsidian plugin for deeper integration

---

## 22. Comparison Matrix: Notion vs Obsidian Integration

| Feature              | Notion                | Obsidian                | Notes                                        |
| -------------------- | --------------------- | ----------------------- | -------------------------------------------- |
| **Access method**    | REST API (cloud)      | Filesystem (local)      | Obsidian is simpler for co-located           |
| **Authentication**   | API key / OAuth2      | None (filesystem)       | Obsidian has no auth for local access        |
| **Change detection** | HTTP Webhooks         | Filesystem watcher      | Both achieve similar results                 |
| **Data format**      | Proprietary blocks    | Standard Markdown       | Obsidian is more portable                    |
| **Content creation** | Create blocks via API | Write `.md` files       | Both support rich content                    |
| **Search**           | API endpoint          | Filesystem / ripgrep    | Obsidian search is local + fast              |
| **Metadata**         | Typed properties      | YAML frontmatter        | Both support structured metadata             |
| **Linking**          | Page IDs              | `[[wiki-links]]`        | Obsidian links are human-readable            |
| **Rate limits**      | 3 req/sec             | None (filesystem I/O)   | Obsidian is unlimited                        |
| **Multi-device**     | Built-in (cloud)      | Needs sync solution     | Notion wins for multi-device                 |
| **Offline**          | Limited               | Full                    | Obsidian works completely offline            |
| **Plugin ecosystem** | Limited               | 1500+ plugins           | Obsidian is far more extensible              |
| **API maturity**     | Official, versioned   | Community plugin        | Notion has better API stability              |
| **Loop prevention**  | Bot ID filtering      | Self-authored timestamp | Both handle it differently                   |
| **Estimated effort** | 15-23 hours           | 29-45 hours             | Obsidian needs more custom code              |
| **MCP tools**        | 7 tools (built)       | 14 tools (to build)     | Obsidian needs more tools for its features   |
| **Risk level**       | R0-R2                 | R0-R3                   | Obsidian has filesystem access (higher risk) |

---

## 23. Appendices

### Appendix A: Obsidian Markdown Extensions

| Extension             | Syntax                     | Standard Markdown?        |
| --------------------- | -------------------------- | ------------------------- | --- |
| Wiki-links            | `[[note-name]]`            | No                        |
| Wiki-links with alias | `[[note-name               | display text]]`           | No  |
| Block references      | `[[note^block-id]]`        | No                        |
| Heading references    | `[[note#heading]]`         | No                        |
| Embeds (transclusion) | `![[note-name]]`           | No                        |
| Image embeds          | `![[image.png]]`           | No                        |
| Tags                  | `#tag`, `#nested/tag`      | No (some parsers support) |
| Callouts              | `> [!note] Title`          | No                        |
| Task lists            | `- [ ] task`, `- [x] done` | Partial (GFM supports)    |
| Footnotes             | `[^1]`                     | Partial (some parsers)    |
| Mermaid diagrams      | ` ```mermaid `             | No                        |
| MathJax               | `$inline$`, `$$block$$`    | No                        |
| Comments              | `%%hidden%%`               | No                        |
| Dataview queries      | ` ```dataview `            | No (Dataview plugin)      |

### Appendix B: Obsidian Local REST API Plugin Endpoints

| Method | Endpoint                 | Description               |
| ------ | ------------------------ | ------------------------- |
| GET    | `/vault/{path}`          | Read file content         |
| GET    | `/vault/`                | List all files in vault   |
| PUT    | `/vault/{path}`          | Create or overwrite file  |
| PATCH  | `/vault/{path}`          | Append to file            |
| DELETE | `/vault/{path}`          | Delete file               |
| POST   | `/search/simple/`        | Simple text search        |
| POST   | `/search/`               | JSON Logic search         |
| GET    | `/periodic/daily/`       | Get today's daily note    |
| GET    | `/periodic/weekly/`      | Get current weekly note   |
| POST   | `/open/{path}`           | Open file in Obsidian app |
| POST   | `/commands/{commandId}/` | Execute Obsidian command  |
| GET    | `/`                      | API status / health check |

### Appendix C: Gray-Matter (Frontmatter Parser) Examples

```javascript
import matter from "gray-matter";

// Parse
const { data, content } = matter(`---
tags: [project, active]
status: in-progress
---
# My Note
Body content here.
`);
// data = { tags: ['project', 'active'], status: 'in-progress' }
// content = '# My Note\nBody content here.\n'

// Compose
const output = matter.stringify("# My Note\nBody content here.", {
  tags: ["project", "active"],
  status: "in-progress",
});
// Returns the full file with frontmatter + body
```

### Appendix D: External References

- [Obsidian Help](https://help.obsidian.md/)
- [Obsidian Plugin API](https://docs.obsidian.md/Home)
- [Obsidian Local REST API Plugin](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [Chokidar (File Watcher)](https://github.com/paulmillr/chokidar)
- [Gray-Matter (Frontmatter Parser)](https://github.com/jonschlinkert/gray-matter)
- [Obsidian URI Protocol](https://help.obsidian.md/Extending+Obsidian/Obsidian+URI)
- [Obsidian Community Plugins](https://obsidian.md/plugins)
- [Obsidian Sync](https://obsidian.md/sync)
- [Dataview Plugin](https://blacksmithgu.github.io/obsidian-dataview/)

---

_This document provides a comprehensive, equivalent design and implementation plan for Obsidian integration, directly paralleling the Notion integration plan. It accounts for Obsidian's fundamentally different vault-oriented, local-first, markdown-based storage paradigm while maintaining architectural consistency with the OpenClaw integration framework._
