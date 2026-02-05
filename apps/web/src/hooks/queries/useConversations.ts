import { useQuery } from "@tanstack/react-query";
import {
  listSessions,
  getChatHistory,
  parseAgentSessionKey,
  type GatewaySessionRow,
  type ChatMessage,
} from "@/lib/api";
import { useUIStore } from "@/stores/useUIStore";

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

// ── Mappers ────────────────────────────────────────────────────────

/**
 * Map a GatewaySessionRow (from sessions.list RPC) to our UI Conversation type.
 *
 * The session `key` becomes the conversation `id`.
 * `agentId` is extracted from the key pattern `agent:<agentId>:<rest>`.
 */
function mapSessionToConversation(session: GatewaySessionRow): Conversation {
  const parsed = parseAgentSessionKey(session.key);
  return {
    id: session.key,
    title: session.derivedTitle ?? session.label ?? session.key,
    agentId: parsed?.agentId,
    createdAt: session.lastMessageAt
      ? new Date(session.lastMessageAt).toISOString()
      : new Date().toISOString(),
    updatedAt: session.lastMessageAt
      ? new Date(session.lastMessageAt).toISOString()
      : new Date().toISOString(),
    preview: session.lastMessage ?? undefined,
  };
}

/**
 * Map a ChatMessage (from chat.history RPC) to our UI Message type.
 */
function mapChatMessageToMessage(
  msg: ChatMessage,
  conversationId: string,
  index: number
): Message {
  return {
    id: `${conversationId}-msg-${index}`,
    conversationId,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp ?? new Date().toISOString(),
  };
}

// ── Mock data ──────────────────────────────────────────────────────

async function fetchMockConversations(): Promise<Conversation[]> {
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

async function fetchMockMessages(conversationId: string): Promise<Message[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));

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

// ── Live fetch functions ───────────────────────────────────────────

async function fetchConversations(liveMode: boolean): Promise<Conversation[]> {
  if (!liveMode) {
    return fetchMockConversations();
  }
  try {
    const result = await listSessions({
      includeGlobal: false,
      includeUnknown: false,
      includeLastMessage: true,
      includeDerivedTitles: true,
      limit: 50,
    });
    return result.sessions.map(mapSessionToConversation);
  } catch {
    return fetchMockConversations();
  }
}

async function fetchConversation(
  id: string,
  liveMode: boolean
): Promise<Conversation | null> {
  const conversations = await fetchConversations(liveMode);
  return conversations.find((c) => c.id === id) ?? null;
}

async function fetchConversationsByAgent(
  agentId: string,
  liveMode: boolean
): Promise<Conversation[]> {
  const conversations = await fetchConversations(liveMode);
  return conversations.filter((c) => c.agentId === agentId);
}

async function fetchMessages(
  conversationId: string,
  liveMode: boolean
): Promise<Message[]> {
  if (!liveMode) {
    return fetchMockMessages(conversationId);
  }
  try {
    const result = await getChatHistory(conversationId, 100);
    return result.messages.map((msg, i) =>
      mapChatMessageToMessage(msg, conversationId, i)
    );
  } catch {
    return fetchMockMessages(conversationId);
  }
}

// ── Query hooks ────────────────────────────────────────────────────

export function useConversations() {
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  const liveMode = (import.meta.env?.DEV ?? false) && useLiveGateway;
  const modeKey = liveMode ? "live" : "mock";

  return useQuery({
    queryKey: conversationKeys.list({ mode: modeKey }),
    queryFn: () => fetchConversations(liveMode),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useConversation(id: string) {
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  const liveMode = (import.meta.env?.DEV ?? false) && useLiveGateway;
  const modeKey = liveMode ? "live" : "mock";

  return useQuery({
    queryKey: [...conversationKeys.detail(id), modeKey],
    queryFn: () => fetchConversation(id, liveMode),
    enabled: !!id,
  });
}

export function useConversationsByAgent(agentId: string) {
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  const liveMode = (import.meta.env?.DEV ?? false) && useLiveGateway;
  const modeKey = liveMode ? "live" : "mock";

  return useQuery({
    queryKey: conversationKeys.list({ agentId, mode: modeKey }),
    queryFn: () => fetchConversationsByAgent(agentId, liveMode),
    enabled: !!agentId,
  });
}

export function useMessages(conversationId: string) {
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  const liveMode = (import.meta.env?.DEV ?? false) && useLiveGateway;
  const modeKey = liveMode ? "live" : "mock";

  return useQuery({
    queryKey: [...conversationKeys.messages(conversationId), modeKey],
    queryFn: () => fetchMessages(conversationId, liveMode),
    enabled: !!conversationId,
    staleTime: 1000 * 30, // 30 seconds - messages update frequently
  });
}
