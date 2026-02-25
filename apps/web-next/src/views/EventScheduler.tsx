import React, { useState } from "react";
import { cn } from "../lib/utils";

type CalendarView = "month" | "week" | "day" | "agenda";
type EventKind = "meeting" | "deploy" | "review" | "sprint" | "oncall" | "maintenance" | "social";

interface CalendarEvent {
  id: string;
  title: string;
  kind: EventKind;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;
  attendees: string[];
  description: string;
  allDay: boolean;
  recurring: boolean;
}

const kindColor = (k: EventKind) => {
  if (k === "meeting")     {return "bg-primary/20 border-primary text-indigo-300";}
  if (k === "deploy")      {return "bg-emerald-500/20 border-emerald-500 text-emerald-300";}
  if (k === "review")      {return "bg-amber-500/20 border-amber-500 text-amber-300";}
  if (k === "sprint")      {return "bg-purple-500/20 border-purple-500 text-purple-300";}
  if (k === "oncall")      {return "bg-rose-500/20 border-rose-500 text-rose-300";}
  if (k === "maintenance") {return "bg-orange-500/20 border-orange-500 text-orange-300";}
  return "bg-[var(--color-surface-3)]/20 border-[var(--color-surface-3)] text-[var(--color-text-primary)]";
};

const kindDot = (k: EventKind) => {
  if (k === "meeting")     {return "bg-primary";}
  if (k === "deploy")      {return "bg-emerald-500";}
  if (k === "review")      {return "bg-amber-500";}
  if (k === "sprint")      {return "bg-purple-500";}
  if (k === "oncall")      {return "bg-rose-500";}
  if (k === "maintenance") {return "bg-orange-500";}
  return "bg-[var(--color-surface-3)]";
};

