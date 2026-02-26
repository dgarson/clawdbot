import type { OpenClawPluginModule } from "../../src/plugins/types.js";
import { askDiscordConfirmation } from "../../src/discord/index.js";
import { askSlackConfirmation } from "../../src/slack/index.js";

// Basic logger shim if plugin logger isn't sufficient or for debugging
function logAuthDec(message: string) {
    // console.log(`[ToolApprovalGate] ${message}`);
}

export const toolApprovalGatePlugin: OpenClawPluginModule = {
  id: "tool-approval-gate",
  name: "Tool Approval Gate",
  description: "Requires human approval for sensitive tool executions.",
  register: (api) => {
    api.on("before_tool_call", async (event, ctx) => {
      const config = api.config;
      const approvalConfig = config.tools?.approval;

      if (!approvalConfig?.required?.length) {
        return;
      }

      const restrictedTools = new Set(approvalConfig.required);
      if (!restrictedTools.has(event.toolName)) {
        return;
      }

      const notificationChannel = approvalConfig.channel;
      if (!notificationChannel) {
        // If no channel configured, we can't ask for approval.
        // Warn and block.
        api.logger.warn(`Tool ${event.toolName} requires approval but no approval.channel is configured.`);
        return {
             block: true,
             blockReason: "Approval required but no approval channel configured.",
        };
      }

      api.logger.info(`Intercepting ${event.toolName} for approval in ${notificationChannel}.`);

      const cleanChannel = notificationChannel.replace(/^(slack:|discord:|channel:)/, "");
      const isDiscord = notificationChannel.includes("discord") || /^\d{17,20}$/.test(cleanChannel);

      let approved = false;
      let reason = "";

      if (isDiscord) {
         const result = await askDiscordConfirmation({
            to: cleanChannel,
            title: "Tool Execution Approval Required",
            message: `Agent wants to execute \`${event.toolName}\`.\n\nArgs:\n\`\`\`json\n${JSON.stringify(event.params, null, 2)}\n\`\`\``,
            confirmLabel: "Approve",
            cancelLabel: "Deny",
            style: "danger", 
            timeoutSeconds: 600,
         });
         approved = result.confirmed;
         reason = result.confirmed ? "Approved by user" : (result.timedOut ? "Timed out" : "Denied by user");
      } else {
         const result = await askSlackConfirmation({
             to: cleanChannel,
             title: "Tool Execution Approval Required",
             message: `Agent wants to execute \`${event.toolName}\`.\n\nArgs:\n\`\`\`json\n${JSON.stringify(event.params, null, 2)}\n\`\`\``,
             confirmLabel: "Approve",
             cancelLabel: "Deny",
             style: "danger",
             timeoutSeconds: 600,
         });
         approved = result.confirmed;
         reason = result.confirmed ? "Approved by user" : (result.timedOut ? "Timed out" : "Denied by user");
      }

      if (!approved) {
        return {
          block: true,
          blockReason: `Tool execution denied: ${reason}`,
        };
      }
      
      api.logger.info(`Tool ${event.toolName} approved.`);
    });
  },
};
export default toolApprovalGatePlugin;
