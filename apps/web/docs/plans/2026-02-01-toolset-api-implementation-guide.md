# Toolset API Implementation Guide

**Date:** 2026-02-01
**Status:** Draft
**Depends On:** [Toolset Configuration Design](./2026-02-01-toolset-configuration-design.md)

## Overview

This document provides a comprehensive implementation guide for adding backend RPC support for the Toolset Configuration feature. The frontend implementation exists in `apps/web/src/components/domain/tools/` and `apps/web/src/components/domain/settings/ToolsetsSection.tsx`. This guide focuses on minimal upstream changes to reduce merge conflicts.

## Architecture Overview

### Existing Patterns

The codebase follows a consistent pattern for RPC-based CRUD operations:

1. **Gateway RPC Methods** - Defined in `src/gateway/server-methods/` with handlers exported in `src/gateway/server-methods.ts`
2. **Protocol Schemas** - JSON Schema validation in `src/gateway/protocol/`
3. **Service Layer** - Business logic encapsulated in service classes (e.g., `CronService`, `AutomationService`)
4. **File-based Storage** - JSON files in `~/.clawdbrain/` directory with atomic write patterns

### Key Reference Files

| Purpose | File Path |
|---------|-----------|
| RPC Handler Pattern | `src/gateway/server-methods/cron.ts` |
| Service Class Pattern | `src/automations/service.ts` |
| Store Operations | `src/automations/store.ts` |
| Protocol Schemas | `src/gateway/protocol/index.ts` |
| Method Registration | `src/gateway/server-methods.ts` |
| Frontend RPC Client | `apps/web/src/integrations/openclaw/openclaw.ts` |

---

## Data Model

### Core Types

```typescript
// src/toolsets/types.ts

/**
 * Permission configuration for a single tool within a toolset.
 */
export interface ToolPermission {
  /** Tool identifier (e.g., "read-docs", "code-exec") */
  toolId: string;
  /** Whether the tool is enabled in this toolset */
  enabled: boolean;
  /** Optional granular permissions (e.g., ["read", "write"]) */
  permissions?: string[];
}

/**
 * A reusable toolset configuration.
 */
export interface Toolset {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** Creation timestamp in milliseconds */
  createdAtMs: number;
  /** Last update timestamp in milliseconds */
  updatedAtMs: number;
  /** Tool permissions in this toolset */
  tools: ToolPermission[];
  /** Whether this is a built-in toolset (read-only) */
  isBuiltIn?: boolean;
}

/**
 * Input for creating a new toolset.
 */
export interface ToolsetCreate {
  name: string;
  description?: string;
  tools: ToolPermission[];
}

/**
 * Input for updating an existing toolset.
 */
export interface ToolsetPatch {
  name?: string;
  description?: string;
  tools?: ToolPermission[];
}

/**
 * Store file format for persistence.
 */
export interface ToolsetStoreFile {
  version: 1;
  toolsets: Toolset[];
}
```

### Built-in Toolsets

Built-in toolsets are defined in code and merged with user toolsets at runtime:

```typescript
// src/toolsets/builtin.ts

export const BUILTIN_TOOLSETS: Toolset[] = [
  {
    id: "builtin-minimal",
    name: "Minimal",
    description: "Read-only tools for safe information gathering",
    createdAtMs: 0,
    updatedAtMs: 0,
    isBuiltIn: true,
    tools: [
      { toolId: "read-docs", enabled: true, permissions: ["read"] },
      { toolId: "code-analysis", enabled: true, permissions: ["read", "analyze"] },
      { toolId: "web-search", enabled: true, permissions: ["read"] },
    ],
  },
  {
    id: "builtin-standard",
    name: "Standard",
    description: "Common tools without code execution capabilities",
    createdAtMs: 0,
    updatedAtMs: 0,
    isBuiltIn: true,
    tools: [
      // ... standard tool configuration
    ],
  },
  {
    id: "builtin-full",
    name: "Full Access",
    description: "All tools enabled with full permissions",
    createdAtMs: 0,
    updatedAtMs: 0,
    isBuiltIn: true,
    tools: [
      // ... all tools enabled
    ],
  },
];
```

