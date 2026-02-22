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
