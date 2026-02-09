import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  Task,
  TaskPriority,
  TaskStatus,
  Workstream,
  WorkstreamStatus,
} from "../queries/useWorkstreams";

interface CreateWorkstreamInput {
  name: string;
  description?: string;
  ownerId?: string;
  status: WorkstreamStatus;
}

interface UpdateWorkstreamInput {
  id: string;
  data: Partial<Omit<Workstream, "id" | "tasks" | "progress" | "createdAt" | "updatedAt">>;
}

interface UpdateWorkstreamStatusInput {
  id: string;
  status: WorkstreamStatus;
}

interface CreateTaskInput {
  workstreamId: string;
  data: {
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId?: string;
    dependencies?: string[];
  };
}

interface UpdateTaskInput {
  workstreamId: string;
  task: {
    id: string;
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string;
    dependencies?: string[];
  };
}

interface DeleteTaskInput {
  workstreamId: string;
  taskId: string;
}

interface UpdateTaskStatusInput {
  workstreamId: string;
  taskId: string;
  status: TaskStatus;
}

interface UpdateTaskPriorityInput {
  workstreamId: string;
  taskId: string;
  priority: TaskPriority;
}

async function readonlyWorkstreamMutation<TData>(message: string): Promise<TData> {
  throw new Error(message);
}

// Mutation hooks
export function useCreateWorkstream() {
  return useMutation<Workstream, Error, CreateWorkstreamInput>({
    mutationFn: (_input) =>
      readonlyWorkstreamMutation<Workstream>(
        "Workstreams are read-only until gateway support lands."
      ),
    onError: (error) => {
      toast.error(
        `Failed to create workstream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateWorkstream() {
  return useMutation<Workstream, Error, UpdateWorkstreamInput>({
    mutationFn: (_input) =>
      readonlyWorkstreamMutation<Workstream>(
        "Workstreams are read-only until gateway support lands."
      ),
    onError: (error) => {
      toast.error(
        `Failed to update workstream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useDeleteWorkstream() {
  return useMutation<string, Error, string>({
    mutationFn: (_id) =>
      readonlyWorkstreamMutation<string>(
        "Workstreams are read-only until gateway support lands."
      ),
    onError: (error) => {
      toast.error(
        `Failed to delete workstream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateWorkstreamStatus() {
  return useMutation<Workstream, Error, UpdateWorkstreamStatusInput>({
    mutationFn: (_input) =>
      readonlyWorkstreamMutation<Workstream>(
        "Workstreams are read-only until gateway support lands."
      ),
    onError: (error) => {
      toast.error(
        `Failed to update workstream status: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useCreateTask() {
  return useMutation<Task, Error, CreateTaskInput>({
    mutationFn: (_input) =>
      readonlyWorkstreamMutation<Task>(
        "Workstream tasks are read-only until gateway support lands."
      ),
    onError: (error) => {
      toast.error(
        `Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateTask() {
  return useMutation<Task, Error, UpdateTaskInput>({
    mutationFn: (_input) =>
      readonlyWorkstreamMutation<Task>(
        "Workstream tasks are read-only until gateway support lands."
      ),
    onError: (error) => {
      toast.error(
        `Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useDeleteTask() {
  return useMutation<string, Error, DeleteTaskInput>({
    mutationFn: (_input) =>
      readonlyWorkstreamMutation<string>(
        "Workstream tasks are read-only until gateway support lands."
      ),
    onError: (error) => {
      toast.error(
        `Failed to delete task: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateTaskStatus() {
  return useMutation<Task, Error, UpdateTaskStatusInput>({
    mutationFn: (_input) =>
      readonlyWorkstreamMutation<Task>(
        "Workstream tasks are read-only until gateway support lands."
      ),
    onError: (error) => {
      toast.error(
        `Failed to update task status: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateTaskPriority() {
  return useMutation<Task, Error, UpdateTaskPriorityInput>({
    mutationFn: (_input) =>
      readonlyWorkstreamMutation<Task>(
        "Workstream tasks are read-only until gateway support lands."
      ),
    onError: (error) => {
      toast.error(
        `Failed to update task priority: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}
