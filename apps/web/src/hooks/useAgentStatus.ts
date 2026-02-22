import * as React from "react";
import type { Agent } from "@/stores/useAgentStore";
import type { AgentDotStatus } from "@/components/ui/AgentStatusDot";

/** How many milliseconds of inactivity before we consider an agent "offline" */
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Derive a display-friendly dot status from an agent's store data.
 *
 * Priority:
 * 1. If the store status is "busy" → busy (amber, fast pulse)
 * 2. If the store status is "online" and lastActive within 5 min → online (green, slow pulse)
 * 3. If the store status is "online" but stale → offline (gray)
 * 4. If the store status is "paused" → busy (treated as waiting/working)
 * 5. Otherwise → offline
 *
 * A separate "error" status can be supplied by callers or derived from
 * future error state on the agent model.
 */
export function deriveAgentDotStatus(agent: Pick<Agent, "status" | "lastActive" | "currentTask">): AgentDotStatus {
  const { status, lastActive } = agent;

  // Explicit busy
  if (status === "busy") {
    return "busy";
  }

  // Paused agents are waiting for approval → show as busy
  if (status === "paused") {
    return "busy";
  }

  // Online check: verify lastActive is recent
  if (status === "online") {
    if (lastActive) {
      const elapsed = Date.now() - new Date(lastActive).getTime();
      if (elapsed > ONLINE_THRESHOLD_MS) {
        return "offline";
      }
    }
    return "online";
  }

  // Everything else (offline, unknown)
  return "offline";
}

/**
 * React hook that returns a derived `AgentDotStatus` for a single agent.
 *
 * Recalculates whenever the agent's status or lastActive changes.
 * Also sets up a timer to transition from online → offline when lastActive
 * goes stale (past the 5-minute threshold).
 */
export function useAgentStatus(agent: Pick<Agent, "status" | "lastActive" | "currentTask"> | null | undefined): AgentDotStatus {
  const [dotStatus, setDotStatus] = React.useState<AgentDotStatus>(() =>
    agent ? deriveAgentDotStatus(agent) : "offline",
  );

  React.useEffect(() => {
    if (!agent) {
      setDotStatus("offline");
      return;
    }

    const derived = deriveAgentDotStatus(agent);
    setDotStatus(derived);

    // If currently online, set a timer to re-check when the threshold expires
    if (derived === "online" && agent.lastActive) {
      const elapsed = Date.now() - new Date(agent.lastActive).getTime();
      const remaining = ONLINE_THRESHOLD_MS - elapsed;

      if (remaining > 0) {
        const timer = setTimeout(() => {
          setDotStatus(deriveAgentDotStatus(agent));
        }, remaining + 500); // small buffer

        return () => clearTimeout(timer);
      }
    }
  }, [agent?.status, agent?.lastActive, agent?.currentTask]);

  return dotStatus;
}

export default useAgentStatus;
