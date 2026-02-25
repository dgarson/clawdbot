import React, { useState } from "react";
import { cn } from "../lib/utils";

type FieldType = "text" | "number" | "date" | "select" | "boolean";
type TemplateCategory = "contract" | "invoice" | "report" | "onboarding" | "notification";

interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue: string;
  options?: string[]; // for select type
  description: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  fields: TemplateField[];
  body: string; // template with {{field}} placeholders
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  version: string;
}

interface GeneratedDocument {
  templateId: string;
  templateName: string;
  values: Record<string, string>;
  generatedAt: string;
}

const TEMPLATES: DocumentTemplate[] = [
  {
    id: "t1",
    name: "Service Agreement",
    category: "contract",
    description: "Standard SaaS service agreement for new customers",
    version: "2.1",
    createdAt: "2025-11-10",
    updatedAt: "2026-01-15",
    usageCount: 84,
    fields: [
      { id: "f1", name: "client_name", label: "Client Name", type: "text", required: true, defaultValue: "", description: "Full legal name of the client" },
      { id: "f2", name: "contract_value", label: "Contract Value ($)", type: "number", required: true, defaultValue: "0", description: "Annual contract value in USD" },
      { id: "f3", name: "start_date", label: "Start Date", type: "date", required: true, defaultValue: "", description: "Service commencement date" },
      { id: "f4", name: "end_date", label: "End Date", type: "date", required: true, defaultValue: "", description: "Service end date" },
      { id: "f5", name: "plan_tier", label: "Plan Tier", type: "select", required: true, defaultValue: "starter", options: ["starter", "growth", "enterprise"], description: "Subscription tier" },
      { id: "f6", name: "support_level", label: "Support Level", type: "select", required: false, defaultValue: "standard", options: ["standard", "priority", "dedicated"], description: "Support tier included" },
    ],
    body: `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of {{start_date}} between OpenClaw, Inc. ("Provider") and {{client_name}} ("Client").

1. SERVICES
Provider agrees to supply the {{plan_tier}} plan services as described in the Order Form, commencing {{start_date}} and continuing through {{end_date}}.

2. FEES
Client agrees to pay {{contract_value}} USD annually for the services outlined herein.

3. SUPPORT
Client shall receive {{support_level}} support as part of this agreement.

4. TERMINATION
Either party may terminate this Agreement with 30 days written notice.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.`,
  },
  {
    id: "t2",
    name: "Invoice Template",
    category: "invoice",
    description: "Standard invoice for services rendered",
    version: "1.4",
    createdAt: "2025-10-05",
    updatedAt: "2026-02-01",
    usageCount: 312,
    fields: [
      { id: "f1", name: "invoice_number", label: "Invoice Number", type: "text", required: true, defaultValue: "INV-", description: "Unique invoice identifier" },
      { id: "f2", name: "client_name", label: "Client Name", type: "text", required: true, defaultValue: "", description: "Billed-to company" },
      { id: "f3", name: "issue_date", label: "Issue Date", type: "date", required: true, defaultValue: "", description: "Invoice issue date" },
      { id: "f4", name: "due_date", label: "Due Date", type: "date", required: true, defaultValue: "", description: "Payment due date" },
      { id: "f5", name: "subtotal", label: "Subtotal (USD)", type: "number", required: true, defaultValue: "0", description: "Pre-tax subtotal" },
      { id: "f6", name: "tax_rate", label: "Tax Rate (%)", type: "number", required: false, defaultValue: "8.25", description: "Applicable tax rate" },
    ],
    body: "INVOICE {{invoice_number}}\n\nBill To: {{client_name}}\nIssue Date: {{issue_date}}\nDue Date: {{due_date}}\n\nServices Rendered:\n  Platform License (monthly) ..... USD {{subtotal}}\n\nSubtotal: USD {{subtotal}}\nTax ({{tax_rate}}%): calculated\nTotal Due: see attached calculation\n\nPayment Terms: Net 30\nWire transfer or ACH preferred.",
  },
  {
    id: "t3",
    name: "Onboarding Welcome Email",
    category: "onboarding",
    description: "Welcome email sent to new users on account activation",
    version: "3.0",
    createdAt: "2025-09-20",
    updatedAt: "2026-02-10",
    usageCount: 1247,
    fields: [
      { id: "f1", name: "first_name", label: "First Name", type: "text", required: true, defaultValue: "", description: "User's first name" },
      { id: "f2", name: "company_name", label: "Company Name", type: "text", required: true, defaultValue: "", description: "User's company" },
      { id: "f3", name: "plan_name", label: "Plan Name", type: "text", required: false, defaultValue: "Starter", description: "Subscribed plan" },
      { id: "f4", name: "login_url", label: "Login URL", type: "text", required: true, defaultValue: "https://app.openclaw.io/login", description: "App login URL" },
      { id: "f5", name: "trial_days", label: "Trial Days", type: "number", required: false, defaultValue: "14", description: "Trial period length" },
    ],
    body: `Hi {{first_name}},

Welcome to OpenClaw! We're thrilled to have {{company_name}} on board.

Your {{plan_name}} account is ready. You have {{trial_days}} days to explore all features at no charge.

Get started here: {{login_url}}

Here's what to do first:
1. Complete your agent setup
2. Invite your team members
3. Connect your first integration

We're here to help. Reply to this email anytime.

— The OpenClaw Team`,
  },
  {
    id: "t4",
    name: "Incident Report",
    category: "report",
    description: "Post-incident report for internal documentation",
    version: "1.1",
    createdAt: "2026-01-08",
    updatedAt: "2026-02-05",
    usageCount: 23,
    fields: [
      { id: "f1", name: "incident_id", label: "Incident ID", type: "text", required: true, defaultValue: "INC-", description: "Incident tracking ID" },
      { id: "f2", name: "severity", label: "Severity", type: "select", required: true, defaultValue: "SEV2", options: ["SEV1", "SEV2", "SEV3", "SEV4"], description: "Incident severity level" },
      { id: "f3", name: "started_at", label: "Started At", type: "text", required: true, defaultValue: "", description: "Incident start time" },
      { id: "f4", name: "resolved_at", label: "Resolved At", type: "text", required: true, defaultValue: "", description: "Resolution time" },
      { id: "f5", name: "affected_service", label: "Affected Service", type: "text", required: true, defaultValue: "", description: "Primary service affected" },
      { id: "f6", name: "root_cause", label: "Root Cause", type: "text", required: true, defaultValue: "", description: "Brief root cause summary" },
    ],
    body: `INCIDENT REPORT: {{incident_id}}
Severity: {{severity}}

Timeline:
  Started: {{started_at}}
  Resolved: {{resolved_at}}

Affected Service: {{affected_service}}

Root Cause Summary:
{{root_cause}}

Impact Assessment:
[To be completed by incident commander]

Action Items:
1. [Add remediation items]
2. [Add preventive measures]

Report prepared by: [author]`,
  },
];

