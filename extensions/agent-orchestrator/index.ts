import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

const plugin = {
  id: "agent-orchestrator",
  name: "Agent Orchestrator",
  description:
    "Multi-agent task decomposition with role-based boundaries and inter-agent messaging",

  register(api: OpenClawPluginApi) {
    api.logger.info("[agent-orchestrator] registered (stub)");
  },
};

export default plugin;
