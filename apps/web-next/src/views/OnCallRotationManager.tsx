import React, { useState } from "react";
import { cn } from "../lib/utils";

type ShiftStatus = "active" | "upcoming" | "past";
type EscalationPolicy = "immediate" | "15min" | "30min" | "1hr";
type AlertChannel = "phone" | "sms" | "slack" | "email" | "pagerduty";

interface OnCallPerson {
  id: string;
  name: string;
  email: string;
  timezone: string;
  phone: string;
  avatarInitials: string;
  avatarColor: string;
  team: string;
  role: string;
  alertChannels: AlertChannel[];
  incidentsThisMonth: number;
  avgResponseMin: number;
  lastAck: string;
}

interface Shift {
  id: string;
  personId: string;
  rotationId: string;
  start: string;
  end: string;
  status: ShiftStatus;
  incidentCount: number;
  acknowledged: boolean;
}

interface Rotation {
  id: string;
  name: string;
  team: string;
  currentPersonId: string;
  nextPersonId: string;
  escalationPolicy: EscalationPolicy;
  handoffDay: string;
  handoffTime: string;
  members: string[];
  alertCount: number;
  mttrMin: number;
}

interface Incident {
  id: string;
  title: string;
  severity: "sev1" | "sev2" | "sev3";
  status: "open" | "acked" | "resolved";
  assignedTo: string;
  rotationId: string;
  firedAt: string;
  ackedAt: string | null;
  resolvedAt: string | null;
  ackTimeMin: number | null;
  resolveTimeMin: number | null;
}

const PEOPLE: OnCallPerson[] = [
  { id: "p1", name: "Alice Nguyen", email: "alice@company.com", timezone: "US/Pacific (UTC-8)", phone: "+1-555-0101", avatarInitials: "AN", avatarColor: "bg-indigo-600", team: "Platform", role: "Staff Engineer", alertChannels: ["phone", "sms", "pagerduty"], incidentsThisMonth: 7, avgResponseMin: 3.2, lastAck: "2h ago" },
  { id: "p2", name: "Bob Martinez", email: "bob@company.com", timezone: "US/Eastern (UTC-5)", phone: "+1-555-0102", avatarInitials: "BM", avatarColor: "bg-emerald-600", team: "Platform", role: "Senior Engineer", alertChannels: ["phone", "slack", "email"], incidentsThisMonth: 4, avgResponseMin: 7.8, lastAck: "1d ago" },
  { id: "p3", name: "Carol Kim", email: "carol@company.com", timezone: "Europe/London (UTC+0)", phone: "+44-20-0103", avatarInitials: "CK", avatarColor: "bg-purple-600", team: "Backend", role: "Principal Engineer", alertChannels: ["pagerduty", "sms"], incidentsThisMonth: 11, avgResponseMin: 2.1, lastAck: "4h ago" },
  { id: "p4", name: "Dave Patel", email: "dave@company.com", timezone: "Asia/Kolkata (UTC+5:30)", phone: "+91-98-0104", avatarInitials: "DP", avatarColor: "bg-amber-600", team: "Data", role: "Data Engineer", alertChannels: ["phone", "slack"], incidentsThisMonth: 2, avgResponseMin: 9.4, lastAck: "3d ago" },
  { id: "p5", name: "Eve Chen", email: "eve@company.com", timezone: "US/Pacific (UTC-8)", phone: "+1-555-0105", avatarInitials: "EC", avatarColor: "bg-rose-600", team: "Backend", role: "Engineer", alertChannels: ["pagerduty", "email"], incidentsThisMonth: 6, avgResponseMin: 5.3, lastAck: "6h ago" },
];

