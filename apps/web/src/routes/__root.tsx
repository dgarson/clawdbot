import { createRootRoute, Outlet, useLocation } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { ThemeProvider, ShortcutsProvider } from "@/providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { UnlockGuard } from "@/features/security/components/unlock/UnlockGuard";
import { GatewayAuthGuard } from "@/components/composed/GatewayAuthGuard";
import { useGatewayEventSync, useGatewayStreamHandler } from "@/hooks";
import { useGatewayEnabled } from "@/hooks/useGatewayEnabled";

export const Route = createRootRoute({
  component: RootLayout,
});

/** Paths where the AppShell should be hidden (fullscreen pages) */
const FULLSCREEN_PATHS = ["/onboarding", "/unlock", "/landing"] as const;

/** Paths that bypass all guards (no Gateway, no onboarding, no unlock) */
const PUBLIC_PATHS = ["/landing"] as const;

function RootLayout() {
  const location = useLocation();
  const isFullscreen = FULLSCREEN_PATHS.some((path) =>
    location.pathname.startsWith(path)
  );
  const isPublic = PUBLIC_PATHS.some((path) =>
    location.pathname.startsWith(path)
  );

  // Check if we should enable gateway auth guard
  // In dev mode, only enable when useLiveGateway is true
  // In production, always enable
  // Public pages (e.g. /landing) never connect to gateway
  const gatewayEnabled = !isPublic && useGatewayEnabled();

  // Enable gateway stream handler to process streaming events
  // Disable for public paths that don't need gateway
  useGatewayStreamHandler({ enabled: gatewayEnabled && !isPublic });
  useGatewayEventSync({ enabled: gatewayEnabled && !isPublic });

  // Public paths bypass all guards entirely
  const content = isFullscreen ? <Outlet /> : <AppShell><Outlet /></AppShell>;

  return (
    <ThemeProvider>
      <ShortcutsProvider>
        <ErrorBoundary>
          {isPublic ? (
            <Outlet />
          ) : (
            <GatewayAuthGuard enabled={gatewayEnabled}>
              <OnboardingGuard>
                <UnlockGuard>
                  {content}
                </UnlockGuard>
              </OnboardingGuard>
            </GatewayAuthGuard>
          )}
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
  );
}
