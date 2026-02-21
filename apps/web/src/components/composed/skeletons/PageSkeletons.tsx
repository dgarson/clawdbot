"use client";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/50",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-muted/30 before:to-transparent",
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Home / Dashboard Skeleton
// ---------------------------------------------------------------------------

export function HomeSkeleton() {
  return (
    <div className="space-y-8 p-1">
      {/* Greeting */}
      <div className="space-y-2">
        <Bone className="h-8 w-64" />
        <Bone className="h-4 w-48" />
      </div>

      {/* Quick Chat */}
      <div className="rounded-xl border border-border/50 bg-card/80 p-5">
        <Bone className="h-4 w-32 mb-4" />
        <Bone className="h-12 w-full rounded-xl" />
      </div>

      {/* Agent Grid (2x3) */}
      <div>
        <Bone className="h-5 w-28 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-card/80 p-5 space-y-3"
            >
              <div className="flex items-center gap-3">
                <Bone className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Bone className="h-4 w-24" />
                  <Bone className="h-3 w-16" />
                </div>
                <Bone className="h-5 w-14 rounded-full" />
              </div>
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom panels (2 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card/80 p-5 space-y-4"
          >
            <Bone className="h-5 w-36" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <Bone className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Bone className="h-3.5 w-40" />
                  <Bone className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent List Skeleton
// ---------------------------------------------------------------------------

export function AgentListSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {/* Header with search */}
      <div className="flex items-center justify-between">
        <Bone className="h-8 w-32" />
        <div className="flex items-center gap-3">
          <Bone className="h-10 w-64 rounded-xl" />
          <Bone className="h-10 w-10 rounded-xl" />
          <Bone className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card/80 p-5"
          >
            <div className="flex items-center gap-3 mb-4">
              <Bone className="h-12 w-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Bone className="h-4 w-28" />
                <Bone className="h-3 w-20" />
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-2/3" />
            </div>
            <div className="flex items-center justify-between">
              <Bone className="h-6 w-16 rounded-full" />
              <div className="flex gap-2">
                <Bone className="h-8 w-8 rounded-lg" />
                <Bone className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Detail Skeleton
// ---------------------------------------------------------------------------

export function AgentDetailSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {/* Back button + agent header */}
      <div className="flex items-center gap-3 mb-2">
        <Bone className="h-8 w-8 rounded-lg" />
        <Bone className="h-4 w-24" />
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Bone className="h-16 w-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Bone className="h-6 w-40" />
          <Bone className="h-4 w-28" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-10 w-24 rounded-xl" />
          <Bone className="h-10 w-10 rounded-xl" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50 pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      {/* Tab content: stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card/80 p-4 space-y-2"
          >
            <Bone className="h-3 w-16" />
            <Bone className="h-7 w-12" />
          </div>
        ))}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border/50 bg-card/80 p-5 space-y-4">
          <Bone className="h-5 w-24" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-3/4" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-5/6" />
        </div>
        <div className="rounded-xl border border-border/50 bg-card/80 p-5 space-y-4">
          <Bone className="h-5 w-28" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="h-6 w-6 rounded shrink-0" />
              <Bone className="h-3.5 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation List Skeleton
// ---------------------------------------------------------------------------

export function ConversationListSkeleton() {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-full max-w-md border-r border-border/50 bg-card/30 p-4 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <Bone className="h-6 w-32" />
          <Bone className="h-9 w-9 rounded-lg" />
        </div>
        <Bone className="h-10 w-full rounded-xl mb-2" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl p-3"
          >
            <Bone className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Bone className="h-3.5 w-24" />
                <Bone className="h-2.5 w-10" />
              </div>
              <Bone className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Main content placeholder */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Bone className="h-20 w-20 rounded-2xl mx-auto" />
          <Bone className="h-6 w-48 mx-auto" />
          <Bone className="h-4 w-64 mx-auto" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat Thread Skeleton
// ---------------------------------------------------------------------------

export function ChatThreadSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
        <Bone className="h-8 w-8 rounded-lg" />
        <Bone className="h-9 w-9 rounded-full" />
        <div className="space-y-1.5">
          <Bone className="h-4 w-28" />
          <Bone className="h-2.5 w-16" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-6 overflow-hidden">
        {/* User message */}
        <div className="flex justify-end">
          <Bone className="h-10 w-48 rounded-2xl rounded-br-md" />
        </div>
        {/* Agent message */}
        <div className="flex items-start gap-3">
          <Bone className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-2 max-w-md">
            <Bone className="h-4 w-full rounded-2xl rounded-bl-md" />
            <Bone className="h-4 w-3/4 rounded-2xl rounded-bl-md" />
            <Bone className="h-4 w-1/2 rounded-2xl rounded-bl-md" />
          </div>
        </div>
        {/* User message */}
        <div className="flex justify-end">
          <Bone className="h-10 w-36 rounded-2xl rounded-br-md" />
        </div>
        {/* Agent message (longer) */}
        <div className="flex items-start gap-3">
          <Bone className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-2 max-w-lg">
            <Bone className="h-4 w-full rounded-2xl rounded-bl-md" />
            <Bone className="h-4 w-full rounded-2xl" />
            <Bone className="h-4 w-5/6 rounded-2xl" />
            <Bone className="h-4 w-2/3 rounded-2xl rounded-bl-md" />
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 p-4">
        <Bone className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Skeleton
// ---------------------------------------------------------------------------

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 p-1">
      <Bone className="h-8 w-24" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar nav */}
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bone key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-xl border border-border/50 bg-card/80 p-6 space-y-4">
            <Bone className="h-5 w-32" />
            <Bone className="h-3 w-64" />
            <div className="space-y-4 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Bone className="h-3.5 w-28" />
                    <Bone className="h-2.5 w-48" />
                  </div>
                  <Bone className="h-6 w-11 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workstreams Skeleton
// ---------------------------------------------------------------------------

export function WorkstreamsSkeleton() {
  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Bone className="h-7 w-36" />
          <Bone className="h-4 w-56" />
        </div>
        <Bone className="h-10 w-36 rounded-xl" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Workstream cards */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card/80 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Bone className="h-10 w-10 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Bone className="h-4 w-40" />
                  <Bone className="h-3 w-24" />
                </div>
              </div>
              <Bone className="h-6 w-20 rounded-full" />
            </div>
            <Bone className="h-2 w-full rounded-full mb-2" />
            <div className="flex items-center gap-4">
              <Bone className="h-3 w-16" />
              <Bone className="h-3 w-20" />
              <Bone className="h-3 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
