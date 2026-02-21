
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Tag, Calendar, X, Edit, Save, Trash2 } from "lucide-react";
import type { Memory } from "./MemoryCard";

interface MemoryDetailProps {
  memory: Memory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (memory: Memory) => void;
  onDelete?: (memory: Memory) => void;
  className?: string;
}

const sourceColors: Record<string, string> = {
  agent: "bg-primary/20 text-primary",
  manual: "bg-blue-500/20 text-blue-600",
  import: "bg-purple-500/20 text-purple-600",
  conversation: "bg-green-500/20 text-green-600",
};

export function MemoryDetail({
  memory,
  open,
  onOpenChange,
  onSave,
  onDelete,
  className,
}: MemoryDetailProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedContent, setEditedContent] = React.useState("");
  const [editedTags, setEditedTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState("");

  // Reset edit state when memory changes or dialog closes
  React.useEffect(() => {
    if (memory) {
      setEditedContent(memory.content);
      setEditedTags([...memory.tags]);
    }
    if (!open) {
      setIsEditing(false);
    }
  }, [memory, open]);

  const handleSave = () => {
    if (!memory || !onSave) {return;}

    onSave({
      ...memory,
      content: editedContent,
      tags: editedTags,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!memory || !onDelete) {return;}
    onDelete(memory);
    onOpenChange(false);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      e.preventDefault();
      if (!editedTags.includes(newTag.trim())) {
        setEditedTags([...editedTags, newTag.trim()]);
      }
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags(editedTags.filter((tag) => tag !== tagToRemove));
  };

  const sourceColorClass = memory
    ? sourceColors[memory.source.toLowerCase()] || "bg-secondary text-secondary-foreground"
    : "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
                  "w-full max-w-2xl max-h-[85vh] overflow-hidden",
                  "rounded-2xl border border-border bg-card shadow-2xl",
                  className
                )}
              >
                {memory && (
                  <>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border p-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-secondary/50">
                          <Brain className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">
                            Memory Details
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {isEditing ? "Edit this memory" : "View and manage this memory"}
                          </p>
                        </div>
                      </div>
                      <Dialog.Close asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <X className="h-4 w-4" />
                        </Button>
                      </Dialog.Close>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
                      {/* Source and timestamp */}
                      <div className="flex items-center gap-3 mb-4">
                        <Badge variant="secondary" className={cn("text-xs", sourceColorClass)}>
                          {memory.source}
                        </Badge>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{memory.timestamp}</span>
                        </div>
                        {memory.workspace && (
                          <span className="text-xs text-muted-foreground/70">
                            {memory.workspace}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="mb-6">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Content
                        </label>
                        {isEditing ? (
                          <Textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="min-h-[150px] resize-none"
                            placeholder="Enter memory content..."
                          />
                        ) : (
                          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {memory.content}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Tags
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {(isEditing ? editedTags : memory.tags).map((tag) => (
                            <motion.span
                              key={tag}
                              layout
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground border border-border/50",
                                isEditing && "pr-1"
                              )}
                            >
                              <Tag className="h-3 w-3" />
                              {tag}
                              {isEditing && (
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
                        {isEditing && (
                          <input
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={handleAddTag}
                            placeholder="Add a tag and press Enter..."
                            className={cn(
                              "w-full h-9 px-3 rounded-lg border border-border bg-background",
                              "text-sm text-foreground placeholder:text-muted-foreground",
                              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                            )}
                          />
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t border-border p-6">
                      <div>
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="default"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={handleDelete}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsEditing(false);
                                setEditedContent(memory.content);
                                setEditedTags([...memory.tags]);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button onClick={handleSave}>
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                          </>
                        ) : (
                          onSave && (
                            <Button variant="outline" onClick={() => setIsEditing(true)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export default MemoryDetail;