const HISTORY: GeneratedDocument[] = [
  { templateId: "t1", templateName: "Service Agreement", values: { client_name: "Acme Corp", plan_tier: "enterprise" }, generatedAt: "2026-02-22T13:00:00Z" },
  { templateId: "t3", templateName: "Onboarding Welcome Email", values: { first_name: "Sarah", company_name: "TechFlow Inc." }, generatedAt: "2026-02-22T12:30:00Z" },
  { templateId: "t2", templateName: "Invoice Template", values: { invoice_number: "INV-2026-0044", client_name: "BuildCo" }, generatedAt: "2026-02-22T11:00:00Z" },
  { templateId: "t4", templateName: "Incident Report", values: { incident_id: "INC-2026-018", severity: "SEV2" }, generatedAt: "2026-02-21T22:15:00Z" },
];

const TABS = ["Templates", "Builder", "Preview", "History"] as const;
type Tab = typeof TABS[number];

const categoryColor: Record<TemplateCategory, string> = {
  contract: "text-primary bg-primary/10 border-primary/30",
  invoice: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  report: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  onboarding: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  notification: "text-blue-400 bg-blue-400/10 border-blue-400/30",
};

const categoryEmoji: Record<TemplateCategory, string> = {
  contract: "📝",
  invoice: "🧾",
  report: "📊",
  onboarding: "👋",
  notification: "🔔",
};

