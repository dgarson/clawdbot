"use client";

import * as React from "react";
import { DetailPanel } from "@/components/composed/DetailPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  FileEdit,
  Flag,
  GitBranch,
  Link2,
  Loader2,
  Search,
  Terminal,
  Trash2,
  User,
} from "lucide-react";
import type {
  Task,
  TaskStatus,
  TaskPriority,
} from "@/hooks/queries/useWorkstreams";
import type { Agent } from "@/stores/useAgentStore";
import { useAgents } from "@/hooks/queries/useAgents";
import {
  useUpdateTask,
  useUpdateTaskStatus,
  useUpdateTaskPriority,
  useDeleteTask,
} from "@/hooks/mutations/useWorkstreamMutations";
import { cn } from "@/lib/utils";

interface TaskDetailPanelProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  workstreamId: string;
  allTasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

const statusOptions: { value: TaskStatus; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "todo", label: "Not Started", description: "Waiting to begin", icon: <Circle className="h-4 w-4" /> },
  { value: "in_progress", label: "Working", description: "Currently in progress", icon: <Clock className="h-4 w-4" /> },
  { value: "review", label: "Needs Review", description: "Ready for your review", icon: <Eye className="h-4 w-4" /> },
  { value: "done", label: "Completed", description: "Successfully finished", icon: <CheckCircle2 className="h-4 w-4" /> },
  { value: "blocked", label: "On Hold", description: "Waiting on something", icon: <AlertCircle className="h-4 w-4" /> },
];

const priorityOptions: { value: TaskPriority; label: string; description: string; color: string }[] = [
  { value: "low", label: "Low Priority", description: "Can wait", color: "text-gray-500" },
  { value: "medium", label: "Normal", description: "Standard priority", color: "text-blue-500" },
  { value: "high", label: "Important", description: "Needs attention soon", color: "text-orange-500" },
  { value: "urgent", label: "Urgent", description: "Needs immediate attention", color: "text-red-500" },
];

const statusColors: Record<TaskStatus, string> = {
  todo: "bg-gray-500/20 text-gray-500",
  in_progress: "bg-yellow-500/20 text-yellow-500",
  review: "bg-purple-500/20 text-purple-500",
  done: "bg-green-500/20 text-green-500",
  blocked: "bg-red-500/20 text-red-500",
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

// Animated status badge for agent sessions
function AgentStatusBadge({ status }: { status: TaskStatus }) {
  const config: Record<TaskStatus, { label: string; color: string; bgColor: string; animate: boolean }> = {
    in_progress: {
      label: "Active",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/20",
      animate: true,
    },
    review: {
      label: "Waiting",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/20",
      animate: true,
    },
    done: {
      label: "Completed",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/20",
      animate: false,
    },
    blocked: {
      label: "Paused",
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-500/20",
      animate: false,
    },
    todo: {
      label: "Idle",
      color: "text-gray-500",
      bgColor: "bg-gray-500/10",
      animate: false,
    },
  };

  const { label, color, bgColor, animate } = config[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", bgColor, color)}>
      {animate ? (
        <span className="relative flex h-2 w-2">
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", status === "in_progress" ? "bg-green-500" : "bg-amber-500")} />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", status === "in_progress" ? "bg-green-500" : "bg-amber-500")} />
        </span>
      ) : (
        <span className={cn("h-2 w-2 rounded-full", status === "done" ? "bg-blue-500" : "bg-gray-400")} />
      )}
      {label}
    </span>
  );
}

// Expandable tool usage item component
interface ToolUsageItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  recentActions: { action: string; time: string }[];
}

