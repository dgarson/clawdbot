import * as React from "react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { ArrowRight } from "lucide-react";

type ButtonBaseProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

interface LandingButtonProps extends ButtonBaseProps {
  /** Show the glow effect (primary CTA) */
  glow?: boolean;
  /** Append an arrow icon */
  arrow?: boolean;
}

/** Landing-specific button with optional glow pseudo-element and arrow. */
export function LandingButton({
  glow,
  arrow,
  className,
  children,
  ...props
}: LandingButtonProps) {
  return (
    <Button
      className={cn(
        "transition-transform duration-150",
        "hover:-translate-y-0.5",
        glow && "lp-primary-button",
        className
      )}
      {...props}
    >
      {children}
      {arrow && <ArrowRight className="ml-2 h-4 w-4" />}
    </Button>
  );
}
