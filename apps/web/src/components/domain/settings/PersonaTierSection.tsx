import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { usePersonaStore, type PersonaTier } from "@/stores/usePersonaStore";

interface TierOption {
  value: PersonaTier;
  label: string;
  description: string;
}

const tierOptions: TierOption[] = [
  {
    value: "casual",
    label: "Casual",
    description: "Simple overview, key metrics, and quick access to conversations.",
  },
  {
    value: "engaged",
    label: "Engaged",
    description: "Adds workstreams, rituals, detailed logs, and more tool configuration.",
  },
  {
    value: "expert",
    label: "Expert",
    description: "Full access including raw JSON, advanced configuration, and creation tools.",
  },
];

interface PersonaTierSectionProps {
  className?: string;
}

export function PersonaTierSection({ className }: PersonaTierSectionProps) {
  const { tier, setTier } = usePersonaStore();

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle>Interface Complexity</CardTitle>
        <CardDescription>
          Choose how much of the interface you want to see. You can change this at any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Experience tier</h4>
            <p className="text-sm text-muted-foreground">
              Controls which features and panels are visible across the app.
            </p>
          </div>

          <div
            className="flex flex-col sm:flex-row gap-2"
            role="radiogroup"
            aria-label="Interface complexity tier"
          >
            {tierOptions.map((option) => {
              const isActive = tier === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setTier(option.value)}
                  className={cn(
                    "relative flex-1 rounded-lg border px-4 py-3 text-left transition-colors",
                    isActive
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="persona-tier-active"
                      className="absolute inset-0 rounded-lg border-2 border-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative block text-sm font-medium">{option.label}</span>
                  <span className="relative block text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          <h4 className="text-sm font-medium">What changes with each tier</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong>Casual</strong> — stats, personality summary, conversations</li>
            <li><strong>Engaged</strong> — adds workstreams, rituals, detailed logs, tool config</li>
            <li><strong>Expert</strong> — adds raw JSON editor, advanced config, creation tools</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default PersonaTierSection;
