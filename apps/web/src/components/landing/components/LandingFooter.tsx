const FOOTER_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Safety", href: "#safety" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "FAQ", href: "#faq" },
  { label: "Open Console", href: "/" },
] as const;

/** Compact footer with anchor links and brand line. */
export function LandingFooter() {
  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Left: brand */}
          <div className="flex flex-col items-center sm:items-start gap-1">
            <span className="text-sm font-semibold text-foreground">
              Clawdbrain
            </span>
            <span className="text-xs text-muted-foreground">
              Autonomous work, supervised by you.
            </span>
          </div>

          {/* Right: nav links */}
          <nav
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
            aria-label="Footer navigation"
          >
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
