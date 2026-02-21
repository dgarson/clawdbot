# Worktree RPC Specification

## Overview

The Worktree RPC system provides secure, session-scoped access to agent workspace filesystems through the Clawdbrain gateway WebSocket protocol. This enables UI clients to browse, read, and modify files within agent workspaces.

## Architecture

### Request Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Client (Web UI)                                  │
│  User clicks file → worktree.read({ agentId, path })                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ WebSocket RPC
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Gateway RPC Handler                                 │
│  1. Validate RPC request format                                         │
│  2. Extract agentId from params                                         │
│  3. Resolve agent → get agent config/metadata                           │
│  4. Locate workspace → ~/.clawdbrain/agents/{agentId}/workspace         │
│  5. Validate path (security checks)                                     │
│  6. Perform file operation                                              │
│  7. Apply content filters (redaction, sanitization)                     │
│  8. Return result                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Resolution Chain

1. **RPC Request** → Gateway receives WebSocket frame
2. **Agent Resolution** → `agentId` → Agent config lookup
3. **Workspace Resolution** → Agent config → workspace directory path
4. **Path Resolution** → Workspace root + requested path → absolute file path
5. **Security Validation** → Check path is within workspace bounds
6. **File Operation** → Read/write/list/delete
7. **Content Filtering** → Redact secrets, sanitize output
8. **Response** → Return result to client

## RPC Methods

### 1. `worktree.list`

List files and directories within an agent's workspace.

**Request:**
```typescript
{
  type: "req",
  id: "msg-uuid",
  method: "worktree.list",
  params: {
    agentId: string;        // Required: Agent identifier
    path?: string;          // Optional: Directory path (default: "/")
    recursive?: boolean;    // Optional: Recursive listing (default: false)
    includeHidden?: boolean; // Optional: Include dotfiles (default: false)
  }
}
```

**Response:**
```typescript
{
  id: "msg-uuid",
  ok: true,
  payload: {
    path: string;           // Normalized path that was listed
    entries: [
      {
        path: string;       // Relative path from workspace root
        name: string;       // Filename or directory name
        kind: "file" | "dir";
        sizeBytes?: number; // File size (omitted for directories)
        modifiedAt?: string; // ISO8601 timestamp
        permissions?: string; // Unix permissions (e.g., "rw-r--r--")
      }
    ]
  }
}
```

**Resolution Flow:**
1. Extract `agentId` from params
2. Resolve agent → `/agents/{agentId}` config lookup
3. Locate workspace → `~/.clawdbrain/agents/{agentId}/workspace`
4. Normalize path → Join workspace root + requested path
5. Validate path → Must be within workspace bounds (no `..` escapes)
6. Read directory → Use `fs.readdir()` with `withFileTypes`
7. Map entries → Convert to response format
8. Return result

**Errors:**
- `AGENT_NOT_FOUND` - Agent ID doesn't exist
- `WORKSPACE_NOT_FOUND` - Workspace directory doesn't exist
- `PATH_OUTSIDE_WORKSPACE` - Path traversal attempt detected
- `PERMISSION_DENIED` - Filesystem permission error
- `NOT_A_DIRECTORY` - Requested path is a file, not a directory

---

### 2. `worktree.read`

Read the contents of a file within an agent's workspace.

**Request:**
```typescript
{
  type: "req",
  id: "msg-uuid",
  method: "worktree.read",
  params: {
    agentId: string;        // Required: Agent identifier
    path: string;           // Required: File path relative to workspace
    encoding?: "utf8" | "base64"; // Optional: Encoding (default: "utf8")
    maxBytes?: number;      // Optional: Max file size to read (default: 10MB)
    redact?: boolean;       // Optional: Apply secret redaction (default: true)
  }
}
```

**Response:**
```typescript
{
  id: "msg-uuid",
  ok: true,
  payload: {
    path: string;           // Normalized path that was read
    content: string;        // File contents (utf8 or base64)
    encoding: "utf8" | "base64";
    sizeBytes: number;      // Actual file size
    modifiedAt?: string;    // ISO8601 timestamp
    truncated?: boolean;    // True if file was truncated due to maxBytes
    redacted?: boolean;     // True if redaction was applied
  }
}
```