const ROTATIONS: Rotation[] = [
  { id: "rot1", name: "Platform Primary", team: "Platform", currentPersonId: "p1", nextPersonId: "p2", escalationPolicy: "15min", handoffDay: "Monday", handoffTime: "09:00", members: ["p1", "p2", "p5"], alertCount: 42, mttrMin: 18 },
  { id: "rot2", name: "Backend On-Call", team: "Backend", currentPersonId: "p3", nextPersonId: "p5", escalationPolicy: "immediate", handoffDay: "Wednesday", handoffTime: "08:00", members: ["p3", "p5"], alertCount: 28, mttrMin: 24 },
  { id: "rot3", name: "Data Team", team: "Data", currentPersonId: "p4", nextPersonId: "p1", escalationPolicy: "30min", handoffDay: "Friday", handoffTime: "18:00", members: ["p4", "p1"], alertCount: 9, mttrMin: 45 },
];

const SHIFTS: Shift[] = [
  { id: "s1", personId: "p1", rotationId: "rot1", start: "Mon Feb 17 09:00", end: "Mon Feb 24 09:00", status: "active", incidentCount: 7, acknowledged: true },
  { id: "s2", personId: "p2", rotationId: "rot1", start: "Mon Feb 24 09:00", end: "Mon Mar 03 09:00", status: "upcoming", incidentCount: 0, acknowledged: false },
  { id: "s3", personId: "p3", rotationId: "rot2", start: "Wed Feb 19 08:00", end: "Wed Feb 26 08:00", status: "active", incidentCount: 11, acknowledged: true },
  { id: "s4", personId: "p5", rotationId: "rot2", start: "Wed Feb 26 08:00", end: "Wed Mar 05 08:00", status: "upcoming", incidentCount: 0, acknowledged: false },
  { id: "s5", personId: "p4", rotationId: "rot3", start: "Fri Feb 14 18:00", end: "Fri Feb 21 18:00", status: "active", incidentCount: 2, acknowledged: true },
  { id: "s6", personId: "p1", rotationId: "rot3", start: "Fri Feb 21 18:00", end: "Fri Feb 28 18:00", status: "upcoming", incidentCount: 0, acknowledged: false },
  { id: "s7", personId: "p5", rotationId: "rot1", start: "Mon Feb 10 09:00", end: "Mon Feb 17 09:00", status: "past", incidentCount: 4, acknowledged: true },
  { id: "s8", personId: "p3", rotationId: "rot2", start: "Wed Feb 12 08:00", end: "Wed Feb 19 08:00", status: "past", incidentCount: 8, acknowledged: true },
];

const INCIDENTS: Incident[] = [
  { id: "i1", title: "High Error Rate on API Gateway", severity: "sev1", status: "acked", assignedTo: "p1", rotationId: "rot1", firedAt: "Today 10:34", ackedAt: "Today 10:37", resolvedAt: null, ackTimeMin: 3, resolveTimeMin: null },
  { id: "i2", title: "DB Connection Pool Saturation", severity: "sev1", status: "resolved", assignedTo: "p1", rotationId: "rot1", firedAt: "Today 09:12", ackedAt: "Today 09:15", resolvedAt: "Today 09:44", ackTimeMin: 3, resolveTimeMin: 32 },
  { id: "i3", title: "Memory Anomaly in ML Service", severity: "sev2", status: "resolved", assignedTo: "p3", rotationId: "rot2", firedAt: "Today 08:03", ackedAt: "Today 08:05", resolvedAt: "Today 08:27", ackTimeMin: 2, resolveTimeMin: 24 },
  { id: "i4", title: "P95 Latency Spike User Service", severity: "sev2", status: "open", assignedTo: "p1", rotationId: "rot1", firedAt: "Today 10:39", ackedAt: null, resolvedAt: null, ackTimeMin: null, resolveTimeMin: null },
  { id: "i5", title: "ETL Pipeline Failure", severity: "sev3", status: "resolved", assignedTo: "p4", rotationId: "rot3", firedAt: "Yesterday 14:22", ackedAt: "Yesterday 14:31", resolvedAt: "Yesterday 16:48", ackTimeMin: 9, resolveTimeMin: 146 },
];

const channelIcon: Record<AlertChannel, string> = {
  phone: "📞", sms: "💬", slack: "💙", email: "✉️", pagerduty: "📟",
};

