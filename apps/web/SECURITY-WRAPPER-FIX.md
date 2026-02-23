# Security Wrapper Display Fix

## Problem

Security wrappers (e.g., `<<<EXTERNAL_UNTRUSTED_CONTENT>>>`, `SECURITY NOTICE:` warnings, and metadata like `Source: Web Fetch`) were leaking into the user-visible UI when displaying tool outputs.

These wrappers are **internal security markers** meant only for the LLM to prevent prompt injection attacks. They should never be visible to end users.

## Root Cause

The web fetch tool (`src/agents/tools/web-fetch.ts`) wraps fetched content with security markers using `wrapExternalContent()` from `src/security/external-content.ts`. This is by design for LLM protection.

However, the UI components were displaying the raw tool output directly without stripping these internal markers:

1. **`apps/web/src/components/domain/chat/ToolCallCard.tsx`** (lines 145-147)
2. **`apps/web/src/components/domain/session/SessionChatMessage.tsx`** (lines 274-276)

## Solution Implemented

### 1. Added Security Wrapper Stripping Functions

Both ToolCallCard components now include:

- `stripSecurityWrappers(content: string)`: Removes all security markers from strings
  - Strips `<<<EXTERNAL_UNTRUSTED_CONTENT>>>` boundaries
  - Removes `SECURITY NOTICE:` warning blocks
  - Removes metadata lines (`Source:`, `From:`, `Subject:`, `---`)

- `stripWrappersFromValue(value: unknown)`: Recursively strips wrappers from nested data structures
  - Handles strings, arrays, and objects
  - Preserves data structure while cleaning content

- `formatOutput(value: unknown)`: Combines stripping and formatting
  - Strips wrappers from the value structure FIRST
  - Then formats as JSON for display

### 2. Updated Display Logic

**ToolCallCard.tsx (domain/chat)**:
```typescript
// Before
{formatJson(toolCall.output)}

// After
{formatOutput(toolCall.output)}
```

**SessionChatMessage.tsx (domain/session)**:
```typescript
// Before
{tool.output}

// After
{stripWrappersRecursively(tool.output)}
```

### 3. Added Comprehensive Tests

Created `apps/web/src/components/domain/chat/ToolCallCard.test.tsx` with 5 test cases:
- ✅ Strip external content wrappers from tool output
- ✅ Strip security warning from tool output
- ✅ Handle nested JSON with security wrappers
- ✅ Do not modify output without security wrappers
- ✅ Strip metadata lines from wrapper

## Result

Tool outputs now display **only the actual content** to users, with all internal security markers removed. The LLM still receives the wrapped content for protection against prompt injection.

### Example

**Before** (bug):
```
<<<EXTERNAL_UNTRUSTED_CONTENT>>>
Source: Web Fetch
---
Hello World
<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>
```

**After** (fixed):
```
Hello World
```

## Files Modified

1. **apps/web/src/components/domain/chat/ToolCallCard.tsx**
   - Added `stripSecurityWrappers()`, `stripWrappersFromValue()`, `formatOutput()`
   - Updated output display to use `formatOutput()`

2. **apps/web/src/components/domain/session/SessionChatMessage.tsx**
   - Added `stripSecurityWrappers()`, `stripWrappersRecursively()`, `stripWrappersFromValue()`
   - Updated output display and copy button to use `stripWrappersRecursively()`

3. **apps/web/src/components/domain/chat/ToolCallCard.test.tsx** (new)
   - Comprehensive test coverage for security wrapper stripping

## Testing

```bash
cd apps/web && pnpm vitest run src/components/domain/chat/ToolCallCard.test.tsx
```

All 5 tests pass ✅
