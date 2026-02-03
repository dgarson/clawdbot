/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./index.css";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Import security provider for app lock & 2FA
import { SecurityProvider } from "./features/security";
import { GatewayProvider } from "./providers/GatewayProvider";
import { useUIStore } from "./stores/useUIStore";

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Read gateway auth from URL query params (e.g., ?password=xxx or ?token=xxx)
function getGatewayAuthFromUrl(): { token?: string; password?: string } {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? undefined;
  const password = params.get("password") ?? undefined;
  return { token, password };
}

// Gateway provider wrapper - defined before render for fast refresh compatibility
function AppGatewayProviders({ children }: { children: React.ReactNode }) {
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  const liveMode = (import.meta.env?.DEV ?? false) && useLiveGateway;
  const { token, password } = getGatewayAuthFromUrl();
  const autoConnect = liveMode || Boolean(token || password);
  return (
    <GatewayProvider autoConnect={autoConnect} token={token} password={password}>
      {children}
    </GatewayProvider>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SecurityProvider>
        <AppGatewayProviders>
          <RouterProvider router={router} />
        </AppGatewayProviders>
      </SecurityProvider>
      {import.meta.env.DEV && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  </StrictMode>
);