**Resolution Flow:**
1. Extract `agentId` and `path` from params
2. Resolve agent → `/agents/{agentId}` config lookup
3. Locate workspace → `~/.clawdbrain/agents/{agentId}/workspace`
4. Normalize path → Join workspace root + requested path
5. Validate path → Must be within workspace bounds
6. Check file size → If > maxBytes, prepare to truncate
7. Read file → Use `fs.readFile()` with specified encoding
8. Apply redaction → If `redact: true`, run secret detection
9. Return result

**Secret Redaction:**

When `redact: true` (default), the system scans file content for:
- API keys (patterns like `api_key=...`, `API_KEY: ...`)
- JWT tokens (patterns like `eyJ...`)
- Private keys (PEM blocks starting with `-----BEGIN PRIVATE KEY-----`)
- AWS credentials (`AKIA...`, `aws_secret_access_key`)
- Database connection strings with passwords
- Bearer tokens
- OAuth tokens

Detected secrets are replaced with:
```
[REDACTED: API_KEY]
[REDACTED: JWT_TOKEN]
[REDACTED: PRIVATE_KEY]
[REDACTED: AWS_CREDENTIALS]
[REDACTED: DATABASE_PASSWORD]
[REDACTED: BEARER_TOKEN]
```

**Redaction Configuration:**

Can be configured per-agent or globally:
```typescript
{
  redaction: {
    enabled: boolean;           // Enable/disable redaction
    patterns: [
      {
        name: string;           // Pattern name (e.g., "API_KEY")
        regex: string;          // Regular expression to match
        replacement: string;    // Replacement text template
      }
    ],
    excludePaths: string[];     // Paths to skip redaction (e.g., ".env.example")
  }
}
```

**Errors:**
- `AGENT_NOT_FOUND` - Agent ID doesn't exist
- `WORKSPACE_NOT_FOUND` - Workspace directory doesn't exist
- `PATH_OUTSIDE_WORKSPACE` - Path traversal attempt detected
- `FILE_NOT_FOUND` - Requested file doesn't exist
- `FILE_TOO_LARGE` - File exceeds maxBytes and no truncation allowed
- `PERMISSION_DENIED` - Filesystem permission error
- `NOT_A_FILE` - Requested path is a directory, not a file
- `UNSUPPORTED_ENCODING` - Binary file requested with utf8 encoding

---

### 3. `worktree.write`

Write or create a file within an agent's workspace.

**Request:**
```typescript
{
  type: "req",
  id: "msg-uuid",
  method: "worktree.write",
  params: {
    agentId: string;        // Required: Agent identifier
    path: string;           // Required: File path relative to workspace
    content: string;        // Required: File contents
    encoding?: "utf8" | "base64"; // Optional: Content encoding (default: "utf8")
    createDirs?: boolean;   // Optional: Create parent directories (default: true)
    overwrite?: boolean;    // Optional: Allow overwriting existing files (default: true)
  }
}
```

**Response:**
```typescript
{
  id: "msg-uuid",
  ok: true,
  payload: {
    path: string;           // Normalized path that was written
    sizeBytes: number;      // Bytes written
    modifiedAt: string;     // ISO8601 timestamp
    created: boolean;       // True if file was created, false if overwritten
  }
}
```

**Resolution Flow:**
1. Extract `agentId`, `path`, `content` from params
2. Resolve agent → `/agents/{agentId}` config lookup
3. Locate workspace → `~/.clawdbrain/agents/{agentId}/workspace`
4. Normalize path → Join workspace root + requested path
5. Validate path → Must be within workspace bounds
6. Check parent directory → Create if `createDirs: true`
7. Check existing file → Error if exists and `overwrite: false`
8. Write file → Use `fs.writeFile()` with specified encoding
9. Return result

**Errors:**
- `AGENT_NOT_FOUND` - Agent ID doesn't exist
- `WORKSPACE_NOT_FOUND` - Workspace directory doesn't exist
- `PATH_OUTSIDE_WORKSPACE` - Path traversal attempt detected
- `FILE_EXISTS` - File exists and `overwrite: false`
- `PARENT_NOT_FOUND` - Parent directory doesn't exist and `createDirs: false`
- `PERMISSION_DENIED` - Filesystem permission error
- `DISK_FULL` - No space left on device

