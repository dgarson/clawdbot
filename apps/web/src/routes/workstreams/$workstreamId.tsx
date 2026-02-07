"use client";

import { useState, useMemo, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  GitBranch,
  Plus,
  Calendar,
  CheckCircle2,
  Pause,
  Play,
  Archive,
  Settings,
  Loader2,
  AlertCircle,
  Flag,
} from "lucide-react";
import { useWorkstream, type Task, type TaskPriority } from "@/hooks/queries/useWorkstreams";
import { useWorkQueueItems } from "@/hooks/queries/useWorkQueue";
import { useAgents } from "@/hooks/queries/useAgents";
import { useCreateTask, useUpdateWorkstreamStatus } from "@/hooks/mutations/useWorkstreamMutations";
import { WorkstreamDAG } from "@/components/domain/workstreams/WorkstreamDAG";
import { TaskDetailPanel } from "@/components/domain/workstreams/TaskDetailPanel";
import type { WorkstreamStatus } from "@/hooks/queries/useWorkstreams";
import type { Agent } from "@/stores/useAgentStore";

export const Route = createFileRoute("/workstreams/$workstreamId")({
  component: WorkstreamDetailPage,
});

const statusConfig: Record<
  WorkstreamStatus,
  { color: string; bgColor: string; label: string; icon: React.ReactNode }