const kindEmoji = (k: EventKind) => {
  if (k === "meeting")     {return "📅";}
  if (k === "deploy")      {return "🚀";}
  if (k === "review")      {return "🔍";}
  if (k === "sprint")      {return "⚡";}
  if (k === "oncall")      {return "📟";}
  if (k === "maintenance") {return "🔧";}
  return "🎉";
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const TODAY = new Date(2026, 1, 22); // Feb 22 2026

const EVENTS: CalendarEvent[] = [
  { id: "e1",  title: "Sprint Planning",          kind: "sprint",      date: "2026-02-22", startTime: "09:00", endTime: "10:00", attendees: ["Luis","Xavier","Tim"],     description: "Plan Horizon UI sprint tasks",           allDay: false, recurring: true  },
  { id: "e2",  title: "Horizon Deploy",            kind: "deploy",      date: "2026-02-22", startTime: "14:00", endTime: "15:00", attendees: ["Luis","Tim"],              description: "Deploy 100+ views to staging",           allDay: false, recurring: false },
  { id: "e3",  title: "UX Review w/ Stephan",      kind: "review",      date: "2026-02-23", startTime: "11:00", endTime: "12:00", attendees: ["Luis","Stephan"],          description: "Brand alignment review for Horizon",     allDay: false, recurring: false },
  { id: "e4",  title: "Tim PR Review",             kind: "review",      date: "2026-02-23", startTime: "14:00", endTime: "15:00", attendees: ["Luis","Tim"],              description: "Megabranch PR review",                   allDay: false, recurring: false },
  { id: "e5",  title: "All Hands",                 kind: "meeting",     date: "2026-02-24", startTime: "10:00", endTime: "11:00", attendees: ["All"],                     description: "Monthly org-wide sync",                  allDay: false, recurring: true  },
  { id: "e6",  title: "Database Maintenance",      kind: "maintenance", date: "2026-02-25", startTime: "02:00", endTime: "04:00", attendees: ["Tim","Reed"],              description: "Planned downtime for DB upgrade",        allDay: false, recurring: false },
  { id: "e7",  title: "Design System Workshop",    kind: "meeting",     date: "2026-02-26", startTime: "13:00", endTime: "15:00", attendees: ["Luis","Piper","Quinn"],    description: "Component library design session",       allDay: false, recurring: false },
  { id: "e8",  title: "Wes On-call",               kind: "oncall",      date: "2026-02-22", startTime: "00:00", endTime: "23:59", attendees: ["Wes"],                     description: "Primary on-call rotation",               allDay: true,  recurring: true  },
  { id: "e9",  title: "Product Roadmap Review",    kind: "sprint",      date: "2026-02-27", startTime: "15:00", endTime: "16:00", attendees: ["Luis","Xavier","Stephan"], description: "Quarterly roadmap alignment",             allDay: false, recurring: false },
  { id: "e10", title: "Security Audit",            kind: "review",      date: "2026-02-28", startTime: "09:00", endTime: "11:00", attendees: ["Tim","All"],               description: "Quarterly security review",              allDay: false, recurring: true  },
  { id: "e11", title: "Team Social",               kind: "social",      date: "2026-02-28", startTime: "17:00", endTime: "19:00", attendees: ["All"],                     description: "End of sprint celebration 🎉",           allDay: false, recurring: false },
  { id: "e12", title: "Reed On-call",              kind: "oncall",      date: "2026-02-25", startTime: "00:00", endTime: "23:59", attendees: ["Reed"],                     description: "Primary on-call rotation",               allDay: true,  recurring: true  },
];

const HOURS = ["00","06","09","10","11","12","13","14","15","16","17","18","20","22"];

export default function EventScheduler() {
  const [viewMode, setViewMode] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date(TODAY));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState<boolean>(false);
  const [newEventTitle, setNewEventTitle] = useState<string>("");
  const [newEventKind, setNewEventKind] = useState<EventKind>("meeting");
  const [newEventDate, setNewEventDate] = useState<string>("2026-02-22");
  const [events, setEvents] = useState<CalendarEvent[]>(EVENTS);
  const [filterKinds, setFilterKinds] = useState<Set<EventKind>>(new Set());

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Build month grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const gridDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (gridDays.length % 7 !== 0) {gridDays.push(null);}

  function prevMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function getEventsForDay(day: number): CalendarEvent[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(e => e.date === dateStr && (filterKinds.size === 0 || filterKinds.has(e.kind)));
  }

  function isToday(day: number): boolean {
    return year === TODAY.getFullYear() && month === TODAY.getMonth() && day === TODAY.getDate();
  }

  function createEvent() {
    if (!newEventTitle.trim()) {return;}
    const newEv: CalendarEvent = {
      id: `e${Date.now()}`,
      title: newEventTitle.trim(),
      kind: newEventKind,
      date: newEventDate,
      startTime: "09:00",
      endTime: "10:00",
      attendees: ["Luis"],
      description: "",
      allDay: false,
      recurring: false,
    };
    setEvents(prev => [...prev, newEv]);
    setNewEventTitle("");
    setShowNewEvent(false);
  }

  function toggleKindFilter(k: EventKind) {
    setFilterKinds(prev => {
      const next = new Set(prev);
      if (next.has(k)) {next.delete(k);} else {next.add(k);}
      return next;
    });
  }

  const kinds: EventKind[] = ["meeting", "deploy", "review", "sprint", "oncall", "maintenance", "social"];

  // Agenda view: next 14 days of events
  const agendaEvents = events
    .filter(e => {
      const evDate = new Date(e.date);
      const today = new Date(2026, 1, 22);
      const plus14 = new Date(today);
      plus14.setDate(plus14.getDate() + 14);
      return evDate >= today && evDate <= plus14 && (filterKinds.size === 0 || filterKinds.has(e.kind));
    })
    .toSorted((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  return (
    <div className="flex h-full bg-[var(--color-surface-0)] overflow-hidden">
      {/* Left sidebar */}
      <div className="w-56 flex-shrink-0 bg-[var(--color-surface-1)] border-r border-[var(--color-border)] flex flex-col">
        {/* Month mini-nav */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-1">‹</button>
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">{MONTHS[month].slice(0,3)} {year}</span>
            <button onClick={nextMonth} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-1">›</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {DAYS.map(d => <div key={d} className="text-[9px] text-[var(--color-text-muted)]">{d[0]}</div>)}
            {gridDays.map((day, i) => (
              <button
                key={i}
                disabled={!day}
                onClick={() => day && setCurrentDate(new Date(year, month, day))}
                className={cn(
                  "w-6 h-6 text-[10px] rounded mx-auto flex items-center justify-center",
                  !day && "opacity-0",
                  day && isToday(day) && "bg-primary text-[var(--color-text-primary)] font-bold",
                  day && !isToday(day) && "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* New event button */}
        <div className="p-3">
          <button
            onClick={() => setShowNewEvent(true)}
            className="w-full bg-primary hover:bg-primary text-[var(--color-text-primary)] text-xs font-medium py-2 rounded transition-colors"
          >
            + New Event
          </button>
        </div>

        {/* Kind filters */}
        <div className="px-3 pb-4">
          <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Filter by type</div>
          <div className="space-y-1">
            {kinds.map(k => (
              <button
                key={k}
                onClick={() => toggleKindFilter(k)}
                className={cn(
                  "w-full flex items-center gap-2 text-xs px-2 py-1 rounded transition-colors",
                  filterKinds.has(k) ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", kindDot(k))} />
                <span className="capitalize">{k}</span>
                {filterKinds.has(k) && <span className="ml-auto text-primary">✓</span>}
              </button>
            ))}
          </div>
          {filterKinds.size > 0 && (
            <button onClick={() => setFilterKinds(new Set())} className="w-full text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mt-2 text-center">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Main calendar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-1)] flex-shrink-0">
          <button onClick={prevMonth} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2 py-1 rounded hover:bg-[var(--color-surface-2)]">‹</button>
          <h2 className="font-semibold text-[var(--color-text-primary)] text-sm">{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2 py-1 rounded hover:bg-[var(--color-surface-2)]">›</button>
          <button
            onClick={() => setCurrentDate(new Date(TODAY))}
            className="ml-2 text-xs text-primary hover:text-indigo-300 px-2 py-1 rounded hover:bg-[var(--color-surface-2)]"
          >
            Today
          </button>

          <div className="ml-auto flex rounded border border-[var(--color-border)] overflow-hidden">
            {(["month", "week", "agenda"] as CalendarView[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={cn(
                  "text-xs px-3 py-1.5 capitalize transition-colors",
                  viewMode === v ? "bg-primary text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {viewMode === "month" && (
            <div className="p-0">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-xs text-[var(--color-text-muted)] py-2 font-medium">{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(96px, 1fr)" }}>
                {gridDays.map((day, i) => {
                  const dayEvents = day ? getEventsForDay(day) : [];
                  return (
                    <div
                      key={i}
                      className={cn(
                        "border-r border-b border-[var(--color-border)] p-1 min-h-24",
                        !day && "bg-[var(--color-surface-1)]/30",
                        day && isToday(day) && "bg-primary/5"
                      )}
                    >
                      {day && (
                        <>
                          <div className={cn(
                            "w-6 h-6 text-xs flex items-center justify-center rounded-full mb-1",
                            isToday(day) ? "bg-primary text-[var(--color-text-primary)] font-bold" : "text-[var(--color-text-secondary)]"
                          )}>
                            {day}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map(ev => (
                              <button
                                key={ev.id}
                                onClick={() => setSelectedEventId(ev.id)}
                                className={cn(
                                  "w-full text-left text-[10px] px-1 py-0.5 rounded border truncate transition-colors hover:opacity-80",
                                  kindColor(ev.kind)
                                )}
                              >
                                {!ev.allDay && `${ev.startTime} `}{kindEmoji(ev.kind)} {ev.title}
                              </button>
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-[9px] text-[var(--color-text-muted)] px-1">+{dayEvents.length - 3} more</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "agenda" && (
            <div className="p-4 max-w-2xl">
              <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">Next 14 Days</div>
              {agendaEvents.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-sm text-center py-8">No events in the next 14 days</p>
              ) : (
                <div className="space-y-2">
                  {agendaEvents.map((ev, i) => {
                    const prevDate = i > 0 ? agendaEvents[i - 1].date : null;
                    const showDateHeader = ev.date !== prevDate;
                    const evDate = new Date(ev.date + "T12:00");
                    return (
                      <div key={ev.id}>
                        {showDateHeader && (
                          <div className="text-xs font-semibold text-[var(--color-text-muted)] mt-4 mb-2 uppercase tracking-wider">
                            {evDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                          </div>
                        )}
                        <button
                          onClick={() => setSelectedEventId(ev.id === selectedEventId ? null : ev.id)}
                          className={cn(
                            "w-full text-left flex gap-3 p-3 rounded border transition-colors",
                            kindColor(ev.kind),
                            selectedEventId === ev.id ? "opacity-100" : "opacity-80 hover:opacity-100"
                          )}
                        >
                          <span className="text-lg flex-shrink-0">{kindEmoji(ev.kind)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">{ev.title}</div>
                            <div className="text-[10px] mt-0.5 flex items-center gap-2">
                              {ev.allDay ? <span>All day</span> : <span>{ev.startTime} – {ev.endTime}</span>}
                              {ev.recurring && <span>🔁 Recurring</span>}
                              <span>👥 {ev.attendees.slice(0, 3).join(", ")}{ev.attendees.length > 3 ? ` +${ev.attendees.length - 3}` : ""}</span>
                            </div>
                            {selectedEventId === ev.id && ev.description && (
                              <p className="text-xs mt-2">{ev.description}</p>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {viewMode === "week" && (
            <div className="p-4">
              <p className="text-[var(--color-text-muted)] text-sm text-center py-8">Week view — use Month or Agenda for full interaction</p>
              <div className="space-y-2">
                {events.filter(e => e.date >= "2026-02-22" && e.date <= "2026-02-28").toSorted((a,b) => (a.date+a.startTime).localeCompare(b.date+b.startTime)).map(ev => (
                  <div key={ev.id} className={cn("flex gap-3 p-3 rounded border", kindColor(ev.kind))}>
                    <span>{kindEmoji(ev.kind)}</span>
                    <div>
                      <div className="text-sm text-[var(--color-text-primary)]">{ev.title}</div>
                      <div className="text-[10px] text-[var(--color-text-secondary)]">{ev.date} · {ev.startTime}–{ev.endTime}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: event detail or new event form */}
      {(selectedEvent || showNewEvent) && (
        <div className="w-72 flex-shrink-0 border-l border-[var(--color-border)] flex flex-col bg-[var(--color-surface-1)]">
          {showNewEvent ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-sm text-[var(--color-text-primary)]">New Event</span>
                <button onClick={() => setShowNewEvent(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xs">✕</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Title</label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={e => setNewEventTitle(e.target.value)}
                    placeholder="Event title..."
                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs px-3 py-2 rounded focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Type</label>
                  <select
                    value={newEventKind}
                    onChange={e => setNewEventKind(e.target.value as EventKind)}
                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs px-3 py-2 rounded focus:outline-none focus:border-primary"
                  >
                    {kinds.map(k => <option key={k} value={k} className="capitalize">{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--color-text-muted)] mb-1">Date</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={e => setNewEventDate(e.target.value)}
                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs px-3 py-2 rounded focus:outline-none focus:border-primary"
                  />
                </div>
                <button
                  onClick={createEvent}
                  disabled={!newEventTitle.trim()}
                  className="w-full bg-primary hover:bg-primary disabled:opacity-40 text-[var(--color-text-primary)] text-xs font-medium py-2 rounded"
                >
                  Create Event
                </button>
              </div>
            </div>
          ) : selectedEvent ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg">{kindEmoji(selectedEvent.kind)}</span>
                <button onClick={() => setSelectedEventId(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xs">✕</button>
              </div>
              <h3 className="font-semibold text-[var(--color-text-primary)] text-sm mb-1">{selectedEvent.title}</h3>
              <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium capitalize", kindColor(selectedEvent.kind))}>
                {selectedEvent.kind}
              </span>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Date & Time</div>
                  <div className="text-xs text-[var(--color-text-primary)]">
                    {selectedEvent.date}
                    {!selectedEvent.allDay && ` · ${selectedEvent.startTime} – ${selectedEvent.endTime}`}
                    {selectedEvent.allDay && " · All day"}
                    {selectedEvent.recurring && " 🔁"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Attendees ({selectedEvent.attendees.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedEvent.attendees.map(a => (
                      <span key={a} className="text-[10px] bg-[var(--color-surface-2)] text-[var(--color-text-primary)] px-2 py-0.5 rounded">{a}</span>
                    ))}
                  </div>
                </div>
                {selectedEvent.description && (
                  <div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Description</div>
                    <p className="text-xs text-[var(--color-text-primary)]">{selectedEvent.description}</p>
                  </div>
                )}
                <button
                  onClick={() => setSelectedEventId(null)}
                  className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] hover:border-[var(--color-surface-3)] py-1.5 rounded transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
