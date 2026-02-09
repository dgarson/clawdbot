/**
 * Playwright Test Mode
 *
 * When VITE_PLAYWRIGHT_TEST_MODE=true, the app bypasses all auth guards
 * and simulates a logged-in user state. This allows Playwright tests to
 * interact with the UI without needing a live gateway connection.
 *
 * Usage:
 *   VITE_PLAYWRIGHT_TEST_MODE=true pnpm dev
 *   # or use the convenience script:
 *   pnpm dev:playwright
 *   # or create .env.playwright with the var and run:
 *   vite --mode playwright
 */

/**
 * Check if the app is running in Playwright test mode.
 *
 * When true, all authentication guards (GatewayAuthGuard, OnboardingGuard,
 * UnlockGuard) are bypassed and SecurityProvider returns an always-unlocked state.
 * The gateway WebSocket connection is not established.
 */
export function isPlaywrightTestMode(): boolean {
  return import.meta.env.VITE_PLAYWRIGHT_TEST_MODE === 'true';
}
