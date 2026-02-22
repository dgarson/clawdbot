import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uuidv7 } from "@/lib/ids";
import type {
  Workstream,
  WorkstreamStatus,
  Task,
  TaskStatus,
  TaskPriority,
} from "../queries/useWorkstreams";
import { workstreamKeys } from "../queries/useWorkstreams";

// Mock API functions
async function createWorkstream(
  data: Omit<Workstream, "id" | "createdAt" | "updatedAt" | "tasks" | "progress">
): Promise<Workstream> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const now = new Date().toISOString();
  return {
    ...data,
    id: uuidv7(),
    tasks: [],
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
}

async function updateWorkstream(
  data: Partial<Omit<Workstream, "tasks">> & { id: string }
): Promise<Workstream> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    ...data,
    updatedAt: new Date().toISOString(),
  } as Workstream;
}

async function deleteWorkstream(id: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return id;
}

async function updateWorkstreamStatus(
  id: string,
  status: WorkstreamStatus
): Promise<{ id: string; status: WorkstreamStatus }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { id, status };
}

async function createTask(
  workstreamId: string,
  data: Omit<Task, "id" | "workstreamId" | "createdAt" | "updatedAt">
): Promise<Task> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const now = new Date().toISOString();
  return {
    ...data,
    id: uuidv7(),
    workstreamId,
    createdAt: now,
    updatedAt: now,
  };
}

async function updateTask(
  workstreamId: string,
  task: Partial<Task> & { id: string }
): Promise<Task> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return {
    ...task,
    workstreamId,
    updatedAt: new Date().toISOString(),
  } as Task;
}

async function deleteTask(
  workstreamId: string,
  taskId: string
): Promise<{ workstreamId: string; taskId: string }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { workstreamId, taskId };
}

async function updateTaskStatus(
  workstreamId: string,
  taskId: string,
  status: TaskStatus
): Promise<{ workstreamId: string; taskId: string; status: TaskStatus }> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { workstreamId, taskId, status };
}

async function updateTaskPriority(
  workstreamId: string,
  taskId: string,
  priority: TaskPriority
): Promise<{ workstreamId: string; taskId: string; priority: TaskPriority }> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { workstreamId, taskId, priority };
}

