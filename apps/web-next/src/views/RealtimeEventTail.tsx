import { useMemo, useState } from "react";
import { Activity, Pause, Play, Search } from "lucide-react";
import { cn } from "../lib/utils";

type TailMode = "all" | "routing" | "tool" | "budget" | "journal";

type TailEvent = {
  time: string;
  mode: Exclude<TailMode, "all">;
  source: string;
  level: "info" | "warn" | "error";
  line: string;
};

const EVENTS: TailEvent[] = [
  { time: "10:03:17", mode: "routing", source: "router.feedback", level: "warn", line: "expected T3 escalate != predicted T1 handle" },
  { time: "10:03:12", mode: "tool", source: "tool.web_fetch", level: "error", line: "timeout after 14.2s (retry budget exhausted)" },
  { time: "10:03:02", mode: "budget", source: "usage.hourly", level: "warn", line: "provider=anthropic spend_velocity +22% vs baseline" },
  { time: "10:02:40", mode: "journal", source: "agent.wave", level: "info", line: "wave 37 started sessions=34 safeguards=on" },
  { time: "10:02:12", mode: "routing", source: "self_eval", level: "info", line: "mismatch trend 10.7% -> 9.9% (6h window)" },
];

export default function RealtimeEventTail() {
  const [mode, setMode] = useState<TailMode>("all");
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EVENTS.filter((event) => {
      if (mode !== "all" && event.mode !== mode) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        event.line.toLowerCase().includes(q) ||
        event.source.toLowerCase().includes(q) ||
        event.mode.includes(q)
      );
    });
  }, [mode, query]);

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Realtime Event Tail</h1>
            <p className="text-sm text-zinc-400">Tail specialized journals with routing/tool/budget focused modes.</p>
          </div>
          <button
            onClick={() => setPaused((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? "Resume" : "Pause"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "routing", "tool", "budget", "journal"] as TailMode[]).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs uppercase",
                mode === item ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-300",
              )}
            >
              {item}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 rounded-md border border-zinc-800 px-2 py-1">
            <Search className="h-3.5 w-3.5 text-zinc-500" />
            <input
              className="bg-transparent text-sm outline-none placeholder:text-zinc-600"
              placeholder="Filter source/line"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
            <Activity className="h-3.5 w-3.5" />
            {paused ? "stream paused" : "stream live"} · {rows.length} events
          </div>
          <div className="space-y-2 font-mono text-xs">
            {rows.map((row, index) => (
              <div key={`${row.time}-${index}`} className="rounded-md border border-zinc-800 bg-zinc-950/70 p-2">
                <div className="flex gap-2">
                  <span className="text-zinc-500">{row.time}</span>
                  <span className="text-cyan-300">[{row.source}]</span>
                  <span
                    className={cn(
                      row.level === "info" && "text-sky-300",
                      row.level === "warn" && "text-amber-300",
                      row.level === "error" && "text-rose-300",
                    )}
                  >
                    {row.level.toUpperCase()}
                  </span>
                  <span className="text-zinc-200">{row.line}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
