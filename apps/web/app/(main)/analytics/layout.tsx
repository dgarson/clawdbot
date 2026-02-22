"use client";

import * as React from "react";

/**
 * Analytics section layout.
 * Currently a pass-through — sub-pages handle their own headers and navigation.
 * This layout exists to enable nested route segments under /analytics/.
 */
export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
