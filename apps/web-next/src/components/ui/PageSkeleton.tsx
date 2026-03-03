import { cn } from "../../lib/utils";

// Base skeleton pulse element (inline to avoid circular import with Skeleton.tsx)
function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-secondary/70 rounded animate-pulse-soft", className)}
      aria-hidden="true"
    />
  );
}

/**
 * PageSkeleton — full-page loading skeleton matching the Horizon app shell.
 *
 * Renders a sidebar + main content area silhouette while a lazy view loads.
 * Uses subtle pulse animation (no spinners) for a fast, calm loading feel.
 *
 * Usage:
 *   <React.Suspense fallback={<PageSkeleton />}>
 *     <SomeHeavyView />
 *   </React.Suspense>
 */
export function PageSkeleton({ variant = "default" }: { variant?: "default" | "table" | "cards" | "chat" }) {
  return (
    <div className="flex h-full w-full min-h-[400px]" aria-label="Loading page…" aria-busy="true">
      {/* Main content area */}
      <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Bone className="h-7 w-48" />
            <Bone className="h-3.5 w-72" />
          </div>
          <div className="flex gap-2">
            <Bone className="h-8 w-24 rounded-lg" />
            <Bone className="h-8 w-28 rounded-lg" />
          </div>
        </div>

        {variant === "table" && <TableContent />}
        {variant === "cards" && <CardsContent />}
        {variant === "chat" && <ChatContent />}
        {variant === "default" && <DefaultContent />}
      </div>
    </div>
  );
}

function DefaultContent() {
  return (
    <>
      {/* Stat cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-2.5">
            <Bone className="h-3 w-20" />
            <Bone className="h-7 w-14" />
            <Bone className="h-2.5 w-24" />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4 space-y-3">
          <Bone className="h-4 w-32" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Bone className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Bone className={cn("h-3", i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-1/2" : "w-5/6")} />
                <Bone className="h-2.5 w-28" />
              </div>
              <Bone className="h-5 w-16 rounded-full shrink-0" />
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <Bone className="h-4 w-24" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Bone className="h-2.5 w-24" />
                <Bone className="h-2.5 w-10" />
              </div>
              <Bone className="h-2 w-full rounded-full" />
            </div>
          ))}
          <div className="pt-2 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Bone className="w-2 h-2 rounded-full shrink-0" />
                <Bone className="h-2.5 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function TableContent() {
  return (
    <>
      {/* Filter row */}
      <div className="flex items-center gap-2">
        <Bone className="h-8 w-56 rounded-lg" />
        {[...Array(3)].map((_, i) => (
          <Bone key={i} className="h-7 w-20 rounded-full" />
        ))}
        <div className="ml-auto">
          <Bone className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden flex-1">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-border">
          {[...Array(5)].map((_, i) => (
            <Bone key={i} className="h-3 w-16" />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-border last:border-0">
            <div className="flex items-center gap-2">
              <Bone className="w-7 h-7 rounded-full shrink-0" />
              <Bone className="h-3 flex-1" />
            </div>
            <Bone className="h-3 w-20 my-auto" />
            <Bone className="h-5 w-16 rounded-full my-auto" />
            <Bone className="h-3 w-24 my-auto" />
            <Bone className="h-3 w-12 my-auto" />
          </div>
        ))}
      </div>
    </>
  );
}

function CardsContent() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(9)].map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-start justify-between">
            <Bone className="h-10 w-10 rounded-lg" />
            <Bone className="h-5 w-14 rounded-full" />
          </div>
          <Bone className="h-4 w-32" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-4/5" />
          <div className="flex gap-2 pt-1">
            <Bone className="h-7 flex-1 rounded-lg" />
            <Bone className="h-7 w-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatContent() {
  return (
    <div className="flex flex-1 bg-card border border-border rounded-lg overflow-hidden min-h-0">
      {/* Sidebar list */}
      <div className="w-64 border-r border-border p-3 space-y-2 shrink-0">
        <Bone className="h-8 w-full rounded-lg mb-3" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 p-2">
            <Bone className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Bone className="h-3 w-24" />
              <Bone className="h-2 w-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Message pane */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {[
          { side: "left", lines: 2 },
          { side: "right", lines: 1 },
          { side: "left", lines: 3 },
          { side: "right", lines: 2 },
        ].map((msg, i) => (
          <div key={i} className={cn("flex gap-2.5", msg.side === "right" && "flex-row-reverse")}>
            <Bone className="w-8 h-8 rounded-full shrink-0" />
            <div className={cn("space-y-1.5 max-w-sm", msg.side === "right" && "items-end flex flex-col")}>
              {[...Array(msg.lines)].map((_, li) => (
                <Bone
                  key={li}
                  className={cn("h-3 rounded", li === msg.lines - 1 ? "w-3/4" : "w-full")}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex-1" />
        <Bone className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default PageSkeleton;
