import React, { useState, useCallback } from "react";
import { cn } from "../lib/utils";

type Section = "general" | "security" | "appearance" | "notifications" | "billing" | "api" | "data" | "danger";

export default function WorkspaceSettings() {
  const [activeSection, setActiveSection] = useState<Section>("general");
  const [isSaved, setIsSaved] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const workspaceName = "OpenClaw Horizon";

  const handleSave = useCallback(() => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  }, []);

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: "general", label: "General", icon: "⚙️" },
    { id: "security", label: "Security", icon: "🛡️" },
    { id: "appearance", label: "Appearance", icon: "🎨" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
    { id: "billing", label: "Billing", icon: "💳" },
    { id: "api", label: "API", icon: "🔌" },
    { id: "data", label: "Data", icon: "📊" },
    { id: "danger", label: "Danger Zone", icon: "⚠️" },
  ];

  return (
    <div className="flex h-full min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] font-sans selection:bg-indigo-500/30">
      {/* Sidebar Navigation */}
      <nav className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface-0)] p-4 sticky top-0 h-screen overflow-y-auto" aria-label="Settings Navigation">
        <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4 px-2">Workspace Settings</h2>
        <ul className="space-y-1" role="tablist">
          {sections.map((section) => (
            <li key={section.id} role="none">
              <button
                role="tab"
                aria-selected={activeSection === section.id}
                aria-controls={`${section.id}-panel`}
                id={`${section.id}-tab`}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  activeSection === section.id
                    ? "bg-[var(--color-surface-1)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)]/50"
                )}
              >
                <span role="img" aria-hidden="true">{section.icon}</span>
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content Area */}
      <main className="flex-1 p-8 overflow-y-auto" id="settings-content">
        <div className="max-w-2xl mx-auto">
          {activeSection === "general" && (
            <section id="general-panel" role="tabpanel" aria-labelledby="general-tab" className="space-y-6">
              <Header title="General Settings" description="Manage your workspace identity and localization." />
              <Card>
                <div className="space-y-4">
                  <Field label="Workspace Name" id="ws-name" defaultValue={workspaceName} />
                  <Field label="Workspace Slug" id="ws-slug" prefix="openclaw.io/" defaultValue="horizon" />
                  <div className="grid grid-cols-2 gap-4">
                    <SelectField label="Timezone" id="ws-timezone" options={["(GMT-07:00) Mountain Time", "(GMT-08:00) Pacific Time", "(GMT+00:00) UTC"]} defaultValue="(GMT-07:00) Mountain Time" />
                    <SelectField label="Language" id="ws-lang" options={["English (US)", "Spanish", "French", "German"]} defaultValue="English (US)" />
                  </div>
                </div>
              </Card>
              <SaveButton onSave={handleSave} isSaved={isSaved} />
            </section>
          )}

          {activeSection === "security" && (
            <section id="security-panel" role="tabpanel" aria-labelledby="security-tab" className="space-y-6">
              <Header title="Security" description="Control access and authentication policies." />
              <Card>
                <div className="space-y-6">
                  <SwitchField label="Require Two-Factor Authentication" description="All members must have 2FA enabled." id="sec-2fa" defaultChecked />
                  <SelectField label="Password Policy" id="sec-pass" options={["Standard (8+ chars)", "Strong (12+ chars, symbols)", "Enterprise (SSO Only)"]} defaultValue="Strong (12+ chars, symbols)" />
                  <Field label="Session Timeout (hours)" id="sec-timeout" type="number" defaultValue="24" />
                  <div className="space-y-2">
                    <label htmlFor="sec-ips" className="block text-sm font-medium text-[var(--color-text-secondary)]">IP Allowlist</label>
                    <textarea
                      id="sec-ips"
                      className="w-full bg-[var(--color-surface-2)] border-[var(--color-border)] rounded-md p-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none min-h-[100px]"
                      placeholder="Enter IP addresses (one per line)"
                      defaultValue={"192.168.1.1\n10.0.0.0/24"}
                    />
                  </div>
                </div>
              </Card>
              <SaveButton onSave={handleSave} isSaved={isSaved} />
            </section>
          )}

          {activeSection === "appearance" && (
            <section id="appearance-panel" role="tabpanel" aria-labelledby="appearance-tab" className="space-y-6">
              <Header title="Appearance" description="Customize how the dashboard looks and feels." />
              <Card>
                <div className="space-y-6">
                  <SelectField label="Theme Preset" id="app-theme" options={["Midnight (Default)", "Zinc", "High Contrast", "System"]} defaultValue="Midnight (Default)" />
                  <div className="space-y-2">
                    <span className="block text-sm font-medium text-[var(--color-text-secondary)]">Interface Density</span>
                    <div className="flex gap-2">
                      {["Compact", "Comfortable", "Spacious"].map((d) => (
                        <button key={d} className={cn("px-4 py-2 rounded-md text-sm border border-[var(--color-border)] transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none", d === "Comfortable" ? "bg-indigo-600 border-indigo-500" : "bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)]")}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SelectField label="Date Format" id="app-date" options={["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]} defaultValue="MM/DD/YYYY" />
                </div>
              </Card>
              <SaveButton onSave={handleSave} isSaved={isSaved} />
            </section>
          )}

          {activeSection === "notifications" && (
            <section id="notifications-panel" role="tabpanel" aria-labelledby="notifications-tab" className="space-y-6">
              <Header title="Notifications" description="Manage how and when you receive updates." />
              <Card>
                <div className="space-y-6">
                  <SwitchField label="Email Digest" description="Receive a weekly summary of workspace activity." id="nt-email" defaultChecked />
                  <SwitchField label="Slack Alerts" description="Post critical alerts to the #ops channel." id="nt-slack" defaultChecked />
                  <Field label="Webhook URL" id="nt-webhook" placeholder="https://hooks.example.com/..." />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Quiet Hours Start" id="nt-quiet-start" type="time" defaultValue="22:00" />
                    <Field label="Quiet Hours End" id="nt-quiet-end" type="time" defaultValue="08:00" />
                  </div>
                </div>
              </Card>
              <SaveButton onSave={handleSave} isSaved={isSaved} />
            </section>
          )}

          {activeSection === "billing" && (
            <section id="billing-panel" role="tabpanel" aria-labelledby="billing-tab" className="space-y-6">
              <Header title="Billing & Subscription" description="Manage your plan and payment details." />
              <Card>
                <div className="space-y-6">
                  <div className="p-4 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold text-indigo-400 uppercase tracking-tight">Active Plan</p>
                      <p className="text-xl font-bold">Enterprise Pro</p>
                    </div>
                    <span className="px-3 py-1 bg-indigo-500 text-xs font-bold rounded-full">ANNUAL</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-[var(--color-border)]">
                      <span className="text-sm text-[var(--color-text-secondary)]">Payment Method</span>
                      <span className="text-sm font-mono">•••• 4242 (Visa)</span>
                    </div>
                    <Field label="Billing Contact Email" id="bil-email" defaultValue="billing@openclaw.io" />
                  </div>
                </div>
              </Card>
              <SaveButton onSave={handleSave} isSaved={isSaved} />
            </section>
          )}

          {activeSection === "api" && (
            <section id="api-panel" role="tabpanel" aria-labelledby="api-tab" className="space-y-6">
              <Header title="API Configuration" description="Configure developer settings and access limits." />
              <Card>
                <div className="space-y-6">
                  <Field label="Global Rate Limit (req/min)" id="api-rate" type="number" defaultValue="5000" />
                  <div className="space-y-2">
                    <label htmlFor="api-cors" className="block text-sm font-medium text-[var(--color-text-secondary)]">Allowed CORS Origins</label>
                    <textarea
                      id="api-cors"
                      className="w-full bg-[var(--color-surface-2)] border-[var(--color-border)] rounded-md p-2 text-sm focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none min-h-[80px]"
                      placeholder="https://app.example.com"
                      defaultValue="https://*.openclaw.io"
                    />
                  </div>
                  <SelectField label="API Version Preference" id="api-ver" options={["2024-01 (LTS)", "2024-05 (Stable)", "Beta"]} defaultValue="2024-01 (LTS)" />
                </div>
              </Card>
              <SaveButton onSave={handleSave} isSaved={isSaved} />
            </section>
          )}

          {activeSection === "data" && (
            <section id="data-panel" role="tabpanel" aria-labelledby="data-tab" className="space-y-6">
              <Header title="Data Management" description="Control data retention and portability." />
              <Card>
                <div className="space-y-6">
                  <SelectField label="Log Retention Policy" id="dt-ret" options={["30 Days", "90 Days", "1 Year", "Indefinite"]} defaultValue="90 Days" />
                  <div className="p-4 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">Export Workspace Data</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">Generate a JSON export of all workspace settings and logs.</p>
                    </div>
                    <button className="px-3 py-1.5 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] rounded text-xs font-medium focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none">Request Export</button>
                  </div>
                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-muted)] italic">OpenClaw is GDPR and SOC2 compliant. All data processing follows our privacy policy.</p>
                  </div>
                </div>
              </Card>
              <SaveButton onSave={handleSave} isSaved={isSaved} />
            </section>
          )}

          {activeSection === "danger" && (
            <section id="danger-panel" role="tabpanel" aria-labelledby="danger-tab" className="space-y-6">
              <Header title="Danger Zone" description="Irreversible actions for this workspace." />
              
              <div className="p-6 rounded-lg bg-[var(--color-surface-0)] border border-red-900/50 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-red-500">Reset Workspace</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">This will wipe all configuration settings but keep members and billing active. This cannot be undone.</p>
                  <button className="px-4 py-2 bg-red-950/30 text-red-500 border border-red-900/50 hover:bg-red-900/20 rounded-md text-sm font-semibold focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none transition-colors">
                    Reset Settings
                  </button>
                </div>

                <div className="pt-6 border-t border-red-900/30 space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-red-500">Delete Workspace</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">Permanently delete "{workspaceName}" and all associated data. This action is irreversible.</p>
                  </div>
                  
                  <div className="space-y-3">
                    <label htmlFor="delete-confirm" className="block text-sm text-[var(--color-text-primary)]">
                      Please type <span className="font-mono font-bold text-[var(--color-text-primary)] selection:bg-red-500/50">{workspaceName}</span> to confirm.
                    </label>
                    <input
                      id="delete-confirm"
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none placeholder:text-[var(--color-text-muted)]"
                      placeholder="Type workspace name"
                    />
                    <button
                      disabled={deleteConfirmation !== workspaceName}
                      className={cn(
                        "w-full py-2 rounded-md text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none",
                        deleteConfirmation === workspaceName
                          ? "bg-red-600 hover:bg-red-500 text-[var(--color-text-primary)]"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-not-allowed"
                      )}
                    >
                      Delete Workspace
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

/* Helper Components */

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-[var(--color-text-secondary)] mt-1">{description}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
      {children}
    </div>
  );
}

function Field({ label, id, type = "text", defaultValue, prefix, placeholder }: { label: string; id: string; type?: string; defaultValue?: string; prefix?: string; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-secondary)]">{label}</label>
      <div className="flex">
        {prefix && (
          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-sm">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={cn(
            "w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] p-2 text-sm text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none transition-shadow",
            prefix ? "rounded-r-md" : "rounded-md"
          )}
        />
      </div>
    </div>
  );
}

function SelectField({ label, id, options, defaultValue }: { label: string; id: string; options: string[]; defaultValue: string }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-secondary)]">{label}</label>
      <select
        id={id}
        defaultValue={defaultValue}
        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function SwitchField({ label, description, id, defaultChecked }: { label: string; description: string; id: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked || false);
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <p className="text-xs text-[var(--color-text-secondary)]">{description}</p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => setChecked(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          checked ? "bg-indigo-600" : "bg-[var(--color-surface-3)]"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}

function SaveButton({ onSave, isSaved }: { onSave: () => void; isSaved: boolean }) {
  return (
    <div className="flex items-center gap-4 pt-4 border-t border-[var(--color-border)]">
      <button
        onClick={onSave}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)] rounded-md text-sm font-semibold focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none transition-colors flex items-center gap-2"
      >
        Save Changes
      </button>
      {isSaved && (
        <span className="text-emerald-500 text-sm font-medium animate-in fade-in slide-in-from-left-2 duration-300" role="status">
          ✓ Saved
        </span>
      )}
    </div>
  );
}