---

## Storage Location

### Recommended Path

```
~/.clawdbrain/toolsets/toolsets.json
```

This follows the existing pattern used by automations (`~/.clawdbrain/automations/automations.json`).

### Path Resolution

```typescript
// src/toolsets/store.ts

import { CONFIG_DIR } from "../utils.js";

/** Default directory for toolsets state */
export const DEFAULT_TOOLSETS_DIR = path.join(CONFIG_DIR, "toolsets");

/** Default path to the toolsets store file */
export const DEFAULT_TOOLSETS_STORE_PATH = path.join(
  DEFAULT_TOOLSETS_DIR,
  "toolsets.json",
);

/**
 * Resolve the toolsets store path from config or use default.
 */
export function resolveToolsetsStorePath(storePath?: string): string {
  if (storePath?.trim()) {
    const raw = storePath.trim();
    if (raw.startsWith("~")) {
      return path.resolve(raw.replace("~", os.homedir()));
    }
    return path.resolve(raw);
  }
  return DEFAULT_TOOLSETS_STORE_PATH;
}
```

---

## RPC Methods

### Method Summary

| Method | Description | Scope Required |
|--------|-------------|----------------|
| `toolset.list` | List all toolsets (built-in + custom) | `operator.read` |
| `toolset.get` | Get a single toolset by ID | `operator.read` |
| `toolset.create` | Create a new toolset | `operator.admin` |
| `toolset.update` | Update an existing toolset | `operator.admin` |
| `toolset.delete` | Delete a toolset | `operator.admin` |
| `toolset.duplicate` | Duplicate a toolset | `operator.admin` |

### Protocol Schemas

Create JSON Schema definitions for parameter validation:

```typescript
// src/gateway/protocol/schemas/toolset.ts

export const ToolPermissionSchema = {
  type: "object",
  properties: {
    toolId: { type: "string" },
    enabled: { type: "boolean" },
    permissions: { type: "array", items: { type: "string" } },
  },
  required: ["toolId", "enabled"],
  additionalProperties: false,
};

export const ToolsetListParamsSchema = {
  type: "object",
  properties: {
    includeBuiltIn: { type: "boolean" },
  },
  additionalProperties: false,
};

export const ToolsetGetParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
  },
  required: ["id"],
  additionalProperties: false,
};

export const ToolsetCreateParamsSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: "string" },
    tools: { type: "array", items: ToolPermissionSchema },
  },
  required: ["name", "tools"],
  additionalProperties: false,
};

export const ToolsetUpdateParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    patch: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        description: { type: "string" },
        tools: { type: "array", items: ToolPermissionSchema },
      },
      additionalProperties: false,
    },
  },
  required: ["id", "patch"],
  additionalProperties: false,
};

export const ToolsetDeleteParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
  },
  required: ["id"],
  additionalProperties: false,
};

export const ToolsetDuplicateParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
  },
  required: ["id"],
  additionalProperties: false,
};
```

### RPC Handler Implementation

