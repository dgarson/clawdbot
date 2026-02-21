/**
 * Hooks for agent workspace file operations.
 *
 * Wraps the gateway RPC calls:
 * - agents.files.list → list all files in an agent workspace
 * - agents.files.get  → read a single file's content
 * - agents.files.set  → write/create a file
 */

import { useCallback } from "react";
import {
  useLiveAgentFiles,
  useLiveAgentFile,
  useSaveAgentFile,
  type AgentFileEntry,
  type AgentsFilesListResult,
  type AgentsFilesGetResult,
  type AgentsFilesSetResult,
} from "@/lib/api/gateway-hooks";

// Re-export types
export type { AgentFileEntry, AgentsFilesListResult, AgentsFilesGetResult, AgentsFilesSetResult };

// ---------------------------------------------------------------------------
// Well-known agent workspace files
// ---------------------------------------------------------------------------

/** Standard agent configuration files in order of importance. */
export const AGENT_FILES = [
  { name: "SOUL.md", label: "Soul", description: "Agent personality, voice, and core identity" },
  { name: "AGENTS.md", label: "Instructions", description: "Agent behavior, capabilities, and session rules" },
  { name: "USER.md", label: "User Profile", description: "Information about who the agent serves" },
  { name: "TOOLS.md", label: "Tools", description: "Environment-specific tool configuration" },
  { name: "HEARTBEAT.md", label: "Heartbeat", description: "Scheduled check-in behavior" },
  { name: "MEMORY.md", label: "Memory", description: "Long-term curated knowledge and context" },
  { name: "IDENTITY.md", label: "Identity", description: "Extended identity and self-description" },
  { name: "CONTEXT.md", label: "Context", description: "Company/project context" },
] as const;

export type AgentFileName = (typeof AGENT_FILES)[number]["name"];

/**
 * Get the human-readable label for an agent file name.
 */
export function getFileLabel(name: string): string {
  const found = AGENT_FILES.find((f) => f.name === name);
  return found?.label ?? name.replace(/\.[^.]+$/, "");
}

/**
 * Get the description for an agent file name.
 */
export function getFileDescription(name: string): string {
  const found = AGENT_FILES.find((f) => f.name === name);
  return found?.description ?? "";
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the file manifest for an agent workspace.
 * Returns list of files with metadata (size, modified date, missing flag).
 */
export function useAgentFiles(agentId: string | undefined) {
  const query = useLiveAgentFiles(agentId);

  return {
    ...query,
    files: query.data?.files ?? [],
    workspace: query.data?.workspace ?? null,
  };
}

/**
 * Fetch a single agent file's content.
 */
export function useAgentFile(agentId: string | undefined, fileName: string | undefined) {
  const query = useLiveAgentFile(agentId, fileName);

  return {
    ...query,
    file: query.data?.file ?? null,
    content: query.data?.file?.content ?? null,
  };
}

/**
 * Mutation hook to save an agent file.
 *
 * @example
 * const { save, isSaving } = useAgentFileSave();
 * await save("my-agent", "SOUL.md", "# Updated soul content...");
 */
export function useAgentFileSave() {
  const mutation = useSaveAgentFile();

  const save = useCallback(
    async (agentId: string, name: string, content: string) => {
      return mutation.mutateAsync({ agentId, name, content });
    },
    [mutation],
  );

  return {
    save,
    isSaving: mutation.isPending,
    error: mutation.error,
    lastResult: mutation.data,
    reset: mutation.reset,
  };
}
