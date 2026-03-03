import type { SessionRecord, ToolDescriptor } from "./types.js";

export interface MockPolicyGate {
  id: string;
  name: string;
  scope: {
    sessions: readonly string[];
    tools: readonly string[];
  };
  reason: string;
  canInvoke: (params: { sessionId: string; tool: string }) => boolean;
}

type FixtureTimestamp = `${number}-${number}-${number}T${number}-${number}-${number}Z`;

type ToolInput = Omit<ToolDescriptor, "name" | "description" | "inputSchema"> & {
  name?: string;
  description?: string;
  inputSchema?: ToolDescriptor["inputSchema"];
};

type SessionInput = Omit<SessionRecord, "id" | "name" | "createdAt" | "updatedAt"> &
  Partial<Pick<SessionRecord, "id" | "name" | "createdAt" | "updatedAt">>;

const resolveTimestamp = (value: string): FixtureTimestamp => {
  return value as FixtureTimestamp;
};

const defaultTool: ToolDescriptor = {
  name: "echo",
  description: "Echo input back unchanged",
  inputSchema: {
    type: "object",
    additionalProperties: false,
  },
};

const defaultSession: SessionRecord = {
  id: "session-demo",
  name: "Demo Session",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const randomSuffix = (): string => {
  return Math.random().toString(36).slice(2, 10);
};

export const createMockSession = (overrides: SessionInput = {}): SessionRecord => {
  const stamp = resolveTimestamp(overrides.createdAt ?? "2026-01-01T00:00:00Z");

  return {
    id: overrides.id ?? `session-${randomSuffix()}`,
    name: overrides.name ?? "Test Session",
    createdAt: overrides.createdAt ?? stamp,
    updatedAt: overrides.updatedAt ?? stamp,
  };
};

export const createMockSessions = (
  count: number,
  overrides: SessionInput = {},
): SessionRecord[] => {
  const safeCount = Math.max(0, Math.floor(count));

  return Array.from({ length: safeCount }, (_, index) =>
    createMockSession({
      ...overrides,
      id: overrides.id ? `${overrides.id}-${index + 1}` : `session-${randomSuffix()}`,
      name: `${overrides.name ?? "Test Session"} ${index + 1}`,
      createdAt: overrides.createdAt ?? `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      updatedAt: overrides.updatedAt ?? `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
    }),
  );
};

export const createMockTool = (overrides: ToolInput = {}): ToolDescriptor => {
  return {
    name: overrides.name ?? defaultTool.name,
    description: overrides.description ?? defaultTool.description,
    inputSchema: overrides.inputSchema ?? defaultTool.inputSchema,
  };
};

export const createMockTools = (count: number, overrides: ToolInput = {}): ToolDescriptor[] => {
  const safeCount = Math.max(0, Math.floor(count));

  return Array.from({ length: safeCount }, (_, index) =>
    createMockTool({
      ...overrides,
      name: overrides.name ? `${overrides.name}_${index + 1}` : `${defaultTool.name}_${index + 1}`,
      description: overrides.description ?? `Mock tool ${index + 1}`,
    }),
  );
};

export const createMockPolicyGate = (
  overrides: {
    id?: string;
    name?: string;
    allowedSessions?: readonly string[];
    allowedTools?: readonly string[];
    reason?: string;
  } = {},
): MockPolicyGate => {
  const allowedSessions = overrides.allowedSessions ?? ["*"];
  const allowedTools = overrides.allowedTools ?? ["*"];

  const canInvoke = ({ sessionId, tool }: { sessionId: string; tool: string }): boolean => {
    const sessionAllowed = allowedSessions.includes("*") || allowedSessions.includes(sessionId);
    const toolAllowed = allowedTools.includes("*") || allowedTools.includes(tool);

    return sessionAllowed && toolAllowed;
  };

  return {
    id: overrides.id ?? `policy-gate-${randomSuffix()}`,
    name: overrides.name ?? "mock-policy-gate",
    scope: {
      sessions: allowedSessions,
      tools: allowedTools,
    },
    reason: overrides.reason ?? "local test gate",
    canInvoke,
  };
};

export const createMockPolicyGates = (
  count: number,
  overrides: {
    id?: string;
    name?: string;
    allowedSessions?: readonly string[];
    allowedTools?: readonly string[];
    reason?: string;
  } = {},
): MockPolicyGate[] => {
  const safeCount = Math.max(0, Math.floor(count));

  return Array.from({ length: safeCount }, (_, index) =>
    createMockPolicyGate({
      ...overrides,
      id: overrides.id ? `${overrides.id}-${index + 1}` : undefined,
      name: overrides.name ? `${overrides.name}-${index + 1}` : undefined,
    }),
  );
};

export const createMockRuntimeRecords = (): {
  session: SessionRecord;
  tool: ToolDescriptor;
  policyGate: MockPolicyGate;
} => {
  const session = createMockSession({
    id: `session-${defaultSession.id}`,
    name: defaultSession.name,
    createdAt: defaultSession.createdAt,
    updatedAt: defaultSession.updatedAt,
  });
  const tool = createMockTool();
  const policyGate = createMockPolicyGate({
    allowedSessions: [session.id],
    allowedTools: [tool.name],
  });

  return {
    session,
    tool,
    policyGate,
  };
};
