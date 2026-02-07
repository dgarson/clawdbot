import { cn } from "@/lib/utils";

interface LandingSectionHeaderProps {
  label?: string;
  headline: string;
  subhead?: string;
  learnMoreHref?: string;
  learnMoreLabel?: string;
  className?: string;
  align?: "left" | "center";
}

/** Standardized section header: optional label, headline, subhead, learn-more link. */
export function LandingSectionHeader({
  label,
  headline,
  subhead,
  learnMoreHref,
  learnMoreLabel = "Learn more",
  className,
  align = "center",
}: LandingSectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 mb-10 sm:mb-14",
        align === "center" && "items-center text-center",
        className
      )}
    >
      {label && (
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          {label}
        </span>
      )}
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground">
        {headline}
      </h2>
      {subhead && (
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
          {subhead}
        </p>
      )}
      {learnMoreHref && (
        <a
          href={learnMoreHref}
          className="text-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          {learnMoreLabel}
        </a>
      )}
    </div>
  );
}
