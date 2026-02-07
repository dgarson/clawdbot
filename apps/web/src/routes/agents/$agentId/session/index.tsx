import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/agents/$agentId/session/")({
  beforeLoad: ({ params }) => {
    // Redirect to "current" session when no session key is provided
    throw redirect({
      to: "/agents/$agentId/session/$sessionKey",
      params: { agentId: params.agentId, sessionKey: "current" },
    });
  },
});
