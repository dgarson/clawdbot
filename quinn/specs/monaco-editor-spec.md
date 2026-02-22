# Spec: Monaco Editor Integration (#12)
*Branch: `luis/ui-redesign` | Worktree: `/Users/openclaw/openclaw-ui-redesign/apps/web/`*

## Goal
Replace the `<textarea>` in `AgentFileEditor` with Monaco Editor for expert-mode file editing. Must be lazy-loaded (Monaco is large) and should degrade gracefully.

## File to modify
`/Users/openclaw/openclaw-ui-redesign/apps/web/src/components/domain/agents/AgentFileEditor.tsx`

The component currently has a plain `<textarea>` for editing. Find it around line 162 and replace with Monaco.

## Implementation

### 1. Install Monaco (already in package.json? check first)
```bash
cd /Users/openclaw/openclaw-ui-redesign/apps/web
cat package.json | grep monaco
```
If not installed:
```bash
pnpm add @monaco-editor/react
```

### 2. Create lazy Monaco wrapper
Create `/Users/openclaw/openclaw-ui-redesign/apps/web/src/components/domain/agents/MonacoFileEditor.tsx`:

```tsx
"use client";
import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-load Monaco — it's ~2MB, must not block initial render
const MonacoEditor = React.lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default }))
);

export interface MonacoFileEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;  // auto-detect from filename
  readOnly?: boolean;
  height?: string;
}

function detectLanguage(filename: string): string {
  if (filename.endsWith(".md")) return "markdown";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".ts") || filename.endsWith(".tsx")) return "typescript";
  if (filename.endsWith(".js") || filename.endsWith(".jsx")) return "javascript";
  if (filename.endsWith(".yaml") || filename.endsWith(".yml")) return "yaml";
  if (filename.endsWith(".sh")) return "shell";
  return "plaintext";
}

export function MonacoFileEditor({ value, onChange, language = "markdown", readOnly = false, height = "400px" }: MonacoFileEditorProps) {
  return (
    <React.Suspense fallback={
      <div style={{ height }} className="rounded-md overflow-hidden">
        <Skeleton className="w-full h-full" />
      </div>
    }>
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          lineNumbers: "on",
          wordWrap: "on",
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "gutter",
          smoothScrolling: true,
          cursorBlinking: "smooth",
          formatOnPaste: true,
          automaticLayout: true,
        }}
      />
    </React.Suspense>
  );
}

export { detectLanguage };
```

### 3. Update AgentFileEditor
In `AgentFileEditor.tsx`, import and use `MonacoFileEditor` instead of `<textarea>`:

- Import: `import { MonacoFileEditor, detectLanguage } from "./MonacoFileEditor";`
- Replace the `<textarea>` element with:
```tsx
<MonacoFileEditor
  value={localContent}
  onChange={handleContentChange}
  language={detectLanguage(fileName)}
  height="500px"
/>
```
- Remove the textarea's className, value, onChange etc.
- Keep all the save/revert/unsaved changes logic unchanged — only the editor element changes.

### 4. Add Monaco to vendor chunks in vite.config
Check `/Users/openclaw/openclaw-ui-redesign/apps/web/vite.config.ts` and add monaco to manual chunks if needed (it should already lazy-load via dynamic import).

## Acceptance Criteria
- [ ] `@monaco-editor/react` installed
- [ ] `MonacoFileEditor.tsx` created with lazy loading
- [ ] `AgentFileEditor.tsx` uses Monaco instead of textarea
- [ ] Build passes: `cd /Users/openclaw/openclaw-ui-redesign/apps/web && npx vite build` — should succeed in ~10s
- [ ] Monaco appears in a separate chunk (check dist/assets for monaco)
- [ ] Fallback skeleton shows while Monaco loads
- [ ] File: commit on `luis/ui-redesign` branch with message `feat(ui): Monaco editor for agent file editing (#12)`

## DO NOT
- Do not change the save/load logic
- Do not add routing changes
- Do not modify other files than the two above (+ vite.config if needed)
- Do not use `require()` — ESM only
