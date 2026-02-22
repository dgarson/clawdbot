import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bot, Calendar, Wrench } from "lucide-react";
import { AgentConfigPage } from "./AgentConfigPage";
import { AgentRitualsTab } from "./AgentRitualsTab";
import { AgentToolsTab } from "./AgentToolsTab";

type ConfigureSubTab = "builder" | "rituals" | "tools";

interface AgentConfigureTabProps {
  agentId: string;
}

export function AgentConfigureTab({ agentId }: AgentConfigureTabProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<ConfigureSubTab>("builder");

  return (
    <Tabs
      value={activeSubTab}
      onValueChange={(v) => setActiveSubTab(v as ConfigureSubTab)}
      className="space-y-4"
    >
      <TabsList className="bg-muted/50 p-1">
        <TabsTrigger value="builder" className="gap-1.5">
          <Bot className="size-4" />
          Agent Builder
        </TabsTrigger>
        <TabsTrigger value="rituals" className="gap-1.5">
          <Calendar className="size-4" />
          Rituals
        </TabsTrigger>
        <TabsTrigger value="tools" className="gap-1.5">
          <Wrench className="size-4" />
          Tools
        </TabsTrigger>
      </TabsList>

      <TabsContent value="builder" className="mt-0">
        <AgentConfigPage agentId={agentId} embedded />
      </TabsContent>

      <TabsContent value="rituals" className="mt-0">
        <AgentRitualsTab agentId={agentId} />
      </TabsContent>

      <TabsContent value="tools" className="mt-0">
        <AgentToolsTab agentId={agentId} />
      </TabsContent>
    </Tabs>
  );
}
