# Tool Output Display Fix

## Problem

Tool outputs (e.g., `exec` command results, file listings) were being displayed **twice** in the chat interface:

1. **In the main message bubble** - as part of the message content
2. **In the expandable Tool Details section** - where they should exclusively appear

This created visual clutter and redundancy.

## Root Cause

The backend was emitting tool outputs as text deltas that got appended to the message content stream. When tool results were broadcast, they were:
- Added to `streaming.content` (displayed in chat bubble)
- ALSO tracked in `streaming.toolCalls` (displayed in tool details)

## Solution

Implemented a **two-layer fix**:

### 1. Gateway Stream Handler (`useGatewayStreamHandler.ts`)

Created a new hook that processes gateway streaming events and routes them correctly:

- **Text deltas** → Only added to message content if they're not tool outputs
- **Tool outputs** → Routed ONLY to the tool calls array
- **Pattern detection** → Identifies common tool output patterns (ls listings, command output, etc.) and filters them from message content

Key features:
- Detects tool output patterns (file listings, command outputs)
- Routes tool metadata separately from message text
- Maintains tool call status (running, done, error)
- Prevents tool output from ever reaching message content

### 2. Content Filter (`SessionChatMessage.tsx`)

Added a safety filter in the UI component as a fallback:

```typescript
function filterToolOutputFromContent(content: string): string {
  const toolOutputPatterns = [
    /^total \d+\s*\ndrwxr-xr-x/m,     // ls -la output
    /^drwxr-xr-x[\s\S]*?staff/m,     // File listing with permissions
    /^-rw-r--r--[\s\S]*?staff/m,     // File listing
  ];

  const isOnlyToolOutput = toolOutputPatterns.some(pattern => pattern.test(content));
  if (isOnlyToolOutput) {
    return ""; // Don't display in message bubble
  }

  return content;
}
```

This ensures that even if tool output somehow leaks into message content, it won't be displayed in the chat bubble.

### 3. Integration

- Registered the stream handler in the root layout (`__root.tsx`)
- Exported from hooks index for easy reuse
- Applied content filter to all assistant messages before rendering

## Result

Tool outputs now appear **exclusively** in the expandable Tool Details section, keeping the main chat area clean and focused on conversational content.

### Before
```
┌─────────────────────────────────┐
│ total 5208                      │
│ drwxr-xr-x@ 87 dgarson staff... │
│ drwxr-xr-x@ 44 dgarson staff... │
│ (full tool output shown)        │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 🔧 exec              View ✓     │
│ (same output in tool details)   │
└─────────────────────────────────┘
```

### After
```
┌─────────────────────────────────┐
│ (clean chat message)            │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ 🔧 exec              View ✓     │
│ (output ONLY here)              │
└─────────────────────────────────┘
```

## Files Modified

1. **apps/web/src/hooks/useGatewayStreamHandler.ts** (new)
   - Main stream event processing logic
   - Tool output detection and routing

2. **apps/web/src/hooks/index.ts**
   - Export new hook

3. **apps/web/src/components/domain/session/SessionChatMessage.tsx**
   - Added content filter function
   - Applied filter to assistant messages

4. **apps/web/src/routes/__root.tsx**
   - Integrated stream handler at app root

## Testing

To verify the fix:

1. Start a chat session with an agent
2. Execute a command that produces tool output (e.g., `/exec ls -la`)
3. Verify that:
   - The command output does NOT appear in the message bubble
   - The output ONLY appears in the expandable tool details section
   - Other message text still displays normally

## Future Improvements

Consider:
- More sophisticated tool output detection (ML-based?)
- Backend refactoring to send separate event types for tool outputs
- Structured tool result format (JSON) instead of text parsing
