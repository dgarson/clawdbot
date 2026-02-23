import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Calendar,
  Wrench,
  PanelRightOpen,
  PanelRightClose,
  CheckCircle2,
} from "lucide-react";
import { AgentConfigPage } from "./AgentConfigPage";
import { AgentRitualsTab } from "./AgentRitualsTab";
import { AgentToolsTab } from "./AgentToolsTab";
import { LLMAssistPanel, type AssistContext } from "@/components/domain/assist/LLMAssistPanel";
import { AutoReviewPanel } from "@/components/domain/assist/AutoReviewPanel";
import { useAgentFiles, useAgentFileSave } from "@/hooks/queries/useAgentFiles";
import { useAgent } from "@/hooks/queries/useAgents";
import { AnimatePresence, motion } from "framer-motion";

export type ConfigureSubTab = "builder" | "rituals" | "tools";

interface AgentConfigureTabProps {
  agentId: string;
  defaultSubTab?: ConfigureSubTab;
  onSubTabChange?: (tab: ConfigureSubTab) => void;
}

export function AgentConfigureTab({
  agentId,
  defaultSubTab = "builder",
  onSubTabChange,
}: AgentConfigureTabProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<ConfigureSubTab>(defaultSubTab);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (defaultSubTab && defaultSubTab !== activeSubTab) {
      setActiveSubTab(defaultSubTab);
    }
  }, [defaultSubTab]);

  const [assistOpen, setAssistOpen] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [builderInnerTab, setBuilderInnerTab] = React.useState("overview");

  const { data: agent } = useAgent(agentId);
  const { files } = useAgentFiles(agentId);
  const { save: saveFile } = useAgentFileSave();

  const agentName = agent?.name ?? agentId;

  const handleSubTabChange = (tab: ConfigureSubTab) => {
    setActiveSubTab(tab);
    onSubTabChange?.(tab);
  };

  const assistContext: AssistContext = React.useMemo(() => ({
    section: activeSubTab === "builder" ? builderInnerTab : activeSubTab,
    agentName,
  }), [activeSubTab, builderInnerTab, agentName]);

  const handleAssistFileChange = React.useCallback(
    (fileName: string, newContent: string) => {
      void saveFile(agentId, fileName, newContent);
    },
    [agentId, saveFile],
  );

  const handleReviewFix = React.useCallback(
    (fix: { type: string; fileName?: string; newContent?: string }) => {
      if (fix.type === "file_change" && fix.fileName && fix.newContent) {
        void saveFile(agentId, fix.fileName, fix.newContent);
      }
    },
    [agentId, saveFile],
  );

  // Auto Review is only meaningful for the Agent Builder (config files)
  const canReview = activeSubTab === "builder";

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-end gap-2 mb-4">
          {canReview && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={reviewOpen ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setReviewOpen(!reviewOpen)}
                >
                  <CheckCircle2 className="size-4" />
                  Auto Review
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Analyze config and get suggestions for improvement</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={assistOpen ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => setAssistOpen(!assistOpen)}
              >
                {assistOpen ? (
                  <PanelRightClose className="size-4" />
                ) : (
                  <PanelRightOpen className="size-4" />
                )}
                AI Assist
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Get AI help with this section</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Auto Review Panel */}
        <AnimatePresence>
          {reviewOpen && canReview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <AutoReviewPanel
                agentId={agentId}
                agentName={agentName}
                files={files}
                open={reviewOpen}
                onClose={() => setReviewOpen(false)}
                onApplyFix={handleReviewFix}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <Tabs
          value={activeSubTab}
          onValueChange={(v) => handleSubTabChange(v as ConfigureSubTab)}
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
            <AgentConfigPage
              agentId={agentId}
              embedded
              externalAssistOpen={assistOpen}
              onExternalAssistOpenChange={setAssistOpen}
              externalReviewOpen={reviewOpen}
              onExternalReviewOpenChange={setReviewOpen}
              onInnerTabChange={setBuilderInnerTab}
            />
          </TabsContent>

          <TabsContent value="rituals" className="mt-0">
            <AgentRitualsTab agentId={agentId} />
          </TabsContent>

          <TabsContent value="tools" className="mt-0">
            <AgentToolsTab agentId={agentId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Assist Sidebar */}
      <LLMAssistPanel
        agentId={agentId}
        context={assistContext}
        open={assistOpen}
        onClose={() => setAssistOpen(false)}
        onApplyChanges={handleAssistFileChange}
      />
    </div>
  );
}
