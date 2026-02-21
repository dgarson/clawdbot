
import { createFileRoute } from "@tanstack/react-router";
import { AgentConfigPage } from "@/components/domain/agents/AgentConfigPage";

export const Route = createFileRoute("/agents/$agentId/configure")({
  component: AgentConfigureRoute,
});

function AgentConfigureRoute() {
  const { agentId } = Route.useParams();
  return <AgentConfigPage agentId={agentId} />;
}
