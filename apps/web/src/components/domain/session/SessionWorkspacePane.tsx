/**
 * SessionWorkspacePane — files panel for the right sidebar.
 *
 * Shows a file-tree explorer. Selecting a file reveals a preview pane
 * below the tree (split layout). Terminal has been moved to TerminalOverlay.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  RefreshCw,
  ChevronDown,
  X,
} from "lucide-react";
import { FilePreviewPanel } from "./FilePreviewPanel";
import { createWorktreeGatewayAdapter } from "@/integrations/worktree/gateway";

export interface SessionWorkspacePaneProps {
  workspaceDir?: string;
  agentId?: string;
  className?: string;
}

// ── Types ──────────────────────────────────────────────────────────

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
}

// ── Mock data ──────────────────────────────────────────────────────

const mockFileTree: FileNode[] = [
  {
    name: "workspace",
    type: "folder",
    children: [
      { name: "README.md", type: "file" },
      { name: "notes.txt", type: "file" },
      {
        name: "research",
        type: "folder",
        children: [
          { name: "findings.md", type: "file" },
          { name: "data.json", type: "file" },
        ],
      },
      {
        name: "scripts",
        type: "folder",
        children: [
          { name: "analyze.py", type: "file" },
          { name: "export.sh", type: "file" },
        ],
      },
    ],
  },
];

// ── Main component ─────────────────────────────────────────────────

export function SessionWorkspacePane({
  workspaceDir = "~/.clawdbrain/agents/default/workspace",
  agentId,
  className,
}: SessionWorkspacePaneProps) {
  const [revision, setRevision] = React.useState(0);
  const [selectedFile, setSelectedFile] = React.useState<(FileNode & { path: string }) | null>(null);
  const [fileContent, setFileContent] = React.useState("");
  const [fileLoading, setFileLoading] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const worktreeAdapter = React.useMemo(() => createWorktreeGatewayAdapter(), []);

  const handleFileClick = React.useCallback(
    async (node: FileNode, path: string) => {
      if (node.type === "folder") {return;}

      setSelectedFile({ ...node, path });
      setFileLoading(true);
      setFileError(null);

      if (!agentId) {
        setFileError("Agent ID not available");
        setFileLoading(false);
        return;
      }

      try {
        const result = await worktreeAdapter.readFile?.(agentId, path, {
          signal: new AbortController().signal,
        });
        setFileContent(result?.content ?? "");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Not connected")) {
          setFileError("Not connected to gateway.");
        } else {
          setFileError(msg || "Failed to load file");
        }
      } finally {
        setFileLoading(false);
      }
    },
    [agentId, worktreeAdapter]
  );

  const clearSelection = () => {
    setSelectedFile(null);
    setFileContent("");
    setFileError(null);
  };

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono truncate">{workspaceDir}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {selectedFile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={clearSelection}
              title="Back to files"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setRevision((v) => v + 1)}
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content: tree or tree+preview split */}
      {selectedFile ? (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="h-[38%] overflow-auto border-b border-border/50 shrink-0">
            <FileExplorer
              key={revision}
              files={mockFileTree}
              workspaceDir={workspaceDir}
              onFileClick={handleFileClick}
              selectedPath={selectedFile.path}
            />
          </div>
          <div className="flex-1 min-h-0">
            <FilePreviewPanel
              file={selectedFile}
              content={fileContent}
              loading={fileLoading}
              error={fileError}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <FileExplorer
            key={revision}
            files={mockFileTree}
            workspaceDir={workspaceDir}
            onFileClick={handleFileClick}
          />
        </div>
      )}
    </div>
  );
}

// ── FileExplorer ───────────────────────────────────────────────────

interface FileExplorerProps {
  files: FileNode[];
  workspaceDir: string;
  onFileClick?: (node: FileNode, path: string) => void;
  selectedPath?: string;
}

function FileExplorer({ files, onFileClick, selectedPath }: FileExplorerProps) {
  return (
    <div className="p-2 space-y-0.5">
      {files.map((node) => (
        <FileTreeNode
          key={node.name}
          node={node}
          depth={0}
          parentPath=""
          onFileClick={onFileClick}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  parentPath: string;
  onFileClick?: (node: FileNode, path: string) => void;
  selectedPath?: string;
}

function FileTreeNode({ node, depth, parentPath, onFileClick, selectedPath }: FileTreeNodeProps) {
  const [expanded, setExpanded] = React.useState(true);
  const path = parentPath ? `${parentPath}/${node.name}` : node.name;
  const isFolder = node.type === "folder";
  const isSelected = selectedPath === path;

  return (
    <div>
      <button
        type="button"
        onClick={() => (isFolder ? setExpanded((v) => !v) : onFileClick?.(node, path))}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors",
          "hover:bg-muted/50",
          isSelected && "bg-accent"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isFolder ? (
          <>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform shrink-0",
                !expanded && "-rotate-90"
              )}
            />
            <FolderOpen className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <FileIcon filename={node.name} />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {isFolder && expanded && node.children?.map((child) => (
        <FileTreeNode
          key={child.name}
          node={child}
          depth={depth + 1}
          parentPath={path}
          onFileClick={onFileClick}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (ext) {
    case "md":   return <span className={cls}>📄</span>;
    case "json": return <span className={cls}>📋</span>;
    case "py":   return <span className={cls}>🐍</span>;
    case "sh":   return <span className={cls}>⚡</span>;
    case "txt":  return <span className={cls}>📝</span>;
    default:     return <span className={cls}>📄</span>;
  }
}

export default SessionWorkspacePane;
