import React, { useState } from "react";
import { cn } from "../lib/utils";

type TranslationStatus = "approved" | "pending" | "missing" | "outdated";

interface Locale {
  code: string;
  name: string;
  flag: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  coverage: number; // percent
  approvedCount: number;
  pendingCount: number;
  missingCount: number;
  translators: string[];
}

interface TranslationKey {
  id: string;
  key: string;
  namespace: string;
  defaultValue: string;
  description: string;
  usedIn: string[];
  interpolations: string[];
  translations: Record<string, { value: string; status: TranslationStatus; updatedAt: string; translatedBy?: string }>;
}

const LOCALES: Locale[] = [
  { code: "en", name: "English",    flag: "🇺🇸", nativeName: "English",    direction: "ltr", coverage: 100, approvedCount: 247, pendingCount: 0,  missingCount: 0,  translators: ["Luis"] },
  { code: "es", name: "Spanish",    flag: "🇪🇸", nativeName: "Español",    direction: "ltr", coverage: 94,  approvedCount: 232, pendingCount: 8,  missingCount: 7,  translators: ["Quinn"] },
  { code: "fr", name: "French",     flag: "🇫🇷", nativeName: "Français",   direction: "ltr", coverage: 87,  approvedCount: 215, pendingCount: 14, missingCount: 18, translators: ["Piper"] },
  { code: "de", name: "German",     flag: "🇩🇪", nativeName: "Deutsch",    direction: "ltr", coverage: 82,  approvedCount: 203, pendingCount: 11, missingCount: 33, translators: ["Wes"] },
  { code: "ja", name: "Japanese",   flag: "🇯🇵", nativeName: "日本語",      direction: "ltr", coverage: 71,  approvedCount: 175, pendingCount: 22, missingCount: 50, translators: ["Reed"] },
  { code: "ar", name: "Arabic",     flag: "🇸🇦", nativeName: "العربية",    direction: "rtl", coverage: 45,  approvedCount: 111, pendingCount: 18, missingCount: 118, translators: [] },
  { code: "zh", name: "Chinese",    flag: "🇨🇳", nativeName: "中文",        direction: "ltr", coverage: 63,  approvedCount: 156, pendingCount: 31, missingCount: 60, translators: ["Sam"] },
  { code: "pt", name: "Portuguese", flag: "🇧🇷", nativeName: "Português",  direction: "ltr", coverage: 88,  approvedCount: 217, pendingCount: 9,  missingCount: 21, translators: ["Quinn"] },
];

