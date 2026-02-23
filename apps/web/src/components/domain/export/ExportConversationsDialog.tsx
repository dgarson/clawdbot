
import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  exportConversations,
  downloadFile,
  downloadBlob,
  formatExportFilename,
  type ConversationExportFormat,
} from "@/lib/export";
import { useConversationStore, type Message } from "@/stores/useConversationStore";
import { useAgentStore } from "@/stores/useAgentStore";
import { formatConversationAsMarkdown } from "@/lib/export";

interface ExportConversationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = ConversationExportFormat;

export function ExportConversationsDialog({
  open,
  onOpenChange,
}: ExportConversationsDialogProps) {
  const { conversations, messages } = useConversationStore();
  const { agents } = useAgentStore();

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [format, setFormat] = React.useState<ExportFormat>("json");
  const [includeTimestamps, setIncludeTimestamps] = React.useState(true);
  const [includeAgentNames, setIncludeAgentNames] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);

  // Reset selection when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
    }
  }, [open]);

  const sortedConversations = React.useMemo(() => {
    return [...conversations].toSorted((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [conversations]);

  const toggleConversation = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(conversations.map((c) => c.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const getAgentName = (agentId: string): string | undefined => {
    return agents.find((a) => a.id === agentId)?.name;
  };

  const getMessages = (conversationId: string): Message[] => {
    return messages.get(conversationId) ?? [];
  };

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {return "Today";}
    if (diffDays === 1) {return "Yesterday";}
    if (diffDays < 7) {return `${diffDays}d ago`;}
    if (diffDays < 30) {return `${Math.floor(diffDays / 7)}w ago`;}
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one conversation");
      return;
    }

    setIsExporting(true);
    try {
      const selectedConversations = conversations.filter((c) =>
        selectedIds.has(c.id)
      );

      if (format === "json") {
        const exportData = exportConversations({
          conversations: selectedConversations,
          getMessages,
          getAgentName,
        });

        const filename = formatExportFilename("conversations");
        downloadFile(exportData, filename);
      } else {
        // Markdown format - create a zip or concatenated file
        if (selectedConversations.length === 1) {
          const conv = selectedConversations[0];
          const convMessages = getMessages(conv.id);
          const agentName = conv.agentId ? getAgentName(conv.agentId) : undefined;
          const markdown = formatConversationAsMarkdown(conv, convMessages, {
            includeTimestamps,
            includeAgentNames,
            agentName,
          });

          const blob = new Blob([markdown], { type: "text/markdown" });
          const sanitizedTitle = (conv.title || "conversation")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .substring(0, 50);
          const date = new Date().toISOString().split("T")[0];
          downloadBlob(blob, `${sanitizedTitle}-${date}.md`);
        } else {
          // Multiple conversations - concatenate with separators
          const markdownParts = selectedConversations.map((conv) => {
            const convMessages = getMessages(conv.id);
            const agentName = conv.agentId ? getAgentName(conv.agentId) : undefined;
            return formatConversationAsMarkdown(conv, convMessages, {
              includeTimestamps,
              includeAgentNames,
              agentName,
            });
          });

          const markdown = markdownParts.join("\n\n---\n\n# \n\n");
          const blob = new Blob([markdown], { type: "text/markdown" });
          const date = new Date().toISOString().split("T")[0];
          downloadBlob(blob, `conversations-${date}.md`);
        }
      }

      toast.success(`Exported ${selectedIds.size} conversation${selectedIds.size > 1 ? "s" : ""}`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to export conversations");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Export Conversations</DialogTitle>
          <DialogDescription>
            Select conversations to download.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {sortedConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No conversations to export
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    className="h-7 text-xs"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectNone}
                    className="h-7 text-xs"
                  >
                    Select None
                  </Button>
                </div>

                {sortedConversations.map((conv) => (
                  <label
                    key={conv.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(conv.id)}
                      onCheckedChange={() => toggleConversation(conv.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {conv.title || "Untitled conversation"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(conv.updatedAt)}
                      </p>
                    </div>
                  </label>
                ))}
              </>
            )}
          </div>

          {/* Format selection */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm font-medium">Format:</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === "json"}
                  onChange={() => setFormat("json")}
                  className={cn(
                    "h-4 w-4 border border-input bg-background",
                    "focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "checked:border-primary checked:bg-primary"
                  )}
                />
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">JSON</span>
                  <p className="text-xs text-muted-foreground">
                    Full metadata, machine readable
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="markdown"
                  checked={format === "markdown"}
                  onChange={() => setFormat("markdown")}
                  className={cn(
                    "h-4 w-4 border border-input bg-background",
                    "focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "checked:border-primary checked:bg-primary"
                  )}
                />
                <div className="space-y-0.5">
                  <span className="text-sm font-medium">Markdown</span>
                  <p className="text-xs text-muted-foreground">
                    Human readable, easy sharing
                  </p>
                </div>
              </label>
            </div>

            {/* Options */}
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium">Options:</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={includeTimestamps}
                  onCheckedChange={(checked) => setIncludeTimestamps(!!checked)}
                />
                <span className="text-sm">Include timestamps</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={includeAgentNames}
                  onCheckedChange={(checked) => setIncludeAgentNames(!!checked)}
                />
                <span className="text-sm">Include agent names</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedIds.size === 0 || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export ({selectedIds.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportConversationsDialog;
