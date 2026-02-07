import { cn } from "@/lib/utils";

interface LandingSectionProps {
  id?: string;
  alternate?: boolean;
  className?: string;
  belowFold?: boolean;
  children: React.ReactNode;
}

/** Consistent section wrapper with rhythm and alternating surfaces. */
export function LandingSection({
  id,
  alternate,
  className,
  belowFold,
  children,
}: LandingSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8",
        alternate && "bg-card/50",
        belowFold && "lp-below-fold",
        className
      )}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}
