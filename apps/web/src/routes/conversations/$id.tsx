import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ChatHeader,
  ChatThread,
  ChatInput,
  ChatSettingsPanel,
} from "@/components/domain/chat";
import {
  useConversation,
  useMessages,
} from "@/hooks/queries/useConversations";
import { useAgent } from "@/hooks/queries/useAgents";
import {
  useSendMessage,
  useDeleteConversation,
} from "@/hooks/mutations/useConversationMutations";
import { useConversationStore } from "@/stores/useConversationStore";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/conversations/$id")({
  component: ConversationDetailPage,
});

function ConversationDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // Set active conversation in store
  const { setActiveConversation, clearMessages } = useConversationStore();

  React.useEffect(() => {
    setActiveConversation(id);
    return () => setActiveConversation(null);
  }, [id, setActiveConversation]);

  // Fetch data
  const { data: conversation, isLoading: conversationLoading } = useConversation(id);
  const { data: messages, isLoading: messagesLoading } = useMessages(id);
  const { data: agent } = useAgent(conversation?.agentId || "");

  // Mutations
  const sendMessage = useSendMessage();
  const deleteConversation = useDeleteConversation();

  const handleBack = () => {
    navigate({ to: "/conversations" });
  };

  const handleSubmit = async (value: string) => {
    if (!value.trim()) {return;}

    setInputValue("");

    try {
      await sendMessage.mutateAsync({
        conversationId: id,
        role: "user",
        content: value.trim(),
      });

      // Simulate an AI response after a delay
      setTimeout(async () => {
        await sendMessage.mutateAsync({
          conversationId: id,
          role: "assistant",
          content: "I received your message and I'm processing it. This is a simulated response for the demo.",
        });
      }, 1000);
    } catch {
      toast.error("Failed to send message");
    }
  };

  const handleClearHistory = () => {
    clearMessages(id);
    toast.success("Chat history cleared");
    setIsSettingsOpen(false);
  };

  const handleDeleteConversation = async () => {
    try {
      await deleteConversation.mutateAsync(id);
      navigate({ to: "/conversations" });
    } catch {
      toast.error("Failed to delete conversation");
    }
  };

  const isLoading = conversationLoading || messagesLoading;

  if (conversationLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex flex-col h-screen max-w-4xl mx-auto">
          {/* Header skeleton */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          {/* Messages skeleton */}
          <div className="flex-1 p-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex items-start gap-2 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <Skeleton className={`h-16 ${i % 2 === 0 ? "w-2/3" : "w-1/2"} rounded-2xl`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Conversation not found
          </h2>
          <p className="text-muted-foreground mb-4">
            This conversation may have been deleted or does not exist.
          </p>
          <button
            onClick={handleBack}
            className="text-primary hover:underline"
          >
            Back to conversations
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col h-screen max-w-4xl mx-auto border-x border-border">
        {/* Chat Header */}
        <ChatHeader
          agent={agent ?? undefined}
          title={conversation.title}
          onBack={handleBack}
          onSettings={() => setIsSettingsOpen(true)}
        />

        {/* Chat Thread */}
        <ChatThread
          messages={messages ?? []}
          agent={agent ?? undefined}
          isLoading={isLoading}
          className="flex-1 overflow-hidden"
        />

        {/* Chat Input */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          disabled={sendMessage.isPending}
          placeholder={`Message ${agent?.name || "AI"}...`}
        />
      </div>

      {/* Settings Panel */}
      <ChatSettingsPanel
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        conversation={conversation}
        agent={agent ?? undefined}
        messageCount={messages?.length ?? 0}
        onClearHistory={handleClearHistory}
        onDeleteConversation={handleDeleteConversation}
      />
    </div>
  );
}