// Mutation hooks
export function useCreateWorkstream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkstream,
    onSuccess: (newWorkstream) => {
      queryClient.setQueryData<Workstream[]>(workstreamKeys.lists(), (old) =>
        old ? [newWorkstream, ...old] : [newWorkstream]
      );
      queryClient.invalidateQueries({ queryKey: workstreamKeys.all });
      toast.success("Workstream created successfully");
    },
    onError: (error) => {
      toast.error(
        `Failed to create workstream: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateWorkstream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateWorkstream,
    onMutate: async (updatedWorkstream) => {
      await queryClient.cancelQueries({
        queryKey: workstreamKeys.detail(updatedWorkstream.id),
      });

      const previousWorkstream = queryClient.getQueryData<Workstream>(
        workstreamKeys.detail(updatedWorkstream.id)
      );

      queryClient.setQueryData<Workstream>(
        workstreamKeys.detail(updatedWorkstream.id),
        (old) => (old ? { ...old, ...updatedWorkstream } : undefined)
      );

      return { previousWorkstream };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workstreamKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: workstreamKeys.lists() });
      toast.success("Workstream updated successfully");
    },
    onError: (_error, variables, context) => {
      if (context?.previousWorkstream) {
        queryClient.setQueryData(
          workstreamKeys.detail(variables.id),
          context.previousWorkstream
        );
      }
      toast.error("Failed to update workstream");
    },
  });
}

export function useDeleteWorkstream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWorkstream,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: workstreamKeys.lists() });

      const previousWorkstreams = queryClient.getQueryData<Workstream[]>(
        workstreamKeys.lists()
      );

      queryClient.setQueryData<Workstream[]>(workstreamKeys.lists(), (old) =>
        old ? old.filter((ws) => ws.id !== id) : []
      );

      return { previousWorkstreams };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workstreamKeys.all });
      toast.success("Workstream deleted successfully");
    },
    onError: (_error, _, context) => {
      if (context?.previousWorkstreams) {
        queryClient.setQueryData(
          workstreamKeys.lists(),
          context.previousWorkstreams
        );
      }
      toast.error("Failed to delete workstream");
    },
  });
}

export function useUpdateWorkstreamStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkstreamStatus }) =>
      updateWorkstreamStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({
        queryKey: workstreamKeys.detail(id),
      });

      const previousWorkstream = queryClient.getQueryData<Workstream>(
        workstreamKeys.detail(id)
      );

      queryClient.setQueryData<Workstream>(workstreamKeys.detail(id), (old) =>
        old ? { ...old, status } : undefined
      );

      queryClient.setQueryData<Workstream[]>(workstreamKeys.lists(), (old) =>
        old ? old.map((ws) => (ws.id === id ? { ...ws, status } : ws)) : []
      );

      return { previousWorkstream };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workstreamKeys.detail(variables.id),
      });
      toast.success(`Workstream marked as ${variables.status}`);
    },
    onError: (_error, variables, context) => {
      if (context?.previousWorkstream) {
        queryClient.setQueryData(
          workstreamKeys.detail(variables.id),
          context.previousWorkstream
        );
      }
      toast.error("Failed to update workstream status");
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workstreamId,
      data,
    }: {
      workstreamId: string;
      data: Omit<Task, "id" | "workstreamId" | "createdAt" | "updatedAt">;
    }) => createTask(workstreamId, data),
    onSuccess: (newTask, { workstreamId }) => {
      queryClient.setQueryData<Workstream>(
        workstreamKeys.detail(workstreamId),
        (old) =>
          old ? { ...old, tasks: [...old.tasks, newTask] } : undefined
      );
      queryClient.invalidateQueries({
        queryKey: workstreamKeys.tasks(workstreamId),
      });
      toast.success("Task created successfully");
    },
    onError: () => {
      toast.error("Failed to create task");
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workstreamId,
      task,
    }: {
      workstreamId: string;
      task: Partial<Task> & { id: string };
    }) => updateTask(workstreamId, task),
    onMutate: async ({ workstreamId, task }) => {
      await queryClient.cancelQueries({
        queryKey: workstreamKeys.detail(workstreamId),
      });

      const previousWorkstream = queryClient.getQueryData<Workstream>(
        workstreamKeys.detail(workstreamId)
      );

      queryClient.setQueryData<Workstream>(
        workstreamKeys.detail(workstreamId),
        (old) =>
          old
            ? {
                ...old,
                tasks: old.tasks.map((t) =>
                  t.id === task.id ? { ...t, ...task } : t
                ),
              }
            : undefined
      );

      return { previousWorkstream };
    },
    onSuccess: (_, { workstreamId }) => {
      queryClient.invalidateQueries({
        queryKey: workstreamKeys.detail(workstreamId),
      });
      toast.success("Task updated successfully");
    },
    onError: (_error, { workstreamId }, context) => {
      if (context?.previousWorkstream) {
        queryClient.setQueryData(
          workstreamKeys.detail(workstreamId),
          context.previousWorkstream
        );
      }
      toast.error("Failed to update task");
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workstreamId,
      taskId,
    }: {
      workstreamId: string;
      taskId: string;
    }) => deleteTask(workstreamId, taskId),
    onMutate: async ({ workstreamId, taskId }) => {
      await queryClient.cancelQueries({
        queryKey: workstreamKeys.detail(workstreamId),
      });

      const previousWorkstream = queryClient.getQueryData<Workstream>(
        workstreamKeys.detail(workstreamId)
      );

      queryClient.setQueryData<Workstream>(
        workstreamKeys.detail(workstreamId),
        (old) =>
          old
            ? {
                ...old,
                tasks: old.tasks.filter((t) => t.id !== taskId),
              }
            : undefined
      );

      return { previousWorkstream };
    },
    onSuccess: () => {
      toast.success("Task deleted successfully");
    },
    onError: (_error, { workstreamId }, context) => {
      if (context?.previousWorkstream) {
        queryClient.setQueryData(
          workstreamKeys.detail(workstreamId),
          context.previousWorkstream
        );
      }
      toast.error("Failed to delete task");
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workstreamId,
      taskId,
      status,
    }: {
      workstreamId: string;
      taskId: string;
      status: TaskStatus;
    }) => updateTaskStatus(workstreamId, taskId, status),
    onMutate: async ({ workstreamId, taskId, status }) => {
      await queryClient.cancelQueries({
        queryKey: workstreamKeys.detail(workstreamId),
      });

      const previousWorkstream = queryClient.getQueryData<Workstream>(
        workstreamKeys.detail(workstreamId)
      );

      queryClient.setQueryData<Workstream>(
        workstreamKeys.detail(workstreamId),
        (old) =>
          old
            ? {
                ...old,
                tasks: old.tasks.map((t) =>
                  t.id === taskId ? { ...t, status } : t
                ),
              }
            : undefined
      );

      return { previousWorkstream };
    },
    onSuccess: (_, { status }) => {
      const statusLabels: Record<TaskStatus, string> = {
        todo: "To Do",
        in_progress: "In Progress",
        review: "Review",
        done: "Done",
        blocked: "Blocked",
      };
      toast.success(`Task moved to ${statusLabels[status]}`);
    },
    onError: (_error, { workstreamId }, context) => {
      if (context?.previousWorkstream) {
        queryClient.setQueryData(
          workstreamKeys.detail(workstreamId),
          context.previousWorkstream
        );
      }
      toast.error("Failed to update task status");
    },
  });
}

export function useUpdateTaskPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workstreamId,
      taskId,
      priority,
    }: {
      workstreamId: string;
      taskId: string;
      priority: TaskPriority;
    }) => updateTaskPriority(workstreamId, taskId, priority),
    onMutate: async ({ workstreamId, taskId, priority }) => {
      await queryClient.cancelQueries({
        queryKey: workstreamKeys.detail(workstreamId),
      });

      const previousWorkstream = queryClient.getQueryData<Workstream>(
        workstreamKeys.detail(workstreamId)
      );

      queryClient.setQueryData<Workstream>(
        workstreamKeys.detail(workstreamId),
        (old) =>
          old
            ? {
                ...old,
                tasks: old.tasks.map((t) =>
                  t.id === taskId ? { ...t, priority } : t
                ),
              }
            : undefined
      );

      return { previousWorkstream };
    },
    onSuccess: (_, { priority }) => {
      toast.success(`Task priority set to ${priority}`);
    },
    onError: (_error, { workstreamId }, context) => {
      if (context?.previousWorkstream) {
        queryClient.setQueryData(
          workstreamKeys.detail(workstreamId),
          context.previousWorkstream
        );
      }
      toast.error("Failed to update task priority");
    },
  });
}
