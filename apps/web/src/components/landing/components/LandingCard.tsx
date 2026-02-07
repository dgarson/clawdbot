import { cn } from "@/lib/utils";

type CardVariant = "standard" | "elevated" | "glass";

interface LandingCardProps extends React.ComponentProps<"div"> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  standard: "bg-card border border-border",
  elevated: "bg-card border border-border shadow-lg",
  glass: "lp-glass",
};

/** Card component with standard, elevated, and glass variants. */
export function LandingCard({
  variant = "standard",
  className,
  children,
  ...props
}: LandingCardProps) {
  return (
    <div
      className={cn("rounded-xl p-6", variantStyles[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
