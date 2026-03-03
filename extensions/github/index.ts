import type { AnyAgentTool, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { createGithubTools } from "./src/tools.js";

const plugin = {
  id: "github",
  name: "GitHub",
  description: "Granular GitHub PR and commit management tools via gh CLI",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerTool(
      (ctx: { sandboxed?: boolean }) => {
        if (ctx.sandboxed) {
          return null;
        }
        return createGithubTools(api) as AnyAgentTool[];
      },
      { optional: true },
    );
  },
};

export default plugin;
