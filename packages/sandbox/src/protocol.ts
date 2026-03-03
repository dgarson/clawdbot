export type SandboxEventKind = "started" | "stopped" | "busy" | "idle" | "error";

export interface SandboxEvent {
  kind: SandboxEventKind;
  at: string;
  detail?: string;
}

export interface RuntimeBootstrapConfig {
  command: string;
  env: Record<string, string>;
  timeoutMs: number;
}

export const buildEvent = (kind: SandboxEventKind, detail?: string): SandboxEvent => {
  return {
    kind,
    at: new Date().toISOString(),
    detail,
  };
};

export const isTerminalEvent = (event: SandboxEvent): boolean => {
  return event.kind === "stopped" || event.kind === "error";
};

export const toBootstrapConfig = (
  command: string,
  env: Record<string, string>,
  timeoutMs: number,
): RuntimeBootstrapConfig => {
  return {
    command,
    env,
    timeoutMs,
  };
};
