"use client";

import { Activity, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthDashboard } from "@/components/domain/config";

interface HealthSectionProps {
  className?: string;
}

export function HealthSection({ className }: HealthSectionProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            System Health
          </CardTitle>
          <CardDescription>
            Monitor the health of your Clawdbrain system including gateway connection,
            messaging channels, and AI provider status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Info box */}
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">About Health Checks</p>
              <p className="text-muted-foreground">
                The health dashboard shows the current status of your system components.
                Status is automatically refreshed every 30 seconds. Click "Run Diagnostics"
                for a manual check with detailed results.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Dashboard */}
      <HealthDashboard />
    </div>
  );
}

export default HealthSection;
