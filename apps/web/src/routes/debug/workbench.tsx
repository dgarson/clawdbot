"use client";

import * as React from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useUIStore } from "@/stores/useUIStore";
import type { Message } from "@/stores/useConversationStore";
import { AgentWorkbench } from "@/components/composed/AgentWorkbench";
import { createMockWorktreeAdapter } from "@/integrations/worktree";

export const Route = createFileRoute("/debug/workbench")({
  component: DebugWorkbenchPage,
});

const demoMessages: Message[] = [
  {
    id: "m1",
    conversationId: "session-123",
    role: "user",
    content: "Can you open the plan file and show me what the agent is doing?",
    timestamp: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: "m2",
    conversationId: "session-123",
    role: "assistant",
    content: "Sure — I’ll pull up the session worktree and the current plan.",
    timestamp: new Date(Date.now() - 150000).toISOString(),
  },
];

function DebugWorkbenchPage() {
  const powerUserMode = useUIStore((s) => s.powerUserMode);
  const worktreeAdapter = React.useMemo(() => createMockWorktreeAdapter(), []);

  if (!powerUserMode) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <AgentWorkbench
          height={820}
          agentId="agent-1"
          agent={{
            id: "agent-1",
            name: "Code Companion",
            role: "Development Partner",
            status: "online",
            description: "Builds and reviews code",
            tags: [],
            lastActive: "Just now",
          }}
          conversation={{
            id: "session-123",
            title: "Session 123",
            messages: demoMessages,
            onSend: async () => {
              // Stub — wire this to your sessions/messages API later.
            },
          }}
          worktree={{
            adapter: worktreeAdapter,
            initialPath: "/sessions/session-123",
            pinnedPaths: [
              { label: "Session", path: "/sessions/session-123" },
              { label: "Src", path: "/src" },
              { label: "Logs", path: "/logs" },
            ],
          }}
          terminal={{
            welcomeMessage: "Type here — wire to agent PTY stream later.",
          }}
        />
      </div>
    </div>
  );
}

