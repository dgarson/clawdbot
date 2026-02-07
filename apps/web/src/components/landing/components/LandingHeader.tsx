import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LandingButton } from "./LandingButton";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Safety", href: "#safety" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "FAQ", href: "#faq" },
] as const;

/** Sticky translucent header with anchor navigation and mobile menu. */
export function LandingHeader() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleOpenConsole = () => {
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
      {/* Skip to content — visible on focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Wordmark */}
        <a
          href="/landing"
          className="text-xl font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
        >
          Clawdbrain
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Landing page navigation">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <LandingButton glow arrow size="sm" onClick={handleOpenConsole}>
            Open Console
          </LandingButton>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden flex items-center justify-center h-10 w-10 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu sheet */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-[max-height] duration-300 ease-out border-t border-border/50 bg-background/95 backdrop-blur-sm",
          mobileOpen ? "max-h-80" : "max-h-0 border-t-0"
        )}
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex flex-col gap-1 px-4 py-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 pt-2 border-t border-border/50">
            <LandingButton
              glow
              arrow
              className="w-full"
              onClick={handleOpenConsole}
            >
              Open Console
            </LandingButton>
          </div>
        </div>
      </div>
    </header>
  );
}
