
import { ArrowUpRight, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface UsageMetric {
  id: string;
  label: string;
  current: number;
  limit: number;
  unit: string;
}

interface UsageSectionProps {
  className?: string;
}

export function UsageSection({ className }: UsageSectionProps) {
  // Mock usage data - in production this would come from an API
  const plan = {
    name: "Pro",
    price: "$29/month",
    renewalDate: "February 15, 2026",
  };

  const metrics: UsageMetric[] = [
    {
      id: "messages",
      label: "Messages",
      current: 8432,
      limit: 10000,
      unit: "messages",
    },
    {
      id: "agents",
      label: "Active Agents",
      current: 5,
      limit: 10,
      unit: "agents",
    },
    {
      id: "storage",
      label: "Storage",
      current: 2.4,
      limit: 5,
      unit: "GB",
    },
    {
      id: "rituals",
      label: "Scheduled Rituals",
      current: 12,
      limit: 25,
      unit: "rituals",
    },
    {
      id: "integrations",
      label: "Connected Integrations",
      current: 2,
      limit: 5,
      unit: "integrations",
    },
  ];

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) {return "bg-destructive";}
    if (percentage >= 75) {return "bg-warning";}
    return "bg-primary";
  };

  const getPercentage = (current: number, limit: number) => {
    return Math.min(Math.round((current / limit) * 100), 100);
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle>Usage & Billing</CardTitle>
        <CardDescription>
          Monitor your usage and manage your subscription plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Current Plan */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-muted/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-lg">{plan.name} Plan</h4>
              <Badge variant="secondary">{plan.price}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Your plan renews on {plan.renewalDate}
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Zap className="h-4 w-4" />
            Upgrade
            <ArrowUpRight className="h-3 w-3" />
          </Button>
        </div>

        <Separator />

        {/* Usage Metrics */}
        <div className="space-y-6">
          <h4 className="text-sm font-medium">Usage This Month</h4>
          <div className="space-y-6">
            {metrics.map((metric) => {
              const percentage = getPercentage(metric.current, metric.limit);
              const progressColor = getProgressColor(percentage);

              return (
                <div key={metric.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{metric.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {metric.current.toLocaleString()} / {metric.limit.toLocaleString()} {metric.unit}
                    </span>
                  </div>
                  <div className="relative">
                    <Progress value={percentage} className="h-2" />
                    {/* Custom colored indicator overlay */}
                    <div
                      className={cn(
                        "absolute inset-0 h-2 rounded-full transition-all",
                        progressColor
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {percentage >= 90 && (
                    <p className="text-xs text-destructive">
                      Approaching limit - consider upgrading your plan
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Plan Comparison */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Available Plans</h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4 border-muted">
              <h5 className="font-medium">Free</h5>
              <p className="text-2xl font-bold">$0</p>
              <p className="text-xs text-muted-foreground mb-3">Forever free</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>1,000 messages/mo</li>
                <li>2 agents</li>
                <li>500 MB storage</li>
              </ul>
            </Card>
            <Card className="p-4 border-primary relative">
              <Badge className="absolute -top-2 right-2" variant="default">
                Current
              </Badge>
              <h5 className="font-medium">Pro</h5>
              <p className="text-2xl font-bold">$29</p>
              <p className="text-xs text-muted-foreground mb-3">per month</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>10,000 messages/mo</li>
                <li>10 agents</li>
                <li>5 GB storage</li>
              </ul>
            </Card>
            <Card className="p-4 border-muted">
              <h5 className="font-medium">Enterprise</h5>
              <p className="text-2xl font-bold">Custom</p>
              <p className="text-xs text-muted-foreground mb-3">Contact sales</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>Unlimited messages</li>
                <li>Unlimited agents</li>
                <li>Unlimited storage</li>
              </ul>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default UsageSection;
