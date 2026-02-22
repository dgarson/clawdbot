import type { Metadata } from "next";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { GatewayProvider } from "@/components/shell/gateway-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastViewport } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "OpenClaw",
  description: "AI Agent Control Interface",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <GatewayProvider>
              {children}
              <ToastViewport />
            </GatewayProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
