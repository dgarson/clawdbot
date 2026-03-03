import { cn } from "../lib/utils";

// Base skeleton pulse element
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-secondary/70 rounded animate-pulse-soft",
        className
      )}
      aria-hidden="true"
    />
  );
}

// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard...">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-2 w-24" />
          </div>
        ))}
      </div>
      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full max-w-[200px]" />
                <Skeleton className="h-2 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-2 h-2 rounded-full shrink-0" />
              <Skeleton className="h-2.5 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Table skeleton (sessions, nodes, etc.)
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-label="Loading...">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      {/* Filter row */}
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-4 gap-4 p-3 border-b border-border">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-4 p-3 border-b border-border last:border-0">
            <Skeleton className="h-3.5 w-full max-w-[140px]" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Card grid skeleton (skills, agents, etc.)
export function CardGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-label="Loading...">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Chat skeleton
export function ChatSkeleton() {
  return (
    <div className="flex h-[600px] gap-0 bg-card border border-border rounded-lg overflow-hidden" aria-label="Loading chat...">
      {/* Sidebar */}
      <div className="w-64 border-r border-border p-4 space-y-3">
        <Skeleton className="h-8 w-full rounded-lg" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 p-2">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-32" />
            </div>
          </div>
        ))}
      </div>
      {/* Message area */}
      <div className="flex-1 flex flex-col p-4 space-y-4">
        {[
          { align: "left", lines: 2 },
          { align: "right", lines: 1 },
          { align: "left", lines: 3 },
        ].map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.align === "right" && "flex-row-reverse")}>
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className={cn("space-y-1.5 max-w-sm", msg.align === "right" && "items-end flex flex-col")}>
              {[...Array(msg.lines)].map((_, li) => (
                <div key={li} className={cn("bg-secondary/70 rounded animate-pulse-soft h-3", li === msg.lines - 1 ? "w-3/4" : "w-full")} aria-hidden="true" />
              ))}
            </div>
          </div>
        ))}
        <div className="flex-1" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

// Generic content skeleton (editor, form, etc.)
export function ContentSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading...">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className={cn("h-9 rounded-lg", i % 3 === 2 ? "h-20" : "h-9")} />
          </div>
        ))}
      </div>
    </div>
  );
}
