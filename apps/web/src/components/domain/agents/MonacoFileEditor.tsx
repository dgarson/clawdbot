"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonacoFileEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  fileName?: string;
  onSave?: () => void;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

function detectLanguage(fileName?: string): string {
  if (!fileName) return "plaintext";
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const map: Record<string, string> = {
    ".md": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".sh": "shell",
    ".toml": "toml",
  };
  return map[ext] ?? "plaintext";
}

// ---------------------------------------------------------------------------
// Theme detection
// ---------------------------------------------------------------------------

function detectTheme(): "vs-dark" | "light" {
  return document.documentElement.classList.contains("dark") ? "vs-dark" : "light";
}

// ---------------------------------------------------------------------------
// Lazy-loaded Monaco inner component
// ---------------------------------------------------------------------------

const LazyMonacoEditor = React.lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.Editor }))
);

// ---------------------------------------------------------------------------
// Fallback textarea (used when Monaco fails to load)
// ---------------------------------------------------------------------------

function FallbackTextarea({
  value,
  onChange,
  placeholder,
}: Pick<MonacoFileEditorProps, "value" | "onChange" | "placeholder">) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Enter content…"}
      className="w-full min-h-[500px] rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm leading-relaxed text-foreground outline-none resize-y focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
      spellCheck={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function EditorSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] rounded-lg border border-border bg-muted/30 gap-3">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Loading editor…</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner Monaco editor (wraps @monaco-editor/react Editor)
// ---------------------------------------------------------------------------

interface InnerEditorProps {
  value: string;
  onChange: (val: string) => void;
  language: string;
  theme: "vs-dark" | "light";
  onSave?: () => void;
}

function InnerEditor({ value, onChange, language, theme, onSave }: InnerEditorProps) {
  // We keep a ref to the monaco instance to register the Cmd+S action
  const monacoRef = React.useRef<Parameters<import("@monaco-editor/react").OnMount>[1] | null>(null);
  const editorRef = React.useRef<Parameters<import("@monaco-editor/react").OnMount>[0] | null>(null);

  const handleMount: import("@monaco-editor/react").OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    if (onSave) {
      editor.addAction({
        id: "oclaw-save",
        label: "Save File",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
          onSave();
        },
      });
    }
  };

  const handleChange = (val: string | undefined) => {
    onChange(val ?? "");
  };

  return (
    <div className="min-h-[500px] rounded-lg border border-border overflow-hidden">
      <LazyMonacoEditor
        height="500px"
        language={language}
        theme={theme}
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          wordWrap: "on",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "JetBrains Mono, Fira Code, monospace",
          automaticLayout: true,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error boundary for graceful fallback
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
}

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

class MonacoErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function MonacoFileEditor({
  value,
  onChange,
  placeholder,
  fileName,
  onSave,
}: MonacoFileEditorProps) {
  const language = detectLanguage(fileName);
  const [theme, setTheme] = React.useState<"vs-dark" | "light">(detectTheme);

  // Keep theme in sync with document dark-mode class changes
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(detectTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const fallback = (
    <FallbackTextarea value={value} onChange={onChange} placeholder={placeholder} />
  );

  return (
    <MonacoErrorBoundary fallback={fallback}>
      <React.Suspense fallback={<EditorSkeleton />}>
        <InnerEditor
          value={value}
          onChange={onChange}
          language={language}
          theme={theme}
          onSave={onSave}
        />
      </React.Suspense>
    </MonacoErrorBoundary>
  );
}
