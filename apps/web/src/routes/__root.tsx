import * as React from "react";
import { createRootRoute, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { ThemeProvider, ShortcutsProvider } from "@/providers";
import { ReducedMotionProvider } from "@/components/composed/ReducedMotionProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorFallback } from "@/components/ErrorFallback";
import { AppShell } from "@/components/layout/AppShell";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { UnlockGuard } from "@/features/security/components/unlock/UnlockGuard";
import { GatewayAuthGuard } from "@/components/composed/GatewayAuthGuard";
import { useGatewayStreamHandler } from "@/hooks";
import { useUIStore } from "@/stores/useUIStore";
import { useAnnounce } from "@/hooks/useAnnounce";

/**
 * Route-level error component for TanStack Router.
 * Catches errors during route rendering and provides recovery actions.
 */
function RouteErrorComponent({ error }: { error: Error }) {
  const router = useRouter();
  return (
    <ErrorFallback
      error={error}
      onReset={() => {
        // Invalidate and retry the current route
        router.invalidate();
      }}
      onGoHome={() => {
        router.navigate({ to: "/" });
      }}
    />
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RouteErrorComponent,
});

/** Paths where the AppShell should be hidden (fullscreen pages) */
const FULLSCREEN_PATHS = ["/onboarding", "/unlock"] as const;

function RootLayout() {
  const location = useLocation();
  const isFullscreen = FULLSCREEN_PATHS.some((path) =>
    location.pathname.startsWith(path)
  );

  // Check if we should enable gateway auth guard
  // In dev mode, only enable when useLiveGateway is true
  // In production, always enable
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  const isDev = import.meta.env?.DEV ?? false;
  const gatewayEnabled = !isDev || useLiveGateway;

  // Enable gateway stream handler to process streaming events
  useGatewayStreamHandler({ enabled: gatewayEnabled });

  // Announce route changes for screen readers (WCAG 4.1.3)
  const announce = useAnnounce();
  const prevPathRef = React.useRef(location.pathname);
  React.useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname;
      // Derive human-readable page name from pathname
      const segment = location.pathname.split("/").filter(Boolean).pop() || "Home";
      const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
      document.title = `${title} — OpenClaw`;
      announce(`Navigated to ${title}`);
    }
  }, [location.pathname, announce]);

  return (
    <ReducedMotionProvider>
    <ThemeProvider>
      <ShortcutsProvider>
        <ErrorBoundary>
          <GatewayAuthGuard enabled={gatewayEnabled}>
            <OnboardingGuard>
              <UnlockGuard>
                {isFullscreen ? (
                  <Outlet />
                ) : (
                  <AppShell>
                    <Outlet />
                  </AppShell>
                )}
              </UnlockGuard>
            </OnboardingGuard>
          </GatewayAuthGuard>
        </ErrorBoundary>
        <Toaster
          position="bottom-right"
          expand={false}
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "font-sans",
            },
          }}
        />
      </ShortcutsProvider>
    </ThemeProvider>
    </ReducedMotionProvider>
  );
}
