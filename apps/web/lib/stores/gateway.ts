import { create } from "zustand";
import {
  GatewayClient,
  type GatewayClientOptions,
  type GatewayEventFrame,
  type GatewayHelloOk,
  type GatewaySnapshot,
} from "@/lib/gateway/client";

type GatewayState = {
  // Connection
  connected: boolean;
  connecting: boolean;
  error: string | null;
  client: GatewayClient | null;
  hello: GatewayHelloOk | null;
  snapshot: GatewaySnapshot | null;

  // Event listeners
  eventListeners: Map<string, Set<(payload: unknown) => void>>;

  // Actions
  connect: (url: string, opts?: Partial<GatewayClientOptions>) => void;
  disconnect: () => void;
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  addEventListener: (event: string, handler: (payload: unknown) => void) => () => void;
};

export const useGatewayStore = create<GatewayState>((set, get) => ({
  connected: false,
  connecting: false,
  error: null,
  client: null,
  hello: null,
  snapshot: null,
  eventListeners: new Map(),

  connect: (url, opts) => {
    const existing = get().client;
    if (existing) existing.stop();

    set({ connecting: true, error: null });

    const client = new GatewayClient({
      url,
      token: opts?.token,
      password: opts?.password,
      instanceId: opts?.instanceId,
      onHello: (hello) => {
        set({
          connected: true,
          connecting: false,
          hello,
          snapshot: hello.snapshot as GatewaySnapshot | undefined ?? null,
          error: null,
        });
      },
      onEvent: (evt: GatewayEventFrame) => {
        const listeners = get().eventListeners.get(evt.event);
        if (listeners) {
          for (const handler of listeners) {
            try {
              handler(evt.payload);
            } catch (e) {
              console.error(`[gateway] event handler error for ${evt.event}:`, e);
            }
          }
        }
        // Also notify wildcard listeners
        const wildcardListeners = get().eventListeners.get("*");
        if (wildcardListeners) {
          for (const handler of wildcardListeners) {
            try {
              handler(evt);
            } catch (e) {
              console.error("[gateway] wildcard handler error:", e);
            }
          }
        }
      },
      onClose: () => {
        set({ connected: false });
      },
      onConnectionChange: (connected) => {
        set({ connected, connecting: false });
      },
    });

    set({ client });
    client.start();
  },

  disconnect: () => {
    const client = get().client;
    if (client) {
      client.stop();
      set({
        client: null,
        connected: false,
        connecting: false,
        hello: null,
        snapshot: null,
      });
    }
  },

  request: async <T = unknown>(method: string, params?: unknown): Promise<T> => {
    const client = get().client;
    if (!client) throw new Error("Gateway not connected");
    return client.request<T>(method, params);
  },

  addEventListener: (event, handler) => {
    const listeners = get().eventListeners;
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(handler);
    set({ eventListeners: new Map(listeners) });

    // Return unsubscribe function
    return () => {
      const current = get().eventListeners;
      current.get(event)?.delete(handler);
      set({ eventListeners: new Map(current) });
    };
  },
}));
