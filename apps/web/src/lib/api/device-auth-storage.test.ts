import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSharedGatewayPassword,
  clearSharedGatewayToken,
  clearStoredGatewayUrl,
  loadSharedGatewayPassword,
  loadSharedGatewayToken,
  loadStoredGatewayConnectionSettings,
  loadStoredGatewayUrl,
  persistGatewayConnectionFromUrl,
} from "./device-auth-storage";

describe("device-auth-storage", () => {
  const backingStore = new Map<string, string>();

  beforeEach(() => {
    backingStore.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => backingStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
          backingStore.set(key, value);
        },
        removeItem: (key: string) => {
          backingStore.delete(key);
        },
        clear: () => {
          backingStore.clear();
        },
      },
    });
    window.history.replaceState({}, "", "/");
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
});
