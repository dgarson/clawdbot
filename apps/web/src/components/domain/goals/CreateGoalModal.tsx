"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { uuidv7 } from "@/lib/ids";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Target, X, Plus, Trash2, Loader2 } from "lucide-react";

interface MilestoneInput {
  id: string;
  title: string;
}

interface CreateGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    milestones: { title: string; completed: boolean }[];
    status: "not_started";
    dueDate?: string;
  }) => void;
  isLoading?: boolean;
  className?: string;
}

export function CreateGoalModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  className,
}: CreateGoalModalProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [milestones, setMilestones] = React.useState<MilestoneInput[]>([
    { id: uuidv7(), title: "" },
  ]);
  const [errors, setErrors] = React.useState<{ title?: string }>({});

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setMilestones([{ id: uuidv7(), title: "" }]);
      setErrors({});
    }
  }, [open]);

  const handleAddMilestone = () => {
    setMilestones([...milestones, { id: uuidv7(), title: "" }]);
  };

  const handleRemoveMilestone = (id: string) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((m) => m.id !== id));
    }
  };

  const handleMilestoneChange = (id: string, value: string) => {
    setMilestones(
      milestones.map((m) => (m.id === id ? { ...m, title: value } : m))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: { title?: string } = {};
    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Filter out empty milestones
    const validMilestones = milestones
      .filter((m) => m.title.trim())
      .map((m) => ({ title: m.title.trim(), completed: false }));

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      milestones: validMilestones,
      status: "not_started",
      dueDate: dueDate || undefined,
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
                  "w-full max-w-lg max-h-[85vh] overflow-hidden",
                  "rounded-2xl border border-border bg-card shadow-2xl",
                  className
                )}
              >
                <form onSubmit={handleSubmit}>
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">
                          Create New Goal
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Define your objective and milestones
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
                      <Label htmlFor="goal-title">
                        Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="goal-title"
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          if (errors.title) {setErrors({});}
                        }}
                        placeholder="What do you want to achieve?"
                        className={cn(
                          "h-11 rounded-xl",
                          errors.title && "border-destructive"
                        )}
                      />
                      {errors.title && (
                        <p className="text-xs text-destructive">{errors.title}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="goal-description">Description</Label>
                      <Textarea
                        id="goal-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your goal in more detail..."
                        className="min-h-[100px] rounded-xl resize-none"
                      />
                    </div>

                    {/* Due Date */}
                    <div className="space-y-2">
                      <Label htmlFor="goal-due-date">Due Date</Label>
                      <Input
                        id="goal-due-date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="h-11 rounded-xl"
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>

                    {/* Milestones */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Milestones</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleAddMilestone}
                          className="h-8 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {milestones.map((milestone, index) => (
                          <motion.div
                            key={milestone.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex items-center gap-2"
                          >
                            <span className="text-xs text-muted-foreground w-6 shrink-0">
                              {index + 1}.
                            </span>
                            <Input
                              value={milestone.title}
                              onChange={(e) =>
                                handleMilestoneChange(milestone.id, e.target.value)
                              }
                              placeholder="Milestone description..."
                              className="h-10 rounded-lg flex-1"
                            />
                            {milestones.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveMilestone(milestone.id)}
                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </motion.div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Break your goal into smaller, achievable steps
                      </p>
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
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Create Goal
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

export default CreateGoalModal;
