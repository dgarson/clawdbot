import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const hoisted = vi.hoisted(() => ({
  useLiveGateway: false,
  isConnected: false,
}));

vi.mock("../useGatewayEnabled", () => ({
  useGatewayEnabled: () => hoisted.useLiveGateway,
  useGatewayModeKey: () => (hoisted.useLiveGateway ? "live" : "mock"),
}));

vi.mock("@/providers", () => ({
  useGateway: () => ({ isConnected: hoisted.isConnected }),
}));

import { useAgentStatusToggleEnabled } from "./useAgentMutations";

describe("useAgentStatusToggleEnabled", () => {
  beforeEach(() => {
    hoisted.useLiveGateway = false;
  });

  it("returns true when in mock mode", () => {
    hoisted.useLiveGateway = false;
    hoisted.isConnected = false;
    const { result } = renderHook(() => useAgentStatusToggleEnabled());
    expect(result.current).toBe(true);
  });

  it("returns false when in live mode", () => {
    hoisted.useLiveGateway = true;
    hoisted.isConnected = false;
    const { result } = renderHook(() => useAgentStatusToggleEnabled());
    expect(result.current).toBe(false);
  });

  it("returns false when gateway is connected even if live toggle is off", () => {
    hoisted.useLiveGateway = false;
    hoisted.isConnected = true;
    const { result } = renderHook(() => useAgentStatusToggleEnabled());
    expect(result.current).toBe(false);
  });
});
