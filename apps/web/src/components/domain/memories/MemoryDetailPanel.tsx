
import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DetailPanel } from "@/components/composed/DetailPanel";
import { ConfirmDialog } from "@/components/composed/ConfirmDialog";
import {
  Brain,
  Calendar,
  Edit,
  Save,
  Trash2,
  Tag,
  X,
  Link as LinkIcon,
  FileText,
  MessageSquare,
  Lightbulb,
  Image,
} from "lucide-react";
import type { Memory, MemoryType } from "@/hooks/queries/useMemories";

interface MemoryDetailPanelProps {
  memory: Memory | null;
  open: boolean;
  onClose: () => void;
  onSave?: (memory: Memory) => void;
  onDelete?: (id: string) => void;
  onAddTags?: (id: string, tags: string[]) => void;
  onRemoveTags?: (id: string, tags: string[]) => void;
  className?: string;
}

const typeConfig: Record<MemoryType, { icon: typeof Brain; color: string; label: string }> = {
  note: { icon: FileText, color: "bg-blue-500/20 text-blue-500", label: "Note" },
  document: { icon: FileText, color: "bg-purple-500/20 text-purple-500", label: "Document" },
  link: { icon: LinkIcon, color: "bg-green-500/20 text-green-500", label: "Link" },
  image: { icon: Image, color: "bg-pink-500/20 text-pink-500", label: "Image" },
  conversation: { icon: MessageSquare, color: "bg-orange-500/20 text-orange-500", label: "Conversation" },
  insight: { icon: Lightbulb, color: "bg-yellow-500/20 text-yellow-500", label: "Insight" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MemoryDetailPanel({
  memory,
  open,
  onClose,
  onSave,
  onDelete,
  onAddTags,
  onRemoveTags,
  className,
}: MemoryDetailPanelProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedContent, setEditedContent] = React.useState("");
  const [editedTags, setEditedTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Reset edit state when memory changes or panel closes
  React.useEffect(() => {
    if (memory) {
      setEditedContent(memory.content);
      setEditedTags([...memory.tags]);
    }
    if (!open) {
      setIsEditing(false);
    }
  }, [memory, open]);

  if (!memory) {return null;}

  const typeInfo = typeConfig[memory.type];
  const TypeIcon = typeInfo.icon;

  const handleSave = () => {
    if (!onSave) {return;}
    onSave({
      ...memory,
      content: editedContent,
      tags: editedTags,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedContent(memory.content);
    setEditedTags([...memory.tags]);
    setIsEditing(false);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      e.preventDefault();
      if (!editedTags.includes(newTag.trim())) {
        const newTags = [...editedTags, newTag.trim()];
        setEditedTags(newTags);
        if (onAddTags && !isEditing) {
          onAddTags(memory.id, [newTag.trim()]);
        }
      }
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = editedTags.filter((tag) => tag !== tagToRemove);
    setEditedTags(newTags);
    if (onRemoveTags && !isEditing) {
      onRemoveTags(memory.id, [tagToRemove]);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(memory.id);
      onClose();
    }
  };

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      title="Memory Details"
      width="lg"
      className={className}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl",
              typeInfo.color.split(" ")[0]
            )}>
              <TypeIcon className={cn("h-7 w-7", typeInfo.color.split(" ")[1])} />
            </div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn(typeInfo.color, "border-0")}>
                {typeInfo.label}
              </Badge>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-1">
              {memory.title}
            </h3>
          </div>

          <div className="flex items-center gap-1">
            {!isEditing && onSave && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="h-8 w-8"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="rounded-xl bg-secondary/30 p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Created</span>
            </div>
            <p className="text-sm font-medium text-foreground">
              {formatDate(memory.createdAt)}
            </p>
          </div>
          <div className="rounded-xl bg-secondary/30 p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Updated</span>
            </div>
            <p className="text-sm font-medium text-foreground">
              {formatDate(memory.updatedAt)}
            </p>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <label className="block text-sm font-medium text-foreground mb-2">
            Content
          </label>
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[200px] rounded-xl resize-none"
              placeholder="Enter content..."
            />
          ) : (
            <div className="rounded-xl bg-secondary/30 p-4 border border-border/50">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {memory.content}
              </p>
            </div>
          )}
        </motion.div>

        {/* Tags */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(isEditing ? editedTags : memory.tags).map((tag) => (
              <motion.span
                key={tag}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-secondary/80 px-3 py-1 text-xs font-medium text-secondary-foreground border border-border/50",
                  (isEditing || onRemoveTags) && "pr-1"
                )}
              >
                <Tag className="h-3 w-3" />
                {tag}
                {(isEditing || onRemoveTags) && (
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </motion.span>
            ))}
            {(isEditing ? editedTags : memory.tags).length === 0 && !isEditing && (
              <span className="text-sm text-muted-foreground">No tags</span>
            )}
          </div>
          {(isEditing || onAddTags) && (
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add a tag and press Enter..."
              className={cn(
                "w-full h-10 px-4 rounded-xl border border-border bg-background",
                "text-sm text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              )}
            />
          )}
        </motion.div>

        {/* Related Memories Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl bg-secondary/20 p-4 border border-border/50"
        >
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Related Memories
          </h4>
          <p className="text-sm text-muted-foreground">
            Similar content will appear here.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 pt-2"
        >
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1 h-11 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 h-11 rounded-xl"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </>
          ) : (
            <Button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl"
            >
              Close
            </Button>
          )}
        </motion.div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Memory"
        resource={{
          title: memory.title,
          subtitle: memory.source ?? "Memory",
        }}
        description={`Are you sure you want to delete "${memory.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </DetailPanel>
  );
}

export default MemoryDetailPanel;