---

### 4. `worktree.delete`

Delete a file or directory within an agent's workspace.

**Request:**
```typescript
{
  type: "req",
  id: "msg-uuid",
  method: "worktree.delete",
  params: {
    agentId: string;        // Required: Agent identifier
    path: string;           // Required: Path to delete
    recursive?: boolean;    // Optional: Delete directories recursively (default: false)
  }
}
```

**Response:**
```typescript
{
  id: "msg-uuid",
  ok: true,
  payload: {
    path: string;           // Path that was deleted
    kind: "file" | "dir";   // What was deleted
    itemsDeleted?: number;  // Number of items deleted (for recursive dir deletes)
  }
}
```

**Resolution Flow:**
1. Extract `agentId`, `path` from params
2. Resolve agent → `/agents/{agentId}` config lookup
3. Locate workspace → `~/.clawdbrain/agents/{agentId}/workspace`
4. Normalize path → Join workspace root + requested path
5. Validate path → Must be within workspace bounds, cannot delete workspace root
6. Check if exists → Error if not found
7. Delete → Use `fs.rm()` with `recursive` option if applicable
8. Return result

**Errors:**
- `AGENT_NOT_FOUND` - Agent ID doesn't exist
- `WORKSPACE_NOT_FOUND` - Workspace directory doesn't exist
- `PATH_OUTSIDE_WORKSPACE` - Path traversal attempt detected
- `FILE_NOT_FOUND` - Requested path doesn't exist
- `CANNOT_DELETE_ROOT` - Attempted to delete workspace root
- `DIRECTORY_NOT_EMPTY` - Directory has contents and `recursive: false`
- `PERMISSION_DENIED` - Filesystem permission error

---

### 5. `worktree.move`

Move or rename a file or directory within an agent's workspace.

**Request:**
```typescript
{
  type: "req",
  id: "msg-uuid",
  method: "worktree.move",
  params: {
    agentId: string;        // Required: Agent identifier
    fromPath: string;       // Required: Source path
    toPath: string;         // Required: Destination path
    overwrite?: boolean;    // Optional: Allow overwriting destination (default: false)
  }
}
```

**Response:**
```typescript
{
  id: "msg-uuid",
  ok: true,
  payload: {
    fromPath: string;       // Normalized source path
    toPath: string;         // Normalized destination path
    overwritten: boolean;   // True if destination was overwritten
  }
}
```

**Resolution Flow:**
1. Extract `agentId`, `fromPath`, `toPath` from params
2. Resolve agent → `/agents/{agentId}` config lookup
3. Locate workspace → `~/.clawdbrain/agents/{agentId}/workspace`
4. Normalize paths → Join workspace root + both paths
5. Validate paths → Both must be within workspace bounds
6. Check source exists → Error if not found
7. Check destination → Error if exists and `overwrite: false`
8. Move → Use `fs.rename()` or `fs.cp()` + `fs.rm()` if cross-device
9. Return result

**Errors:**
- `AGENT_NOT_FOUND` - Agent ID doesn't exist
- `WORKSPACE_NOT_FOUND` - Workspace directory doesn't exist
- `PATH_OUTSIDE_WORKSPACE` - Path traversal attempt detected (either path)
- `SOURCE_NOT_FOUND` - Source path doesn't exist
- `DESTINATION_EXISTS` - Destination exists and `overwrite: false`
- `CANNOT_MOVE_TO_SUBDIRECTORY` - Attempted to move directory into itself
- `PERMISSION_DENIED` - Filesystem permission error

---

### 6. `worktree.mkdir`

Create a directory within an agent's workspace.

**Request:**
```typescript
{
  type: "req",
  id: "msg-uuid",
  method: "worktree.mkdir",
  params: {
    agentId: string;        // Required: Agent identifier
    path: string;           // Required: Directory path to create
    recursive?: boolean;    // Optional: Create parent directories (default: true)
  }
}
```

