"use client";

import { Construction, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ComingSoonSectionProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  features?: string[];
  className?: string;
}

export function ComingSoonSection({
  title,
  description,
  icon: Icon = Construction,
  features,
  className,
}: ComingSoonSectionProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            We're working on this feature. Check back soon for updates.
          </p>
          {features && features.length > 0 && (
            <div className="text-left w-full max-w-sm">
              <p className="text-sm font-medium mb-2">What to expect:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ComingSoonSection;
