import { Brain, CheckCircle2, Route, Target } from "lucide-react";

export default function RoutingSelfEvalWorkbench() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Routing Self-Eval Workbench</h1>
          <p className="text-sm text-zinc-400">Track routing quality, confusion trends, and review-queue driven improvement loops.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Metric label="Mismatch Rate" value="9.8%" note="-2.5pt / 24h" />
          <Metric label="False Escalations" value="31" note="down from 44" />
          <Metric label="Open Reviews" value="27" note="8 high severity" />
          <Metric label="Resolved Today" value="54" note="78% same-day" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Route className="h-4 w-4 text-sky-400" />Tier confusion hotspots</h2>
            <ul className="space-y-2 text-sm">
              <li className="rounded-md border border-zinc-800 p-2">T1 → expected T3 escalate (status updates misread)</li>
              <li className="rounded-md border border-zinc-800 p-2">T2 → expected T1 handle (over-escalation on acknowledgements)</li>
              <li className="rounded-md border border-zinc-800 p-2">T1/T2 boundary noisy in release-thread chatter</li>
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Brain className="h-4 w-4 text-violet-400" />Self-eval actions</h2>
            <ul className="space-y-2 text-sm">
              <li className="rounded-md border border-zinc-800 p-2 flex items-center justify-between"><span>Refresh eval sample set</span><CheckCircle2 className="h-4 w-4 text-emerald-400" /></li>
              <li className="rounded-md border border-zinc-800 p-2 flex items-center justify-between"><span>Regenerate routing guidance hints</span><Target className="h-4 w-4 text-cyan-400" /></li>
              <li className="rounded-md border border-zinc-800 p-2 flex items-center justify-between"><span>Draft threshold patch from resolved reviews</span><CheckCircle2 className="h-4 w-4 text-emerald-400" /></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric(props: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="text-xs text-zinc-400">{props.label}</div>
      <div className="text-2xl font-semibold">{props.value}</div>
      <div className="text-xs text-zinc-500">{props.note}</div>
    </div>
  );
}
