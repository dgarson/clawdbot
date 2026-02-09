import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GATEWAY_URL_CHANGED_EVENT,
  clearSharedGatewayPassword,
  clearSharedGatewayToken,
  clearStoredGatewayUrl,
  loadSharedGatewayPassword,
  loadSharedGatewayToken,
  loadStoredGatewayConnectionSettings,
  loadStoredGatewayUrl,
  persistGatewayConnectionFromUrl,
  storeGatewayUrl,
} from "./device-auth-storage";
import { installMockLocalStorage, type MockLocalStorageController } from "@/test/mock-local-storage";

describe("device-auth-storage", () => {
  let localStorageMock: MockLocalStorageController | null = null;

  beforeEach(() => {
    localStorageMock = installMockLocalStorage();
    localStorageMock.reset();
    window.history.replaceState({}, "", "/");
  });

  afterAll(() => {
    localStorageMock?.restore();
  });

  it("falls back to localhost gateway URL when none is stored", () => {
    expect(loadStoredGatewayUrl()).toBe("ws://127.0.0.1:18789");
    expect(loadStoredGatewayConnectionSettings()).toEqual({
      gatewayUrl: "ws://127.0.0.1:18789",
      token: undefined,
      password: undefined,
    });
  });

  it("persists token/password/gatewayUrl from URL and strips them from browser URL", () => {
    window.history.replaceState(
      {},
      "",
      "/settings?token=abc123&password=secret&gatewayUrl=ws%3A%2F%2Fexample.local%3A18789&keep=1#gateway"
    );

    const persisted = persistGatewayConnectionFromUrl();

    expect(persisted.hadUrlCredentials).toBe(true);
    expect(persisted.gatewayUrl).toBe("ws://example.local:18789");
    expect(persisted.token).toBe("abc123");
    expect(persisted.password).toBe("secret");
    expect(window.location.pathname).toBe("/settings");
    expect(window.location.search).toBe("?keep=1");
    expect(window.location.hash).toBe("#gateway");
  });

  it("clears stored credentials when URL params are present but empty", () => {
    localStorage.setItem("clawdbrain-gateway-token", "existing-token");
    localStorage.setItem("clawdbrain-gateway-password", "existing-password");
    localStorage.setItem("clawdbrain-gateway-url", "ws://stored:18789");

    window.history.replaceState({}, "", "/?token=&password=&gatewayUrl=");
    persistGatewayConnectionFromUrl();

    expect(loadSharedGatewayToken()).toBeNull();
    expect(loadSharedGatewayPassword()).toBeNull();
    expect(loadStoredGatewayUrl()).toBe("ws://127.0.0.1:18789");
    expect(window.location.search).toBe("");
  });

  it("clear helpers remove shared auth and URL values", () => {
    localStorage.setItem("clawdbrain-gateway-token", "t");
    localStorage.setItem("clawdbrain-gateway-password", "p");
    localStorage.setItem("clawdbrain-gateway-url", "ws://x:1");

    clearSharedGatewayToken();
    clearSharedGatewayPassword();
    clearStoredGatewayUrl();

    expect(loadSharedGatewayToken()).toBeNull();
    expect(loadSharedGatewayPassword()).toBeNull();
    expect(loadStoredGatewayUrl()).toBe("ws://127.0.0.1:18789");
  });

  it("dispatches gateway-url change event when storing a gateway URL", () => {
    const handler = vi.fn();
    window.addEventListener(GATEWAY_URL_CHANGED_EVENT, handler);

    storeGatewayUrl("ws://gateway.local:18789");

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent<{ gatewayUrl: string }>;
    expect(event.detail.gatewayUrl).toBe("ws://gateway.local:18789");
    window.removeEventListener(GATEWAY_URL_CHANGED_EVENT, handler);
  });

  it("dispatches gateway-url change event when clearing a gateway URL", () => {
    const handler = vi.fn();
    window.addEventListener(GATEWAY_URL_CHANGED_EVENT, handler);

    clearStoredGatewayUrl();

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent<{ gatewayUrl: string }>;
    expect(event.detail.gatewayUrl).toBe("ws://127.0.0.1:18789");
    window.removeEventListener(GATEWAY_URL_CHANGED_EVENT, handler);
  });
});
