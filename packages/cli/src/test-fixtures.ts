import type { LocalSandboxRuntime, RuntimeStatus } from "@openclaw/sandbox";
import { vi, type Mock } from "vitest";

type BaseRuntimeStatus = Pick<
  RuntimeStatus,
  "state" | "command" | "mode" | "rootDir" | "runtime" | "readyAt" | "startedAt" | "stoppedAt"
>;

interface MockExecResult {
  output: unknown;
  elapsedMs: number;
}

const asStatus = (values: Partial<BaseRuntimeStatus>): RuntimeStatus => {
  return {
    state: values.state ?? "ready",
    rootDir: "/tmp/openclaw-runtime",
    command: "openclaw-runtime",
    mode: "memory",
    ...values,
    runtime: {
      pid: 12345,
      ...values.runtime,
    },
  };
};

export const createMockRuntime = (
  overrides: Partial<{
    status: Mock<() => Promise<RuntimeStatus>>;
    start: Mock<() => Promise<void>>;
    stop: Mock<() => Promise<void>>;
    exec: Mock<(input: { input: unknown }) => Promise<MockExecResult>>;
    streamEvents: Mock<(handler: (event: { kind: string }) => void) => () => void>;
  }> = {},
): LocalSandboxRuntime => {
  return {
    start: overrides.start ?? vi.fn().mockResolvedValue(undefined),
    stop: overrides.stop ?? vi.fn().mockResolvedValue(undefined),
    status:
      overrides.status ??
      vi.fn().mockResolvedValue(
        asStatus({
          state: "ready",
        }),
      ),
    exec:
      overrides.exec ??
      vi.fn().mockImplementation(async (payload: { input: unknown }) => ({
        output: payload.input,
        elapsedMs: 0,
      })),
    streamEvents: overrides.streamEvents ?? vi.fn().mockReturnValue(() => undefined),
  };
};

export interface SessionFixture {
  id: string;
  ownerId: string;
}

export interface ToolFixture {
  name: string;
  description: string;
}

export interface PolicyGateFixture {
  id: string;
  allow: (sessionId: string, tool: string) => boolean;
}

export const createMockSessions = (count: number): SessionFixture[] => {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    id: `session-${index + 1}`,
    ownerId: `owner-${index + 1}`,
  }));
};

export const createMockTools = (count: number): ToolFixture[] => {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    name: `tool-${index + 1}`,
    description: `Tool ${index + 1}`,
  }));
};

export const createMockPolicyGates = (count: number): PolicyGateFixture[] => {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    id: `gate-${index + 1}`,
    allow: (sessionId, tool) => {
      return sessionId.length > 0 && tool.length > 0 && index % 2 === 0;
    },
  }));
};