const severityBadge: Record<string, string> = {
  sev1: "bg-rose-500/20 border-rose-500/40 text-rose-300",
  sev2: "bg-orange-500/15 border-orange-500/30 text-orange-400",
  sev3: "bg-amber-500/10 border-amber-500/20 text-amber-400",
};

const incidentStatusBadge: Record<string, string> = {
  open:     "bg-rose-500/15 border-rose-500/30 text-rose-400",
  acked:    "bg-sky-500/15 border-sky-500/30 text-sky-400",
  resolved: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
};

const escalationLabel: Record<EscalationPolicy, string> = {
  immediate: "Immediate",
  "15min": "After 15 min",
  "30min": "After 30 min",
  "1hr": "After 1 hr",
};

const shiftStatusBadge: Record<ShiftStatus, string> = {
  active:   "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  upcoming: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
  past:     "bg-zinc-700/40 border-zinc-600 text-zinc-500",
};

const getPerson = (id: string) => PEOPLE.find(p => p.id === id);
const getRotation = (id: string) => ROTATIONS.find(r => r.id === id);

export default function OnCallRotationManager() {
  const [tab, setTab] = useState<"rotations" | "schedule" | "incidents" | "team">("rotations");
  const [selectedRotation, setSelectedRotation] = useState<Rotation | null>(ROTATIONS[0]);

  const activeIncidents = INCIDENTS.filter(i => i.status === "open" || i.status === "acked");
  const totalAlerts = ROTATIONS.reduce((s, r) => s + r.alertCount, 0);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">On-Call Rotation Manager</h1>
            <p className="text-xs text-zinc-400 mt-0.5">{ROTATIONS.length} rotations · {PEOPLE.length} on-call engineers</p>
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors">+ New Rotation</button>
        </div>
        {/* Stats */}
        <div className="flex gap-4 mt-3">
          {[
            { label: "Active Incidents", value: activeIncidents.length, color: activeIncidents.length > 0 ? "text-rose-400" : "text-emerald-400", pulse: activeIncidents.length > 0 },
            { label: "Alerts This Month", value: totalAlerts, color: "text-zinc-300", pulse: false },
            { label: "Avg MTTR", value: `${Math.round(ROTATIONS.reduce((s, r) => s + r.mttrMin, 0) / ROTATIONS.length)}m`, color: "text-white", pulse: false },
            { label: "On-Call Now", value: ROTATIONS.length, color: "text-indigo-400", pulse: false },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              {s.pulse && <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />}
              <div>
                <span className={cn("text-base font-bold", s.color)}>{s.value}</span>
                <span className="text-zinc-500 text-xs ml-1.5">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(["rotations", "schedule", "incidents", "team"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800")}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "incidents" && activeIncidents.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-[9px] font-bold text-white">{activeIncidents.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Rotations Tab */}
        {tab === "rotations" && (
          <div className="flex h-full">
            {/* Left: rotation list */}
            <div className="w-[44%] flex-none border-r border-zinc-800 overflow-y-auto">
              {ROTATIONS.map(rot => {
                const current = getPerson(rot.currentPersonId);
                const next = getPerson(rot.nextPersonId);
                return (
                  <button key={rot.id} onClick={() => setSelectedRotation(rot)} className={cn(
                    "w-full text-left px-4 py-4 border-b border-zinc-800/60 hover:bg-zinc-900 transition-colors",
                    selectedRotation?.id === rot.id && "bg-zinc-900 border-l-2 border-l-indigo-500"
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white text-sm">{rot.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{rot.team} · Escalation: {escalationLabel[rot.escalationPolicy]}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-zinc-400">{rot.alertCount} alerts</div>
                        <div className="text-zinc-600">MTTR {rot.mttrMin}m</div>
                      </div>
                    </div>
                    {current && (
                      <div className="flex items-center gap-2 mt-3">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-none", current.avatarColor)}>{current.avatarInitials}</div>
                        <div>
                          <div className="text-xs text-white">{current.name}</div>
                          <div className="text-[10px] text-emerald-400">On-call now</div>
                        </div>
                        {next && (
                          <>
                            <div className="text-zinc-700 mx-1">→</div>
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-none opacity-50", next.avatarColor)}>{next.avatarInitials}</div>
                            <div className="text-[10px] text-zinc-500">{next.name} next</div>
                          </>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Right: rotation detail */}
            <div className="flex-1 overflow-y-auto p-5">
              {selectedRotation && (() => {
                const current = getPerson(selectedRotation.currentPersonId);
                const next = getPerson(selectedRotation.nextPersonId);
                const members = selectedRotation.members.map(id => getPerson(id)).filter(Boolean) as OnCallPerson[];
                const shifts = SHIFTS.filter(s => s.rotationId === selectedRotation.id);
                return (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-base font-semibold text-white">{selectedRotation.name}</h2>
                      <p className="text-xs text-zinc-500 mt-1">Team: {selectedRotation.team} · Handoff: {selectedRotation.handoffDay} at {selectedRotation.handoffTime}</p>
                    </div>
                    {/* Current on-call */}
                    {current && (
                      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4">
                        <div className="text-xs text-indigo-400 font-medium mb-2">Currently On-Call</div>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold", current.avatarColor)}>{current.avatarInitials}</div>
                          <div>
                            <div className="font-semibold text-white">{current.name}</div>
                            <div className="text-xs text-zinc-400">{current.timezone}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              {current.alertChannels.map(ch => (
                                <span key={ch} title={ch}>{channelIcon[ch]}</span>
                              ))}
                            </div>
                          </div>
                          <div className="ml-auto text-right text-xs">
                            <div className="text-white font-semibold">{current.avgResponseMin}m</div>
                            <div className="text-zinc-500">avg response</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Next on-call */}
                    {next && (
                      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                        <div className="text-xs text-zinc-500 font-medium mb-2">Next On-Call ({selectedRotation.handoffDay})</div>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold", next.avatarColor)}>{next.avatarInitials}</div>
                          <div>
                            <div className="text-sm font-medium text-white">{next.name}</div>
                            <div className="text-xs text-zinc-500">{next.timezone}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Escalation */}
                    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                      <div className="text-xs font-medium text-zinc-400 mb-2">Escalation Policy</div>
                      <div className="text-sm text-white">{escalationLabel[selectedRotation.escalationPolicy]}</div>
                      <div className="text-xs text-zinc-500 mt-1">After no acknowledgment, page all rotation members</div>
                    </div>
                    {/* Shift history */}
                    <div>
                      <div className="text-xs font-medium text-zinc-400 mb-2">Shift Schedule</div>
                      <div className="space-y-1.5">
                        {shifts.map(shift => {
                          const person = getPerson(shift.personId);
                          return (
                            <div key={shift.id} className="flex items-center gap-3 bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-800">
                              {person && (
                                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-none", person.avatarColor)}>{person.avatarInitials}</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-zinc-300">{person?.name}</div>
                                <div className="text-[10px] text-zinc-600">{shift.start} – {shift.end}</div>
                              </div>
                              <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", shiftStatusBadge[shift.status])}>{shift.status}</span>
                              {shift.incidentCount > 0 && (
                                <span className="text-[10px] text-zinc-500">{shift.incidentCount} incidents</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Members */}
                    <div>
                      <div className="text-xs font-medium text-zinc-400 mb-2">Rotation Members</div>
                      <div className="flex gap-2 flex-wrap">
                        {members.map(m => (
                          <div key={m.id} className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-800">
                            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold", m.avatarColor)}>{m.avatarInitials}</div>
                            <span className="text-xs text-zinc-300">{m.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {tab === "schedule" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-2">
              {SHIFTS.sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : 0)).map(shift => {
                const person = getPerson(shift.personId);
                const rotation = getRotation(shift.rotationId);
                return (
                  <div key={shift.id} className={cn("bg-zinc-900 rounded-xl p-4 border",
                    shift.status === "active" ? "border-emerald-500/30" : "border-zinc-800"
                  )}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {person && (
                          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-none", person.avatarColor)}>{person.avatarInitials}</div>
                        )}
                        <div>
                          <div className="font-medium text-white text-sm">{person?.name}</div>
                          <div className="text-xs text-zinc-500">{rotation?.name}</div>
                          <div className="text-[10px] text-zinc-600 mt-0.5">{shift.start} → {shift.end}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {shift.incidentCount > 0 && (
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">{shift.incidentCount}</div>
                            <div className="text-[10px] text-zinc-600">incidents</div>
                          </div>
                        )}
                        <span className={cn("px-2 py-1 rounded border text-xs font-medium", shiftStatusBadge[shift.status])}>{shift.status}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Incidents Tab */}
        {tab === "incidents" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-2">
              {INCIDENTS.map(inc => {
                const person = getPerson(inc.assignedTo);
                const rotation = getRotation(inc.rotationId);
                return (
                  <div key={inc.id} className={cn("bg-zinc-900 rounded-xl p-4 border",
                    inc.status === "open" ? "border-rose-500/40" :
                    inc.status === "acked" ? "border-sky-500/30" : "border-zinc-800"
                  )}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-bold", severityBadge[inc.severity])}>{inc.severity.toUpperCase()}</span>
                          <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium", incidentStatusBadge[inc.status])}>{inc.status.toUpperCase()}</span>
                          <span className="text-[10px] text-zinc-600">{inc.firedAt}</span>
                        </div>
                        <div className="font-medium text-white text-sm">{inc.title}</div>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500">
                          {person && (
                            <span>Assigned: <span className="text-zinc-300">{person.name}</span></span>
                          )}
                          <span>·</span>
                          <span>{rotation?.name}</span>
                        </div>
                      </div>
                      <div className="flex gap-3 flex-none text-right text-xs">
                        {inc.ackTimeMin !== null && (
                          <div>
                            <div className={cn("font-semibold", inc.ackTimeMin <= 5 ? "text-emerald-400" : "text-amber-400")}>{inc.ackTimeMin}m</div>
                            <div className="text-zinc-600 text-[10px]">ack time</div>
                          </div>
                        )}
                        {inc.resolveTimeMin !== null && (
                          <div>
                            <div className="font-semibold text-white">{inc.resolveTimeMin}m</div>
                            <div className="text-zinc-600 text-[10px]">resolve</div>
                          </div>
                        )}
                        {inc.status === "open" && (
                          <button className="px-2.5 py-1 rounded bg-sky-500/15 border border-sky-500/30 text-sky-400 text-xs hover:bg-sky-500/25 transition-colors">Ack</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Team Tab */}
        {tab === "team" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-3">
              {PEOPLE.sort((a, b) => a.avgResponseMin - b.avgResponseMin).map(person => (
                <div key={person.id} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center font-bold flex-none", person.avatarColor)}>{person.avatarInitials}</div>
                      <div>
                        <div className="font-semibold text-white">{person.name}</div>
                        <div className="text-xs text-zinc-400">{person.role} · {person.team}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{person.timezone}</div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {person.alertChannels.map(ch => (
                            <span key={ch} className="text-base" title={ch}>{channelIcon[ch]}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-right text-xs">
                      <div>
                        <div className={cn("text-lg font-bold", person.avgResponseMin <= 5 ? "text-emerald-400" : "text-amber-400")}>{person.avgResponseMin}m</div>
                        <div className="text-zinc-600">avg response</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-white">{person.incidentsThisMonth}</div>
                        <div className="text-zinc-600">incidents/mo</div>
                      </div>
                    </div>
                  </div>
                  {/* Avg response bar */}
                  <div className="mt-3">
                    <div className="w-full bg-zinc-800 rounded-full h-1">
                      <div
                        className={cn("h-1 rounded-full", person.avgResponseMin <= 5 ? "bg-emerald-500" : "bg-amber-500")}
                        style={{ width: `${Math.min(100, (person.avgResponseMin / 15) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-1">Last acknowledged: {person.lastAck}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
