import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  clearSharedGatewayPassword,
  clearSharedGatewayToken,
  storeSharedGatewayToken,
} from "@/lib/api/device-auth-storage";
import { useConnectionManager } from "./useConnectionManager";

describe("useConnectionManager", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    clearSharedGatewayToken();
    clearSharedGatewayPassword();
    vi.unstubAllGlobals();
  });

  it("includes bearer auth headers when fetching status", async () => {
    storeSharedGatewayToken("token-123");

    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ connected: true }),
    } as Response);

    const { result } = renderHook(() => useConnectionManager("http://localhost:18789"));

    await act(async () => {
      await result.current.fetchStatus("github");
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(options?.headers).toEqual({ Authorization: "Bearer token-123" });
  });

  it("reports missing auth when no gateway credentials are stored", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    const { result } = renderHook(() => useConnectionManager("http://localhost:18789"));

    await act(async () => {
      await result.current.fetchStatus("github");
    });

    await waitFor(() => {
      expect(result.current.error).toBe(
        "Gateway credentials are missing. Add a gateway token or password in the Gateway settings.",
      );
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches statuses for all providers", async () => {
    storeSharedGatewayToken("token-123");

    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ connected: true }),
    } as Response);

    const { result } = renderHook(() => useConnectionManager("http://localhost:18789"));

    let statusMap: ReturnType<typeof result.current.fetchAllStatuses> | undefined;
    await act(async () => {
      statusMap = await result.current.fetchAllStatuses(["github", "slack"]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(statusMap).toEqual({
      github: { connected: true },
      slack: { connected: true },
    });
  });
});
