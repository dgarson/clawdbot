"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Staggered animation delay helper
const staggerDelay = (index: number) => ({
  animationDelay: `${index * 100}ms`,
});

// ============================================
// Agent Card Skeleton
// Matches AgentCard.tsx layout: Avatar + Content + Actions
// ============================================
interface AgentCardSkeletonProps {
  className?: string;
}

export function AgentCardSkeleton({ className }: AgentCardSkeletonProps) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name and Status row */}
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>

          {/* Role and task count */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </Card>
  );
}

// ============================================
// Agent Card Skeleton Grid
// Shows multiple skeleton cards with staggered animation
// ============================================
interface AgentCardSkeletonGridProps {
  count?: number;
  className?: string;
}

export function AgentCardSkeletonGrid({
  count = 3,
  className,
}: AgentCardSkeletonGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} style={staggerDelay(index)} className="animate-in fade-in-0 duration-300">
          <AgentCardSkeleton />
        </div>
      ))}
    </div>
  );
}

// ============================================
// Channel Card Skeleton
// Matches ChannelCard.tsx layout: Icon + Name/Description + Status + Button
// ============================================
interface ChannelCardSkeletonProps {
  className?: string;
}

export function ChannelCardSkeleton({ className }: ChannelCardSkeletonProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header: Icon + Name */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              {/* Name and description */}
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>

          {/* Footer: Status + Configure Button */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Channel Card Skeleton Grid
// Shows multiple skeleton cards with staggered animation
// ============================================
interface ChannelCardSkeletonGridProps {
  count?: number;
  className?: string;
}

export function ChannelCardSkeletonGrid({
  count = 4,
  className,
}: ChannelCardSkeletonGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} style={staggerDelay(index)} className="animate-in fade-in-0 duration-300">
          <ChannelCardSkeleton />
        </div>
      ))}
    </div>
  );
}

// ============================================
// Health Card Skeleton
// Matches HealthDashboard status cards (Gateway, Channels, Providers)
// ============================================
interface HealthCardSkeletonProps {
  className?: string;
}

export function HealthCardSkeleton({ className }: HealthCardSkeletonProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          {/* Title with icon */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
          {/* Status badge */}
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Content rows */}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>

        {/* Quick link */}
        <div className="pt-2 border-t">
          <Skeleton className="h-3 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Health Dashboard Skeleton
// Shows the full health dashboard loading state
// ============================================
interface HealthDashboardSkeletonProps {
  className?: string;
}

export function HealthDashboardSkeleton({
  className,
}: HealthDashboardSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header card */}
      <Card className="bg-muted/50">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </CardContent>
      </Card>

      {/* Status Cards Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} style={staggerDelay(index)} className="animate-in fade-in-0 duration-300">
            <HealthCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Settings Section Skeleton
// Generic skeleton for settings sections with form fields
// ============================================
interface SettingsSectionSkeletonProps {
  className?: string;
  rows?: number;
}

export function SettingsSectionSkeleton({
  className,
  rows = 4,
}: SettingsSectionSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Section header */}
      <div className="space-y-1">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            style={staggerDelay(index)}
            className="space-y-2 animate-in fade-in-0 duration-300"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>

      {/* Action button */}
      <div className="pt-2">
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
    </div>
  );
}

// ============================================
// API Key Card Skeleton
// For AI provider configuration cards
// ============================================
interface ApiKeyCardSkeletonProps {
  className?: string;
}

export function ApiKeyCardSkeleton({ className }: ApiKeyCardSkeletonProps) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
    </Card>
  );
}

// ============================================
// Config Page Header Skeleton
// For the header section with title and action button
// ============================================
interface ConfigHeaderSkeletonProps {
  className?: string;
  withButton?: boolean;
}

export function ConfigHeaderSkeleton({
  className,
  withButton = true,
}: ConfigHeaderSkeletonProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-56" />
      </div>
      {withButton && <Skeleton className="h-9 w-28 rounded-md" />}
    </div>
  );
}

// ============================================
// Config Filters Skeleton
// For search and filter controls
// ============================================
interface ConfigFiltersSkeletonProps {
  className?: string;
}

export function ConfigFiltersSkeleton({
  className,
}: ConfigFiltersSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      <Skeleton className="h-9 w-full max-w-sm rounded-md" />
      <Skeleton className="h-9 w-[140px] rounded-md" />
    </div>
  );
}

// ============================================
// Full Agent Config Skeleton
// Complete loading state for AgentConfig component
// ============================================
interface AgentConfigSkeletonProps {
  className?: string;
}

export function AgentConfigSkeleton({ className }: AgentConfigSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <ConfigHeaderSkeleton />
      <ConfigFiltersSkeleton />
      <AgentCardSkeletonGrid count={3} />
    </div>
  );
}

// ============================================
// Full Channel Config Skeleton
// Complete loading state for ChannelConfig component
// ============================================
interface ChannelConfigSkeletonProps {
  className?: string;
}

export function ChannelConfigSkeleton({
  className,
}: ChannelConfigSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <ChannelCardSkeletonGrid count={6} />
    </div>
  );
}
