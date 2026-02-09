import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const hoisted = vi.hoisted(() => ({
  listAgents: vi.fn(),
  getAgentStatus: vi.fn(),
  useLiveGateway: true,
  upsertAgents: vi.fn(),
  storeAgents: [] as Array<{ id: string }>,
}));

vi.mock("@/lib/api", () => ({
  listAgents: hoisted.listAgents,
  getAgentStatus: hoisted.getAgentStatus,
}));

vi.mock("@/providers", () => ({
  useGateway: () => ({ isConnected: false }),
}));

vi.mock("@/stores/useAgentStore", () => ({
  useAgentStore: (selector: (s: { agents: typeof hoisted.storeAgents; upsertAgents: typeof hoisted.upsertAgents }) => unknown) =>
    selector({ agents: hoisted.storeAgents, upsertAgents: hoisted.upsertAgents }),
}));

vi.mock("../useGatewayEnabled", () => ({
  useGatewayEnabled: () => hoisted.useLiveGateway,
}));

import { useAgents } from "./useAgents";

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.useLiveGateway = true;
    hoisted.storeAgents = [];
  });

  it("surfaces gateway errors in live mode", async () => {
    hoisted.listAgents.mockRejectedValueOnce(new Error("Gateway down"));

    const { result } = renderHook(() => useAgents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(hoisted.listAgents).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