const TRANSLATION_KEYS: TranslationKey[] = [
  {
    id: "k1", key: "agent.status.active", namespace: "agent",
    defaultValue: "Active", description: "Status badge text for an active agent",
    usedIn: ["AgentDashboard", "AgentRoster", "StatusBadge"],
    interpolations: [],
    translations: {
      en: { value: "Active",    status: "approved", updatedAt: "2026-02-01", translatedBy: "Luis" },
      es: { value: "Activo",    status: "approved", updatedAt: "2026-02-02", translatedBy: "Quinn" },
      fr: { value: "Actif",     status: "approved", updatedAt: "2026-02-03", translatedBy: "Piper" },
      de: { value: "Aktiv",     status: "approved", updatedAt: "2026-02-04", translatedBy: "Wes" },
      ja: { value: "アクティブ", status: "approved", updatedAt: "2026-02-05", translatedBy: "Reed" },
      ar: { value: "نشط",       status: "approved", updatedAt: "2026-02-06" },
      zh: { value: "活跃",       status: "approved", updatedAt: "2026-02-07", translatedBy: "Sam" },
      pt: { value: "Ativo",     status: "approved", updatedAt: "2026-02-08", translatedBy: "Quinn" },
    },
  },
  {
    id: "k2", key: "agent.task.running_count", namespace: "agent",
    defaultValue: "{{count}} task running", description: "Shows how many tasks are currently running. Uses plural forms.",
    usedIn: ["AgentPulseMonitor", "AgentWorkload"],
    interpolations: ["count"],
    translations: {
      en: { value: "{{count}} task running",        status: "approved",  updatedAt: "2026-02-01", translatedBy: "Luis" },
      es: { value: "{{count}} tarea en ejecución",  status: "approved",  updatedAt: "2026-02-02", translatedBy: "Quinn" },
      fr: { value: "{{count}} tâche en cours",      status: "pending",   updatedAt: "2026-02-10", translatedBy: "Piper" },
      de: { value: "{{count}} Aufgabe läuft",        status: "approved",  updatedAt: "2026-02-04", translatedBy: "Wes" },
      ja: { value: "{{count}}件実行中",              status: "approved",  updatedAt: "2026-02-05", translatedBy: "Reed" },
      ar: { value: "",                               status: "missing",   updatedAt: "" },
      zh: { value: "{{count}}个任务运行中",           status: "pending",   updatedAt: "2026-02-15", translatedBy: "Sam" },
      pt: { value: "{{count}} tarefa em execução",  status: "approved",  updatedAt: "2026-02-08", translatedBy: "Quinn" },
    },
  },
  {
    id: "k3", key: "nav.dashboard", namespace: "navigation",
    defaultValue: "Dashboard", description: "Main navigation item for the dashboard",
    usedIn: ["Sidebar", "Breadcrumbs"],
    interpolations: [],
    translations: {
      en: { value: "Dashboard",    status: "approved", updatedAt: "2026-01-15", translatedBy: "Luis" },
      es: { value: "Panel",        status: "approved", updatedAt: "2026-01-16", translatedBy: "Quinn" },
      fr: { value: "Tableau de bord", status: "approved", updatedAt: "2026-01-17", translatedBy: "Piper" },
      de: { value: "Dashboard",    status: "approved", updatedAt: "2026-01-18", translatedBy: "Wes" },
      ja: { value: "ダッシュボード", status: "approved", updatedAt: "2026-01-19", translatedBy: "Reed" },
      ar: { value: "لوحة القيادة", status: "approved", updatedAt: "2026-01-20" },
      zh: { value: "仪表板",        status: "approved", updatedAt: "2026-01-21", translatedBy: "Sam" },
      pt: { value: "Painel",       status: "approved", updatedAt: "2026-01-22", translatedBy: "Quinn" },
    },
  },
  {
    id: "k4", key: "error.rate_limit", namespace: "errors",
    defaultValue: "Rate limit exceeded. Try again in {{seconds}} seconds.",
    description: "Error message when API rate limit is hit",
    usedIn: ["ApiPlayground", "LLMPlayground", "ErrorBoundary"],
    interpolations: ["seconds"],
    translations: {
      en: { value: "Rate limit exceeded. Try again in {{seconds}} seconds.", status: "approved", updatedAt: "2026-02-01", translatedBy: "Luis" },
      es: { value: "Límite de tasa superado. Inténtalo de nuevo en {{seconds}} segundos.", status: "approved", updatedAt: "2026-02-02", translatedBy: "Quinn" },
      fr: { value: "Limite de débit dépassée. Réessayez dans {{seconds}} secondes.", status: "approved", updatedAt: "2026-02-03", translatedBy: "Piper" },
      de: { value: "",            status: "missing", updatedAt: "" },
      ja: { value: "レート制限を超えました。{{seconds}}秒後に再試行してください。", status: "pending", updatedAt: "2026-02-18", translatedBy: "Reed" },
      ar: { value: "",            status: "missing", updatedAt: "" },
      zh: { value: "已超出速率限制。请在{{seconds}}秒后重试。", status: "approved", updatedAt: "2026-02-07", translatedBy: "Sam" },
      pt: { value: "Limite de taxa excedido. Tente novamente em {{seconds}} segundos.", status: "approved", updatedAt: "2026-02-08", translatedBy: "Quinn" },
    },
  },
  {
    id: "k5", key: "billing.plan.enterprise", namespace: "billing",
    defaultValue: "Enterprise", description: "Plan tier label for enterprise customers",
    usedIn: ["BillingSubscription", "PlanBadge", "UpgradeModal"],
    interpolations: [],
    translations: {
      en: { value: "Enterprise",   status: "approved", updatedAt: "2026-02-01", translatedBy: "Luis" },
      es: { value: "Empresarial",  status: "approved", updatedAt: "2026-02-02", translatedBy: "Quinn" },
      fr: { value: "Entreprise",   status: "approved", updatedAt: "2026-02-03", translatedBy: "Piper" },
      de: { value: "Unternehmen",  status: "approved", updatedAt: "2026-02-04", translatedBy: "Wes" },
      ja: { value: "エンタープライズ", status: "outdated", updatedAt: "2025-12-01", translatedBy: "Reed" },
      ar: { value: "المؤسسات",     status: "pending",  updatedAt: "2026-02-20" },
      zh: { value: "企业版",        status: "approved", updatedAt: "2026-02-07", translatedBy: "Sam" },
      pt: { value: "Empresarial",  status: "approved", updatedAt: "2026-02-08", translatedBy: "Quinn" },
    },
  },
  {
    id: "k6", key: "action.save_changes", namespace: "common",
    defaultValue: "Save Changes", description: "Common button label for saving",
    usedIn: ["Many views"],
    interpolations: [],
    translations: {
      en: { value: "Save Changes",      status: "approved", updatedAt: "2026-01-15", translatedBy: "Luis" },
      es: { value: "Guardar cambios",   status: "approved", updatedAt: "2026-01-16", translatedBy: "Quinn" },
      fr: { value: "Sauvegarder",       status: "approved", updatedAt: "2026-01-17", translatedBy: "Piper" },
      de: { value: "Änderungen speichern", status: "approved", updatedAt: "2026-01-18", translatedBy: "Wes" },
      ja: { value: "変更を保存",         status: "approved", updatedAt: "2026-01-19", translatedBy: "Reed" },
      ar: { value: "حفظ التغييرات",      status: "pending",  updatedAt: "2026-02-10" },
      zh: { value: "保存更改",            status: "approved", updatedAt: "2026-01-21", translatedBy: "Sam" },
      pt: { value: "Salvar alterações",  status: "approved", updatedAt: "2026-01-22", translatedBy: "Quinn" },
    },
  },
];

