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
import type { AgentHealthStatus } from "@/hooks/queries/useAgentStatus";

type HealthFilter = "all" | AgentHealthStatus;

export interface AgentStatusSummaryProps {
  total: number;
  active: number;
  idle: number;
  stalled: number;
  errored: number;
  totalTokens: number;
  totalCost: number;
  activeFilter?: HealthFilter;
  onFilterChange?: (filter: HealthFilter) => void;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  ringColor?: string;
  delay?: number;
  filterValue?: HealthFilter;
  activeFilter?: HealthFilter;
  onFilterChange?: (filter: HealthFilter) => void;
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  ringColor,
  delay = 0,
  filterValue,
  activeFilter,
  onFilterChange,
}: StatCardProps) {
  const isClickable = filterValue !== undefined && onFilterChange !== undefined;
  const isSelected = isClickable && activeFilter === filterValue;

  const handleClick = () => {
    if (!isClickable) {return;}
    // Toggle: clicking the selected tile deselects (resets to "all")
    onFilterChange(isSelected ? "all" : filterValue);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card
        className={cn(
          "border-border/50 bg-card/50 transition-all duration-150",
          isClickable && "cursor-pointer hover:bg-muted/40",
          isSelected && ringColor && `ring-2 ring-offset-1 ${ringColor}`,
          isSelected && iconBg.replace("/10", "/5")
        )}
        onClick={handleClick}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={isClickable ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        } : undefined}
      >
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

function formatTokenCount(tokens: number): string {
  if (tokens < 1_000) {return String(tokens);}
  if (tokens < 1_000_000) {return `${(tokens / 1_000).toFixed(1)}k`;}
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

export function AgentStatusSummary({
  total,
  active,
  idle,
  stalled,
  errored,
  totalTokens,
  totalCost,
  activeFilter,
  onFilterChange,
}: AgentStatusSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <StatCard
        label="Total Agents"
        value={total}
        icon={Bot}
        iconColor="text-primary"
        iconBg="bg-primary/10"
        ringColor="ring-primary"
        delay={0}
        filterValue="all"
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />
      <StatCard
        label="Active"
        value={active}
        icon={Zap}
        iconColor="text-green-500"
        iconBg="bg-green-500/10"
        ringColor="ring-green-500"
        delay={0.05}
        filterValue="active"
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />
      <StatCard
        label="Idle"
        value={idle}
        icon={Pause}
        iconColor="text-gray-500 dark:text-gray-400"
        iconBg="bg-gray-500/10"
        ringColor="ring-gray-400"
        delay={0.1}
        filterValue="idle"
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />
      <StatCard
        label="Stalled"
        value={stalled}
        icon={AlertTriangle}
        iconColor="text-yellow-500"
        iconBg="bg-yellow-500/10"
        ringColor="ring-yellow-500"
        delay={0.15}
        filterValue="stalled"
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
      />
      <StatCard
        label="Errored"
        value={errored}
        icon={XCircle}
        iconColor="text-red-500"
        iconBg="bg-red-500/10"
        ringColor="ring-red-500"
        delay={0.2}
        filterValue="errored"
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
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
