import { AlertTriangle, DollarSign, Shield } from "lucide-react";

export default function BudgetGuardrailsCenter() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Budget Guardrails Center</h1>
          <p className="text-sm text-zinc-400">Provider budgets, anomaly thresholds, and operator controls in one place.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs text-zinc-400">Daily Spend</span><DollarSign className="h-4 w-4 text-emerald-400" /></div>
            <div className="text-2xl font-semibold">$438</div>
            <div className="text-xs text-amber-300">82% of daily budget used</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs text-zinc-400">Anomaly Risk</span><AlertTriangle className="h-4 w-4 text-amber-400" /></div>
            <div className="text-2xl font-semibold">Medium</div>
            <div className="text-xs text-zinc-400">Spend velocity elevated on Anthropic</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs text-zinc-400">Protection State</span><Shield className="h-4 w-4 text-sky-400" /></div>
            <div className="text-2xl font-semibold">Armed</div>
            <div className="text-xs text-zinc-400">Auto-throttle + routing fallback enabled</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <h2 className="font-semibold">Provider Caps</h2>
            {[
              ["Anthropic", "$230 / $250"],
              ["OpenAI", "$121 / $180"],
              ["OpenRouter", "$87 / $120"],
            ].map(([name, value]) => (
              <div key={name} className="rounded-md border border-zinc-800 p-2 text-sm flex justify-between">
                <span>{name}</span><span className="text-zinc-300">{value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <h2 className="font-semibold">Guardrail Knobs</h2>
            <label className="block text-sm">Auto throttle threshold<input type="range" defaultValue={80} className="w-full" /></label>
            <label className="block text-sm">Model downgrade trigger<input type="range" defaultValue={68} className="w-full" /></label>
            <label className="block text-sm">Alert sensitivity<select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 p-1"><option>Balanced</option><option>Aggressive</option></select></label>
          </div>
        </div>
      </div>
    </div>
  );
}