**Response:**
```typescript
{
  id: "msg-uuid",
  ok: true,
  payload: {
    path: string;           // Normalized path that was created
    created: boolean;       // True if created, false if already existed
  }
}
```

**Resolution Flow:**
1. Extract `agentId`, `path` from params
2. Resolve agent → `/agents/{agentId}` config lookup
3. Locate workspace → `~/.clawdbrain/agents/{agentId}/workspace`
4. Normalize path → Join workspace root + requested path
5. Validate path → Must be within workspace bounds
6. Create directory → Use `fs.mkdir()` with `recursive` option
7. Return result

**Errors:**
- `AGENT_NOT_FOUND` - Agent ID doesn't exist
- `WORKSPACE_NOT_FOUND` - Workspace directory doesn't exist
- `PATH_OUTSIDE_WORKSPACE` - Path traversal attempt detected
- `PARENT_NOT_FOUND` - Parent directory doesn't exist and `recursive: false`
- `FILE_EXISTS` - A file exists at the requested path
- `PERMISSION_DENIED` - Filesystem permission error

---

## Security Considerations

### Path Validation

All file paths must be validated to prevent directory traversal attacks:

```typescript
function validatePath(workspaceRoot: string, requestedPath: string): string {
  // Normalize and resolve the path
  const normalizedPath = path.normalize(requestedPath);
  const absolutePath = path.resolve(workspaceRoot, normalizedPath);

  // Ensure the resolved path is still within workspace bounds
  if (!absolutePath.startsWith(workspaceRoot)) {
    throw new Error("PATH_OUTSIDE_WORKSPACE");
  }

  // Check for suspicious patterns
  if (normalizedPath.includes("..") || normalizedPath.startsWith("/")) {
    throw new Error("INVALID_PATH");
  }

  return absolutePath;
}
```

### Secret Redaction System

#### Built-in Patterns

The system includes default patterns for common secrets:

```typescript
const DEFAULT_REDACTION_PATTERNS = [
  {
    name: "API_KEY",
    regex: /(?:api[_-]?key|apikey|api[_-]?secret)[\s]*[:=][\s]*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
    replacement: "[REDACTED: API_KEY]",
  },
  {
    name: "JWT_TOKEN",
    regex: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    replacement: "[REDACTED: JWT_TOKEN]",
  },
  {
    name: "PRIVATE_KEY",
    regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
    replacement: "[REDACTED: PRIVATE_KEY]",
  },
  {
    name: "AWS_ACCESS_KEY",
    regex: /(?:AKIA|ASIA)[0-9A-Z]{16}/g,
    replacement: "[REDACTED: AWS_ACCESS_KEY]",
  },
  {
    name: "AWS_SECRET_KEY",
    regex: /(?:aws_secret_access_key|aws_secret)[\s]*[:=][\s]*['"]?([a-zA-Z0-9/+=]{40})['"]?/gi,
    replacement: "[REDACTED: AWS_SECRET_KEY]",
  },
  {
    name: "GITHUB_TOKEN",
    regex: /gh[pousr]_[a-zA-Z0-9]{36,}/g,
    replacement: "[REDACTED: GITHUB_TOKEN]",
  },
  {
    name: "BEARER_TOKEN",
    regex: /bearer[\s]+([a-zA-Z0-9_\-\.]+)/gi,
    replacement: "bearer [REDACTED: BEARER_TOKEN]",
  },
  {
    name: "DATABASE_PASSWORD",
    regex: /(?:password|pwd|pass)[\s]*[:=][\s]*['"]?([^'"\s]{8,})['"]?/gi,
    replacement: "password=[REDACTED: DATABASE_PASSWORD]",
  },
  {
    name: "CONNECTION_STRING",
    regex: /(?:postgres|mysql|mongodb):\/\/[^:]+:([^@]+)@/g,
    replacement: (match) => match.replace(/:[^@]+@/, ":[REDACTED]@"),
  },
  {
    name: "ANTHROPIC_API_KEY",
    regex: /sk-ant-[a-zA-Z0-9_-]{95,}/g,
    replacement: "[REDACTED: ANTHROPIC_API_KEY]",
  },
  {
    name: "OPENAI_API_KEY",
    regex: /sk-[a-zA-Z0-9]{48}/g,
    replacement: "[REDACTED: OPENAI_API_KEY]",
  },
];
```