> = {
  active: {
    color: "text-green-500",
    bgColor: "bg-green-500/20",
    label: "Active",
    icon: <Play className="h-4 w-4" />,
  },
  paused: {
    color: "text-orange-500",
    bgColor: "bg-orange-500/20",
    label: "Paused",
    icon: <Pause className="h-4 w-4" />,
  },
  completed: {
    color: "text-blue-500",
    bgColor: "bg-blue-500/20",
    label: "Completed",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  archived: {
    color: "text-gray-500",
    bgColor: "bg-gray-500/20",
    label: "Archived",
    icon: <Archive className="h-4 w-4" />,
  },
};

function getAgentInitials(agent: Agent | null | undefined): string {
  if (!agent?.name) {return "?";}
  return agent.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDueDate(dueDate: string): string {
  const date = new Date(dueDate);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)} days overdue`;
  } else if (diffDays === 0) {
    return "Due today";
  } else if (diffDays === 1) {
    return "Due tomorrow";
  } else if (diffDays <= 7) {
    return `${diffDays} days left`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

// Add Task Modal Component
interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  workstreamId: string;
  existingTasks: Task[];
}

function AddTaskModal({ open, onClose, workstreamId, existingTasks }: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);

  const { data: agents = [] } = useAgents();
  const [assigneeId, setAssigneeId] = useState<string>("");
  const createTask = useCreateTask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {return;}

    await createTask.mutateAsync({
      workstreamId,
      data: {
        title: title.trim(),
        description: description.trim() || undefined,
        status: "todo",
        priority,
        assigneeId: assigneeId || undefined,
        dependencies: selectedDependencies.length > 0 ? selectedDependencies : undefined,
      },
    });

    // Reset form
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssigneeId("");
    setSelectedDependencies([]);
    onClose();
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAssigneeId("");
    setSelectedDependencies([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Add Task</DialogTitle>
              <DialogDescription>
                Create a new task in this workstream
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <input
              id="title"
              type="text"
              placeholder="Enter task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the task..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Flag className="h-4 w-4" />
                    Low
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-2 text-blue-500">
                    <Flag className="h-4 w-4" />
                    Medium
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center gap-2 text-orange-500">
                    <Flag className="h-4 w-4" />
                    High
                  </div>
                </SelectItem>
                <SelectItem value="urgent">
                  <div className="flex items-center gap-2 text-red-500">
                    <Flag className="h-4 w-4" />
                    Urgent
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Assignee (optional)</Label>
              <Select value={assigneeId || "unassigned"} onValueChange={(value) => setAssigneeId(value === "unassigned" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={agent.avatar} />
                        <AvatarFallback className="text-[10px]">
                          {getAgentInitials(agent)}
                        </AvatarFallback>
                      </Avatar>
                      {agent.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dependencies */}
          {existingTasks.length > 0 && (
            <div className="space-y-2">
              <Label>Dependencies (optional)</Label>
              <div className="max-h-32 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                {existingTasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex items-center gap-2 rounded p-1 hover:bg-secondary cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDependencies.includes(task.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDependencies([...selectedDependencies, task.id]);
                        } else {
                          setSelectedDependencies(selectedDependencies.filter((id) => id !== task.id));
                        }
                      }}
                      className="rounded border-input"
                    />
                    <span className="text-sm truncate">{task.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createTask.isPending}
            >
              {createTask.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkstreamDetailPage() {
  const { workstreamId } = Route.useParams();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<WorkstreamStatus | null>(null);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);

  const { data: workstream, isLoading, error } = useWorkstream(workstreamId);
  const { data: agents = [] } = useAgents();
  const { data: queueItems = [] } = useWorkQueueItems();
  const updateStatus = useUpdateWorkstreamStatus();

  const owner = useMemo(() => {
    if (!workstream?.ownerId) {return null;}
    return agents.find((a) => a.id === workstream.ownerId);
  }, [workstream, agents]);

  const status = workstream ? statusConfig[workstream.status] : null;

  const completedTasks = workstream?.tasks.filter((t) => t.status === "done").length ?? 0;
  const totalTasks = workstream?.tasks.length ?? 0;

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const activeTasks = useMemo(() => {
    return workstream?.tasks.filter(
      (task) => task.status === "in_progress" || task.status === "review"
    ) ?? [];
  }, [workstream?.tasks]);

  const workstreamQueueItems = useMemo(() => {
    return queueItems.filter((item) => item.workstreamId === workstreamId);
  }, [queueItems, workstreamId]);

  const handleStatusChange = (newStatus: WorkstreamStatus) => {
    if (!workstream) {return;}
    const requiresConfirmation =
      (newStatus === "paused" || newStatus === "archived") &&
      activeTasks.length > 0 &&
      newStatus !== workstream.status;

    if (requiresConfirmation) {
      setPendingStatus(newStatus);
      setStatusConfirmOpen(true);
      return;
    }

    updateStatus.mutate({ id: workstream.id, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <Skeleton className="h-10 w-48 mb-6" />
          <Skeleton className="h-24 mb-6" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  if (error || !workstream) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold text-destructive">
            {error ? "Error loading workstream" : "Workstream not found"}
          </h2>
          <p className="text-muted-foreground mt-2 mb-6">
            {error?.message || "The workstream you're looking for doesn't exist."}
          </p>
          <Button asChild>
            <Link to="/workstreams">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workstreams
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          {/* Breadcrumb */}
          <div className="mb-4">
            <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
              <Link to="/workstreams">
                <ArrowLeft className="h-4 w-4" />
                Back to Workstreams
              </Link>
            </Button>
          </div>

          {/* Title row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-2 ring-border/50"
              >
                <GitBranch className={cn("h-7 w-7", status?.color)} />
              </motion.div>

              {/* Info */}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-foreground">
                    {workstream.name}
                  </h1>
                  <Badge className={cn(status?.bgColor, status?.color, "border-0 gap-1")}>
                    {status?.icon}
                    {status?.label}
                  </Badge>
                </div>

                {workstream.description && (
                  <p className="text-muted-foreground max-w-xl">
                    {workstream.description}
                  </p>
                )}

                {/* Meta info */}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {completedTasks}/{totalTasks} tasks
                    </span>
                  </div>

                  {workstream.dueDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDueDate(workstream.dueDate)}</span>
                    </div>
                  )}

                  {owner && (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={owner.avatar} />
                        <AvatarFallback className="text-[10px]">
                          {getAgentInitials(owner)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{owner.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Status dropdown */}
              <Select
                value={workstream.status}
                onValueChange={(v) => handleStatusChange(v as WorkstreamStatus)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2 text-green-500">
                      <Play className="h-4 w-4" />
                      Active
                    </div>
                  </SelectItem>
                  <SelectItem value="paused">
                    <div className="flex items-center gap-2 text-orange-500">
                      <Pause className="h-4 w-4" />
                      Paused
                    </div>
                  </SelectItem>
                  <SelectItem value="completed">
                    <div className="flex items-center gap-2 text-blue-500">
                      <CheckCircle2 className="h-4 w-4" />
                      Completed
                    </div>
                  </SelectItem>
                  <SelectItem value="archived">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Archive className="h-4 w-4" />
                      Archived
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{workstream.progress}%</span>
            </div>
            <Progress value={workstream.progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* DAG View */}
      <div className="flex-1 overflow-hidden">
        <WorkstreamDAG
          tasks={workstream.tasks}
          agents={agents}
          queueItems={workstreamQueueItems}
          onTaskClick={handleTaskClick}
          onAddTask={() => setIsAddTaskModalOpen(true)}
        />
      </div>

      {/* Floating Add Task button (mobile) */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-6 right-6 md:hidden"
      >
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => setIsAddTaskModalOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </motion.div>

      {/* Add Task Modal */}
      <AddTaskModal
        open={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        workstreamId={workstreamId}
        existingTasks={workstream.tasks}
      />

      <Dialog
        open={statusConfirmOpen}
        onOpenChange={(open) => {
          setStatusConfirmOpen(open);
          if (!open) {setPendingStatus(null);}
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {pendingStatus === "archived" ? "Archive workstream?" : "Pause workstream?"}
            </DialogTitle>
            <DialogDescription>
              This workstream has active nodes running. Confirming will terminate them immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="text-muted-foreground">Active nodes</div>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border/60 bg-secondary/30 p-3">
              {activeTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{task.title}</div>
                    {task.description && (
                      <div className="truncate text-xs text-muted-foreground">
                        {task.description}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {task.status === "review" ? "Review" : "In progress"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setStatusConfirmOpen(false);
                setPendingStatus(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingStatus) {return;}
                updateStatus.mutate({ id: workstream.id, status: pendingStatus });
                setStatusConfirmOpen(false);
                setPendingStatus(null);
              }}
            >
              {pendingStatus === "archived" ? "Archive anyway" : "Pause anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        workstreamId={workstreamId}
        allTasks={workstream.tasks}
        onTaskClick={(taskId) => {
          const task = workstream.tasks.find((t) => t.id === taskId);
          if (task) {
            setSelectedTask(task);
          }
        }}
      />
    </div>
  );
}
