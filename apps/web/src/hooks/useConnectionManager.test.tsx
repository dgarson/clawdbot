import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  clearSharedGatewayPassword,
  clearSharedGatewayToken,
  storeSharedGatewayToken,
} from "@/lib/api/device-auth-storage";
import { useConnectionManager } from "./useConnectionManager";
import { installMockLocalStorage, type MockLocalStorageController } from "@/test/mock-local-storage";

const CONNECTION_STORAGE_KEYS = [
  "clawdbrain-gateway-token",
  "clawdbrain-gateway-password",
];

describe("useConnectionManager", () => {
  let localStorageMock: MockLocalStorageController | null = null;

  beforeEach(() => {
    localStorageMock = installMockLocalStorage();
    localStorageMock.reset(CONNECTION_STORAGE_KEYS);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    clearSharedGatewayToken();
    clearSharedGatewayPassword();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    localStorageMock?.restore();
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

    let statusMap: Awaited<ReturnType<typeof result.current.fetchAllStatuses>> | undefined;
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
