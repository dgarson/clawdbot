"use client";

import * as React from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/jobs/")({
  component: JobsPage,
});

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  status: "idle" | "running" | "success" | "failed";
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
}

// Mock cron jobs data
const initialJobs: CronJob[] = [
  {
    id: "1",
    name: "Daily Backup",
    schedule: "0 2 * * *",
    command: "backup.run",
    enabled: true,
    status: "success",
    lastRun: new Date(Date.now() - 36000000),
    nextRun: new Date(Date.now() + 50400000),
    createdAt: new Date(Date.now() - 2592000000),
  },
  {
    id: "2",
    name: "Sync Memories",
    schedule: "*/30 * * * *",
    command: "memory.sync",
    enabled: true,
    status: "idle",
    lastRun: new Date(Date.now() - 1800000),
    nextRun: new Date(Date.now() + 1800000),
    createdAt: new Date(Date.now() - 604800000),
  },
  {
    id: "3",
    name: "Weekly Report",
    schedule: "0 9 * * 1",
    command: "report.generate",
    enabled: false,
    status: "idle",
    lastRun: new Date(Date.now() - 604800000),
    nextRun: undefined,
    createdAt: new Date(Date.now() - 1209600000),
  },
  {
    id: "4",
    name: "Agent Health Check",
    schedule: "*/5 * * * *",
    command: "agent.healthCheck",
    enabled: true,
    status: "running",
    lastRun: new Date(Date.now() - 300000),
    nextRun: new Date(Date.now() + 300000),
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: "5",
    name: "Cache Cleanup",
    schedule: "0 4 * * *",
    command: "cache.cleanup",
    enabled: true,
    status: "failed",
    lastRun: new Date(Date.now() - 72000000),
    nextRun: new Date(Date.now() + 14400000),
    createdAt: new Date(Date.now() - 432000000),
  },
];

// Cron presets
const cronPresets = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at noon", value: "0 12 * * *" },
  { label: "Weekly (Monday 9am)", value: "0 9 * * 1" },
  { label: "Monthly (1st at midnight)", value: "0 0 1 * *" },
];

// Available commands
const availableCommands = [
  "backup.run",
  "memory.sync",
  "report.generate",
  "agent.healthCheck",
  "cache.cleanup",
  "ritual.execute",
  "goal.check",
  "notification.send",
];

