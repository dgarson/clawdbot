import { useUIStore } from "../stores/useUIStore.js";

/**
 * Shared hook that determines whether the app should use the live gateway
 * (true) or fall back to mock data (false).
 *
 * **Production**: always returns true — the gateway is the primary data source.
 * **Development**: returns true only when the user has toggled "Live Gateway"
 * on in the UI settings, allowing dev users to opt into mock data by default.
 *
 * Use this hook everywhere instead of inline `import.meta.env.DEV && useLiveGateway`
 * checks to ensure consistent behavior across all query/mutation hooks.
 */
export function useGatewayEnabled(): boolean {
  const isDev = import.meta.env?.DEV ?? false;
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  // In production, always use gateway. In dev, respect the user's toggle.
  return !isDev || useLiveGateway;
}

/**
 * Returns "live" or "mock" for use as a React Query cache key segment,
 * ensuring queries are refetched when the mode changes.
 */
export function useGatewayModeKey(): "live" | "mock" {
  return useGatewayEnabled() ? "live" : "mock";
}
