import { useQuery } from "@tanstack/react-query";

// Types
export type MemoryType =
  | "note"
  | "document"
  | "link"
  | "image"
  | "conversation"
  | "insight";

export interface Memory {
  id: string;
  title: string;
  content: string;
  tags: string[];
  type: MemoryType;
  createdAt: string;
  updatedAt: string;
  source?: string;
  agentId?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

// Query keys factory
export const memoryKeys = {
  all: ["memories"] as const,
  lists: () => [...memoryKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...memoryKeys.lists(), filters] as const,
  details: () => [...memoryKeys.all, "detail"] as const,
  detail: (id: string) => [...memoryKeys.details(), id] as const,
  search: (query: string) => [...memoryKeys.all, "search", query] as const,
};

// Mock API functions
async function fetchMemories(): Promise<Memory[]> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  return [
    {
      id: "mem-1",
      title: "Project Architecture Notes",
      content:
        "The system uses a microservices architecture with event-driven communication between services. Key components include the API gateway, auth service, and data pipeline.",
      tags: ["architecture", "technical", "project"],
      type: "note",
      createdAt: new Date(Date.now() - 604800000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "mem-2",
      title: "User Interview Insights",
      content:
        "Key findings: Users want faster onboarding, prefer dark mode, need better export options. Priority feature request is collaborative editing.",
      tags: ["research", "users", "feedback"],
      type: "insight",
      createdAt: new Date(Date.now() - 1209600000).toISOString(),
      updatedAt: new Date(Date.now() - 259200000).toISOString(),
      agentId: "1",
    },
    {
      id: "mem-3",
      title: "API Documentation Reference",
      content: "https://docs.example.com/api/v2",
      tags: ["api", "documentation", "reference"],
      type: "link",
      createdAt: new Date(Date.now() - 2592000000).toISOString(),
      updatedAt: new Date(Date.now() - 2592000000).toISOString(),
      source: "https://docs.example.com",
    },
    {
      id: "mem-4",
      title: "Meeting Summary - Q1 Planning",
      content:
        "Discussed roadmap priorities, budget allocation, and team structure changes. Agreed to focus on mobile-first approach for next quarter.",
      tags: ["meeting", "planning", "q1"],
      type: "document",
      createdAt: new Date(Date.now() - 5184000000).toISOString(),
      updatedAt: new Date(Date.now() - 5184000000).toISOString(),
      conversationId: "conv-4",
    },
    {
      id: "mem-5",
      title: "Code Pattern: Error Handling",
      content:
        "Adopted Result type pattern for error handling. All async operations return Result<T, E> instead of throwing. See error-handling.md for details.",
      tags: ["code", "patterns", "best-practices"],
      type: "note",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
      agentId: "2",
    },
  ];
}

async function fetchMemory(id: string): Promise<Memory | null> {
  const memories = await fetchMemories();
  return memories.find((m) => m.id === id) ?? null;
}

async function fetchMemoriesByType(type: MemoryType): Promise<Memory[]> {
  const memories = await fetchMemories();
  return memories.filter((m) => m.type === type);
}

async function fetchMemoriesByTag(tag: string): Promise<Memory[]> {
  const memories = await fetchMemories();
  return memories.filter((m) => m.tags.includes(tag));
}

async function searchMemories(query: string): Promise<Memory[]> {
  const memories = await fetchMemories();
  const lowerQuery = query.toLowerCase();
  return memories.filter(
    (m) =>
      m.title.toLowerCase().includes(lowerQuery) ||
      m.content.toLowerCase().includes(lowerQuery) ||
      m.tags.some((t) => t.toLowerCase().includes(lowerQuery))
  );
}

// Query hooks
export function useMemories() {
  return useQuery({
    queryKey: memoryKeys.lists(),
    queryFn: fetchMemories,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMemory(id: string) {
  return useQuery({
    queryKey: memoryKeys.detail(id),
    queryFn: () => fetchMemory(id),
    enabled: !!id,
  });
}

export function useMemoriesByType(type: MemoryType) {
  return useQuery({
    queryKey: memoryKeys.list({ type }),
    queryFn: () => fetchMemoriesByType(type),
    enabled: !!type,
  });
}

export function useMemoriesByTag(tag: string) {
  return useQuery({
    queryKey: memoryKeys.list({ tag }),
    queryFn: () => fetchMemoriesByTag(tag),
    enabled: !!tag,
  });
}

export function useMemorySearch(query: string) {
  return useQuery({
    queryKey: memoryKeys.search(query),
    queryFn: () => searchMemories(query),
    enabled: query.length >= 2, // Only search with 2+ characters
    staleTime: 1000 * 30, // 30 seconds for search results
  });
}
