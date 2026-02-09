import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const hoisted = vi.hoisted(() => ({
  patchSession: vi.fn(),
  deleteSession: vi.fn(),
  sendChatMessage: vi.fn(),
  useLiveGateway: true,
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", () => ({
  patchSession: hoisted.patchSession,
  deleteSession: hoisted.deleteSession,
  sendChatMessage: hoisted.sendChatMessage,
  buildAgentSessionKey: (agentId: string, mainKey = "main") =>
    `agent:${agentId}:${mainKey}`,
}));

vi.mock("@/lib/ids", () => ({
  uuidv7: () => "uuid-1",
}));

vi.mock("sonner", () => ({
  toast: hoisted.toast,
}));

vi.mock("../useGatewayEnabled", () => ({
  useGatewayEnabled: () => hoisted.useLiveGateway,
}));

import { useCreateConversation } from "./useConversationMutations";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useCreateConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useLiveGateway = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a live conversation via sessions.patch", async () => {
    hoisted.patchSession.mockResolvedValueOnce({ ok: true });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const { result } = renderHook(() => useCreateConversation(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ title: "Agent chat", agentId: "agent-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(hoisted.patchSession).toHaveBeenCalledWith({
      key: "agent:agent-1:session-1704067200000",
      label: "Agent chat",
    });
    expect(result.current.data?.id).toBe("agent:agent-1:session-1704067200000");
  });

  it("falls back to mock creation when live mode is disabled", async () => {
    hoisted.useLiveGateway = false;

    const { result } = renderHook(() => useCreateConversation(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ title: "Offline chat" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(hoisted.patchSession).not.toHaveBeenCalled();
    expect(result.current.data?.id).toBe("uuid-1");
  });
});
