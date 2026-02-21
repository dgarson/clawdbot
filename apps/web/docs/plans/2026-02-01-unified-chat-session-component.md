# Unified Chat Session Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a unified, reusable `UnifiedChatSession` component that consolidates the Agent Session UI's rich features into a configurable component supporting Full vs Basic display modes, with complete multi-modal input AND output capabilities.

**Architecture:** The component will wrap existing Session components (SessionChat, SessionActivityFeed, SessionWorkspacePane) and add new capabilities for voice recording, drag-and-drop file uploads, reasoning stream toggles, multi-modal output rendering (images, audio, files), and display mode configuration. The `/conversations` routes will be migrated to use this unified component in Basic mode.

**Tech Stack:** React 18, TanStack Router, Framer Motion, Web Audio API (voice recording), File API (drag-drop), shadcn/ui components, Zustand (stores)

---

## Critical UX Requirements

### Vertical Layout Constraints
- **CRITICAL:** The chat UI and RHS panel must NEVER require page-level scrolling to see the message input box or bottom of panels
- The bottom of the center pane must end no lower than vertically centered between the "Settings" and "Connections" nav items in the left sidebar
- Use `h-screen`, `max-h-screen`, `overflow-hidden` on the outer container
- Use `flex-1 min-h-0` pattern for scrollable children to constrain height properly
- Test at various viewport heights to ensure no overflow

### Message Author Clarity
- Agent 2-letter initials must have a visible ring/border around the avatar circle
- Add a subtle separator line between "Agent Name · Timestamp" header and message content
- Make author attribution more prominent with slightly larger/bolder text

### Multi-Modal Output Support
- Support rendering images in assistant responses (inline or lightbox)
- Support rendering audio players for voice/audio content
- Support rendering file download cards for attachments
- Support rendering code blocks with syntax highlighting

---

## Phase 0: Critical Layout & UX Fixes

### Task 0A: Fix Vertical Layout Overflow Issues

**Files:**
- Modify: `src/routes/agents/$agentId/session/$sessionKey.tsx`
- Modify: `src/routes/conversations/$id.tsx`
- Modify: `src/components/domain/session/SessionChat.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (if needed for reference measurements)

**Problem:** The chat UI overflows the viewport, requiring page-level scrolling to see the message input box.

**Step 1: Audit current layout structure**

Check the outer container uses proper height constraints:
```tsx
// REQUIRED pattern for all chat page containers:
<div className="h-screen max-h-screen overflow-hidden flex flex-col">
  {/* Header - shrink-0 */}
  <header className="shrink-0">...</header>

  {/* Main content - flex-1 min-h-0 */}
  <main className="flex-1 min-h-0 flex">
    {/* Scrollable areas inside */}
  </main>
</div>
```

**Step 2: Apply fix to AgentSessionPage**

In `src/routes/agents/$agentId/session/$sessionKey.tsx`, ensure:
```tsx
return (
  <div className="h-screen max-h-screen overflow-hidden flex flex-col bg-background text-foreground">
    {/* SessionHeader - must be shrink-0 */}
    <SessionHeader className="shrink-0" ... />

    {/* Main content area - flex-1 with min-h-0 is CRITICAL */}
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Chat section */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* Message list - scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">...</div>
        {/* Input - shrink-0 */}
        <div className="shrink-0">...</div>
      </div>

      {/* RHS sidebar - same constraints */}
      <div className="w-[380px] flex flex-col min-h-0 overflow-hidden">...</div>
    </div>
  </div>
);
```

**Step 3: Verify with CSS calc if needed**

If sidebar nav items need consideration, use CSS calc:
```tsx
// Alternative: explicit height calculation
<div className="flex flex-col" style={{ height: 'calc(100vh - var(--sidebar-footer-offset, 0px))' }}>
```

**Step 4: Test at multiple viewport heights**

- Test at 768px, 900px, 1080px viewport heights
- Verify message input is ALWAYS visible without scrolling
- Verify RHS panels don't overflow

**Step 5: Commit**

```bash
git add src/routes/agents/\$agentId/session/\$sessionKey.tsx src/routes/conversations/\$id.tsx
git commit -m "fix(layout): ensure chat UI never overflows viewport height"
```

---

### Task 0B: Improve Message Author Clarity

**Files:**
- Modify: `src/components/domain/session/SessionChatMessage.tsx`
- Modify: `src/components/composed/AgentAvatar.tsx`

**Step 1: Add ring/border to AgentAvatar**

In `AgentAvatar.tsx`, add a visible ring:
```tsx
<div
  className={cn(
    "flex items-center justify-center rounded-xl font-medium",
    "ring-2 ring-border/50", // ADD THIS - subtle ring around avatar
    // ... existing size classes
  )}
>
  {/* 2-letter initial */}
</div>
```

**Step 2: Update SessionChatMessage header with separator**

In `SessionChatMessage.tsx`, update the message bubble header:
```tsx
{/* Header with separator */}
<div className="mb-2">
  <div className="flex items-center justify-between gap-2 text-xs">
    <span
      className={cn(
        "font-semibold", // Make bolder
        isUser ? "text-primary-foreground/90" : "text-foreground"
      )}
    >
      {isUser ? "You" : message.agentName || "Assistant"}
    </span>
    {formattedTime && (
      <span
        className={cn(
          "text-[10px]", // Slightly smaller timestamp
          isUser ? "text-primary-foreground/60" : "text-muted-foreground"
        )}
      >
        {formattedTime}
      </span>
    )}
  </div>
  {/* Subtle separator line */}
  <div
    className={cn(
      "mt-1.5 mb-2 h-px w-full",
      isUser ? "bg-primary-foreground/10" : "bg-border/30"
    )}
  />
