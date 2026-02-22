
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  X,
  Plus,
  Loader2,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  Lightbulb,
  Image,
  Tag,
  Eye,
} from "lucide-react";
import type { MemoryType } from "@/hooks/queries/useMemories";

interface CreateMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    content: string;
    type: MemoryType;
    tags: string[];
  }) => void;
  isLoading?: boolean;
  className?: string;
}

const typeOptions: { value: MemoryType; label: string; icon: typeof Brain }[] = [
  { value: "note", label: "Note", icon: FileText },
  { value: "document", label: "Document", icon: FileText },
  { value: "link", label: "Link", icon: LinkIcon },
  { value: "image", label: "Image", icon: Image },
  { value: "conversation", label: "Conversation", icon: MessageSquare },
  { value: "insight", label: "Insight", icon: Lightbulb },
];

export function CreateMemoryModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  className,
}: CreateMemoryModalProps) {
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [type, setType] = React.useState<MemoryType>("note");
  const [tags, setTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"write" | "preview">("write");
  const [errors, setErrors] = React.useState<{ title?: string; content?: string }>({});

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setContent("");
      setType("note");
      setTags([]);
      setNewTag("");
      setActiveTab("write");
      setErrors({});
    }
  }, [open]);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      e.preventDefault();
      if (!tags.includes(newTag.trim())) {
        setTags([...tags, newTag.trim()]);
      }
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: { title?: string; content?: string } = {};
    if (!title.trim()) {
      newErrors.title = "Title is required";
    }
    if (!content.trim()) {
      newErrors.content = "Content is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      title: title.trim(),
      content: content.trim(),
      type,
      tags,
    });
  };

  // Simple markdown preview (basic rendering)
  const renderMarkdownPreview = (text: string) => {
    // Very basic markdown-like formatting
    return text
      .split("\n")
      .map((line, i) => {
        // Headers
        if (line.startsWith("# ")) {
          return <h1 key={i} className="text-2xl font-bold mb-2">{line.slice(2)}</h1>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={i} className="text-xl font-semibold mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith("### ")) {
          return <h3 key={i} className="text-lg font-medium mb-1">{line.slice(4)}</h3>;
        }
        // Bold
        const boldFormatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        // Italic
        const italicFormatted = boldFormatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
        // Code
        const codeFormatted = italicFormatted.replace(/`(.*?)`/g, '<code class="bg-secondary px-1 rounded">$1</code>');

        return (
          <p
            key={i}
            className="mb-1"
            dangerouslySetInnerHTML={{ __html: codeFormatted }}
          />
        );
      });
  };

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
                <form onSubmit={handleSubmit}>
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Brain className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">
                          Create Memory
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Save knowledge to your memory bank
                        </p>
                      </div>
                    </div>
                    <Dialog.Close asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </Dialog.Close>
                  </div>

                  {/* Content */}
                  <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)] space-y-5">
                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="memory-title">
                        Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="memory-title"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          if (errors.title) {setErrors({ ...errors, title: undefined });}
                        }}
                        placeholder="Give this memory a descriptive title"
                        className={cn(
                          "h-11 rounded-xl",
                          errors.title && "border-destructive"
                        )}
                      />
                      {errors.title && (
                        <p className="text-xs text-destructive">{errors.title}</p>
                      )}
                    </div>

                    {/* Type */}
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={type} onValueChange={(value) => setType(value as MemoryType)}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((option) => {
                            const Icon = option.icon;
                            return (
                              <SelectItem key={option.value} value={option.value}>
                                <span className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {option.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Content with Preview */}
                    <div className="space-y-2">
                      <Label htmlFor="memory-content">
                        Content <span className="text-destructive">*</span>
                      </Label>
                      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "write" | "preview")}>
                        <TabsList className="mb-2">
                          <TabsTrigger value="write" className="gap-2">
                            <FileText className="h-4 w-4" />
                            Write
                          </TabsTrigger>
                          <TabsTrigger value="preview" className="gap-2">
                            <Eye className="h-4 w-4" />
                            Preview
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="write" className="mt-0">
                          <Textarea
                            id="memory-content"
                            value={content}
                            onChange={(e) => {
                              setContent(e.target.value);
                              if (errors.content) {setErrors({ ...errors, content: undefined });}
                            }}
                            placeholder="Write your memory content... (Markdown supported)"
                            className={cn(
                              "min-h-[200px] rounded-xl resize-none font-mono text-sm",
                              errors.content && "border-destructive"
                            )}
                          />
                        </TabsContent>
                        <TabsContent value="preview" className="mt-0">
                          <div className="min-h-[200px] rounded-xl border border-border bg-secondary/30 p-4 text-sm">
                            {content ? (
                              renderMarkdownPreview(content)
                            ) : (
                              <p className="text-muted-foreground italic">
                                Nothing to preview yet...
                              </p>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                      {errors.content && (
                        <p className="text-xs text-destructive">{errors.content}</p>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Tags
                      </Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {tags.map((tag) => (
                          <motion.span
                            key={tag}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground pr-1"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </motion.span>
                        ))}
                      </div>
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={handleAddTag}
                        placeholder="Add a tag and press Enter..."
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end gap-3 border-t border-border p-6">
                    <Dialog.Close asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 rounded-xl"
                      >
                        Cancel
                      </Button>
                    </Dialog.Close>
                    <Button
                      type="submit"
                      className="h-11 rounded-xl min-w-[120px]"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Save Memory
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export default CreateMemoryModal;
