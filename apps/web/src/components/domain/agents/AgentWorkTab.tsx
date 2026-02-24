
import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { WorkSubNav } from "./WorkSubNav";
import { AgentWorkstreamsTab } from "./AgentWorkstreamsTab";
import { AgentRitualsTab } from "./AgentRitualsTab";

interface AgentWorkTabProps {
  agentId: string;
  section?: string;
}

export function AgentWorkTab({ agentId, section }: AgentWorkTabProps) {
  const activeSection = (section === "rituals" ? "rituals" : "workstreams");
  const navigate = useNavigate();

  function handleSectionChange(next: "workstreams" | "rituals") {
    void navigate({ search: (prev) => ({ ...prev, section: next }) });
  }

  return (
    <div className="space-y-4">
      <WorkSubNav activeSection={activeSection} onSectionChange={handleSectionChange} />
      {activeSection === "workstreams" ? (
        <AgentWorkstreamsTab agentId={agentId} />
      ) : (
        <AgentRitualsTab agentId={agentId} />
      )}
    </div>
  );
}

export default AgentWorkTab;