</div>
```

**Step 3: Commit**

```bash
git add src/components/domain/session/SessionChatMessage.tsx src/components/composed/AgentAvatar.tsx
git commit -m "fix(chat): improve message author clarity with avatar ring and separator"
```

---

### Task 0C: Add Multi-Modal Output Support

**Files:**
- Create: `src/components/domain/session/MessageContentRenderer.tsx`
- Modify: `src/components/domain/session/SessionChatMessage.tsx`
- Modify: `src/lib/api/sessions.ts` (extend ChatMessage type)

**Step 1: Extend ChatMessage type to support attachments**

In `src/lib/api/sessions.ts`:
```ts
export interface MessageAttachment {
  id: string;
  type: "image" | "audio" | "file" | "code";
  name: string;
  mimeType: string;
  url?: string;
  data?: string; // base64 for inline
  language?: string; // for code blocks
  size?: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  toolCalls?: ToolCall[];
  attachments?: MessageAttachment[]; // ADD THIS
  reasoning?: string; // ADD THIS for thinking/reasoning stream
}
```

**Step 2: Create MessageContentRenderer component**

```tsx
// src/components/domain/session/MessageContentRenderer.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Download, Play, Pause, FileText, Code, Image as ImageIcon, Volume2 } from "lucide-react";
import type { MessageAttachment } from "@/lib/api/sessions";

interface MessageContentRendererProps {
  content: string;
  attachments?: MessageAttachment[];
  reasoning?: string;
  showReasoning?: boolean;
  isStreaming?: boolean;
  className?: string;
}