function renderPreview(template: DocumentTemplate, values: Record<string, string>): string {
  let result = template.body;
  template.fields.forEach((f) => {
    const val = values[f.name] || f.defaultValue || `[${f.label}]`;
    result = result.split(`{{${f.name}}}`).join(val);
  });
  return result;
}

export default function DocumentTemplateBuilder(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Templates");
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate>(TEMPLATES[0]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | "all">("all");

  const filteredTemplates = TEMPLATES.filter((t) => {
    if (categoryFilter !== "all" && t.category !== categoryFilter) {return false;}
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) {return false;}
    return true;
  });

  const updateValue = (name: string, val: string) => {
    setFieldValues((prev) => ({ ...prev, [name]: val }));
  };

  const previewText = renderPreview(selectedTemplate, fieldValues);
  const filledCount = selectedTemplate.fields.filter(f => fieldValues[f.name] && fieldValues[f.name].trim() !== "").length;
  const requiredFilled = selectedTemplate.fields.filter(f => f.required).every(f => fieldValues[f.name]?.trim());

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Document Template Builder</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Create, fill, and export document templates with merge fields</p>
        </div>
        <button className="px-3 py-1.5 text-xs bg-primary hover:bg-primary rounded-md transition-colors">
          + New Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-[var(--color-border)] shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-primary border-primary"
                : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
            {t === "Builder" && (
              <span className="ml-1.5 text-[10px] text-[var(--color-text-muted)]">{selectedTemplate.name}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* ── TEMPLATES ── */}
        {tab === "Templates" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-primary"
              />
              <div className="flex gap-1">
                {(["all", "contract", "invoice", "report", "onboarding", "notification"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      "px-2.5 py-1.5 text-xs rounded-md border transition-colors",
                      categoryFilter === cat
                        ? "bg-primary/20 border-primary text-indigo-300"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]"
                    )}
                  >
                    {cat === "all" ? "All" : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => { setSelectedTemplate(tmpl); setFieldValues({}); setTab("Builder"); }}
                  className={cn(
                    "bg-[var(--color-surface-1)] border rounded-lg p-5 cursor-pointer transition-colors",
                    selectedTemplate.id === tmpl.id ? "border-primary/60" : "border-[var(--color-border)] hover:border-[var(--color-border)]"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{categoryEmoji[tmpl.category]}</span>
                        <h3 className="font-semibold">{tmpl.name}</h3>
                        <span className="text-xs text-[var(--color-text-muted)]">v{tmpl.version}</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">{tmpl.description}</p>
                    </div>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border shrink-0", categoryColor[tmpl.category])}>
                      {tmpl.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                    <span>{tmpl.fields.length} fields</span>
                    <span>{tmpl.usageCount} uses</span>
                    <span>Updated {tmpl.updatedAt}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedTemplate(tmpl); setFieldValues({}); setTab("Builder"); }}
                      className="px-2.5 py-1 text-xs bg-primary/20 border border-primary/40 text-indigo-300 rounded hover:bg-primary/30 transition-colors"
                    >
                      Fill & Generate
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 text-xs border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded hover:border-[var(--color-surface-3)] transition-colors"
                    >
                      Edit Template
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 text-xs border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded hover:border-[var(--color-surface-3)] transition-colors"
                    >
                      Duplicate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BUILDER ── */}
        {tab === "Builder" && (
          <div className="space-y-4">
            {/* Template selector */}
            <div className="flex items-center gap-3 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-3">
              <span className="text-xl">{categoryEmoji[selectedTemplate.category]}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold">{selectedTemplate.name}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">{selectedTemplate.description}</div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {filledCount}/{selectedTemplate.fields.length} fields filled
              </div>
              <button
                onClick={() => setTab("Templates")}
                className="text-xs text-primary hover:text-indigo-300 transition-colors"
              >
                Change →
              </button>
            </div>

            {/* Field grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedTemplate.fields.map((field) => (
                <div key={field.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium">{field.label}</label>
                    {field.required && <span className="text-rose-400 text-xs">*</span>}
                    <span className="text-[10px] px-1 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-muted)] font-mono">{`{{${field.name}}}`}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mb-2">{field.description}</div>
                  {field.type === "select" && field.options ? (
                    <select
                      value={fieldValues[field.name] ?? field.defaultValue}
                      onChange={(e) => updateValue(field.name, e.target.value)}
                      className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
                    >
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === "boolean" ? (
                    <div className="flex gap-3">
                      {["true", "false"].map((v) => (
                        <button
                          key={v}
                          onClick={() => updateValue(field.name, v)}
                          className={cn(
                            "px-3 py-1 text-xs rounded border transition-colors",
                            (fieldValues[field.name] ?? field.defaultValue) === v
                              ? "bg-primary/20 border-primary text-indigo-300"
                              : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                      value={fieldValues[field.name] ?? field.defaultValue}
                      onChange={(e) => updateValue(field.name, e.target.value)}
                      placeholder={field.defaultValue || `Enter ${field.label.toLowerCase()}...`}
                      className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-primary"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Generate button */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTab("Preview")}
                disabled={!requiredFilled}
                className={cn(
                  "px-5 py-2 text-sm font-medium rounded-lg transition-colors",
                  requiredFilled
                    ? "bg-primary hover:bg-primary text-[var(--color-text-primary)]"
                    : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)] cursor-not-allowed"
                )}
              >
                Generate Preview →
              </button>
              {!requiredFilled && (
                <span className="text-xs text-[var(--color-text-muted)]">Fill all required fields to continue</span>
              )}
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {tab === "Preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{selectedTemplate.name}</h3>
                <div className="text-xs text-[var(--color-text-secondary)]">Generated preview with field values applied</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTab("Builder")}
                  className="px-3 py-1.5 text-xs border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)] rounded-md transition-colors"
                >
                  ← Edit Fields
                </button>
                <button className="px-3 py-1.5 text-xs bg-primary hover:bg-primary rounded-md transition-colors">
                  Export as PDF
                </button>
                <button className="px-3 py-1.5 text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded-md transition-colors">
                  Copy Text
                </button>
              </div>
            </div>

            {/* Document preview */}
            <div className="bg-white rounded-lg p-8 shadow-2xl">
              <pre className="font-sans text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">{previewText}</pre>
            </div>

            {/* Field values summary */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
              <div className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider mb-3">Applied Values</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {selectedTemplate.fields.map((f) => (
                  <div key={f.id} className="text-xs">
                    <span className="text-[var(--color-text-muted)] font-mono">{`{{${f.name}}}`}: </span>
                    <span className="text-[var(--color-text-primary)]">{fieldValues[f.name] || f.defaultValue || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "History" && (
          <div className="space-y-3">
            <div className="text-xs text-[var(--color-text-secondary)]">Recently generated documents</div>
            {HISTORY.map((doc, idx) => (
              <div key={idx} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 flex items-center gap-4">
                <span className="text-xl">{categoryEmoji[TEMPLATES.find(t => t.id === doc.templateId)?.category ?? "notification"]}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">{doc.templateName}</div>
                  <div className="flex gap-3 mt-1 flex-wrap">
                    {Object.entries(doc.values).map(([k, v]) => (
                      <span key={k} className="text-[10px] text-[var(--color-text-muted)]"><span className="font-mono">{k}:</span> {v}</span>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">{doc.generatedAt.slice(0, 16).replace("T", " ")}</div>
                <button className="text-xs text-primary hover:text-indigo-300">Reopen</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
