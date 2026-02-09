import { listChannelPlugins } from "../channels/plugins/index.js";
import { coreGatewayHandlers } from "./server-methods.js";

const HIDDEN_METHODS = new Set<string>([]);

export function listGatewayMethods(): string[] {
  const channelMethods = listChannelPlugins().flatMap((plugin) => plugin.gatewayMethods ?? []);
  const coreMethods = Object.keys(coreGatewayHandlers).filter(
    (method) => !HIDDEN_METHODS.has(method),
  );
  return Array.from(new Set([...coreMethods, ...channelMethods]));
}

export const GATEWAY_EVENTS = [
  "connect.challenge",
  "agent",
  "chat",
  "presence",
  "tick",
  "talk.mode",
  "shutdown",
  "health",
  "heartbeat",
  "cron",
  "automations",
  "node.pair.requested",
  "node.pair.resolved",
  "node.invoke.request",
  "device.pair.requested",
  "device.pair.resolved",
  "voicewake.changed",
  "exec.approval.requested",
  "exec.approval.resolved",
  "tool.approval.requested",
  "tool.approval.resolved",
];
