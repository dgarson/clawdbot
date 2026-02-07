"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgents, type Agent } from "@/hooks/queries/useAgents";

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAgent: (agent: Agent) => void;
}

const statusConfig: Record<Agent["status"], { color: string; label: string }> = {
  online: { color: "bg-green-500", label: "Online" },
  offline: { color: "bg-gray-400", label: "Offline" },
  busy: { color: "bg-yellow-500", label: "Busy" },
  paused: { color: "bg-orange-500", label: "Paused" },
};

export function NewConversationModal({
  open,
  onOpenChange,
  onSelectAgent,
}: NewConversationModalProps) {
  const { data: agents, isLoading } = useAgents();

  const handleSelectAgent = (agent: Agent) => {
    onSelectAgent(agent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start New Conversation</DialogTitle>
          <DialogDescription>
            Choose an agent to begin a new conversation
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-xl border border-border">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <Skeleton className="h-14 w-14 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))
            : agents?.map((agent, index) => {
                const status = statusConfig[agent.status];
                return (
                  <motion.button
                    key={agent.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelectAgent(agent)}
                    className={cn(
                      "group p-4 rounded-xl border border-border transition-all duration-200",
                      "hover:border-primary/50 hover:bg-secondary/50",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50"
                    )}
                  >
                    <div className="flex flex-col items-center text-center space-y-3">
                      {/* Avatar with status */}
                      <div className="relative">
                        <Avatar className="h-14 w-14 transition-transform group-hover:scale-105">
                          {agent.avatar && (
                            <AvatarImage src={agent.avatar} alt={agent.name} />
                          )}
                          <AvatarFallback className="bg-secondary text-lg">
                            {agent.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {/* Status indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5">
                          <span
                            className={cn(
                              "block h-3.5 w-3.5 rounded-full ring-2 ring-background",
                              status.color
                            )}
                          />
                        </div>
                      </div>

                      {/* Agent info */}
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {agent.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {agent.role}
                        </p>
                      </div>

                      {/* Status badge */}
                      <Badge
                        variant="secondary"
                        className="text-xs"
                      >
                        {status.label}
                      </Badge>
                    </div>
                  </motion.button>
                );
              })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NewConversationModal;
