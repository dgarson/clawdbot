import * as React from "react";
import type { OpenClawEvents, ToolCallEventData } from "@/integrations/openclaw";
import { useOptionalOpenClawEvents } from "@/integrations/openclaw/react";
import { useAgentStore } from "@/stores/useAgentStore";

function getAgentId(event: OpenClawEvents[keyof OpenClawEvents]) {
  return event.context?.agentId;
}

function buildPendingTaskLabel(toolName?: string) {
  if (!toolName) {return "Awaiting approval";}
  return `Approve ${toolName.replace(/_/g, " ")} access`;
}

export function useAgentLiveUpdates() {
  const eventBus = useOptionalOpenClawEvents();
  const upsertAgent = useAgentStore((s) => s.upsertAgent);
  const updateAgentWith = useAgentStore((s) => s.updateAgentWith);

  React.useEffect(() => {
    if (!eventBus) {return;}

    const ensureAgent = (agentId: string) => {
      const existing = useAgentStore.getState().agents.find((agent) => agent.id === agentId);
      if (existing) {return;}
      upsertAgent({
        id: agentId,
        name: agentId,
        role: "Agent",
        status: "paused",
      });
    };

    const applyPending = (agentId: string, data?: ToolCallEventData) => {
      ensureAgent(agentId);
      updateAgentWith(agentId, (agent) => {
        const pendingIds = new Set(agent.pendingToolCallIds ?? []);
        if (data?.toolCallId) {pendingIds.add(data.toolCallId);}
        const nextIds = Array.from(pendingIds);
        return {
          ...agent,
          status: "paused",
          currentTask: buildPendingTaskLabel(data?.toolName),
          pendingToolCallIds: nextIds,
          pendingApprovals: nextIds.length,
        };
      });
    };

    const clearPending = (agentId: string, toolCallId?: string) => {
      updateAgentWith(agentId, (agent) => {
        const pendingIds = new Set(agent.pendingToolCallIds ?? []);
        if (toolCallId) {pendingIds.delete(toolCallId);}
        const nextIds = Array.from(pendingIds);
        return {
          ...agent,
          pendingToolCallIds: nextIds,
          pendingApprovals: nextIds.length,
        };
      });
    };

    const onToolPending = (event: OpenClawEvents["tool:pending"]) => {
      const agentId = getAgentId(event);
      if (!agentId) {return;}
      applyPending(agentId, event.data);
    };

    const onToolApproved = (event: OpenClawEvents["tool:approved"]) => {
      const agentId = getAgentId(event);
      if (!agentId) {return;}
      clearPending(agentId, event.data?.toolCallId);
    };

    const onToolRejected = (event: OpenClawEvents["tool:rejected"]) => {
      const agentId = getAgentId(event);
      if (!agentId) {return;}
      clearPending(agentId, event.data?.toolCallId);
    };

    const onWaitingApproval = (event: OpenClawEvents["workflow:waiting_approval"]) => {
      const agentId = getAgentId(event);
      if (!agentId) {return;}
      ensureAgent(agentId);
      updateAgentWith(agentId, (agent) => ({
        ...agent,
        status: "paused",
        currentTask: agent.currentTask ?? "Awaiting approval",
      }));
    };

    const onAgentThinking = (event: OpenClawEvents["agent:thinking"]) => {
      const agentId = getAgentId(event);
      if (!agentId) {return;}
      ensureAgent(agentId);
      updateAgentWith(agentId, (agent) => ({
        ...agent,
        status: "busy",
        currentTask: event.data?.thought ?? agent.currentTask,
      }));
    };

    eventBus.on("tool:pending", onToolPending);
    eventBus.on("tool:approved", onToolApproved);
    eventBus.on("tool:rejected", onToolRejected);
    eventBus.on("workflow:waiting_approval", onWaitingApproval);
    eventBus.on("agent:thinking", onAgentThinking);

    return () => {
      eventBus.off("tool:pending", onToolPending);
      eventBus.off("tool:approved", onToolApproved);
      eventBus.off("tool:rejected", onToolRejected);
      eventBus.off("workflow:waiting_approval", onWaitingApproval);
      eventBus.off("agent:thinking", onAgentThinking);
    };
  }, [eventBus, upsertAgent, updateAgentWith]);
}

export default useAgentLiveUpdates;
