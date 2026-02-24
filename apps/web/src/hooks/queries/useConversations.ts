import { useQuery } from "@tanstack/react-query";

// Re-export types from store for consistency
export type { Conversation, Message } from "../../stores/useConversationStore";
import type { Conversation, Message } from "../../stores/useConversationStore";

// Query keys factory
export const conversationKeys = {
  all: ["conversations"] as const,
  lists: () => [...conversationKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...conversationKeys.lists(), filters] as const,
  details: () => [...conversationKeys.all, "detail"] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
  messages: (conversationId: string) =>
    [...conversationKeys.detail(conversationId), "messages"] as const,
};

// Mock API functions
async function fetchConversations(): Promise<Conversation[]> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  return [
    {
      id: "conv-1",
      title: "Research on quantum computing",
      agentId: "1",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      preview: "Let me help you understand quantum entanglement...",
    },
    {
      id: "conv-2",
      title: "Code review for auth module",
      agentId: "2",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      preview: "I found a few issues with the token validation...",
    },
    {
      id: "conv-3",
      title: "Blog post draft review",
      agentId: "3",
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      preview: "Your introduction is strong, but consider...",
    },
    {
      id: "conv-4",
      title: "Weekly planning session",
      agentId: "4",
      createdAt: new Date(Date.now() - 604800000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      preview: "Here are your top priorities for this week...",
    },
  ];
}

async function fetchConversation(id: string): Promise<Conversation | null> {
  const conversations = await fetchConversations();
  return conversations.find((c) => c.id === id) ?? null;
}

async function fetchConversationsByAgent(
  agentId: string
): Promise<Conversation[]> {
  const conversations = await fetchConversations();
  return conversations.filter((c) => c.agentId === agentId);
}

async function fetchMessages(conversationId: string): Promise<Message[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Mock messages for demo
  return [
    {
      id: "msg-1",
      conversationId,
      role: "user",
      content: "Can you help me understand this topic?",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "msg-2",
      conversationId,
      role: "assistant",
      content:
        "Of course! I would be happy to help. Let me break this down for you...",
      timestamp: new Date(Date.now() - 3500000).toISOString(),
    },
    {
      id: "msg-3",
      conversationId,
      role: "user",
      content: "That makes sense. What about the next steps?",
      timestamp: new Date(Date.now() - 3400000).toISOString(),
    },
    {
      id: "msg-4",
      conversationId,
      role: "assistant",
      content:
        "Great question! Here are the recommended next steps you should consider...",
      timestamp: new Date(Date.now() - 3300000).toISOString(),
    },
  ];
}

// Query hooks
export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.lists(),
    queryFn: fetchConversations,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: () => fetchConversation(id),
    enabled: !!id,
  });
}

export function useConversationsByAgent(agentId: string) {
  return useQuery({
    queryKey: conversationKeys.list({ agentId }),
    queryFn: () => fetchConversationsByAgent(agentId),
    enabled: !!agentId,
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId),
    queryFn: () => fetchMessages(conversationId),
    enabled: !!conversationId,
    staleTime: 1000 * 30, // 30 seconds - messages update frequently
  });
}
