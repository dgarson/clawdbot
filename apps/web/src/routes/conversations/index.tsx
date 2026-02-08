import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  ConversationList,
  NewConversationModal,
} from "@/components/domain/conversations";
import { useCreateConversation } from "@/hooks/mutations/useConversationMutations";
import type { Conversation } from "@/hooks/queries/useConversations";
import type { Agent } from "@/hooks/queries/useAgents";
import { Button } from "@/components/ui/button";

import { RouteErrorFallback } from "@/components/composed";
export const Route = createFileRoute("/conversations/")({
  component: ConversationsPage,
  errorComponent: RouteErrorFallback,
});

function ConversationsPage() {
  const navigate = useNavigate();
  const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);
  const createConversation = useCreateConversation();

  const handleSelectConversation = (conversation: Conversation) => {
    navigate({ to: "/conversations/$id", params: { id: conversation.id } });
  };

  const handleNewConversation = () => {
    setIsNewChatOpen(true);
  };

  const handleSelectAgent = async (agent: Agent) => {
    try {
      const newConversation = await createConversation.mutateAsync({
        title: `Chat with ${agent.name}`,
        agentId: agent.id,
        preview: "",
      });

      if (!newConversation?.id) {
        toast.error("Failed to create conversation");
        return;
      }

      setIsNewChatOpen(false);
      navigate({ to: "/conversations/$id", params: { id: newConversation.id } });
    } catch {
      toast.error("Failed to create conversation");
    }
  };

  return (
    <div className="flex h-full -mx-4 -my-6 sm:-mx-6 lg:-mx-8">
        {/* Conversation List Sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full md:max-w-md md:border-r border-border bg-card/50"
        >
          <ConversationList
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
            className="h-full"
          />
        </motion.aside>

        {/* Empty State / Welcome */}
        <main className="hidden md:flex flex-1 items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center max-w-md"
          >
            <div className="mb-6 flex justify-center">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <MessageSquare className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              Welcome to Conversations
            </h1>
            <p className="text-muted-foreground mb-6">
              Select a conversation from the list to continue chatting, or start
              a new conversation with one of your AI agents.
            </p>
            <Button
              size="lg"
              onClick={handleNewConversation}
            >
              <MessageSquare className="h-5 w-5" />
              Start New Chat
            </Button>
          </motion.div>
        </main>

        {/* New Conversation Modal */}
        <NewConversationModal
          open={isNewChatOpen}
          onOpenChange={setIsNewChatOpen}
          onSelectAgent={handleSelectAgent}
        />
      </div>
  );
}
