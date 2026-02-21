
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Bot } from "lucide-react";
import { AgentCard } from "./AgentCard";
import { AgentFormModal } from "./AgentFormModal";
import { ConfirmDialog } from "@/components/composed/ConfirmDialog";
import { ErrorState, errorMessages } from "@/components/composed/ErrorState";
import { AgentConfigSkeleton } from "@/components/composed/skeletons";
import { useAgents } from "@/hooks/queries/useAgents";
import {
  useCreateAgent,
  useUpdateAgent,
  useDeleteAgent,
  useUpdateAgentStatus,
} from "@/hooks/mutations/useAgentMutations";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useUIStore } from "@/stores/useUIStore";
import type { Agent, AgentStatus } from "@/stores/useAgentStore";

type FilterStatus = "all" | AgentStatus;

interface AgentConfigProps {
  className?: string;
  initialEditAgentId?: string;
}

export function AgentConfig({ className, initialEditAgentId }: AgentConfigProps) {
  const { data: agents = [], isLoading, error, refetch, isFetching } = useAgents();
  const [isRetrying, setIsRetrying] = React.useState(false);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  const showModeBadge = (import.meta.env?.DEV ?? false);
  const modeLabel = useLiveGateway ? "Live gateway" : "Mock data";
  const modeVariant = useLiveGateway ? "success" : "secondary";

  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const updateAgentStatus = useUpdateAgentStatus();

  // UI State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<FilterStatus>("all");
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingAgent, setEditingAgent] = React.useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = React.useState<Agent | null>(null);
  const initialEditHandledRef = React.useRef(false);

  React.useEffect(() => {
    if (!initialEditAgentId) {return;}
    if (initialEditHandledRef.current) {return;}
    const agent = agents.find((item) => item.id === initialEditAgentId);
    if (!agent) {return;}
    setEditingAgent(agent);
    setIsFormOpen(true);
    initialEditHandledRef.current = true;
  }, [agents, initialEditAgentId]);

  // Filter agents based on search and status
  const filteredAgents = React.useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch =
        searchQuery === "" ||
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.role?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || agent.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [agents, searchQuery, statusFilter]);

  // Handlers
  const handleCreateAgent = () => {
    setEditingAgent(null);
    setIsFormOpen(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setIsFormOpen(true);
  };

  const handleDuplicateAgent = (agent: Agent) => {
    createAgent.mutate({
      name: `${agent.name} (Copy)`,
      role: agent.role,
      model: agent.model,
      runtime: agent.runtime,
      claudeSdkOptions: agent.claudeSdkOptions,
      description: agent.description,
      status: "offline",
      tags: agent.tags ? [...agent.tags] : [],
      taskCount: 0,
    });
  };

  const handleDeleteAgent = (agent: Agent) => {
    setDeletingAgent(agent);
  };

  const handleConfirmDelete = () => {
    if (deletingAgent) {
      deleteAgent.mutate(deletingAgent.id);
      setDeletingAgent(null);
    }
  };

  const handleToggleStatus = (agent: Agent) => {
    const newStatus: AgentStatus =
      agent.status === "online" || agent.status === "busy"
        ? "offline"
        : "online";
    updateAgentStatus.mutate({ id: agent.id, status: newStatus });
  };

  const handleFormSubmit = (data: {
    name: string;
    role: string;
    avatar?: string;
    status: AgentStatus;
    description?: string;
    model?: string;
    runtime?: "pi" | "claude";
    claudeSdkOptions?: {
      provider?: "anthropic" | "zai" | "openrouter";
    };
  }) => {
    if (editingAgent) {
      updateAgent.mutate(
        { id: editingAgent.id, ...data },
        { onSuccess: () => setIsFormOpen(false) }
      );
    } else {
      createAgent.mutate(
        { ...data, tags: [], taskCount: 0 },
        { onSuccess: () => setIsFormOpen(false) }
      );
    }
  };

  // Retry handler (must be defined before conditional returns)
  const handleRetry = React.useCallback(async () => {
    setIsRetrying(true);
    try {
      await refetch();
      toast.success("Agents loaded successfully");
    } catch {
      // Error will be shown by ErrorState
    } finally {
      setIsRetrying(false);
    }
  }, [refetch]);

  // Loading state with proper skeleton
  if (isLoading) {
    return <AgentConfigSkeleton className={className} />;
  }

  // Error state
  if (error) {
    return (
      <div className={cn("space-y-6", className)}>
        <ErrorState
          variant="card"
          title={errorMessages.agents.title}
          description={errorMessages.agents.description}
          onRetry={handleRetry}
          isRetrying={isRetrying || isFetching}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">Agents</h2>
            {showModeBadge && (
              <Badge variant={modeVariant} className="text-xs">
                {modeLabel}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your AI agents and their configurations
          </p>
        </div>
        <Button onClick={handleCreateAgent}>
          <Plus className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as FilterStatus)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Active</SelectItem>
            <SelectItem value="offline">Inactive</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Agent Grid */}
      {filteredAgents.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={handleEditAgent}
                onDuplicate={handleDuplicateAgent}
                onDelete={handleDeleteAgent}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Bot className="h-8 w-8 text-muted-foreground" />
          </div>
          {agents.length === 0 ? (
            <>
              <h3 className="font-semibold text-foreground">No agents yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
                Create your first AI agent to get started. Agents help you
                accomplish tasks with different personalities and capabilities.
              </p>
              <Button onClick={handleCreateAgent}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first agent
              </Button>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-foreground">No agents found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your search or filter criteria
              </p>
            </>
          )}
        </motion.div>
      )}

      {/* Create/Edit Modal */}
      <AgentFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        agent={editingAgent}
        workspaces={workspaces}
        onSubmit={handleFormSubmit}
        isSubmitting={createAgent.isPending || updateAgent.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingAgent}
        onOpenChange={(open) => !open && setDeletingAgent(null)}
        title="Delete Agent"
        resource={
          deletingAgent
            ? {
                title: deletingAgent.name,
                subtitle: deletingAgent.role || "Agent",
              }
            : undefined
        }
        description={`Are you sure you want to delete "${deletingAgent?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />
    </div>
  );
}

export default AgentConfig;
