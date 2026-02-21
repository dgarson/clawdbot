"use client";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-[100]">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
        {/* Logo */}
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-lg">
            OC
          </div>
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping" />
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-lg font-semibold">OpenClaw</p>
          <p className="text-xs text-muted-foreground mt-1">Connecting to gateway...</p>
        </div>

        {/* Loading dots */}
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
