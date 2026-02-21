"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Each cell: { hour: 0-23, day: 0-6 (0=Mon), count: number }
export interface HeatMapCell {
  hour: number;  // 0-23
  day: number;   // 0=Mon, 6=Sun
  count: number;
}

export interface ActivityHeatMapProps {
  /** Array of activity timestamps (ms since epoch) */
  activityTimestamps?: number[];
  /** Pre-computed cells (alternative to timestamps) */
  cells?: HeatMapCell[];
  title?: string;
  className?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function buildCells(timestamps: number[]): HeatMapCell[] {
  const counts: Record<string, number> = {};
  for (const ts of timestamps) {
    const d = new Date(ts);
    const day = (d.getDay() + 6) % 7; // 0=Mon
    const hour = d.getHours();
    const key = `${day}-${hour}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const cells: HeatMapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ day, hour, count: counts[`${day}-${hour}`] ?? 0 });
    }
  }
  return cells;
}

function getIntensityClass(count: number, max: number): string {
  if (max === 0 || count === 0) return "bg-muted/20";
  const ratio = count / max;
  if (ratio < 0.2) return "bg-primary/20";
  if (ratio < 0.4) return "bg-primary/40";
  if (ratio < 0.6) return "bg-primary/60";
  if (ratio < 0.8) return "bg-primary/80";
  return "bg-primary";
}

export function ActivityHeatMap({ activityTimestamps = [], cells: propCells, title = "Activity Pattern", className }: ActivityHeatMapProps) {
  const cells = propCells ?? buildCells(activityTimestamps);
  const max = Math.max(...cells.map((c) => c.count), 1);
  const totalActivity = cells.reduce((s, c) => s + c.count, 0);

  // Build lookup
  const lookup = new Map<string, number>();
  for (const c of cells) lookup.set(`${c.day}-${c.hour}`, c.count);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <span className="text-xs text-muted-foreground">{totalActivity.toLocaleString()} events</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Hour labels across top */}
          <div className="flex">
            <div className="w-10 shrink-0" /> {/* spacer for day labels */}
            {HOURS.filter((h) => h % 3 === 0).map((h) => (
              <div
                key={h}
                className="text-[10px] text-muted-foreground"
                style={{ width: `${(3 / 24) * 100}%`, minWidth: 24 }}
              >
                {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
              </div>
            ))}
          </div>

          {/* Grid */}
          {DAYS.map((dayLabel, day) => (
            <div key={day} className="flex items-center gap-0.5 mt-0.5">
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground text-right pr-2">
                {dayLabel}
              </span>
              {HOURS.map((hour) => {
                const count = lookup.get(`${day}-${hour}`) ?? 0;
                return (
                  <div
                    key={hour}
                    className={cn(
                      "h-4 flex-1 rounded-[2px] cursor-default transition-colors",
                      getIntensityClass(count, max)
                    )}
                    title={`${dayLabel} ${hour}:00 — ${count} event${count !== 1 ? "s" : ""}`}
                  />
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-[10px] text-muted-foreground">Less</span>
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((r) => (
              <div
                key={r}
                className={cn("h-3 w-3 rounded-[2px]", getIntensityClass(r * max, max))}
              />
            ))}
            <span className="text-[10px] text-muted-foreground">More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