#### Redaction Configuration

Agents can configure redaction behavior:

```typescript
// Per-agent configuration
{
  agentId: "agent-123",
  workspace: {
    redaction: {
      enabled: true,              // Enable redaction globally
      defaultBehavior: "redact",  // "redact" | "allow" | "block"
      customPatterns: [           // Additional patterns
        {
          name: "CUSTOM_SECRET",
          regex: "my-pattern",
          replacement: "[REDACTED]"
        }
      ],
      excludePaths: [             // Skip redaction for these paths
        "README.md",
        "docs/**/*.md",
        "**/*.example",
        ".env.example"
      ],
      excludePatterns: [          // Disable specific patterns
        "DATABASE_PASSWORD"       // Don't redact DB passwords for this agent
      ]
    }
  }
}
```

#### Redaction Flow

```typescript
function redactContent(content: string, config: RedactionConfig): {
  redacted: string;
  applied: boolean;
} {
  if (!config.enabled) {
    return { redacted: content, applied: false };
  }

  let redacted = content;
  let applied = false;

  const patterns = [
    ...DEFAULT_REDACTION_PATTERNS,
    ...(config.customPatterns || [])
  ].filter(p => !config.excludePatterns?.includes(p.name));

  for (const pattern of patterns) {
    const before = redacted;
    redacted = redacted.replace(
      new RegExp(pattern.regex, "g"),
      pattern.replacement
    );
    if (redacted !== before) {
      applied = true;
    }
  }

  return { redacted, applied };
}
```

### Permission Model

File operations respect the gateway's session authentication:

1. **Operator Role** - Full access to all agent workspaces
2. **Agent Role** - Access only to own workspace
3. **User Role** - No direct workspace access (must go through agent)

```typescript
function checkWorkspacePermission(
  session: GatewaySession,
  agentId: string
): boolean {
  // Operators can access any workspace
  if (session.role === "operator") {
    return true;
  }

  // Agents can only access their own workspace
  if (session.role === "agent" && session.agentId === agentId) {
    return true;
  }

  // Users cannot access workspaces directly
  return false;
}
```

### Rate Limiting

To prevent abuse, implement rate limiting:

```typescript
{
  worktree: {
    rateLimit: {
      maxRequestsPerMinute: 60,
      maxBytesPerMinute: 100_000_000, // 100MB
      maxConcurrentReads: 5,
    }
  }
}
```

## Error Handling

All errors follow the gateway RPC error format:

```typescript
{
  id: "msg-uuid",
  ok: false,
  error: {
    code: string;           // Error code (e.g., "AGENT_NOT_FOUND")
    message: string;        // Human-readable error message
    details?: unknown;      // Additional error context
  }
}
```

### Error Codes

| Code | Description | HTTP Equivalent |
|------|-------------|-----------------|
| `AGENT_NOT_FOUND` | Agent ID doesn't exist | 404 |
| `WORKSPACE_NOT_FOUND` | Workspace directory missing | 404 |
| `FILE_NOT_FOUND` | File doesn't exist | 404 |
| `PATH_OUTSIDE_WORKSPACE` | Path traversal attempt | 403 |
| `PERMISSION_DENIED` | Insufficient permissions | 403 |
| `FILE_TOO_LARGE` | File exceeds size limit | 413 |
| `DISK_FULL` | No space on device | 507 |
| `INVALID_PATH` | Malformed path | 400 |
| `INVALID_ENCODING` | Unsupported encoding | 400 |
| `FILE_EXISTS` | File already exists | 409 |
| `DIRECTORY_NOT_EMPTY` | Directory has contents | 409 |
| `NOT_A_FILE` | Expected file, got directory | 400 |
| `NOT_A_DIRECTORY` | Expected directory, got file | 400 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |

## Implementation Notes

### Backend (Gateway)

The gateway should implement handlers for each RPC method:

```typescript
// src/gateway/rpc/worktree.ts

export async function handleWorktreeRead(
  params: WorktreeReadParams,
  context: RpcContext
): Promise<WorktreeReadResult> {
  // 1. Validate session permissions
  if (!checkWorkspacePermission(context.session, params.agentId)) {
    throw new RpcError("PERMISSION_DENIED", "Cannot access this workspace");
  }

  // 2. Resolve agent
  const agent = await getAgent(params.agentId);
  if (!agent) {
    throw new RpcError("AGENT_NOT_FOUND", `Agent ${params.agentId} not found`);
  }

  // 3. Locate workspace
  const workspaceRoot = getAgentWorkspacePath(params.agentId);
  if (!fs.existsSync(workspaceRoot)) {
    throw new RpcError("WORKSPACE_NOT_FOUND", "Workspace directory not found");
  }

  // 4. Validate and resolve path
  const absolutePath = validatePath(workspaceRoot, params.path);

  // 5. Check file exists and is readable
  const stats = await fs.promises.stat(absolutePath);
  if (!stats.isFile()) {
    throw new RpcError("NOT_A_FILE", "Path is not a file");
  }

  // 6. Check size limits
  const maxBytes = params.maxBytes || 10_000_000; // 10MB default
  if (stats.size > maxBytes) {
    throw new RpcError("FILE_TOO_LARGE", `File exceeds ${maxBytes} bytes`);
  }

  // 7. Read file
  const encoding = params.encoding || "utf8";
  let content = await fs.promises.readFile(absolutePath, encoding);

  // 8. Apply redaction
  const redactConfig = agent.workspace?.redaction;
  const shouldRedact = params.redact !== false && redactConfig?.enabled !== false;
  let redacted = false;

  if (shouldRedact && encoding === "utf8") {
    const result = redactContent(content, redactConfig);
    content = result.redacted;
    redacted = result.applied;
  }

  // 9. Return result
  return {
    path: params.path,
    content,
    encoding,
    sizeBytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    redacted,
  };
}
```

### Frontend (Web UI)

The web UI uses the gateway adapter:

```typescript
// Component usage
const handleFileClick = async (path: string) => {
  try {
    const result = await readWorktreeFile({
      agentId: currentAgentId,
      path,
      redact: true, // Always redact in UI
    });

    setFileContent(result.content);
    if (result.redacted) {
      showNotification("Some secrets were redacted from this file");
    }
  } catch (error) {
    handleError(error);
  }
};
```

## Future Enhancements

### 1. Watch API

Real-time file change notifications:

```typescript
{
  method: "worktree.watch",
  params: {
    agentId: string;
    path: string;
    recursive?: boolean;
  }
}

// Server sends events:
{
  event: "worktree.changed",
  payload: {
    agentId: string;
    path: string;
    changeType: "created" | "modified" | "deleted";
  }
}
```

### 2. Search API

Full-text search across workspace:

```typescript
{
  method: "worktree.search",
  params: {
    agentId: string;
    query: string;
    glob?: string;
    caseSensitive?: boolean;
    regex?: boolean;
  }
}
```

### 3. Diff API

Compare file versions or workspaces:

```typescript
{
  method: "worktree.diff",
  params: {
    agentId: string;
    fromPath: string;
    toPath: string;
    format?: "unified" | "json";
  }
}
```

### 4. Archive API

Backup/restore workspace:

```typescript
{
  method: "worktree.archive",
  params: {
    agentId: string;
    format: "tar" | "zip";
  }
}
```

## Testing Recommendations

### Unit Tests

- Path validation logic
- Redaction pattern matching
- Error handling for edge cases

### Integration Tests

- Full RPC flow with real filesystem
- Permission checks
- Rate limiting behavior

### Security Tests

- Path traversal attempts
- Secret detection accuracy (true/false positives)
- Permission boundary enforcement

### Performance Tests

- Large file handling (>100MB)
- Deep directory trees (>1000 files)
- Concurrent request handling

## Changelog

### v1.0.0 (2026-02-01)

- Initial specification
- Core RPC methods: list, read, write, delete, move, mkdir
- Secret redaction system
- Security model and permission checks
