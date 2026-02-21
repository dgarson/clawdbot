import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { uuidv7 } from "@/lib/ids";
import type { Conversation, Message } from "../queries/useConversations";
import { conversationKeys } from "../queries/useConversations";

// Mock API functions
async function createConversation(
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

async function updateConversation(
  data: Partial<Conversation> & { id: string }
): Promise<Conversation> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    ...data,
    updatedAt: new Date().toISOString(),
  } as Conversation;
}

async function deleteConversation(id: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return id;
}

async function sendMessage(
  data: Omit<Message, "id" | "timestamp">
): Promise<Message> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return {
    ...data,
    id: uuidv7(),
    timestamp: new Date().toISOString(),
  };
}

async function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<{ conversationId: string; messageId: string }> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { conversationId, messageId };
}

// Mutation hooks
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConversation,
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

  return useMutation({
    mutationFn: updateConversation,
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

  return useMutation({
    mutationFn: deleteConversation,
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

  return useMutation({
    mutationFn: sendMessage,
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
      deleteMessage(conversationId, messageId),
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
