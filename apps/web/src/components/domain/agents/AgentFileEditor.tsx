
import * as React from "react";
import { motion } from "framer-motion";
import {
  Save,
  RotateCcw,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgentFile, useAgentFileSave } from "@/hooks/queries/useAgentFiles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentFileEditorProps {
  agentId: string;
  fileName: string;
  title?: string;
  description?: string;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentFileEditor({
  agentId,
  fileName,
  title,
  description,
  placeholder,
}: AgentFileEditorProps) {
  const { file, content, isLoading, error: loadError, refetch } = useAgentFile(agentId, fileName);
  const { save, isSaving, error: saveError, reset: resetSave } = useAgentFileSave();

  const [localContent, setLocalContent] = React.useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // Sync remote → local
  React.useEffect(() => {
    if (content != null && !hasUnsavedChanges) {
      setLocalContent(content);
    }
  }, [content, hasUnsavedChanges]);

  const handleContentChange = (value: string) => {
    setLocalContent(value);
    setHasUnsavedChanges(value !== (content ?? ""));
    setSaveSuccess(false);
    resetSave();
  };

  const handleSave = async () => {
    try {
      await save(agentId, fileName, localContent);
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      void refetch();
    } catch {
      // Error captured in saveError
    }
  };

  const handleRevert = () => {
    setLocalContent(content ?? "");
    setHasUnsavedChanges(false);
    setSaveSuccess(false);
    resetSave();
  };

  // Ctrl/Cmd+S
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && !isSaving) {
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasUnsavedChanges, isSaving, localContent]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              {title ?? fileName}
              {hasUnsavedChanges && (
                <Badge variant="outline" className="ml-2 text-amber-500 border-amber-500/30">
                  Unsaved
                </Badge>
              )}
              {saveSuccess && (
                <Badge variant="outline" className="ml-2 text-emerald-500 border-emerald-500/30">
                  <CheckCircle2 className="size-3 mr-1" />
                  Saved
                </Badge>
              )}
            </CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevert}
              disabled={!hasUnsavedChanges || isSaving}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Revert
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasUnsavedChanges || isSaving}
              className="gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
              <kbd className="ml-1 hidden rounded border border-border/50 px-1 py-0.5 text-[10px] font-normal text-muted-foreground sm:inline-block">
                ⌘S
              </kbd>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading {fileName}…</span>
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="size-4 inline mr-2" />
            Failed to load: {String(loadError)}
          </div>
        ) : (
          <textarea
            value={localContent}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={placeholder ?? `Enter ${fileName} content...`}
            className="w-full min-h-[400px] rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm leading-relaxed text-foreground outline-none resize-y focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            spellCheck={false}
          />
        )}

        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="size-4 inline mr-2" />
            Failed to save: {String(saveError)}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
