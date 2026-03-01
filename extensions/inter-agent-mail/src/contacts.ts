/**
 * Contact book — resolves known agents with their display names and routing
 * access from the caller's perspective.
 *
 * Agent names come from `config.agents.list[].identity.name` (already in
 * memory; no filesystem scanning required).
 */

import type { OpenClawConfig } from "../../../src/config/types.js";
import { isRoutingAllowed, type ResolvedInterAgentMailConfig } from "./config.js";

export type Contact = {
  agentId: string;
  /** Display name from identity config, if set */
  name?: string;
  /** Whether the caller is allowed to send mail to this agent */
  allowed: boolean;
};

/**
 * Returns all known agents (from config.agents.list) with routing access
 * information from the caller's perspective.
 *
 * If `search` is provided, filters to agents whose id or name contains the
 * search string (case-insensitive substring match).
 */
export function resolveContacts(
  config: OpenClawConfig | undefined,
  routingConfig: ResolvedInterAgentMailConfig,
  callerAgentId: string,
  search?: string,
): Contact[] {
  const agentList = config?.agents?.list ?? [];
  const contacts: Contact[] = agentList.map((entry) => {
    const agentId = entry.id ?? "";
    const name =
      (entry as { id?: string; identity?: { name?: string } }).identity?.name?.trim() || undefined;
    const allowed =
      agentId !== callerAgentId && isRoutingAllowed(routingConfig, callerAgentId, agentId);
    return { agentId, name, allowed };
  });

  // Exclude self from the list (you can't send mail to yourself)
  const filtered = contacts.filter((c) => c.agentId !== callerAgentId);

  if (!search?.trim()) {
    return filtered;
  }

  const query = search.trim().toLowerCase();
  return filtered.filter((c) => {
    const idMatch = c.agentId.toLowerCase().includes(query);
    const nameMatch = c.name?.toLowerCase().includes(query) ?? false;
    return idMatch || nameMatch;
  });
}

/**
 * Formats the contact list as a human-readable string for the tool result.
 */
export function formatContacts(contacts: Contact[]): string {
  if (contacts.length === 0) {
    return "No agents found.";
  }
  const lines = contacts.map((c) => {
    const nameLabel = c.name ? ` (${c.name})` : "";
    const access = c.allowed ? "can send" : "routing blocked";
    return `  ${c.agentId}${nameLabel} — ${access}`;
  });
  return `Known agents:\n${lines.join("\n")}`;
}