export function MessageContentRenderer({
  content,
  attachments,
  reasoning,
  showReasoning = true,
  isStreaming = false,
  className,
}: MessageContentRendererProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Reasoning/thinking stream (collapsible) */}
      {reasoning && showReasoning && (
        <ReasoningBlock reasoning={reasoning} isStreaming={isStreaming} />
      )}

      {/* Main text content */}
      {content && (
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {content}
          {isStreaming && (
            <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-current" />
          )}
        </div>
      )}

      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <div className="space-y-2 pt-2">
          {attachments.map((attachment) => (
            <AttachmentRenderer key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReasoningBlock({ reasoning, isStreaming }: { reasoning: string; isStreaming: boolean }) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-3">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="font-medium">Thinking...</span>
        <span className="text-[10px]">{isExpanded ? "Hide" : "Show"}</span>
      </button>
      {isExpanded && (
        <div className="mt-2 text-xs text-muted-foreground italic whitespace-pre-wrap">
          {reasoning}
          {isStreaming && (
            <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-current" />
          )}
        </div>
      )}
    </div>
  );
}

function AttachmentRenderer({ attachment }: { attachment: MessageAttachment }) {
  switch (attachment.type) {
    case "image":
      return <ImageAttachment attachment={attachment} />;
    case "audio":
      return <AudioAttachment attachment={attachment} />;
    case "code":
      return <CodeAttachment attachment={attachment} />;
    case "file":
    default:
      return <FileAttachment attachment={attachment} />;
  }
}

function ImageAttachment({ attachment }: { attachment: MessageAttachment }) {
  const src = attachment.url || `data:${attachment.mimeType};base64,${attachment.data}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="relative group cursor-pointer">
          <img
            src={src}
            alt={attachment.name}
            className="max-w-sm max-h-64 rounded-lg border border-border object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <img src={src} alt={attachment.name} className="w-full h-auto" />
      </DialogContent>
    </Dialog>
  );
}

function AudioAttachment({ attachment }: { attachment: MessageAttachment }) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const src = attachment.url || `data:${attachment.mimeType};base64,${attachment.data}`;

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-full"
        onClick={togglePlay}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </Button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm truncate">{attachment.name}</span>
        </div>
      </div>
    </div>
  );
}

function CodeAttachment({ attachment }: { attachment: MessageAttachment }) {
  const code = attachment.data || "";

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 text-xs">
        <span className="font-mono text-muted-foreground">{attachment.language || "code"}</span>
        <span className="text-muted-foreground">{attachment.name}</span>
      </div>
      <pre className="p-3 overflow-x-auto text-xs bg-background">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FileAttachment({ attachment }: { attachment: MessageAttachment }) {
  const handleDownload = () => {
    if (attachment.url) {
      window.open(attachment.url, "_blank");
    } else if (attachment.data) {
      const blob = new Blob(
        [Uint8Array.from(atob(attachment.data), (c) => c.charCodeAt(0))],
        { type: attachment.mimeType }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{attachment.name}</div>
        {attachment.size && (
          <div className="text-xs text-muted-foreground">
            {formatFileSize(attachment.size)}
          </div>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={handleDownload}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default MessageContentRenderer;
```

**Step 3: Update SessionChatMessage to use MessageContentRenderer**

Replace the content rendering in `SessionChatMessage.tsx`:
```tsx
import { MessageContentRenderer } from "./MessageContentRenderer";

// In the render:
<MessageContentRenderer
  content={message.content}
  attachments={message.attachments}
  reasoning={message.reasoning}
  showReasoning={true} // or from settings
  isStreaming={message.isStreaming}
/>
```

**Step 4: Export from index**

Add to `src/components/domain/session/index.ts`:
```ts
export { MessageContentRenderer } from "./MessageContentRenderer";
```

**Step 5: Commit**

```bash
git add src/components/domain/session/MessageContentRenderer.tsx src/components/domain/session/SessionChatMessage.tsx src/lib/api/sessions.ts
git commit -m "feat(chat): add multi-modal output support for images, audio, files, code"
```

---

## Phase 1: Core Unified Component

### Task 1: Create UnifiedChatSession Component Shell

**Files:**
- Create: `src/components/domain/session/UnifiedChatSession.tsx`
- Modify: `src/components/domain/session/index.ts`

**Step 1: Create the component file with TypeScript types**

```tsx
// src/components/domain/session/UnifiedChatSession.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/api/sessions";
import type { StreamingMessage } from "@/stores/useSessionStore";
import type { Activity } from "./SessionActivityFeed";

/** Display mode for the unified chat component */
export type ChatDisplayMode = "full" | "basic";

/** Attachment ready for upload */
export interface ChatAttachment {
  id: string;
  type: "file" | "image" | "audio";
  name: string;
  size: number;
  mimeType: string;
  file?: File;
  /** For audio: base64 or blob URL */
  audioData?: string;
  /** Preview URL for images */
  previewUrl?: string;
}

/** Settings for the chat session */
export interface ChatSessionSettings {
  /** Show reasoning/thinking stream toggle */
  showReasoningToggle?: boolean;
  /** Current reasoning toggle state */
  reasoningEnabled?: boolean;
  /** Enable voice input */
  enableVoiceInput?: boolean;
  /** Enable file attachments */
  enableAttachments?: boolean;
  /** Enable drag-and-drop */
  enableDragDrop?: boolean;
  /** Max file size in bytes (default 10MB) */
  maxFileSize?: number;
  /** Allowed file types */
  allowedFileTypes?: string[];
}

export interface UnifiedChatSessionProps {
  /** Display mode: 'full' shows all panels, 'basic' shows chat only */
  mode: ChatDisplayMode;
  /** Chat messages to display */
  messages: ChatMessage[];
  /** Streaming message state */
  streamingMessage?: StreamingMessage | null;
  /** Agent display name */
  agentName: string;
  /** Agent status */
  agentStatus?: "active" | "ready" | "busy" | "offline";
  /** Whether messages are loading */
  isLoading?: boolean;
  /** Callback when message is sent (with optional attachments) */
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
  /** Callback to abort current stream */
  onStop?: () => void;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Placeholder text for input */
  placeholder?: string;
  /** Activity feed items (full mode only) */
  activities?: Activity[];
  /** Workspace directory path (full mode only) */
  workspaceDir?: string;
  /** Session key for terminal context (full mode only) */
  sessionKey?: string;
  /** Settings configuration */
  settings?: ChatSessionSettings;
  /** Callback when reasoning toggle changes */
  onReasoningToggle?: (enabled: boolean) => void;
  /** Callback when voice recording completes */
  onVoiceRecorded?: (audioBlob: Blob, transcription?: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Header content slot (for back button, title, etc.) */
  headerSlot?: React.ReactNode;
}

export function UnifiedChatSession({
  mode,
  messages,
  streamingMessage,
  agentName,
  agentStatus = "ready",
  isLoading = false,
  onSend,
  onStop,
  disabled = false,
  placeholder,
  activities = [],
  workspaceDir,
  sessionKey,
  settings = {},
  onReasoningToggle,
  onVoiceRecorded,
  className,
  headerSlot,
}: UnifiedChatSessionProps) {
  // State
  const [workspacePaneMaximized, setWorkspacePaneMaximized] = React.useState(false);
  const [pendingAttachments, setPendingAttachments] = React.useState<ChatAttachment[]>([]);

  // Default settings
  const mergedSettings: Required<ChatSessionSettings> = {
    showReasoningToggle: settings.showReasoningToggle ?? mode === "full",
    reasoningEnabled: settings.reasoningEnabled ?? true,
    enableVoiceInput: settings.enableVoiceInput ?? true,
    enableAttachments: settings.enableAttachments ?? true,
    enableDragDrop: settings.enableDragDrop ?? true,
    maxFileSize: settings.maxFileSize ?? 10 * 1024 * 1024, // 10MB
    allowedFileTypes: settings.allowedFileTypes ?? ["image/*", "application/pdf", ".txt", ".md", ".json"],
  };

  const handleSend = React.useCallback(
    (message: string) => {
      onSend(message, pendingAttachments.length > 0 ? pendingAttachments : undefined);
      setPendingAttachments([]);
    },
    [onSend, pendingAttachments]
  );

  const handleAddAttachment = React.useCallback((attachment: ChatAttachment) => {
    setPendingAttachments((prev) => [...prev, attachment]);
  }, []);

  const handleRemoveAttachment = React.useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  if (mode === "basic") {
    return (
      <BasicChatLayout
        messages={messages}
        streamingMessage={streamingMessage}
        agentName={agentName}
        agentStatus={agentStatus}
        isLoading={isLoading}
        onSend={handleSend}
        onStop={onStop}
        disabled={disabled}
        placeholder={placeholder}
        settings={mergedSettings}
        onReasoningToggle={onReasoningToggle}
        onVoiceRecorded={onVoiceRecorded}
        pendingAttachments={pendingAttachments}
        onAddAttachment={handleAddAttachment}
        onRemoveAttachment={handleRemoveAttachment}
        className={className}
        headerSlot={headerSlot}
      />
    );
  }

  return (
    <FullChatLayout
      messages={messages}
      streamingMessage={streamingMessage}
      agentName={agentName}
      agentStatus={agentStatus}
      isLoading={isLoading}
      onSend={handleSend}
      onStop={onStop}
      disabled={disabled}
      placeholder={placeholder}
      activities={activities}
      workspaceDir={workspaceDir}
      sessionKey={sessionKey}
      settings={mergedSettings}
      onReasoningToggle={onReasoningToggle}
      onVoiceRecorded={onVoiceRecorded}
      pendingAttachments={pendingAttachments}
      onAddAttachment={handleAddAttachment}
      onRemoveAttachment={handleRemoveAttachment}
      workspacePaneMaximized={workspacePaneMaximized}
      onToggleWorkspaceMaximize={() => setWorkspacePaneMaximized((v) => !v)}
      className={className}
      headerSlot={headerSlot}
    />
  );
}

// Placeholder components - will be implemented in subsequent tasks
function BasicChatLayout(props: any) {
  return <div>Basic layout placeholder</div>;
}

function FullChatLayout(props: any) {
  return <div>Full layout placeholder</div>;
}

export default UnifiedChatSession;
```

**Step 2: Export from index**

Add to `src/components/domain/session/index.ts`:
```ts
export { UnifiedChatSession } from "./UnifiedChatSession";
export type {
  ChatDisplayMode,
  ChatAttachment,
  ChatSessionSettings,
  UnifiedChatSessionProps,
} from "./UnifiedChatSession";
```

**Step 3: Commit**

```bash
git add src/components/domain/session/UnifiedChatSession.tsx src/components/domain/session/index.ts
git commit -m "feat(session): add UnifiedChatSession component shell with types"
```

---

### Task 2: Create Enhanced Chat Input with Multi-Modal Support

**Files:**
- Create: `src/components/domain/session/EnhancedChatInput.tsx`
- Create: `src/hooks/use-voice-recorder.ts`

**Step 1: Create voice recorder hook**

```ts
// src/hooks/use-voice-recorder.ts
"use client";

import * as React from "react";

export interface VoiceRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  error: string | null;
}

export interface UseVoiceRecorderReturn extends VoiceRecorderState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  isSupported: boolean;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = React.useState<VoiceRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    error: null,
  });

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<number | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const isSupported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const startRecording = React.useCallback(async () => {
    if (!isSupported) {
      setState((prev) => ({ ...prev, error: "Voice recording not supported" }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms

      // Start duration timer
      timerRef.current = window.setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to start recording",
      }));
    }
  }, [isSupported]);

  const stopRecording = React.useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || "audio/webm",
        });
        setState((prev) => ({ ...prev, isRecording: false, audioBlob: blob }));
        resolve(blob);

        // Cleanup
        streamRef.current?.getTracks().forEach((track) => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const pauseRecording = React.useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resumeRecording = React.useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      timerRef.current = window.setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      setState((prev) => ({ ...prev, isPaused: false }));
    }
  }, []);

  const cancelRecording = React.useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    chunksRef.current = [];
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioBlob: null,
      error: null,
    });
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    isSupported,
  };
}
```

**Step 2: Create EnhancedChatInput component**

```tsx
// src/components/domain/session/EnhancedChatInput.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Paperclip,
  Mic,
  MicOff,
  Send,
  Square,
  X,
  Image as ImageIcon,
  FileText,
  Brain,
  Loader2,
} from "lucide-react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { uuidv7 } from "@/lib/ids";
import type { ChatAttachment, ChatSessionSettings } from "./UnifiedChatSession";

export interface EnhancedChatInputProps {
  /** Callback when message is submitted */
  onSend: (message: string) => void;
  /** Whether the agent is currently streaming */
  isStreaming?: boolean;
  /** Callback to abort stream */
  onStop?: () => void;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Settings */
  settings: Required<ChatSessionSettings>;
  /** Reasoning toggle callback */
  onReasoningToggle?: (enabled: boolean) => void;
  /** Voice recording callback */
  onVoiceRecorded?: (audioBlob: Blob, transcription?: string) => void;
  /** Pending attachments */
  pendingAttachments: ChatAttachment[];
  /** Add attachment callback */
  onAddAttachment: (attachment: ChatAttachment) => void;
  /** Remove attachment callback */
  onRemoveAttachment: (id: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export function EnhancedChatInput({
  onSend,
  isStreaming = false,
  onStop,
  disabled = false,
  placeholder = "Type a message...",
  settings,
  onReasoningToggle,
  onVoiceRecorded,
  pendingAttachments,
  onAddAttachment,
  onRemoveAttachment,
  className,
}: EnhancedChatInputProps) {
  const [message, setMessage] = React.useState("");
  const [isDragOver, setIsDragOver] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const voiceRecorder = useVoiceRecorder();

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled || isStreaming) return;
    onSend(message);
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files || !settings.enableAttachments) return;

    Array.from(files).forEach((file) => {
      if (file.size > settings.maxFileSize) {
        console.warn(`File ${file.name} exceeds max size`);
        return;
      }

      const isImage = file.type.startsWith("image/");
      const attachment: ChatAttachment = {
        id: uuidv7(),
        type: isImage ? "image" : "file",
        name: file.name,
        size: file.size,
        mimeType: file.type,
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      };
      onAddAttachment(attachment);
    });
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (settings.enableDragDrop) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (settings.enableDragDrop) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Voice recording handlers
  const handleVoiceClick = async () => {
    if (voiceRecorder.isRecording) {
      const blob = await voiceRecorder.stopRecording();
      if (blob && onVoiceRecorded) {
        onVoiceRecorded(blob);
      }
    } else {
      await voiceRecorder.startRecording();
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Focus on mount
  React.useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  return (
    <div
      className={cn("bg-background px-4 pb-4 pt-2", className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-2">
        {/* Reasoning toggle */}
        {settings.showReasoningToggle && (
          <div className="flex items-center justify-end gap-2 px-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label htmlFor="reasoning-toggle" className="text-xs text-muted-foreground cursor-pointer">
                    Show reasoning
                  </Label>
                  <Switch
                    id="reasoning-toggle"
                    checked={settings.reasoningEnabled}
                    onCheckedChange={onReasoningToggle}
                    className="scale-75"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Toggle visibility of AI thinking process</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Pending attachments */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2">
            {pendingAttachments.map((attachment) => (
              <AttachmentPreview
                key={attachment.id}
                attachment={attachment}
                onRemove={() => onRemoveAttachment(attachment.id)}
              />
            ))}
          </div>
        )}

        {/* Main input area */}
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border border-border bg-muted/30 p-2 shadow-sm transition-colors",
            "focus-within:border-primary/30 focus-within:bg-muted/50",
            isDragOver && "border-primary border-dashed bg-primary/5"
          )}
        >
          {/* Attachment button */}
          {settings.enableAttachments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={settings.allowedFileTypes.join(",")}
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                aria-label="Attach file"
                disabled={disabled || isStreaming}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            </>
          )}

          {/* Voice input button */}
          {settings.enableVoiceInput && voiceRecorder.isSupported && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={voiceRecorder.isRecording ? "destructive" : "ghost"}
                  size="icon"
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-xl",
                    voiceRecorder.isRecording
                      ? "animate-pulse"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label={voiceRecorder.isRecording ? "Stop recording" : "Start voice input"}
                  disabled={disabled || isStreaming}
                  onClick={handleVoiceClick}
                >
                  {voiceRecorder.isRecording ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{voiceRecorder.isRecording ? `Recording... ${formatDuration(voiceRecorder.duration)}` : "Record voice message"}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Recording indicator */}
          {voiceRecorder.isRecording && (
            <div className="flex items-center gap-2 px-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground">
                {formatDuration(voiceRecorder.duration)}
              </span>
            </div>
          )}

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isDragOver ? "Drop files here..." : placeholder}
            disabled={disabled || voiceRecorder.isRecording}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent py-2 text-sm",
              "placeholder:text-muted-foreground focus:outline-none disabled:opacity-50",
              "scrollbar-thin"
            )}
          />

          {/* Send/Stop button */}
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={onStop}
              className="h-9 w-9 shrink-0 rounded-xl"
              aria-label="Stop generating"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!message.trim() || disabled || voiceRecorder.isRecording}
              className="h-9 w-9 shrink-0 rounded-xl"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

interface AttachmentPreviewProps {
  attachment: ChatAttachment;
  onRemove: () => void;
}

function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  return (
    <div className="relative group">
      {attachment.type === "image" && attachment.previewUrl ? (
        <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-border">
          <img
            src={attachment.previewUrl}
            alt={attachment.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs truncate max-w-[100px]">{attachment.name}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export default EnhancedChatInput;
```

**Step 3: Export from hooks index**

Add to `src/hooks/index.ts` (or create if not exists):
```ts
export { useVoiceRecorder } from "./use-voice-recorder";
export type { VoiceRecorderState, UseVoiceRecorderReturn } from "./use-voice-recorder";
```

**Step 4: Commit**

```bash
git add src/hooks/use-voice-recorder.ts src/components/domain/session/EnhancedChatInput.tsx
git commit -m "feat(session): add EnhancedChatInput with voice recording and drag-drop"
```

---

### Task 3: Implement Basic Chat Layout

**Files:**
- Modify: `src/components/domain/session/UnifiedChatSession.tsx`

**Step 1: Implement BasicChatLayout component**

Replace the placeholder `BasicChatLayout` in `UnifiedChatSession.tsx`:

```tsx
// Add imports at top
import { motion } from "framer-motion";
import { SessionChatMessage } from "./SessionChatMessage";
import { EnhancedChatInput } from "./EnhancedChatInput";
import { ChatMessageSkeleton } from "@/components/composed";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { useAutoScroll } from "@/hooks/use-auto-scroll";

interface BasicChatLayoutProps {
  messages: ChatMessage[];
  streamingMessage?: StreamingMessage | null;
  agentName: string;
  agentStatus: "active" | "ready" | "busy" | "offline";
  isLoading: boolean;
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled: boolean;
  placeholder?: string;
  settings: Required<ChatSessionSettings>;
  onReasoningToggle?: (enabled: boolean) => void;
  onVoiceRecorded?: (audioBlob: Blob, transcription?: string) => void;
  pendingAttachments: ChatAttachment[];
  onAddAttachment: (attachment: ChatAttachment) => void;
  onRemoveAttachment: (id: string) => void;
  className?: string;
  headerSlot?: React.ReactNode;
}

function BasicChatLayout({
  messages,
  streamingMessage,
  agentName,
  agentStatus,
  isLoading,
  onSend,
  onStop,
  disabled,
  placeholder,
  settings,
  onReasoningToggle,
  onVoiceRecorded,
  pendingAttachments,
  onAddAttachment,
  onRemoveAttachment,
  className,
  headerSlot,
}: BasicChatLayoutProps) {
  const {
    scrollRef,
    isAtBottom,
    scrollToBottom,
    disableAutoScroll,
  } = useAutoScroll({
    smooth: true,
    content: messages.length + (streamingMessage?.content?.length ?? 0),
  });

  // Build display messages
  const displayMessages = React.useMemo(() => {
    const result: Array<ChatMessage & {
      id?: string;
      agentName?: string;
      agentStatus?: "active" | "ready";
      isStreaming?: boolean;
    }> = messages.map((msg, i) => ({
      ...msg,
      id: `msg-${i}`,
      agentName: msg.role === "assistant" ? agentName : undefined,
      agentStatus: msg.role === "assistant" ? (agentStatus === "active" ? "active" : "ready") : undefined,
    }));

    if (streamingMessage?.isStreaming) {
      result.push({
        role: "assistant",
        content: streamingMessage.content,
        toolCalls: streamingMessage.toolCalls,
        id: "streaming",
        agentName,
        agentStatus: "active",
        isStreaming: true,
      });
    }

    return result;
  }, [messages, streamingMessage, agentName, agentStatus]);

  const isStreaming = streamingMessage?.isStreaming ?? false;

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-background", className)}>
      {/* Optional header slot */}
      {headerSlot && (
        <div className="shrink-0 border-b border-border">
          {headerSlot}
        </div>
      )}

      {/* Message list */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto px-4 py-6 scrollbar-thin"
          onWheel={disableAutoScroll}
          onTouchMove={disableAutoScroll}
        >
          <div className="mx-auto max-w-3xl space-y-6 pb-4">
            {isLoading ? (
              <>
                <ChatMessageSkeleton />
                <ChatMessageSkeleton />
                <ChatMessageSkeleton />
              </>
            ) : displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-2xl bg-muted/50 p-6">
                  <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Send a message to begin chatting with {agentName}. The agent
                    can help you with tasks, answer questions, and more.
                  </p>
                </div>
              </div>
            ) : (
              displayMessages.map((msg) => (
                <SessionChatMessage key={msg.id} message={msg} />
              ))
            )}
          </div>
        </div>

        {/* Scroll to bottom button */}
        {!isAtBottom && (
          <Button
            onClick={scrollToBottom}
            size="icon"
            variant="outline"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md z-10 bg-background"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Enhanced chat input */}
      <div className="shrink-0">
        <EnhancedChatInput
          onSend={onSend}
          isStreaming={isStreaming}
          onStop={onStop}
          disabled={disabled || isLoading}
          placeholder={placeholder ?? `Message ${agentName}...`}
          settings={settings}
          onReasoningToggle={onReasoningToggle}
          onVoiceRecorded={onVoiceRecorded}
          pendingAttachments={pendingAttachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
        />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/domain/session/UnifiedChatSession.tsx
git commit -m "feat(session): implement BasicChatLayout for unified component"
```

---

### Task 4: Implement Full Chat Layout

**Files:**
- Modify: `src/components/domain/session/UnifiedChatSession.tsx`

**Step 1: Implement FullChatLayout component**

Replace the placeholder `FullChatLayout` in `UnifiedChatSession.tsx`:

```tsx
// Add imports at top (if not already)
import { SessionActivityFeed } from "./SessionActivityFeed";
import { SessionWorkspacePane } from "./SessionWorkspacePane";

interface FullChatLayoutProps extends BasicChatLayoutProps {
  activities: Activity[];
  workspaceDir?: string;
  sessionKey?: string;
  workspacePaneMaximized: boolean;
  onToggleWorkspaceMaximize: () => void;
}

function FullChatLayout({
  messages,
  streamingMessage,
  agentName,
  agentStatus,
  isLoading,
  onSend,
  onStop,
  disabled,
  placeholder,
  activities,
  workspaceDir,
  sessionKey,
  settings,
  onReasoningToggle,
  onVoiceRecorded,
  pendingAttachments,
  onAddAttachment,
  onRemoveAttachment,
  workspacePaneMaximized,
  onToggleWorkspaceMaximize,
  className,
  headerSlot,
}: FullChatLayoutProps) {
  const {
    scrollRef,
    isAtBottom,
    scrollToBottom,
    disableAutoScroll,
  } = useAutoScroll({
    smooth: true,
    content: messages.length + (streamingMessage?.content?.length ?? 0),
  });

  // Build display messages (same as BasicChatLayout)
  const displayMessages = React.useMemo(() => {
    const result: Array<ChatMessage & {
      id?: string;
      agentName?: string;
      agentStatus?: "active" | "ready";
      isStreaming?: boolean;
    }> = messages.map((msg, i) => ({
      ...msg,
      id: `msg-${i}`,
      agentName: msg.role === "assistant" ? agentName : undefined,
      agentStatus: msg.role === "assistant" ? (agentStatus === "active" ? "active" : "ready") : undefined,
    }));

    if (streamingMessage?.isStreaming) {
      result.push({
        role: "assistant",
        content: streamingMessage.content,
        toolCalls: streamingMessage.toolCalls,
        id: "streaming",
        agentName,
        agentStatus: "active",
        isStreaming: true,
      });
    }

    return result;
  }, [messages, streamingMessage, agentName, agentStatus]);

  const isStreaming = streamingMessage?.isStreaming ?? false;

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-background", className)}>
      {/* Optional header slot */}
      {headerSlot && (
        <div className="shrink-0 border-b border-border">
          {headerSlot}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Chat section (center) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "flex-1 min-w-0 min-h-0 flex flex-col",
            workspacePaneMaximized && "hidden"
          )}
        >
          {/* Message list */}
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto px-4 py-6 scrollbar-thin"
              onWheel={disableAutoScroll}
              onTouchMove={disableAutoScroll}
            >
              <div className="mx-auto max-w-3xl space-y-6 pb-4">
                {isLoading ? (
                  <>
                    <ChatMessageSkeleton />
                    <ChatMessageSkeleton />
                    <ChatMessageSkeleton />
                  </>
                ) : displayMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-2xl bg-muted/50 p-6">
                      <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Send a message to begin chatting with {agentName}. The agent
                        can help you with tasks, answer questions, and more.
                      </p>
                    </div>
                  </div>
                ) : (
                  displayMessages.map((msg) => (
                    <SessionChatMessage key={msg.id} message={msg} />
                  ))
                )}
              </div>
            </div>

            {/* Scroll to bottom */}
            {!isAtBottom && (
              <Button
                onClick={scrollToBottom}
                size="icon"
                variant="outline"
                className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md z-10 bg-background"
                aria-label="Scroll to bottom"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Enhanced chat input */}
          <div className="shrink-0">
            <EnhancedChatInput
              onSend={onSend}
              isStreaming={isStreaming}
              onStop={onStop}
              disabled={disabled || isLoading}
              placeholder={placeholder ?? `Message ${agentName}...`}
              settings={settings}
              onReasoningToggle={onReasoningToggle}
              onVoiceRecorded={onVoiceRecorded}
              pendingAttachments={pendingAttachments}
              onAddAttachment={onAddAttachment}
              onRemoveAttachment={onRemoveAttachment}
            />
          </div>
        </motion.div>

        {/* Right sidebar (activity + workspace) */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className={cn(
            "w-[380px] border-l border-border/50 flex flex-col bg-card/30",
            workspacePaneMaximized && "flex-1 w-full"
          )}
        >
          {/* Activity Feed (top) - hidden when maximized */}
          {!workspacePaneMaximized && (
            <div className="h-[280px] border-b border-border/50 overflow-hidden shrink-0">
              <div className="px-4 py-3 border-b border-border/50">
                <h3 className="text-sm font-medium">Activity</h3>
              </div>
              <SessionActivityFeed activities={activities} maxItems={8} />
            </div>
          )}

          {/* Workspace Pane (bottom or full when maximized) */}
          <div className={cn("flex-1 min-h-0", workspacePaneMaximized && "p-4")}>
            <SessionWorkspacePane
              isMaximized={workspacePaneMaximized}
              onToggleMaximize={onToggleWorkspaceMaximize}
              sessionKey={sessionKey}
              workspaceDir={workspaceDir ?? "~/.clawdbrain/workspace"}
              className="h-full"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/domain/session/UnifiedChatSession.tsx
git commit -m "feat(session): implement FullChatLayout with activity feed and workspace"
```

---

## Phase 2: Bug Fixes (From Original Request)

### Task 5: Fix Refresh Icon - Show Only in File Explorer Tab

**Files:**
- Modify: `src/components/domain/session/SessionWorkspacePane.tsx:126-135`

**Step 1: Change the conditional to show refresh only for files tab**

Find and replace line 126:
```tsx
// BEFORE:
{activeTab === "terminal" && (
  <Button
    variant="ghost"
    ...
  >
    <RefreshCw className="h-3.5 w-3.5" />
  </Button>
)}

// AFTER:
{activeTab === "files" && (
  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7"
    onClick={handleRefreshFiles}
    title="Refresh file list"
  >
    <RefreshCw className="h-3.5 w-3.5" />
  </Button>
)}
```

**Step 2: Add handleRefreshFiles function**

Add before the return statement:
```tsx
const handleRefreshFiles = () => {
  // TODO: Implement actual file refresh from backend
  console.log("Refreshing file list...");
};
```

**Step 3: Remove the terminal refresh handler** (or rename it)

The `handleRefreshTerminal` function can be removed since refresh is no longer available on terminal tab.

**Step 4: Commit**

```bash
git add src/components/domain/session/SessionWorkspacePane.tsx
git commit -m "fix(session): move refresh button from terminal to file explorer tab"
```

---

### Task 6: Fix Tool Access Spacing

**Files:**
- Modify: `src/components/domain/tools/ToolCategorySection.tsx:72`

**Step 1: Add top padding to CardContent**

```tsx
// BEFORE:
<CardContent className="space-y-3 pt-0">

// AFTER:
<CardContent className="space-y-3 pt-4">
```

**Step 2: Commit**

```bash
git add src/components/domain/tools/ToolCategorySection.tsx
git commit -m "fix(tools): add spacing between category header and first tool"
```

---

### Task 7: Remove Add Custom Tool Button from ToolAccessConfig

**Files:**
- Modify: `src/components/domain/tools/ToolAccessConfig.tsx`

**Step 1: Remove showAddCustomTool prop usage and button**

Remove lines 56-61 (the Add Custom Tool button) and the prop from the interface:

```tsx
// Remove from interface:
// showAddCustomTool?: boolean;

// Remove from function params:
// showAddCustomTool = false,

// Remove the entire button block in the header
```

**Step 2: Update the header to remove button reference**

```tsx
{showHeader && (
  <div className="flex items-center justify-between">
    <div>
      <h3 className="font-medium">Tool Access</h3>
      <p className="text-sm text-muted-foreground">
        {enabled} of {total} tools enabled
      </p>
    </div>
    {/* Button removed - tool management happens in system settings */}
  </div>
)}
```

**Step 3: Commit**

```bash
git add src/components/domain/tools/ToolAccessConfig.tsx
git commit -m "fix(tools): remove Add Custom Tool button (managed elsewhere)"
```

---

### Task 8: Add Links to Ritual Cards in Agent Overview

**Files:**
- Modify: `src/components/domain/agents/AgentOverviewTab.tsx:122-152`

**Step 1: Import Link from router**

```tsx
import { Link } from "@tanstack/react-router";
```

**Step 2: Wrap ritual cards with Link**

```tsx
// BEFORE:
<motion.div
  key={ritual.id}
  initial={{ opacity: 0, y: 5 }}
  animate={{ opacity: 1, y: 0 }}
  className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3"
>
  ...
</motion.div>

// AFTER:
<Link
  key={ritual.id}
  to="/rituals/$ritualId"
  params={{ ritualId: ritual.id }}
  className="block"
>
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3 hover:bg-card/80 hover:border-primary/30 transition-colors cursor-pointer"
  >
    ...
  </motion.div>
</Link>
```

**Step 3: Do the same for workstream cards (lines 84-103)**

```tsx
<Link
  key={workstream.id}
  to="/workstreams/$workstreamId"
  params={{ workstreamId: workstream.id }}
  className="block"
>
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-lg border border-border/50 bg-card/50 p-3 hover:bg-card/80 hover:border-primary/30 transition-colors cursor-pointer"
  >
    ...
  </motion.div>
</Link>
```

**Step 4: Commit**

```bash
git add src/components/domain/agents/AgentOverviewTab.tsx
git commit -m "feat(agents): add navigation links to ritual and workstream cards"
```

---

### Task 9: Fix Active Workstreams Alignment with Workstreams Tab

**Files:**
- Modify: `src/components/domain/agents/AgentOverviewTab.tsx:39`
- Review: `src/components/domain/agents/AgentWorkstreamsTab.tsx`

**Step 1: Check how AgentWorkstreamsTab filters workstreams**

Read the workstreams tab to understand the data source and filtering.

**Step 2: Update the filter logic**

The issue is likely that the `status` field doesn't match. Update the filter:

```tsx
// BEFORE:
const activeWorkstreams = workstreams.filter((w) => w.status === "active");

// AFTER (more inclusive - show workstreams that aren't completed/archived):
const activeWorkstreams = workstreams.filter((w) =>
  w.status === "active" || w.status === "in_progress" || !w.status
);
```

**Step 3: Commit**

```bash
git add src/components/domain/agents/AgentOverviewTab.tsx
git commit -m "fix(agents): align active workstreams filter with workstreams tab"
```

---

## Phase 3: Route Migration

### Task 10: Migrate /conversations/$id to Use UnifiedChatSession

**Files:**
- Modify: `src/routes/conversations/$id.tsx`

**Step 1: Import UnifiedChatSession**

```tsx
import { UnifiedChatSession } from "@/components/domain/session";
```

**Step 2: Replace the component body with UnifiedChatSession**

The entire render section (after loading/error handling) should become:

```tsx
return (
  <div className="h-screen">
    <UnifiedChatSession
      mode="basic"
      messages={messages ?? []}
      streamingMessage={null} // Wire up if streaming is enabled
      agentName={agent?.name ?? "Assistant"}
      agentStatus={agent?.status === "online" ? "active" : "ready"}
      isLoading={isLoading}
      onSend={handleSubmit}
      onStop={() => {}}
      disabled={sendMessage.isPending}
      placeholder={`Message ${agent?.name || "AI"}...`}
      settings={{
        showReasoningToggle: false,
        enableVoiceInput: true,
        enableAttachments: true,
        enableDragDrop: true,
      }}
      headerSlot={
        <ChatHeader
          agent={agent ?? undefined}
          title={conversation.title}
          onBack={handleBack}
          onSettings={() => setIsSettingsOpen(true)}
        />
      }
    />
    <ChatSettingsPanel
      open={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      conversation={conversation}
      agent={agent ?? undefined}
      messageCount={messages?.length ?? 0}
      onClearHistory={handleClearHistory}
      onDeleteConversation={handleDeleteConversation}
    />
  </div>
);
```

**Step 3: Commit**

```bash
git add src/routes/conversations/\$id.tsx
git commit -m "refactor(conversations): migrate to UnifiedChatSession component"
```

---

### Task 11: Migrate Agent Session Page to Use UnifiedChatSession

**Files:**
- Modify: `src/routes/agents/$agentId/session/$sessionKey.tsx`

**Step 1: Import UnifiedChatSession**

```tsx
import { UnifiedChatSession, SessionHeader } from "@/components/domain/session";
```

**Step 2: Replace the main render with UnifiedChatSession**

```tsx
return (
  <div className="h-screen">
    <UnifiedChatSession
      mode="full"
      messages={chatHistory?.messages ?? []}
      streamingMessage={streamingMessage}
      agentName={agent.name}
      agentStatus={agent.status === "online" ? "active" : "ready"}
      isLoading={chatLoading}
      onSend={handleSend}
      onStop={handleStop}
      disabled={false}
      activities={activities}
      workspaceDir={`~/.clawdbrain/agents/${agentId}/workspace`}
      sessionKey={sessionKey}
      settings={{
        showReasoningToggle: true,
        reasoningEnabled: true,
        enableVoiceInput: true,
        enableAttachments: true,
        enableDragDrop: true,
      }}
      headerSlot={
        <SessionHeader
          agent={agent}
          sessions={sessions ?? []}
          selectedSessionKey={sessionKey}
          onSessionChange={handleSessionChange}
          onNewSession={handleNewSession}
        />
      }
    />
  </div>
);
```

**Step 3: Commit**

```bash
git add src/routes/agents/\$agentId/session/\$sessionKey.tsx
git commit -m "refactor(agents): migrate session page to UnifiedChatSession"
```

---

## Phase 4: xterm Fix Investigation

### Task 12: Fix xterm Module Resolution

**Files:**
- Investigate: `vite.config.ts`
- Modify: `src/components/composed/WebTerminal.tsx`

**Step 1: Check Vite config for externalization or optimization settings**

The `/* @vite-ignore */` comments force Vite to skip bundling. This works for dev but may fail in production or when modules aren't properly resolved.

**Step 2: Alternative approach - use standard imports with lazy loading**

```tsx
// Replace the loadXterm function with standard dynamic imports
const loadXterm = async () => {
  const { Terminal } = await import("@xterm/xterm");
  const { FitAddon } = await import("@xterm/addon-fit");
  const { WebLinksAddon } = await import("@xterm/addon-web-links");
  const { SearchAddon } = await import("@xterm/addon-search");
  const { ClipboardAddon } = await import("@xterm/addon-clipboard");

  // Import CSS
  await import("@xterm/xterm/css/xterm.css");

  return { Terminal, FitAddon, WebLinksAddon, SearchAddon, ClipboardAddon };
};
```

**Step 3: If still failing, check that packages are in dependencies (not devDependencies)**

Verify in `package.json`:
```json
"dependencies": {
  "@xterm/xterm": "^5.5.0",
  "@xterm/addon-fit": "^0.10.0",
  // etc.
}
```

**Step 4: Run dev server and verify terminal loads**

```bash
pnpm dev
# Navigate to a page with terminal and verify no console errors
```

**Step 5: Commit**

```bash
git add src/components/composed/WebTerminal.tsx vite.config.ts
git commit -m "fix(terminal): resolve xterm module loading issues"
```

---

## Summary

This plan creates:

### Phase 0: Critical UX Fixes (Tasks 0A-0C)
- **Vertical layout fix** - Ensure chat UI never overflows viewport; message input always visible
- **Message author clarity** - Avatar ring, bolder author text, separator line between header and content
- **Multi-modal output** - MessageContentRenderer for images, audio, files, code blocks, reasoning streams

### Phase 1: Core Unified Component (Tasks 1-4)
- **UnifiedChatSession** - Reusable component supporting Full and Basic display modes
- **EnhancedChatInput** - Multi-modal input with voice recording, drag-drop, attachments
- **useVoiceRecorder** - Custom hook for Web Audio API voice recording
- **BasicChatLayout** and **FullChatLayout** - Two layout modes for different use cases

### Phase 2: Bug Fixes (Tasks 5-9)
- Refresh icon placement (terminal → files tab)
- Tool access spacing
- Remove Add Custom Tool button
- Ritual/workstream card linking
- Active workstreams filter alignment

### Phase 3: Route Migration (Tasks 10-11)
- Migrate `/conversations/$id` to use UnifiedChatSession (basic mode)
- Migrate agent session page to use UnifiedChatSession (full mode)

### Phase 4: xterm Fix (Task 12)
- Resolve terminal module resolution issues

The unified component will replace the disparate chat UIs across the app, providing a consistent experience with multi-modal I/O and configurable feature sets.

---

## Task Summary Table

| Task ID | Phase | Description | Files |
|---------|-------|-------------|-------|
| 0A | 0 | Fix vertical layout overflow | session routes, SessionChat |
| 0B | 0 | Improve message author clarity | SessionChatMessage, AgentAvatar |
| 0C | 0 | Add multi-modal output support | MessageContentRenderer (new), SessionChatMessage |
| 1 | 1 | Create UnifiedChatSession shell | UnifiedChatSession (new) |
| 2 | 1 | Create EnhancedChatInput | EnhancedChatInput (new), use-voice-recorder (new) |
| 3 | 1 | Implement BasicChatLayout | UnifiedChatSession |
| 4 | 1 | Implement FullChatLayout | UnifiedChatSession |
| 5 | 2 | Fix refresh icon placement | SessionWorkspacePane |
| 6 | 2 | Fix tool access spacing | ToolCategorySection |
| 7 | 2 | Remove Add Custom Tool | ToolAccessConfig |
| 8 | 2 | Add ritual/workstream links | AgentOverviewTab |
| 9 | 2 | Fix active workstreams filter | AgentOverviewTab |
| 10 | 3 | Migrate conversations route | conversations/$id.tsx |
| 11 | 3 | Migrate agent session route | agents/$agentId/session/$sessionKey.tsx |
| 12 | 4 | Fix xterm module resolution | WebTerminal, vite.config |