function JobsPage() {
  const powerUserMode = useUIStore((s) => s.powerUserMode);
  const [jobs, setJobs] = React.useState<CronJob[]>(initialJobs);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingJob, setEditingJob] = React.useState<CronJob | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [jobToDelete, setJobToDelete] = React.useState<CronJob | null>(null);

  // Form state
  const [formName, setFormName] = React.useState("");
  const [formSchedule, setFormSchedule] = React.useState("* * * * *");
  const [formCommand, setFormCommand] = React.useState(availableCommands[0]);
  const [baseNow] = React.useState(() => Date.now());

  if (!powerUserMode) {
    return <Navigate to="/" />;
  }

  const resetForm = () => {
    setFormName("");
    setFormSchedule("* * * * *");
    setFormCommand(availableCommands[0]);
    setEditingJob(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (job: CronJob) => {
    setEditingJob(job);
    setFormName(job.name);
    setFormSchedule(job.schedule);
    setFormCommand(job.command);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingJob) {
      // Update existing job
      setJobs((prev) =>
        prev.map((j) =>
          j.id === editingJob.id
            ? {
                ...j,
                name: formName,
                schedule: formSchedule,
                command: formCommand,
              }
            : j
        )
      );
    } else {
      // Create new job
      const newJob: CronJob = {
        id: `job-${Date.now()}`,
        name: formName,
        schedule: formSchedule,
        command: formCommand,
        enabled: true,
        status: "idle",
        nextRun: getNextRun(formSchedule),
        createdAt: new Date(),
      };
      setJobs((prev) => [...prev, newJob]);
    }
    setIsModalOpen(false);
    resetForm();
  };

  const toggleJob = (id: string) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? {
              ...j,
              enabled: !j.enabled,
              nextRun: !j.enabled ? getNextRun(j.schedule) : undefined,
            }
          : j
      )
    );
  };

  const confirmDelete = (job: CronJob) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (jobToDelete) {
      setJobs((prev) => prev.filter((j) => j.id !== jobToDelete.id));
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    }
  };

  const getStatusIcon = (status: CronJob["status"]) => {
    switch (status) {
      case "running":
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: CronJob["status"]) => {
    switch (status) {
      case "running":
        return <Badge>Running</Badge>;
      case "success":
        return <Badge variant="success">Success</Badge>;
      case "failed":
        return <Badge variant="error">Failed</Badge>;
      default:
        return <Badge variant="secondary">Idle</Badge>;
    }
  };

  const formatRelativeTime = (date?: Date) => {
    if (!date) {return "Never";}
    const diff = date.getTime() - baseNow;
    const absDiff = Math.abs(diff);
    const isPast = diff < 0;

    if (absDiff < 60000) {return isPast ? "Just now" : "In less than a minute";}
    if (absDiff < 3600000) {
      const mins = Math.floor(absDiff / 60000);
      return isPast ? `${mins}m ago` : `In ${mins}m`;
    }
    if (absDiff < 86400000) {
      const hours = Math.floor(absDiff / 3600000);
      return isPast ? `${hours}h ago` : `In ${hours}h`;
    }
    const days = Math.floor(absDiff / 86400000);
    return isPast ? `${days}d ago` : `In ${days}d`;
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Scheduled Jobs
                </h1>
                <p className="text-muted-foreground">
                  Manage cron jobs and scheduled tasks
                </p>
              </div>
            </div>
            <Button onClick={openCreateModal} className="gap-2">
              <Plus className="h-4 w-4" />
              New Job
            </Button>
          </div>
        </motion.div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Cron Jobs</CardTitle>
            <CardDescription>
              {jobs.filter((j) => j.enabled).length} of {jobs.length} jobs
              active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                <AnimatePresence>
                  {jobs.map((job) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                        job.enabled
                          ? "bg-card hover:bg-muted/50"
                          : "bg-muted/30 opacity-60"
                      )}
                    >
                      {/* Status Icon */}
                      <div className="flex items-center justify-center w-8">
                        {getStatusIcon(job.status)}
                      </div>

                      {/* Job Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {job.name}
                          </span>
                          {getStatusBadge(job.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="font-mono bg-muted px-2 py-0.5 rounded">
                            {job.schedule}
                          </span>
                          <span>{job.command}</span>
                        </div>
                      </div>

                      {/* Timing */}
                      <div className="text-right text-sm">
                        <div className="text-muted-foreground">
                          Last: {formatRelativeTime(job.lastRun)}
                        </div>
                        {job.enabled && job.nextRun && (
                          <div className="text-primary">
                            Next: {formatRelativeTime(job.nextRun)}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={job.enabled}
                          onCheckedChange={() => toggleJob(job.id)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(job)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmDelete(job)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Create/Edit Job Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingJob ? "Edit Job" : "Create New Job"}
              </DialogTitle>
              <DialogDescription>
                Configure the scheduled job settings
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="job-name">Job Name</Label>
                <Input
                  id="job-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter job name"
                />
              </div>

              {/* Command */}
              <div className="space-y-2">
                <Label>Command</Label>
                <Select value={formCommand} onValueChange={setFormCommand}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select command" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCommands.map((cmd) => (
                      <SelectItem key={cmd} value={cmd}>
                        {cmd}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cron Helper */}
              <CronHelper
                value={formSchedule}
                onChange={setFormSchedule}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formName.trim()}>
                {editingJob ? "Save Changes" : "Create Job"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Job</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-medium text-foreground">
                  {jobToDelete?.name}
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

// Cron Helper Component
interface CronHelperProps {
  value: string;
  onChange: (value: string) => void;
}

function CronHelper({ value, onChange }: CronHelperProps) {
  const parts = value.split(" ");
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const updatePart = (index: number, newValue: string) => {
    const newParts = [...parts];
    newParts[index] = newValue;
    onChange(newParts.join(" "));
  };

  const getNextRuns = (_schedule: string): Date[] => {
    void _schedule;
    // Simplified next run calculation for demo
    const now = new Date();
    const runs: Date[] = [];
    for (let i = 1; i <= 5; i++) {
      const next = new Date(now.getTime() + i * 3600000);
      runs.push(next);
    }
    return runs;
  };

  const getHumanReadable = (schedule: string): string => {
    const preset = cronPresets.find((p) => p.value === schedule);
    if (preset) {return preset.label;}

    // Simple parsing for common patterns
    if (schedule === "* * * * *") {return "Every minute";}
    if (schedule.startsWith("*/")) {
      const interval = schedule.split(" ")[0].slice(2);
      return `Every ${interval} minutes`;
    }
    return "Custom schedule";
  };

  return (
    <div className="space-y-4">
      {/* Cron Expression Input */}
      <div className="space-y-2">
        <Label>Schedule (Cron Expression)</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="* * * * *"
          className="font-mono"
        />
      </div>

      {/* Individual Fields */}
      <div className="grid grid-cols-5 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Minute</Label>
          <Input
            value={minute}
            onChange={(e) => updatePart(0, e.target.value)}
            className="font-mono text-center"
            placeholder="*"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hour</Label>
          <Input
            value={hour}
            onChange={(e) => updatePart(1, e.target.value)}
            className="font-mono text-center"
            placeholder="*"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Day</Label>
          <Input
            value={dayOfMonth}
            onChange={(e) => updatePart(2, e.target.value)}
            className="font-mono text-center"
            placeholder="*"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Month</Label>
          <Input
            value={month}
            onChange={(e) => updatePart(3, e.target.value)}
            className="font-mono text-center"
            placeholder="*"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Weekday</Label>
          <Input
            value={dayOfWeek}
            onChange={(e) => updatePart(4, e.target.value)}
            className="font-mono text-center"
            placeholder="*"
          />
        </div>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick Presets</Label>
        <div className="flex flex-wrap gap-2">
          {cronPresets.slice(0, 6).map((preset) => (
            <Button
              key={preset.value}
              variant={value === preset.value ? "default" : "outline"}
              size="sm"
              onClick={() => onChange(preset.value)}
              className="text-xs"
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Human-readable description */}
      <div className="p-3 rounded-lg bg-muted/50 space-y-2">
        <div className="text-sm font-medium">{getHumanReadable(value)}</div>
        <div className="text-xs text-muted-foreground">
          <div className="font-medium mb-1">Next 5 runs:</div>
          <ul className="space-y-0.5">
            {getNextRuns(value).map((run, i) => (
              <li key={i}>{run.toLocaleString()}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Helper function to calculate next run time
function getNextRun(schedule: string): Date {
  // Simplified calculation - in reality would use a cron parser
  const now = new Date();
  const parts = schedule.split(" ");
  const minute = parts[0];

  if (minute === "*") {
    return new Date(now.getTime() + 60000);
  }
  if (minute.startsWith("*/")) {
    const interval = parseInt(minute.slice(2), 10);
    return new Date(now.getTime() + interval * 60000);
  }
  // Default to 1 hour from now
  return new Date(now.getTime() + 3600000);
}
