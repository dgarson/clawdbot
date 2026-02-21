"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, X, Plus, Loader2, Clock, Calendar, Check, Bot } from "lucide-react";
import type { RitualFrequency } from "@/hooks/queries/useRituals";

interface CreateRitualModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    schedule: string;
    frequency: RitualFrequency;
    agentId?: string;
    status: "active";
  }) => void;
  agents?: { id: string; name: string }[];
  initialAgentId?: string;
  isLoading?: boolean;
  className?: string;
}

const frequencyOptions: { value: RitualFrequency; label: string; description: string }[] = [
  { value: "hourly", label: "Hourly", description: "Every hour" },
  { value: "daily", label: "Daily", description: "Once a day" },
  { value: "weekly", label: "Weekly", description: "Once a week" },
  { value: "monthly", label: "Monthly", description: "Once a month" },
];

const quickTimeOptions = [
  { label: "Morning", time: "09:00" },
  { label: "Noon", time: "12:00" },
  { label: "Afternoon", time: "15:00" },
  { label: "Evening", time: "18:00" },
];

export function CreateRitualModal({
  open,
  onOpenChange,
  onSubmit,
  agents = [],
  initialAgentId,
  isLoading = false,
  className,
}: CreateRitualModalProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [time, setTime] = React.useState("09:00");
  const [frequency, setFrequency] = React.useState<RitualFrequency>("daily");
  const [agentId, setAgentId] = React.useState<string>("");
  const [errors, setErrors] = React.useState<{ name?: string }>({});

  // Reset form when modal closes
  React.useEffect(() => {
    if (open) {
      if (initialAgentId) {setAgentId(initialAgentId);}
      return;
    }
    setName("");
    setDescription("");
    setTime("09:00");
    setFrequency("daily");
    setAgentId(initialAgentId ?? "");
    setErrors({});
  }, [open, initialAgentId]);

  // Build cron expression from time and frequency
  const buildSchedule = (time: string, frequency: RitualFrequency): string => {
    const [hours, minutes] = time.split(":");
    switch (frequency) {
      case "hourly":
        return `${minutes} * * * *`;
      case "daily":
        return `${minutes} ${hours} * * *`;
      case "weekly":
        return `${minutes} ${hours} * * 1`; // Monday
      case "monthly":
        return `${minutes} ${hours} 1 * *`; // First of month
      default:
        return `${minutes} ${hours} * * *`;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: { name?: string } = {};
    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      schedule: buildSchedule(time, frequency),
      frequency,
      agentId: agentId || undefined,
      status: "active",
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
                        <RefreshCw className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">
                          Create Ritual
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Set up a recurring automated task
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
                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="ritual-name">
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="ritual-name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (errors.name) {setErrors({});}
                        }}
                        placeholder="e.g., Daily Standup Summary"
                        className={cn(
                          "h-11 rounded-xl",
                          errors.name && "border-destructive"
                        )}
                      />
                      {errors.name && (
                        <p className="text-xs text-destructive">{errors.name}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="ritual-description">Description</Label>
                      <Textarea
                        id="ritual-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What does this ritual do?"
                        className="min-h-[80px] rounded-xl resize-none"
                      />
                    </div>

                    {/* Time */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Time
                      </Label>
                      <div className="relative mb-3">
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="w-full h-11 rounded-xl border border-border bg-background px-4 text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {quickTimeOptions.map((option) => (
                          <button
                            key={option.time}
                            type="button"
                            onClick={() => setTime(option.time)}
                            className={cn(
                              "rounded-lg border px-2 py-2 text-center transition-all",
                              time === option.time
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:bg-secondary/70 hover:text-foreground"
                            )}
                          >
                            <span className="block text-xs font-medium">{option.label}</span>
                            <span className="block text-[10px] text-muted-foreground">{option.time}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Frequency */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Frequency
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        {frequencyOptions.map((option) => (
                          <motion.button
                            key={option.value}
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setFrequency(option.value)}
                            className={cn(
                              "relative rounded-xl border p-3 text-left transition-all",
                              frequency === option.value
                                ? "border-primary bg-primary/10"
                                : "border-border/50 bg-secondary/30 hover:border-primary/40 hover:bg-secondary/70"
                            )}
                          >
                            {frequency === option.value && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute top-2 right-2"
                              >
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                              </motion.div>
                            )}
                            <span className={cn(
                              "block text-sm font-medium",
                              frequency === option.value ? "text-primary" : "text-foreground"
                            )}>
                              {option.label}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Agent Selector */}
                    {agents.length > 0 && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                          Assign to Agent
                        </Label>
                        <Select value={agentId || "none"} onValueChange={(value) => setAgentId(value === "none" ? "" : value)}>
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder="Select an agent (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No agent</SelectItem>
                            {agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="rounded-xl bg-secondary/50 p-4">
                      <p className="text-sm text-muted-foreground">
                        This ritual will run{" "}
                        <Badge variant="secondary" className="mx-1">
                          {frequencyOptions.find((f) => f.value === frequency)?.label.toLowerCase()}
                        </Badge>
                        at{" "}
                        <Badge variant="secondary" className="mx-1">
                          {time}
                        </Badge>
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
                          Create Ritual
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

export default CreateRitualModal;
