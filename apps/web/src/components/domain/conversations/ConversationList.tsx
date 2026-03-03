
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationItem } from "./ConversationItem";
import { useConversations, type Conversation } from "@/hooks/queries/useConversations";
import { useAgents, type Agent } from "@/hooks/queries/useAgents";
import { useDebounce } from "@/hooks/useDebounce";

interface ConversationListProps {
  onSelectConversation: (conversation: Conversation) => void;
  onNewConversation: () => void;
  selectedConversationId?: string;
  className?: string;
}

export function ConversationList({
  onSelectConversation,
  onNewConversation,
  selectedConversationId,
  className,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [agentFilter, setAgentFilter] = React.useState<string>("all");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: conversations, isLoading: conversationsLoading } = useConversations();
  const { data: agents, isLoading: agentsLoading } = useAgents();

  // Create agent lookup map
  const agentMap = React.useMemo(() => {
    if (!agents) {return new Map<string, Agent>();}
    return new Map(agents.map((agent) => [agent.id, agent]));
  }, [agents]);

  // Filter conversations
  const filteredConversations = React.useMemo(() => {
    if (!conversations) {return [];}

    return conversations.filter((conv) => {
      // Search filter
      const matchesSearch =
        !debouncedSearch ||
        conv.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        conv.preview?.toLowerCase().includes(debouncedSearch.toLowerCase());

      // Agent filter
      const matchesAgent =
        agentFilter === "all" || conv.agentId === agentFilter;

      return matchesSearch && matchesAgent;
    });
  }, [conversations, debouncedSearch, agentFilter]);

  const isLoading = conversationsLoading || agentsLoading;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 space-y-4 border-b border-border">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter and New Chat */}
        <div className="flex items-center gap-2">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="flex-1">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={onNewConversation} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredConversations.length === 0 ? (
            // Empty state
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 px-4 text-center"
            >
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                No conversations found
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {searchQuery || agentFilter !== "all"
                  ? "Try adjusting your search or filter"
                  : "Start a new conversation to get going"}
              </p>
              <Button variant="outline" size="sm" onClick={onNewConversation}>
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </motion.div>
          ) : (
            // Conversation items
            <AnimatePresence mode="popLayout">
              {filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  agent={conversation.agentId ? agentMap.get(conversation.agentId) : undefined}
                  isActive={selectedConversationId === conversation.id}
                  onClick={() => onSelectConversation(conversation)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ConversationList;