```typescript
// src/gateway/server-methods/toolsets.ts

import { randomUUID } from "node:crypto";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateToolsetListParams,
  validateToolsetGetParams,
  validateToolsetCreateParams,
  validateToolsetUpdateParams,
  validateToolsetDeleteParams,
  validateToolsetDuplicateParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import {
  loadToolsetsStore,
  saveToolsetsStore,
  resolveToolsetsStorePath,
} from "../../toolsets/store.js";
import { BUILTIN_TOOLSETS } from "../../toolsets/builtin.js";
import type { Toolset, ToolsetCreate, ToolsetPatch } from "../../toolsets/types.js";

export const toolsetsHandlers: GatewayRequestHandlers = {
  "toolset.list": async ({ params, respond }) => {
    if (!validateToolsetListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid toolset.list params: ${formatValidationErrors(validateToolsetListParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { includeBuiltIn?: boolean };
    const storePath = resolveToolsetsStorePath();
    const store = await loadToolsetsStore(storePath);

    const includeBuiltIn = p.includeBuiltIn !== false; // default true
    const toolsets = includeBuiltIn
      ? [...BUILTIN_TOOLSETS, ...store.toolsets]
      : store.toolsets;

    respond(true, { toolsets }, undefined);
  },

  "toolset.get": async ({ params, respond }) => {
    if (!validateToolsetGetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid toolset.get params: ${formatValidationErrors(validateToolsetGetParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { id: string };

    // Check built-in toolsets first
    const builtIn = BUILTIN_TOOLSETS.find((t) => t.id === p.id);
    if (builtIn) {
      respond(true, { toolset: builtIn }, undefined);
      return;
    }

    // Check user toolsets
    const storePath = resolveToolsetsStorePath();
    const store = await loadToolsetsStore(storePath);
    const toolset = store.toolsets.find((t) => t.id === p.id);

    if (!toolset) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.NOT_FOUND, `toolset not found: ${p.id}`),
      );
      return;
    }

    respond(true, { toolset }, undefined);
  },

  "toolset.create": async ({ params, respond }) => {
    if (!validateToolsetCreateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid toolset.create params: ${formatValidationErrors(validateToolsetCreateParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as ToolsetCreate;
    const storePath = resolveToolsetsStorePath();
    const store = await loadToolsetsStore(storePath);

    const now = Date.now();
    const toolset: Toolset = {
      id: `toolset-${randomUUID()}`,
      name: p.name.trim(),
      description: p.description?.trim(),
      createdAtMs: now,
      updatedAtMs: now,
      tools: p.tools,
      isBuiltIn: false,
    };

    store.toolsets.push(toolset);
    await saveToolsetsStore(storePath, store);

    respond(true, { toolset }, undefined);
  },

  "toolset.update": async ({ params, respond }) => {
    if (!validateToolsetUpdateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid toolset.update params: ${formatValidationErrors(validateToolsetUpdateParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { id: string; patch: ToolsetPatch };

    // Prevent editing built-in toolsets
    if (BUILTIN_TOOLSETS.some((t) => t.id === p.id)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "cannot modify built-in toolset"),
      );
      return;
    }

    const storePath = resolveToolsetsStorePath();
    const store = await loadToolsetsStore(storePath);
    const index = store.toolsets.findIndex((t) => t.id === p.id);

    if (index === -1) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.NOT_FOUND, `toolset not found: ${p.id}`),
      );
      return;
    }

    const existing = store.toolsets[index];
    const updated: Toolset = {
      ...existing,
      name: p.patch.name?.trim() ?? existing.name,
      description: p.patch.description?.trim() ?? existing.description,
      tools: p.patch.tools ?? existing.tools,
      updatedAtMs: Date.now(),
    };

    store.toolsets[index] = updated;
    await saveToolsetsStore(storePath, store);

    respond(true, { toolset: updated }, undefined);
  },

  "toolset.delete": async ({ params, respond }) => {
    if (!validateToolsetDeleteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid toolset.delete params: ${formatValidationErrors(validateToolsetDeleteParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { id: string };

    // Prevent deleting built-in toolsets
    if (BUILTIN_TOOLSETS.some((t) => t.id === p.id)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "cannot delete built-in toolset"),
      );
      return;
    }

    const storePath = resolveToolsetsStorePath();
    const store = await loadToolsetsStore(storePath);
    const index = store.toolsets.findIndex((t) => t.id === p.id);

    if (index === -1) {
      respond(true, { deleted: false }, undefined);
      return;
    }

    store.toolsets.splice(index, 1);
    await saveToolsetsStore(storePath, store);

    respond(true, { deleted: true }, undefined);
  },

  "toolset.duplicate": async ({ params, respond }) => {
    if (!validateToolsetDuplicateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid toolset.duplicate params: ${formatValidationErrors(validateToolsetDuplicateParams.errors)}`,
        ),
      );
      return;
    }

    const p = params as { id: string; name?: string };

    // Find source toolset (can be built-in or custom)
    let source: Toolset | undefined = BUILTIN_TOOLSETS.find((t) => t.id === p.id);

    if (!source) {
      const storePath = resolveToolsetsStorePath();
      const store = await loadToolsetsStore(storePath);
      source = store.toolsets.find((t) => t.id === p.id);
    }

    if (!source) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.NOT_FOUND, `toolset not found: ${p.id}`),
      );
      return;
    }

    const storePath = resolveToolsetsStorePath();
    const store = await loadToolsetsStore(storePath);

    const now = Date.now();
    const duplicate: Toolset = {
      id: `toolset-${randomUUID()}`,
      name: p.name?.trim() || `${source.name} (Copy)`,
      description: source.description,
      createdAtMs: now,
      updatedAtMs: now,
      tools: structuredClone(source.tools),
      isBuiltIn: false,
    };

    store.toolsets.push(duplicate);
    await saveToolsetsStore(storePath, store);

    respond(true, { toolset: duplicate }, undefined);
  },
};
```

---

## Store Implementation

```typescript
// src/toolsets/store.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CONFIG_DIR } from "../utils.js";
import type { ToolsetStoreFile } from "./types.js";

