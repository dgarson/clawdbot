"use client";

import { Bot, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentConfig } from "@/components/domain/config";

interface AgentsSectionProps {
  className?: string;
  initialEditAgentId?: string;
}

export function AgentsSection({ className, initialEditAgentId }: AgentsSectionProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Agents
          </CardTitle>
          <CardDescription>
            Create and manage your AI agents. Each agent can have different capabilities,
            personalities, and assigned channels.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Info box */}
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Agent Capabilities</p>
              <ul className="text-muted-foreground space-y-1">
                <li>
                  <strong>Roles</strong> - Define what the agent specializes in (assistant, researcher, etc.)
                </li>
                <li>
                  <strong>Status</strong> - Control when an agent is active and responding
                </li>
                <li>
                  <strong>Tags</strong> - Organize agents by category or purpose
                </li>
                <li>
                  <strong>Channels</strong> - Assign which messaging channels route to each agent
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Config Component */}
      <AgentConfig initialEditAgentId={initialEditAgentId} />
    </div>
  );
}

export default AgentsSection;