function ToolUsageItem({ icon, label, count, recentActions }: ToolUsageItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors",
          "hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isExpanded && "bg-muted/30"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border border-border">
            {icon}
          </div>
          <div>
            <span className="text-sm font-medium">{label}</span>
            <p className="text-xs text-muted-foreground">{count} times</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border bg-muted/20 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent activity</p>
          <div className="space-y-1.5">
            {recentActions.map((item, index) => (
              <div key={index} className="flex items-start gap-2 text-xs">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground/80 truncate">{item.action}</p>
                  <p className="text-muted-foreground">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TaskDetailPanel({
  open,
  onClose,
  task,
  workstreamId,
  allTasks,
  onTaskClick,
}: TaskDetailPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const { data: agents = [] } = useAgents();
  const updateTask = useUpdateTask();
  const updateStatus = useUpdateTaskStatus();
  const updatePriority = useUpdateTaskPriority();
  const deleteTask = useDeleteTask();

  const assignedAgent = agents.find((a) => a.id === task?.assigneeId);

  // Find dependencies and dependents
  const dependencies = React.useMemo(() => {
    if (!task?.dependencies) {return [];}
    return allTasks.filter((t) => task.dependencies?.includes(t.id));
  }, [task, allTasks]);

  const dependents = React.useMemo(() => {
    if (!task) {return [];}
    return allTasks.filter((t) => t.dependencies?.includes(task.id));
  }, [task, allTasks]);

  // Calculate progress based on status
  const progress = React.useMemo(() => {
    if (!task) {return 0;}
    switch (task.status) {
      case "done":
        return 100;
      case "review":
        return 75;
      case "in_progress":
        return 50;
      case "blocked":
        return 25;
      default:
        return 0;
    }
  }, [task]);

  const handleStatusChange = (status: TaskStatus) => {
    if (!task) {return;}
    updateStatus.mutate({
      workstreamId,
      taskId: task.id,
      status,
    });
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    if (!task) {return;}
    updatePriority.mutate({
      workstreamId,
      taskId: task.id,
      priority,
    });
  };

  const handleAssigneeChange = (assigneeId: string | undefined) => {
    if (!task) {return;}
    updateTask.mutate({
      workstreamId,
      task: {
        id: task.id,
        assigneeId: assigneeId || undefined,
      },
    });
  };

  const handleDelete = () => {
    if (!task) {return;}
    deleteTask.mutate(
      { workstreamId, taskId: task.id },
      {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          onClose();
        },
      }
    );
  };

  if (!task) {
    return (
      <DetailPanel open={open} onClose={onClose} title="Task Details" width="lg">
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          No task selected
        </div>
      </DetailPanel>
    );
  }

  return (
    <DetailPanel
      open={open}
      onClose={onClose}
      title="Task Details"
      width="lg"
    >
      <div className="space-y-6">
        {/* Header with status */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-xl font-semibold leading-tight text-foreground">
              {task.title}
            </h3>
            <Badge className={cn("shrink-0", statusColors[task.status])}>
              {statusOptions.find((s) => s.value === task.status)?.label}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        <Separator />

        {/* Description */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Description</Label>
          {task.description ? (
            <p className="text-sm text-foreground">{task.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description</p>
          )}
        </div>

        <Separator />

        {/* Status selector */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Status</Label>
          <Select value={task.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Priority selector */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Priority</Label>
          <Select value={task.priority} onValueChange={handlePriorityChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className={cn("flex items-center gap-2", option.color)}>
                    <Flag className="h-4 w-4" />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Assigned agent */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">Assigned Agent</Label>
          <Select
            value={task.assigneeId ?? "__unassigned__"}
            onValueChange={(value) => handleAssigneeChange(value === "__unassigned__" ? undefined : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unassigned">
                {assignedAgent && (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={assignedAgent.avatar} />
                      <AvatarFallback className="text-[10px]">
                        {getAgentInitials(assignedAgent)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{assignedAgent.name}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned__">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Unassigned</span>
                </div>
              </SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={agent.avatar} />
                      <AvatarFallback className="text-[10px]">
                        {getAgentInitials(agent)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{agent.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Due date */}
        {task.dueDate && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">Due Date</Label>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          </div>
        )}

        <Separator />

        {/* Dependencies */}
        <div className="space-y-2">
          <Label className="text-muted-foreground flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Dependencies ({dependencies.length})
          </Label>
          {dependencies.length > 0 ? (
            <div className="space-y-2">
              {dependencies.map((dep) => (
                <button
                  key={dep.id}
                  onClick={() => onTaskClick?.(dep.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/50 p-2 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 h-5", statusColors[dep.status])}
                  >
                    {dep.status}
                  </Badge>
                  <span className="truncate">{dep.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              This task has no dependencies
            </p>
          )}
        </div>

        {/* Dependents */}
        <div className="space-y-2">
          <Label className="text-muted-foreground flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Dependents ({dependents.length})
          </Label>
          {dependents.length > 0 ? (
            <div className="space-y-2">
              {dependents.map((dep) => (
                <button
                  key={dep.id}
                  onClick={() => onTaskClick?.(dep.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/50 p-2 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 h-5", statusColors[dep.status])}
                  >
                    {dep.status}
                  </Badge>
                  <span className="truncate">{dep.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No tasks depend on this task
            </p>
          )}
        </div>

        <Separator />

        {/* Agent View Link - only for tasks that have started */}
        {task.status !== "todo" && (
          <>
            <div className="space-y-3">
              <Label className="text-muted-foreground">Agent Session</Label>
              {task.status === "done" || task.status === "in_progress" || task.status === "review" ? (
                <a
                  href={`/agents?task=${task.id}`}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:bg-muted/50 hover:border-primary/50 group"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">View Agent Session</p>
                    <p className="text-xs text-muted-foreground">See detailed activity and logs</p>
                  </div>
                  <AgentStatusBadge status={task.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Session Paused</p>
                    <p className="text-xs text-muted-foreground">Task is on hold</p>
                  </div>
                  <AgentStatusBadge status={task.status} />
                </div>
              )}
            </div>
            <Separator />
          </>
        )}

        {/* Activity History - mock timeline */}
        {task.status !== "todo" && (
          <>
            <div className="space-y-3">
              <Label className="text-muted-foreground">Activity History</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {/* Mock activity items - in real implementation, fetch from API */}
                <div className="flex items-start gap-2 text-xs">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <p className="font-medium">Status changed to {task.status.replace("_", " ")}</p>
                    <p className="text-muted-foreground">{new Date(task.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
                {task.status !== "blocked" && (
                  <div className="flex items-start gap-2 text-xs">
                    <div className="mt-1 h-2 w-2 rounded-full bg-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">Work started</p>
                      <p className="text-muted-foreground">{new Date(task.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 text-xs">
                  <div className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/50 shrink-0" />
                  <div>
                    <p className="font-medium">Task created</p>
                    <p className="text-muted-foreground">{new Date(task.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Tool Usage - for active/completed tasks */}
        {(task.status === "in_progress" || task.status === "done" || task.status === "review") && (
          <>
            <div className="space-y-3">
              <Label className="text-muted-foreground">What's Been Done</Label>
              <div className="space-y-2">
                {/* Mock tool usage - in real implementation, fetch from agent session */}
                <ToolUsageItem
                  icon={<FileEdit className="h-4 w-4 text-primary" />}
                  label="Made file changes"
                  count={12}
                  recentActions={[
                    { action: "Updated TaskDetailPanel.tsx", time: "2 min ago" },
                    { action: "Modified WorkstreamDAG.tsx", time: "5 min ago" },
                    { action: "Created AvoidingEdge.tsx", time: "12 min ago" },
                  ]}
                />
                <ToolUsageItem
                  icon={<Search className="h-4 w-4 text-blue-500" />}
                  label="Searched for information"
                  count={8}
                  recentActions={[
                    { action: "Found SelectItem component", time: "3 min ago" },
                    { action: "Located context menu code", time: "8 min ago" },
                  ]}
                />
                <ToolUsageItem
                  icon={<Terminal className="h-4 w-4 text-green-500" />}
                  label="Ran commands"
                  count={5}
                  recentActions={[
                    { action: "Type checked the project", time: "1 min ago" },
                    { action: "Verified build success", time: "6 min ago" },
                  ]}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                View complete session history
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <Separator />
          </>
        )}

        {/* Delete section */}
        <div className="space-y-3">
          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Task
            </Button>
          ) : (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
              <p className="text-sm text-destructive">
                Are you sure you want to delete this task? This action cannot be
                undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteTask.isPending}
                >
                  {deleteTask.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DetailPanel>
  );
}

export default TaskDetailPanel;
