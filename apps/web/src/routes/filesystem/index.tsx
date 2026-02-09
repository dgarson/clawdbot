"use client";

import * as React from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RouteErrorFallback } from "@/components/composed";
import {
  FolderOpen,
  Folder,
  File,
  FileText,
  FileJson,
  FileCode,
  ChevronRight,
  ChevronDown,
  Download,
  Trash2,
  Edit2,
  Save,
  X,
  HardDrive,
  Loader2,
} from "lucide-react";
import { createWorktreeGatewayAdapter } from "@/integrations/worktree/gateway";
import { useAgents } from "@/hooks/queries/useAgents";
import { buildWorktreeTree, mapWorktreeError, type WorktreeTreeNode } from "@/lib/worktree-utils";

export const Route = createFileRoute("/filesystem/")({
  component: FilesystemPage,
  errorComponent: RouteErrorFallback,
});

type FileNode = WorktreeTreeNode;

function FilesystemPage() {
  const powerUserMode = useUIStore((s) => s.powerUserMode);
  const worktreeAdapter = React.useMemo(() => createWorktreeGatewayAdapter(), []);
  const { data: agents = [] } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("");
  const [selectedFile, setSelectedFile] = React.useState<FileNode | null>(null);
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [treeEntries, setTreeEntries] = React.useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = React.useState(false);
  const [treeError, setTreeError] = React.useState<string | null>(null);
  const [fileContent, setFileContent] = React.useState("");
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [fileLoading, setFileLoading] = React.useState(false);
  const activeFileRequest = React.useRef<{ path: string; controller: AbortController } | null>(
    null
  );
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [fileToDelete, setFileToDelete] = React.useState<FileNode | null>(null);

  if (!powerUserMode) {
    return <Navigate to="/" />;
  }

  React.useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0]?.id ?? "");
    }
  }, [agents, selectedAgentId]);

  React.useEffect(() => {
    setSelectedFile(null);
    setFileContent("");
    setFileError(null);
    setIsEditing(false);
    setExpandedFolders(new Set());
    if (activeFileRequest.current) {
      activeFileRequest.current.controller.abort();
      activeFileRequest.current = null;
    }
  }, [selectedAgentId]);

  const loadTree = React.useCallback(
    async (signal: AbortSignal) => {
      if (!selectedAgentId) {
        setTreeEntries([]);
        setTreeError("Select an agent to browse workspace files.");
        return;
      }

      setTreeLoading(true);
      setTreeError(null);
      try {
        const result = await worktreeAdapter.list(
          selectedAgentId,
          "/",
          { signal },
          { recursive: true, includeHidden: true }
        );
        setTreeEntries(buildWorktreeTree(result.entries));
      } catch (err) {
        const info = mapWorktreeError(err);
        setTreeError(`${info.title}: ${info.message}`);
        setTreeEntries([]);
      } finally {
        setTreeLoading(false);
      }
    },
    [selectedAgentId, worktreeAdapter]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void loadTree(controller.signal);
    return () => controller.abort();
  }, [loadTree]);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFileClick = (file: FileNode) => {
    if (file.type === "folder") {
      toggleFolder(file.path);
    } else {
      setSelectedFile(file);
      setIsEditing(false);
      setEditContent("");
      setFileError(null);
      setFileLoading(true);
      if (activeFileRequest.current) {
        activeFileRequest.current.controller.abort();
      }
      const controller = new AbortController();
      activeFileRequest.current = { path: file.path, controller };
      worktreeAdapter.readFile?.(selectedAgentId, file.path, { signal: controller.signal })
        .then((result) => {
          if (activeFileRequest.current?.path !== file.path) {return;}
          setFileContent(result?.content ?? "");
        })
        .catch((err) => {
          if (controller.signal.aborted) {return;}
          const info = mapWorktreeError(err);
          setFileError(`${info.title}: ${info.message}`);
          setFileContent("");
        })
        .finally(() => {
          if (activeFileRequest.current?.path === file.path) {
            setFileLoading(false);
            activeFileRequest.current = null;
          }
        });
    }
  };

  const handleEdit = () => {
    if (selectedFile) {
      setEditContent(fileContent);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!selectedFile || selectedFile.type !== "file") {return;}
    setFileLoading(true);
    setFileError(null);
    const controller = new AbortController();
    try {
      await worktreeAdapter.writeFile?.(
        selectedAgentId,
        { path: selectedFile.path, content: editContent },
        { signal: controller.signal }
      );
      setFileContent(editContent);
      setIsEditing(false);
    } catch (err) {
      const info = mapWorktreeError(err);
      setFileError(`${info.title}: ${info.message}`);
    } finally {
      setFileLoading(false);
    }
  };

  const handleDownload = () => {
    if (!selectedFile) {return;}
    const blob = new Blob([fileContent || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!fileToDelete) {return;}
    const controller = new AbortController();
    try {
      await worktreeAdapter.delete?.(
        selectedAgentId,
        { path: fileToDelete.path },
        { signal: controller.signal }
      );
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      if (selectedFile?.path === fileToDelete.path) {
        setSelectedFile(null);
        setFileContent("");
      }
      void loadTree(controller.signal);
    } catch (err) {
      const info = mapWorktreeError(err);
      setTreeError(`${info.title}: ${info.message}`);
      setDeleteDialogOpen(false);
    }
  };

  const confirmDelete = (file: FileNode) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const getFileIcon = (file: FileNode) => {
    if (file.type === "folder") {
      return expandedFolders.has(file.path) ? (
        <FolderOpen className="h-4 w-4 text-yellow-500" />
      ) : (
        <Folder className="h-4 w-4 text-yellow-500" />
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "json":
      case "jsonl":
        return <FileJson className="h-4 w-4 text-orange-500" />;
      case "md":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "log":
        return <FileCode className="h-4 w-4 text-green-500" />;
      case "enc":
        return <File className="h-4 w-4 text-red-500" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) {return `${bytes} B`;}
    if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(1)} KB`;}
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderTree = (node: FileNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile?.path === node.path;

    return (
      <div key={node.path}>
        <button
          type="button"
          onClick={() => handleFileClick(node)}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left text-sm transition-colors",
            "hover:bg-muted",
            isSelected && "bg-primary/10 text-primary"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {node.type === "folder" && (
            <span className="w-4 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </span>
          )}
          {node.type === "file" && <span className="w-4" />}
          {getFileIcon(node)}
          <span className="flex-1 truncate">{node.name}</span>
          {node.type === "file" && node.sizeBytes !== undefined && (
            <span className="text-xs text-muted-foreground">
              {formatSize(node.sizeBytes)}
            </span>
          )}
        </button>

        {node.type === "folder" && isExpanded && node.children && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {node.children.map((child) => renderTree(child, depth + 1))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    );
  };

  const renderFileContent = () => {
    if (fileLoading) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      );
    }

    if (fileError) {
      return (
        <div className="flex h-full items-center justify-center text-center text-xs text-destructive">
          {fileError}
        </div>
      );
    }

    if (!selectedFile) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <File className="h-12 w-12 mb-4" />
          <p>Select a file to preview</p>
        </div>
      );
    }

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    const content = isEditing ? editContent : fileContent || "";

    // Render markdown
    if (ext === "md" && !isEditing) {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none p-4">
          {content.split("\n").map((line, i) => {
            if (line.startsWith("# ")) {
              return (
                <h1 key={i} className="text-2xl font-bold mb-4">
                  {line.slice(2)}
                </h1>
              );
            }
            if (line.startsWith("## ")) {
              return (
                <h2 key={i} className="text-xl font-semibold mb-3 mt-6">
                  {line.slice(3)}
                </h2>
              );
            }
            if (line.startsWith("- ")) {
              return (
                <li key={i} className="ml-4">
                  {line.slice(2)}
                </li>
              );
            }
            if (line.trim() === "") {
              return <br key={i} />;
            }
            return (
              <p key={i} className="mb-2">
                {line}
              </p>
            );
          })}
        </div>
      );
    }

    // Render JSON with formatting
    if ((ext === "json" || ext === "jsonl") && !isEditing) {
      try {
        const formatted =
          ext === "jsonl"
            ? content
                .split("\n")
                .map((line) => {
                  try {
                    return JSON.stringify(JSON.parse(line), null, 2);
                  } catch {
                    return line;
                  }
                })
                .join("\n---\n")
            : JSON.stringify(JSON.parse(content), null, 2);
        return (
          <pre className="p-4 text-sm font-mono whitespace-pre-wrap text-primary">
            {formatted}
          </pre>
        );
      } catch {
        // Fall through to raw display
      }
    }

    // Raw text / editing mode
    if (isEditing) {
      return (
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="w-full h-full min-h-[400px] font-mono text-sm resize-none border-0 focus-visible:ring-0"
        />
      );
    }

    return (
      <pre className="p-4 text-sm font-mono whitespace-pre-wrap">{content}</pre>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <HardDrive className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Filesystem
              </h1>
              <p className="text-muted-foreground">
                Browse agent worktree files
              </p>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* File Tree */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Files</CardTitle>
              <CardDescription>Select an agent workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 space-y-2">
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name || agent.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const controller = new AbortController();
                    void loadTree(controller.signal);
                  }}
                  disabled={treeLoading || !selectedAgentId}
                  className="w-full"
                >
                  {treeLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Refreshing...
                    </span>
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>
              <ScrollArea className="h-[500px]">
                {treeLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading workspace...
                  </div>
                )}
                {!treeLoading && treeError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                    {treeError}
                  </div>
                )}
                {!treeLoading && !treeError && treeEntries.length === 0 && (
                  <div className="text-xs text-muted-foreground">
                    No files found.
                  </div>
                )}
                {!treeLoading && !treeError && treeEntries.map((node) => renderTree(node))}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* File Preview */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {selectedFile ? selectedFile.name : "Preview"}
                  </CardTitle>
                  {selectedFile && <CardDescription>{selectedFile.path}</CardDescription>}
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(false)}
                          className="gap-1"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave} className="gap-1">
                          <Save className="h-3 w-3" />
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleEdit}
                          className="gap-1"
                          disabled={selectedFile.type !== "file"}
                        >
                          <Edit2 className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownload}
                          className="gap-1"
                          disabled={selectedFile.type !== "file"}
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmDelete(selectedFile)}
                          className="gap-1 text-destructive hover:text-destructive"
                          disabled={selectedFile.type !== "file"}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {selectedFile && (
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="secondary">
                    {formatSize(selectedFile.sizeBytes || 0)}
                  </Badge>
                  {selectedFile.modifiedAt && (
                    <span className="text-xs text-muted-foreground">
                      Modified{" "}
                      {new Date(selectedFile.modifiedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[440px] rounded-lg border bg-muted/30">
                {renderFileContent()}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete File</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-medium text-foreground">
                  {fileToDelete?.name}
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
