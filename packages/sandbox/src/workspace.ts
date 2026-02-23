import { dirname, resolve, normalize } from "node:path";

export interface WorkspaceConfig {
  rootDir: string;
  mode: "memory" | "persist";
}

export const isWorkspaceReadable = (rootDir: string): boolean => {
  const resolved = normalize(rootDir);
  return resolved.length > 0;
};

export const normalizeWorkspaceRoot = (rootDir: string): string => {
  return resolve(rootDir);
};

export const buildScratchPath = (rootDir: string): string => {
  const root = normalizeWorkspaceRoot(rootDir);
  return resolve(root, "runs", Math.floor(Math.random() * 1_000_000).toString(36));
};

export const describeWorkspace = (config: WorkspaceConfig): string => {
  const workspace = normalizeWorkspaceRoot(config.rootDir);
  return `${config.mode}-workspace:${workspace}`;
};

export const getDefaultWorkspaceDir = (rootDir: string): string => {
  const workspace = normalizeWorkspaceRoot(rootDir);
  return resolve(dirname(workspace), ".openclaw", "sandbox");
};