export const DEFAULT_TOOLSETS_DIR = path.join(CONFIG_DIR, "toolsets");
export const DEFAULT_TOOLSETS_STORE_PATH = path.join(
  DEFAULT_TOOLSETS_DIR,
  "toolsets.json",
);

export function resolveToolsetsStorePath(storePath?: string): string {
  if (storePath?.trim()) {
    const raw = storePath.trim();
    if (raw.startsWith("~")) {
      return path.resolve(raw.replace("~", os.homedir()));
    }
    return path.resolve(raw);
  }
  return DEFAULT_TOOLSETS_STORE_PATH;
}

/**
 * Load the toolsets store from disk.
 * Returns a valid store structure even if the file doesn't exist.
 */
export async function loadToolsetsStore(storePath: string): Promise<ToolsetStoreFile> {
  try {
    const raw = await fs.promises.readFile(storePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ToolsetStoreFile> | null;

    const toolsets = Array.isArray(parsed?.toolsets)
      ? parsed.toolsets.filter(Boolean)
      : [];

    return {
      version: 1,
      toolsets: toolsets as ToolsetStoreFile["toolsets"],
    };
  } catch {
    // File doesn't exist or is corrupt - return empty store
    return {
      version: 1,
      toolsets: [],
    };
  }
}

/**
 * Save the toolsets store to disk atomically.
 */
export async function saveToolsetsStore(
  storePath: string,
  store: ToolsetStoreFile,
): Promise<void> {
  await fs.promises.mkdir(path.dirname(storePath), { recursive: true });

  const tmp = `${storePath}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  const json = JSON.stringify(store, null, 2);

  await fs.promises.writeFile(tmp, json, "utf-8");

  // Best-effort backup
  try {
    if (fs.existsSync(storePath)) {
      const bakPath = `${storePath}.bak`;
      await fs.promises.copyFile(storePath, bakPath);
    }
  } catch {
    // Ignore backup errors
  }

  await fs.promises.rename(tmp, storePath);
}
```

---

## Integration Points

### 1. Register RPC Handlers

**File:** `src/gateway/server-methods.ts`

Add minimal changes:

```typescript
// Add import
import { toolsetsHandlers } from "./server-methods/toolsets.js";

// Add to coreGatewayHandlers object
export const coreGatewayHandlers: GatewayRequestHandlers = {
  // ... existing handlers ...
  ...toolsetsHandlers,
};
```

### 2. Register Methods in Method List

**File:** `src/gateway/server-methods-list.ts`

Add to `BASE_METHODS` array:

```typescript
const BASE_METHODS = [
  // ... existing methods ...
  "toolset.list",
  "toolset.get",
  "toolset.create",
  "toolset.update",
  "toolset.delete",
  "toolset.duplicate",
];
```

### 3. Add Authorization Scopes

**File:** `src/gateway/server-methods.ts`

Add to the appropriate scope sets:

```typescript
const READ_METHODS = new Set([
  // ... existing ...
  "toolset.list",
  "toolset.get",
]);

// Note: Create/Update/Delete require admin scope (default behavior)
```

### 4. Export Protocol Validators

**File:** `src/gateway/protocol/index.ts`

Add exports for the new validators:

```typescript
export {
  validateToolsetListParams,
  validateToolsetGetParams,
  validateToolsetCreateParams,
  validateToolsetUpdateParams,
  validateToolsetDeleteParams,
  validateToolsetDuplicateParams,
} from "./schemas/toolset.js";
```

---

## Frontend Integration

### Using the RPC Client

The frontend already has an RPC client via `OpenClawGatewayClient`. Update `ToolsetsSection.tsx` to use it:

```typescript
// apps/web/src/components/domain/settings/ToolsetsSection.tsx

import { useOpenClawGateway } from "@/integrations/openclaw";

export function ToolsetsSection() {
  const gateway = useOpenClawGateway();
  const [toolsets, setToolsets] = React.useState<ToolsetConfig[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Load toolsets on mount
  React.useEffect(() => {
    async function loadToolsets() {
      if (!gateway) return;

      try {
        setLoading(true);
        const result = await gateway.rpc<{ toolsets: ToolsetConfig[] }>(
          "toolset.list",
          { includeBuiltIn: true }
        );
        setToolsets(result.toolsets);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load toolsets");
      } finally {
        setLoading(false);
      }
    }

    loadToolsets();
  }, [gateway]);

  const handleCreateToolset = async (
    data: Omit<ToolsetConfig, "id" | "createdAt" | "updatedAt">
  ) => {
    if (!gateway) return;

    try {
      const result = await gateway.rpc<{ toolset: ToolsetConfig }>(
        "toolset.create",
        {
          name: data.name,
          description: data.description,
          tools: data.tools,
        }
      );
      setToolsets((prev) => [...prev, result.toolset]);
      setEditingToolset(null);
    } catch (err) {
      // Handle error
    }
  };

  // ... similar patterns for update, delete, duplicate
}
```

### Custom Hook (Recommended)

Create a dedicated hook for toolset operations:

```typescript
// apps/web/src/hooks/useToolsets.ts

import { useOpenClawGateway } from "@/integrations/openclaw";
import { useState, useEffect, useCallback } from "react";
import type { ToolsetConfig, ToolPermission } from "@/components/domain/tools";

interface UseToolsetsResult {
  toolsets: ToolsetConfig[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (data: { name: string; description?: string; tools: ToolPermission[] }) => Promise<ToolsetConfig>;
  update: (id: string, patch: { name?: string; description?: string; tools?: ToolPermission[] }) => Promise<ToolsetConfig>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string, name?: string) => Promise<ToolsetConfig>;
}

export function useToolsets(): UseToolsetsResult {
  const gateway = useOpenClawGateway();
  const [toolsets, setToolsets] = useState<ToolsetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!gateway) return;

    try {
      setLoading(true);
      setError(null);
      const result = await gateway.rpc<{ toolsets: ToolsetConfig[] }>("toolset.list");
      setToolsets(result.toolsets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load toolsets");
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (data: {
    name: string;
    description?: string;
    tools: ToolPermission[];
  }) => {
    if (!gateway) throw new Error("Gateway not connected");

    const result = await gateway.rpc<{ toolset: ToolsetConfig }>("toolset.create", data);
    setToolsets((prev) => [...prev, result.toolset]);
    return result.toolset;
  }, [gateway]);

  const update = useCallback(async (
    id: string,
    patch: { name?: string; description?: string; tools?: ToolPermission[] }
  ) => {
    if (!gateway) throw new Error("Gateway not connected");

    const result = await gateway.rpc<{ toolset: ToolsetConfig }>("toolset.update", { id, patch });
    setToolsets((prev) => prev.map((t) => (t.id === id ? result.toolset : t)));
    return result.toolset;
  }, [gateway]);

  const remove = useCallback(async (id: string) => {
    if (!gateway) throw new Error("Gateway not connected");

    await gateway.rpc("toolset.delete", { id });
    setToolsets((prev) => prev.filter((t) => t.id !== id));
  }, [gateway]);

  const duplicate = useCallback(async (id: string, name?: string) => {
    if (!gateway) throw new Error("Gateway not connected");

    const result = await gateway.rpc<{ toolset: ToolsetConfig }>("toolset.duplicate", { id, name });
    setToolsets((prev) => [...prev, result.toolset]);
    return result.toolset;
  }, [gateway]);

  return {
    toolsets,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    duplicate,
  };
}
```

---

## Error Handling

### Error Codes

Use existing error codes from `src/gateway/protocol/index.ts`:

```typescript
export const ErrorCodes = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  NOT_FOUND: -32001,
  UNAVAILABLE: -32002,
  // ...
};
```

### Frontend Error Handling

```typescript
// Example error handling in the hook
const create = useCallback(async (data) => {
  if (!gateway) throw new Error("Gateway not connected");

  try {
    const result = await gateway.rpc("toolset.create", data);
    return result.toolset;
  } catch (err) {
    if (err instanceof Error) {
      // Parse RPC error if available
      if (err.message.includes("name already exists")) {
        throw new Error("A toolset with this name already exists");
      }
      throw err;
    }
    throw new Error("Failed to create toolset");
  }
}, [gateway]);
```

---

## Migration Strategy

### Empty Store Initialization

When users first access toolsets, the store file won't exist. The `loadToolsetsStore` function handles this gracefully by returning an empty store:

```typescript
export async function loadToolsetsStore(storePath: string): Promise<ToolsetStoreFile> {
  try {
    const raw = await fs.promises.readFile(storePath, "utf-8");
    // ... parse and validate
  } catch {
    // File doesn't exist - return empty store
    return {
      version: 1,
      toolsets: [],
    };
  }
}
```

### Future Migration Support

The `version` field in the store allows for future migrations:

```typescript
export async function loadToolsetsStore(storePath: string): Promise<ToolsetStoreFile> {
  // ... load and parse

  // Handle version migrations
  if (parsed?.version === 1) {
    // Current version - no migration needed
  }
  // Future: if (parsed?.version === 2) { ... migrate to v3 ... }

  return store;
}
```

---

## File Structure Summary

### New Files to Create

```
src/toolsets/
├── types.ts              # Type definitions
├── builtin.ts            # Built-in toolset definitions
├── store.ts              # File persistence operations
└── index.ts              # Exports

src/gateway/server-methods/
└── toolsets.ts           # RPC handlers

src/gateway/protocol/schemas/
└── toolset.ts            # JSON Schema definitions

apps/web/src/hooks/
└── useToolsets.ts        # Frontend hook
```

### Files to Modify (Minimal Changes)

| File | Change |
|------|--------|
| `src/gateway/server-methods.ts` | Add import + spread toolsetsHandlers |
| `src/gateway/server-methods-list.ts` | Add 6 method names to BASE_METHODS |
| `src/gateway/protocol/index.ts` | Export new validators |

---

## Testing Recommendations

### Unit Tests

1. **Store operations** - Test load/save with empty, valid, and corrupt files
2. **Built-in toolsets** - Verify they cannot be modified or deleted
3. **CRUD operations** - Test create, read, update, delete flows
4. **Duplicate** - Test duplicating both built-in and custom toolsets

### Integration Tests

1. **RPC round-trip** - Test via WebSocket client
2. **Authorization** - Verify scope requirements
3. **Concurrent writes** - Test file locking behavior

### E2E Tests

1. **Frontend flow** - Create, edit, duplicate, delete toolsets via UI
2. **Gateway restart** - Verify toolsets persist across restarts

---

## Implementation Checklist

- [ ] Create `src/toolsets/types.ts`
- [ ] Create `src/toolsets/builtin.ts`
- [ ] Create `src/toolsets/store.ts`
- [ ] Create `src/toolsets/index.ts`
- [ ] Create `src/gateway/protocol/schemas/toolset.ts`
- [ ] Create `src/gateway/server-methods/toolsets.ts`
- [ ] Update `src/gateway/server-methods.ts` (add import + handlers)
- [ ] Update `src/gateway/server-methods-list.ts` (add method names)
- [ ] Update `src/gateway/protocol/index.ts` (export validators)
- [ ] Create `apps/web/src/hooks/useToolsets.ts`
- [ ] Update `apps/web/src/components/domain/settings/ToolsetsSection.tsx`
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Update documentation
