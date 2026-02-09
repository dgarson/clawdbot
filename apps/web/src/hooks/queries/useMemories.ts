import { useQuery } from "@tanstack/react-query";
import { useGatewayModeKey } from "../useGatewayEnabled";

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
  detail: (id: string, mode?: "live" | "mock") => [...memoryKeys.details(), id, mode] as const,
  search: (query: string, mode?: "live" | "mock") =>
    [...memoryKeys.all, "search", query, mode] as const,
};

async function fetchMemories(): Promise<Memory[]> {
  return [];
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
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: memoryKeys.list({ mode: modeKey }),
    queryFn: fetchMemories,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMemory(id: string) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: memoryKeys.detail(id, modeKey),
    queryFn: () => fetchMemory(id),
    enabled: !!id,
  });
}

export function useMemoriesByType(type: MemoryType) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: memoryKeys.list({ type, mode: modeKey }),
    queryFn: () => fetchMemoriesByType(type),
    enabled: !!type,
  });
}

export function useMemoriesByTag(tag: string) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: memoryKeys.list({ tag, mode: modeKey }),
    queryFn: () => fetchMemoriesByTag(tag),
    enabled: !!tag,
  });
}

export function useMemorySearch(query: string) {
  const modeKey = useGatewayModeKey();
  return useQuery({
    queryKey: memoryKeys.search(query, modeKey),
    queryFn: () => searchMemories(query),
    enabled: query.length >= 2, // Only search with 2+ characters
    staleTime: 1000 * 30, // 30 seconds for search results
  });
}
