import { create } from "zustand";

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  preview?: string;
}

export interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Map<string, Message[]>;
}

export interface ConversationActions {
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  removeConversation: (id: string) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  clearMessages: (conversationId: string) => void;
}

export type ConversationStore = ConversationState & ConversationActions;

export const useConversationStore = create<ConversationStore>()((set) => ({
  // State
  conversations: [],
  activeConversationId: null,
  messages: new Map(),

  // Actions
  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(conversationId) ?? [];
      newMessages.set(conversationId, [...existing, message]);
      return { messages: newMessages };
    }),

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [...state.conversations, conversation],
    })),

  removeConversation: (id) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.delete(id);
      return {
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        messages: newMessages,
      };
    }),

  setMessages: (conversationId, messages) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.set(conversationId, messages);
      return { messages: newMessages };
    }),

  clearMessages: (conversationId) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.set(conversationId, []);
      return { messages: newMessages };
    }),
}));
