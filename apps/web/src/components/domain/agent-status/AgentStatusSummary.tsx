/**
 * Summary stat cards shown at the top of the Agent Status Dashboard.
 *
 * Displays total agents, active count, idle, stalled, errored,
 * total token usage, and total cost.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bot,
  Zap,
  Pause,
  AlertTriangle,
  XCircle,
  Activity,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTokenCount } from "@/lib/format";

export interface AgentStatusSummaryProps {
  total: number;
  active: number;
  idle: number;
  stalled: number;
  errored: number;
  totalTokens: number;
  totalCost: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  delay?: number;
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="border-border/50 bg-card/50">
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              iconBg
            )}
          >
            <Icon className={cn("h-5 w-5", iconColor)} />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function AgentStatusSummary({
  total,
  active,
  idle,
  stalled,
  errored,
  totalTokens,
  totalCost,
}: AgentStatusSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <StatCard
        label="Total Agents"
        value={total}
        icon={Bot}
        iconColor="text-primary"
        iconBg="bg-primary/10"
        delay={0}
      />
      <StatCard
        label="Active"
        value={active}
        icon={Zap}
        iconColor="text-green-500"
        iconBg="bg-green-500/10"
        delay={0.05}
      />
      <StatCard
        label="Idle"
        value={idle}
        icon={Pause}
        iconColor="text-gray-500"
        iconBg="bg-gray-500/10"
        delay={0.1}
      />
      <StatCard
        label="Stalled"
        value={stalled}
        icon={AlertTriangle}
        iconColor="text-yellow-500"
        iconBg="bg-yellow-500/10"
        delay={0.15}
      />
      <StatCard
        label="Errored"
        value={errored}
        icon={XCircle}
        iconColor="text-red-500"
        iconBg="bg-red-500/10"
        delay={0.2}
      />
      <StatCard
        label="Total Tokens"
        value={formatTokenCount(totalTokens)}
        icon={Activity}
        iconColor="text-blue-500"
        iconBg="bg-blue-500/10"
        delay={0.25}
      />
      <StatCard
        label="Total Cost"
        value={`$${totalCost.toFixed(2)}`}
        icon={Coins}
        iconColor="text-purple-500"
        iconBg="bg-purple-500/10"
        delay={0.3}
      />
    </div>
  );
}
