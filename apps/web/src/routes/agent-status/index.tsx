/**
 * Agent Status Route — redirects to the unified Agent Dashboard.
 *
 * Previously a separate dashboard with its own row-based view.
 * Now consolidated into /agents/dashboard with a layout toggle (grid/list).
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/agent-status/")({
  beforeLoad: ({ search }) => {
    // Preserve the health filter when redirecting
    const health = (search as Record<string, unknown>).health;
    throw redirect({
      to: "/agents/dashboard",
      search: {
        layout: "list" as const,
        ...(health ? { health } : {}),
      },
    });
  },
  component: () => null,
});
