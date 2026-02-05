import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uuidv7 } from "@/lib/ids";
import {
  sendChatMessage,
  deleteSession,
  patchSession,
} from "@/lib/api";
import { useUIStore } from "@/stores/useUIStore";
import type { Conversation, Message } from "../queries/useConversations";
import { conversationKeys } from "../queries/useConversations";

// ── Mock API functions (fallback when not connected) ───────────────

async function createConversationMock(
  data: Omit<Conversation, "id" | "createdAt" | "updatedAt">
): Promise<Conversation> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const now = new Date().toISOString();
  return {
    ...data,
    id: uuidv7(),
    createdAt: now,
    updatedAt: now,
  };
}

async function updateConversationMock(
  data: Partial<Conversation> & { id: string }
): Promise<Conversation> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    ...data,
    updatedAt: new Date().toISOString(),
  } as Conversation;
}

async function deleteConversationMock(id: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return id;
}

async function sendMessageMock(
  data: Omit<Message, "id" | "timestamp">
): Promise<Message> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return {
    ...data,
    id: uuidv7(),
    timestamp: new Date().toISOString(),
  };
}

async function deleteMessageMock(
  conversationId: string,
  messageId: string
): Promise<{ conversationId: string; messageId: string }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { conversationId, messageId };
}

// ── Live API functions ─────────────────────────────────────────────

async function updateConversationLive(
  data: Partial<Conversation> & { id: string }
): Promise<Conversation> {
  await patchSession({
    key: data.id,
    label: data.title ?? null,
  });
  return {
    ...data,
    updatedAt: new Date().toISOString(),
  } as Conversation;
}

async function deleteConversationLive(id: string): Promise<string> {
  await deleteSession(id, false);
  return id;
}

/**
 * Send a message via the gateway chat.send RPC.
 * Returns the user message immediately; the assistant reply arrives via events.
 */
async function sendMessageLive(
  data: Omit<Message, "id" | "timestamp">
): Promise<Message> {
  const idempotencyKey = uuidv7();
  await sendChatMessage({
    sessionKey: data.conversationId,
    message: data.content,
    deliver: true,
    idempotencyKey,
  });

  // Return the user message; the assistant response will come via
  // gateway events (chat.event) and be handled by event listeners.
  return {
    ...data,
    id: idempotencyKey,
    timestamp: new Date().toISOString(),
  };
}

// ── Helper to check live mode ──────────────────────────────────────

function useLiveMode(): boolean {
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  return (import.meta.env?.DEV ?? false) && useLiveGateway;
}

// ── Mutation hooks ─────────────────────────────────────────────────

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConversationMock,
    onSuccess: (newConversation) => {
      queryClient.setQueryData<Conversation[]>(
        conversationKeys.lists(),
        (old) => (old ? [newConversation, ...old] : [newConversation])
      );
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success("Conversation created");
    },
    onError: (error) => {
      toast.error(
        `Failed to create conversation: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  const liveMode = useLiveMode();

  return useMutation({
    mutationFn: liveMode ? updateConversationLive : updateConversationMock,
    onMutate: async (updatedConversation) => {
      await queryClient.cancelQueries({
        queryKey: conversationKeys.detail(updatedConversation.id),
      });

      const previousConversation = queryClient.getQueryData<Conversation>(
        conversationKeys.detail(updatedConversation.id)
      );

      queryClient.setQueryData<Conversation>(
        conversationKeys.detail(updatedConversation.id),
        (old) => (old ? { ...old, ...updatedConversation } : undefined)
      );

      return { previousConversation };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      toast.success("Conversation updated");
    },
    onError: (_error, variables, context) => {
      if (context?.previousConversation) {
        queryClient.setQueryData(
          conversationKeys.detail(variables.id),
          context.previousConversation
        );
      }
      toast.error("Failed to update conversation");
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const liveMode = useLiveMode();

  return useMutation({
    mutationFn: liveMode ? deleteConversationLive : deleteConversationMock,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: conversationKeys.lists() });

      const previousConversations = queryClient.getQueryData<Conversation[]>(
        conversationKeys.lists()
      );

      queryClient.setQueryData<Conversation[]>(
        conversationKeys.lists(),
        (old) => (old ? old.filter((c) => c.id !== id) : [])
      );

      return { previousConversations };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
      toast.success("Conversation deleted");
    },
    onError: (_error, _, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(
          conversationKeys.lists(),
          context.previousConversations
        );
      }
      toast.error("Failed to delete conversation");
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const liveMode = useLiveMode();

  return useMutation({
    mutationFn: liveMode ? sendMessageLive : sendMessageMock,
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({
        queryKey: conversationKeys.messages(newMessage.conversationId),
      });

      const previousMessages = queryClient.getQueryData<Message[]>(
        conversationKeys.messages(newMessage.conversationId)
      );

      // Optimistically add message
      const optimisticMessage: Message = {
        ...newMessage,
        id: `temp-${Date.now()}`,
        timestamp: new Date().toISOString(),
      };

      queryClient.setQueryData<Message[]>(
        conversationKeys.messages(newMessage.conversationId),
        (old) => (old ? [...old, optimisticMessage] : [optimisticMessage])
      );

      return { previousMessages, optimisticMessage };
    },
    onSuccess: (newMessage, variables) => {
      // Replace optimistic message with real one
      queryClient.setQueryData<Message[]>(
        conversationKeys.messages(variables.conversationId),
        (old) =>
          old
            ? old.map((msg) =>
                msg.id.startsWith("temp-") ? newMessage : msg
              )
            : [newMessage]
      );
    },
    onError: (_error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          conversationKeys.messages(variables.conversationId),
          context.previousMessages
        );
      }
      toast.error("Failed to send message");
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      deleteMessageMock(conversationId, messageId),
    onMutate: async ({ conversationId, messageId }) => {
      await queryClient.cancelQueries({
        queryKey: conversationKeys.messages(conversationId),
      });

      const previousMessages = queryClient.getQueryData<Message[]>(
        conversationKeys.messages(conversationId)
      );

      queryClient.setQueryData<Message[]>(
        conversationKeys.messages(conversationId),
        (old) => (old ? old.filter((msg) => msg.id !== messageId) : [])
      );

      return { previousMessages };
    },
    onSuccess: () => {
      toast.success("Message deleted");
    },
    onError: (_error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          conversationKeys.messages(variables.conversationId),
          context.previousMessages
        );
      }
      toast.error("Failed to delete message");
    },
  });
}
