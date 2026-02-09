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
import { isPlaywrightTestMode } from "@/lib/test-mode";

export const Route = createRootRoute({
  component: RootLayout,
});

/** Paths where the AppShell should be hidden (fullscreen pages) */
const FULLSCREEN_PATHS = ["/onboarding", "/unlock", "/landing"] as const;

/** Paths that bypass all guards (no Gateway, no onboarding, no unlock) */
const PUBLIC_PATHS = ["/landing"] as const;

function RootLayout() {
  const location = useLocation();
  const testMode = isPlaywrightTestMode();
  const isFullscreen = FULLSCREEN_PATHS.some((path) =>
    location.pathname.startsWith(path)
  );
  const isPublic = PUBLIC_PATHS.some((path) =>
    location.pathname.startsWith(path)
  );

  // Check if we should enable gateway auth guard
  // In dev mode, only enable when useLiveGateway is true
  // In production, always enable
  // Public pages (e.g. /landing) and test mode never connect to gateway
  const gatewayEnabled = !isPublic && !testMode && useGatewayEnabled();

  // Enable gateway stream handler to process streaming events
  // Disable for public paths and test mode that don't need gateway
  useGatewayStreamHandler({ enabled: gatewayEnabled });
  useGatewayEventSync({ enabled: gatewayEnabled });

  // Public paths bypass all guards entirely
  const content = isFullscreen ? <Outlet /> : <AppShell><Outlet /></AppShell>;

  return (
    <ThemeProvider>
      <ShortcutsProvider>
        <ErrorBoundary>
          {isPublic ? (
            <Outlet />
          ) : testMode ? (
            <>
              {/* Playwright test mode banner */}
              <div className="fixed top-0 left-0 right-0 z-[9999] bg-yellow-500/90 text-black text-xs text-center py-0.5 font-mono pointer-events-none">
                🎭 Playwright Test Mode — Auth Disabled
              </div>
              {content}
            </>
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