const STATUS_CONFIG: Record<TranslationStatus, { label: string; color: string; bg: string }> = {
  approved: { label: "Approved", color: "text-emerald-400", bg: "bg-emerald-900/30 border-emerald-800" },
  pending:  { label: "Pending",  color: "text-amber-400",   bg: "bg-amber-900/30 border-amber-800" },
  missing:  { label: "Missing",  color: "text-rose-400",    bg: "bg-rose-900/30 border-rose-800" },
  outdated: { label: "Outdated", color: "text-orange-400",  bg: "bg-orange-900/30 border-orange-800" },
};

type Tab = "locales" | "keys" | "export";

export default function LocalizationManager() {
  const [tab, setTab] = useState<Tab>("locales");
  const [selectedLocale, setSelectedLocale] = useState<Locale | null>(null);
  const [selectedKey, setSelectedKey] = useState<TranslationKey | null>(null);
  const [nsFilter, setNsFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<TranslationStatus | "all">("all");
  const [editingLocale, setEditingLocale] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const namespaces = Array.from(new Set(TRANSLATION_KEYS.map(k => k.namespace)));

  const filteredKeys = TRANSLATION_KEYS.filter(k => {
    if (nsFilter !== "all" && k.namespace !== nsFilter) {return false;}
    if (statusFilter !== "all" && selectedLocale) {
      const t = k.translations[selectedLocale.code];
      if (!t || t.status !== statusFilter) {return false;}
    }
    return true;
  });

  const totalCoverage = Math.round(LOCALES.reduce((a, l) => a + l.coverage, 0) / LOCALES.length);

  const tabs: { id: Tab; label: string }[] = [
    { id: "locales", label: "🌍 Locales" },
    { id: "keys",    label: "🔑 Keys" },
    { id: "export",  label: "📦 Export" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Localization Manager</h1>
            <p className="text-zinc-400 text-sm mt-1">
              {LOCALES.length} locales · {TRANSLATION_KEYS.length} keys shown · {totalCoverage}% avg coverage
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-400">{totalCoverage}%</div>
            <div className="text-xs text-zinc-500">avg coverage</div>
          </div>
        </div>

        {/* Coverage bar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span>Overall Translation Coverage</span>
            <span>{totalCoverage}% across {LOCALES.length} languages</span>
          </div>
          <div className="flex h-6 gap-0.5 rounded overflow-hidden">
            {LOCALES.map(l => (
              <div
                key={l.code}
                title={`${l.name}: ${l.coverage}%`}
                className={cn("flex items-center justify-center text-xs", l.coverage === 100 ? "bg-emerald-500" : l.coverage >= 80 ? "bg-indigo-500" : l.coverage >= 60 ? "bg-amber-500" : "bg-rose-500")}
                style={{ width: `${100 / LOCALES.length}%` }}
              >
                {l.flag}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-zinc-800 mb-5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
              tab === t.id ? "text-white bg-zinc-800 border border-b-0 border-zinc-700" : "text-zinc-400 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Locales Tab */}
      {tab === "locales" && (
        <div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            {LOCALES.map(locale => (
              <div
                key={locale.code}
                onClick={() => setSelectedLocale(selectedLocale?.code === locale.code ? null : locale)}
                className={cn(
                  "bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-colors",
                  selectedLocale?.code === locale.code ? "border-indigo-600" : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{locale.flag}</span>
                    <div>
                      <div className="font-semibold text-white">{locale.name}</div>
                      <div className="text-xs text-zinc-500">{locale.nativeName} · {locale.code} · {locale.direction.toUpperCase()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-xl font-bold", locale.coverage === 100 ? "text-emerald-400" : locale.coverage >= 80 ? "text-indigo-400" : locale.coverage >= 60 ? "text-amber-400" : "text-rose-400")}>
                      {locale.coverage}%
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-full h-2 mb-3">
                  <div
                    className={cn("h-full rounded-full", locale.coverage === 100 ? "bg-emerald-500" : locale.coverage >= 80 ? "bg-indigo-500" : locale.coverage >= 60 ? "bg-amber-500" : "bg-rose-500")}
                    style={{ width: `${locale.coverage}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div className="bg-zinc-800 rounded p-1.5">
                    <div className="text-emerald-400 font-bold">{locale.approvedCount}</div>
                    <div className="text-zinc-500">Approved</div>
                  </div>
                  <div className="bg-zinc-800 rounded p-1.5">
                    <div className="text-amber-400 font-bold">{locale.pendingCount}</div>
                    <div className="text-zinc-500">Pending</div>
                  </div>
                  <div className="bg-zinc-800 rounded p-1.5">
                    <div className="text-rose-400 font-bold">{locale.missingCount}</div>
                    <div className="text-zinc-500">Missing</div>
                  </div>
                </div>

                {locale.translators.length > 0 && (
                  <div className="mt-2 text-xs text-zinc-500">
                    Translators: {locale.translators.join(", ")}
                  </div>
                )}
                {locale.translators.length === 0 && (
                  <div className="mt-2 text-xs text-rose-400">⚠️ No translators assigned</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keys Tab */}
      {tab === "keys" && (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex gap-1">
              <span className="text-xs text-zinc-500 self-center mr-1">Namespace:</span>
              {["all", ...namespaces].map(ns => (
                <button
                  key={ns}
                  onClick={() => setNsFilter(ns)}
                  className={cn("px-2 py-1 text-xs rounded transition-colors", nsFilter === ns ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white")}
                >
                  {ns === "all" ? "All" : ns}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <span className="text-xs text-zinc-500 self-center mr-1">Show locale:</span>
              {LOCALES.map(l => (
                <button
                  key={l.code}
                  onClick={() => setSelectedLocale(selectedLocale?.code === l.code ? null : l)}
                  className={cn("px-2 py-1 text-xs rounded transition-colors", selectedLocale?.code === l.code ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white")}
                >
                  {l.flag} {l.code}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredKeys.map(key => (
              <div
                key={key.id}
                onClick={() => setSelectedKey(selectedKey?.id === key.id ? null : key)}
                className={cn(
                  "bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-colors",
                  selectedKey?.id === key.id ? "border-indigo-600" : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-indigo-400">{key.key}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{key.namespace}</span>
                      {key.interpolations.length > 0 && (
                        <span className="text-xs text-sky-400">variables: {key.interpolations.map(v => `{{${v}}}`).join(", ")}</span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      Default: <span className="text-zinc-300">"{key.defaultValue}"</span>
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">{key.description}</div>
                  </div>

                  {/* Status indicators for each locale */}
                  <div className="flex gap-1 shrink-0">
                    {LOCALES.map(l => {
                      const t = key.translations[l.code];
                      const s = t?.status ?? "missing";
                      return (
                        <div
                          key={l.code}
                          title={`${l.name}: ${s}`}
                          className={cn("w-5 h-5 rounded flex items-center justify-center text-xs", STATUS_CONFIG[s].bg)}
                        >
                          {l.flag}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedKey?.id === key.id && (
                  <div className="mt-4 border-t border-zinc-800 pt-4" onClick={e => e.stopPropagation()}>
                    <div className="space-y-2">
                      {LOCALES.map(locale => {
                        const t = key.translations[locale.code];
                        const isEditing = editingLocale === locale.code;
                        return (
                          <div key={locale.code} className="flex items-start gap-3 bg-zinc-950 rounded-lg p-3">
                            <span className="text-xl shrink-0">{locale.flag}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-zinc-300">{locale.name}</span>
                                <span className={cn("text-xs px-1.5 py-0.5 rounded border", STATUS_CONFIG[t?.status ?? "missing"].color, STATUS_CONFIG[t?.status ?? "missing"].bg)}>
                                  {STATUS_CONFIG[t?.status ?? "missing"].label}
                                </span>
                                {t?.translatedBy && <span className="text-xs text-zinc-500">by {t.translatedBy}</span>}
                              </div>
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    className="flex-1 bg-zinc-900 border border-indigo-600 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none"
                                    autoFocus
                                  />
                                  <button onClick={() => setEditingLocale(null)} className="px-2 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white">Save</button>
                                  <button onClick={() => setEditingLocale(null)} className="px-2 py-1 text-xs rounded bg-zinc-700 text-zinc-300">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className={cn("text-sm font-mono flex-1", t?.value ? "text-zinc-200" : "text-zinc-600 italic")}>
                                    {t?.value || "(not translated)"}
                                  </span>
                                  <button
                                    onClick={() => { setEditingLocale(locale.code); setEditValue(t?.value ?? ""); }}
                                    className="text-xs text-zinc-500 hover:text-indigo-400 px-2 py-0.5 rounded hover:bg-zinc-800 transition-colors"
                                  >
                                    ✏️ Edit
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Tab */}
      {tab === "export" && (
        <div className="space-y-4">
          <div className="text-sm text-zinc-400 mb-4">Export translation files for integration with i18next, react-intl, or custom frameworks</div>
          <div className="grid grid-cols-2 gap-4">
            {LOCALES.map(locale => (
              <div key={locale.code} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{locale.flag}</span>
                    <div>
                      <div className="font-medium text-white">{locale.name}</div>
                      <div className="text-xs text-zinc-500">{locale.code}.json</div>
                    </div>
                  </div>
                  <div className={cn("text-sm font-bold", locale.coverage === 100 ? "text-emerald-400" : locale.coverage >= 80 ? "text-indigo-400" : "text-amber-400")}>
                    {locale.coverage}%
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors">
                    📥 Download
                  </button>
                  <button className="flex-1 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors">
                    📋 Copy JSON
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Export all */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="text-sm font-semibold text-zinc-300 mb-3">Export All Locales</div>
            <div className="flex gap-3">
              {["i18next (JSON)", "react-intl (AST)", "XLIFF 2.0", "PO Format"].map(fmt => (
                <button key={fmt} className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">
                  📦 {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
