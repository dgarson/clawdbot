import React, { useState } from "react";
import { cn } from "../lib/utils";

type WizardStep = "plan" | "identity" | "resources" | "integrations" | "review" | "complete";
type PlanTier = "starter" | "growth" | "enterprise" | "custom";
type ProvisionStatus = "pending" | "provisioning" | "complete" | "failed";
type IntegrationKey = "sso" | "slack" | "github" | "jira" | "pagerduty" | "datadog";

interface PlanFeature {
  name: string;
  included: boolean;
  limit: string | null;
}

interface Plan {
  id: PlanTier;
  name: string;
  price: string;
  description: string;
  features: PlanFeature[];
  maxUsers: number;
  storageGB: number;
  apiCallsPerMonth: number;
}

interface ResourceConfig {
  region: string;
  tier: string;
  dbSize: string;
  cacheSize: string;
  storageGB: number;
  backupRetentionDays: number;
  customDomain: string;
}

interface IdentityConfig {
  adminEmail: string;
  adminName: string;
  orgName: string;
  slug: string;
  ssoEnabled: boolean;
  ssoProvider: string;
  mfaRequired: boolean;
}

interface IntegrationConfig {
  key: IntegrationKey;
  enabled: boolean;
  label: string;
  description: string;
  configRequired: boolean;
}

interface ProvisionStep {
  id: string;
  label: string;
  status: ProvisionStatus;
  duration: string | null;
  error: string | null;
}

const PLANS: Plan[] = [
  {
    id: "starter", name: "Starter", price: "$99/mo",
    description: "Perfect for small teams getting started.",
    maxUsers: 10, storageGB: 50, apiCallsPerMonth: 100000,
    features: [
      { name: "Up to 10 users", included: true, limit: "10" },
      { name: "50 GB storage", included: true, limit: "50 GB" },
      { name: "API access", included: true, limit: "100k/mo" },
      { name: "Email support", included: true, limit: null },
      { name: "SSO integration", included: false, limit: null },
      { name: "Custom domain", included: false, limit: null },
      { name: "SLA guarantee", included: false, limit: null },
    ],
  },
  {
    id: "growth", name: "Growth", price: "$499/mo",
    description: "For growing teams that need more power.",
    maxUsers: 100, storageGB: 500, apiCallsPerMonth: 1000000,
    features: [
      { name: "Up to 100 users", included: true, limit: "100" },
      { name: "500 GB storage", included: true, limit: "500 GB" },
      { name: "API access", included: true, limit: "1M/mo" },
      { name: "Priority support", included: true, limit: null },
      { name: "SSO integration", included: true, limit: null },
      { name: "Custom domain", included: true, limit: null },
      { name: "SLA guarantee", included: false, limit: null },
    ],
  },
  {
    id: "enterprise", name: "Enterprise", price: "Custom",
    description: "Full-featured for large organizations.",
    maxUsers: 99999, storageGB: 10000, apiCallsPerMonth: 99999999,
    features: [
      { name: "Unlimited users", included: true, limit: "Unlimited" },
      { name: "10 TB+ storage", included: true, limit: "10 TB+" },
      { name: "API access", included: true, limit: "Unlimited" },
      { name: "Dedicated support", included: true, limit: null },
      { name: "SSO integration", included: true, limit: null },
      { name: "Custom domain", included: true, limit: null },
      { name: "99.99% SLA", included: true, limit: null },
    ],
  },
];

const INTEGRATIONS: IntegrationConfig[] = [
  { key: "sso", enabled: false, label: "Single Sign-On", description: "Connect SAML/OIDC identity provider", configRequired: true },
  { key: "slack", enabled: false, label: "Slack", description: "Send notifications and alerts to Slack channels", configRequired: true },
  { key: "github", enabled: false, label: "GitHub", description: "Connect repositories for deployments and PRs", configRequired: true },
  { key: "jira", enabled: false, label: "Jira", description: "Sync tickets and project tracking", configRequired: true },
  { key: "pagerduty", enabled: false, label: "PagerDuty", description: "Route incidents to on-call schedules", configRequired: true },
  { key: "datadog", enabled: false, label: "Datadog", description: "Forward metrics and traces to Datadog", configRequired: true },
];

const PROVISION_STEPS: ProvisionStep[] = [
  { id: "s1", label: "Creating tenant namespace", status: "complete", duration: "1.2s", error: null },
  { id: "s2", label: "Provisioning database", status: "complete", duration: "8.4s", error: null },
  { id: "s3", label: "Setting up Redis cache", status: "complete", duration: "2.1s", error: null },
  { id: "s4", label: "Configuring storage buckets", status: "complete", duration: "3.8s", error: null },
  { id: "s5", label: "Deploying application services", status: "provisioning", duration: null, error: null },
  { id: "s6", label: "Configuring networking & DNS", status: "pending", duration: null, error: null },
  { id: "s7", label: "Initializing admin account", status: "pending", duration: null, error: null },
  { id: "s8", label: "Sending welcome email", status: "pending", duration: null, error: null },
];

const STEP_ORDER: WizardStep[] = ["plan", "identity", "resources", "integrations", "review", "complete"];

function stepIndex(s: WizardStep) { return STEP_ORDER.indexOf(s); }

function planBadge(p: PlanTier) {
  if (p === "enterprise") {return "border-indigo-500 ring-2 ring-indigo-500/30";}
  if (p === "growth") {return "border-amber-500 ring-2 ring-amber-500/20";}
  return "border-zinc-700";
}

function provisionStatusIcon(s: ProvisionStatus) {
  if (s === "complete") {return "✓";}
  if (s === "provisioning") {return "⟳";}
  if (s === "failed") {return "✗";}
  return "○";
}
function provisionStatusColor(s: ProvisionStatus) {
  if (s === "complete") {return "text-emerald-400";}
  if (s === "provisioning") {return "text-indigo-400 animate-pulse";}
  if (s === "failed") {return "text-rose-400";}
  return "text-zinc-600";
}

function integrationEmoji(k: IntegrationKey) {
  const map: Record<IntegrationKey, string> = { sso: "🔐", slack: "💬", github: "🐙", jira: "📋", pagerduty: "📟", datadog: "🐕" };
  return map[k];
}

export default function TenantProvisioningWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("plan");
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [identity, setIdentity] = useState<IdentityConfig>({
    adminEmail: "", adminName: "", orgName: "", slug: "", ssoEnabled: false, ssoProvider: "okta", mfaRequired: true,
  });
  const [resources, setResources] = useState<ResourceConfig>({
    region: "us-east-1", tier: "standard", dbSize: "db.t3.large", cacheSize: "cache.t3.medium",
    storageGB: 100, backupRetentionDays: 7, customDomain: "",
  });
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>(INTEGRATIONS);
  const [isProvisioning, setIsProvisioning] = useState(false);

  const currentIdx = stepIndex(currentStep);
  const canProceed = (step: WizardStep) => {
    if (step === "plan") {return selectedPlan !== null;}
    if (step === "identity") {return identity.adminEmail.length > 0 && identity.orgName.length > 0 && identity.slug.length > 0;}
    return true;
  };

  function goNext() {
    const next = STEP_ORDER[currentIdx + 1];
    if (next) {setCurrentStep(next);}
    if (next === "complete") {setIsProvisioning(true);}
  }
  function goBack() {
    const prev = STEP_ORDER[currentIdx - 1];
    if (prev) {setCurrentStep(prev);}
  }

  function toggleIntegration(key: IntegrationKey) {
    setIntegrations(prev => prev.map(i => i.key === key ? { ...i, enabled: !i.enabled } : i));
  }

  const enabledIntegrations = integrations.filter(i => i.enabled).length;
  const completeSteps = PROVISION_STEPS.filter(s => s.status === "complete").length;
  const totalSteps = PROVISION_STEPS.length;
  const provisionPct = Math.round((completeSteps / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenant Provisioning Wizard</h1>
          <p className="text-zinc-400 text-sm mt-1">Set up a new tenant workspace with full configuration</p>
        </div>
        {currentStep !== "complete" && (
          <div className="text-sm text-zinc-500">Step {currentIdx + 1} of {STEP_ORDER.length - 1}</div>
        )}
      </div>

      {/* Progress bar */}
      {currentStep !== "complete" && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEP_ORDER.slice(0, -1).map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all flex-shrink-0",
                  i < currentIdx ? "border-emerald-500 bg-emerald-500 text-white" :
                  i === currentIdx ? "border-indigo-500 bg-indigo-500/20 text-indigo-400" :
                  "border-zinc-700 bg-zinc-800 text-zinc-500",
                )}>
                  {i < currentIdx ? "✓" : i + 1}
                </div>
                {i < STEP_ORDER.length - 2 && (
                  <div className={cn("flex-1 h-0.5 mx-2", i < currentIdx ? "bg-emerald-500" : "bg-zinc-700")} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-zinc-500 px-0.5">
            {["Plan", "Identity", "Resources", "Integrations", "Review"].map(label => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Step: Plan */}
      {currentStep === "plan" && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-4">Choose a Plan</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map(plan => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={cn(
                  "bg-zinc-900 rounded-xl p-5 border cursor-pointer transition-all",
                  selectedPlan === plan.id ? planBadge(plan.id) : "border-zinc-700 hover:border-zinc-500",
                )}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-white text-lg">{plan.name}</div>
                    <div className="text-indigo-400 font-semibold">{plan.price}</div>
                  </div>
                  {selectedPlan === plan.id && <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs">✓</div>}
                </div>
                <div className="text-xs text-zinc-400 mb-4">{plan.description}</div>
                <div className="space-y-2">
                  {plan.features.map(f => (
                    <div key={f.name} className="flex items-center gap-2 text-xs">
                      <span className={f.included ? "text-emerald-400" : "text-zinc-600"}>{f.included ? "✓" : "✗"}</span>
                      <span className={f.included ? "text-zinc-300" : "text-zinc-600"}>{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step: Identity */}
      {currentStep === "identity" && (
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold text-zinc-200 mb-4">Organization Identity</h2>
          <div className="space-y-4">
            {[
              { label: "Organization Name", key: "orgName" as keyof IdentityConfig, placeholder: "Acme Corp" },
              { label: "URL Slug", key: "slug" as keyof IdentityConfig, placeholder: "acme-corp" },
              { label: "Admin Name", key: "adminName" as keyof IdentityConfig, placeholder: "Jane Smith" },
              { label: "Admin Email", key: "adminEmail" as keyof IdentityConfig, placeholder: "jane@acme.com" },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs text-zinc-400 mb-1">{field.label}</label>
                <input
                  type="text"
                  value={identity[field.key] as string}
                  onChange={e => setIdentity(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                />
                {field.key === "slug" && identity.slug && (
                  <div className="text-xs text-zinc-500 mt-1">Preview: https://app.example.com/{identity.slug}</div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800">
              <div>
                <div className="text-sm font-medium text-zinc-200">Require MFA</div>
                <div className="text-xs text-zinc-500 mt-0.5">All users must enable multi-factor authentication</div>
              </div>
              <button
                onClick={() => setIdentity(prev => ({ ...prev, mfaRequired: !prev.mfaRequired }))}
                className={cn("w-10 h-6 rounded-full transition-colors relative", identity.mfaRequired ? "bg-indigo-600" : "bg-zinc-700")}
              >
                <div className={cn("w-4 h-4 bg-white rounded-full absolute top-1 transition-transform", identity.mfaRequired ? "translate-x-5" : "translate-x-1")} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Resources */}
      {currentStep === "resources" && (
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold text-zinc-200 mb-4">Infrastructure Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Region</label>
              <select value={resources.region} onChange={e => setResources(prev => ({ ...prev, region: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200">
                <option value="us-east-1">US East (N. Virginia)</option>
                <option value="us-west-2">US West (Oregon)</option>
                <option value="eu-west-1">EU West (Ireland)</option>
                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Database Instance</label>
              <select value={resources.dbSize} onChange={e => setResources(prev => ({ ...prev, dbSize: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200">
                <option value="db.t3.medium">db.t3.medium (2 vCPU, 4 GB)</option>
                <option value="db.t3.large">db.t3.large (2 vCPU, 8 GB)</option>
                <option value="db.r5.large">db.r5.large (2 vCPU, 16 GB)</option>
                <option value="db.r5.xlarge">db.r5.xlarge (4 vCPU, 32 GB)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Storage (GB)</label>
              <input
                type="number"
                value={resources.storageGB}
                onChange={e => setResources(prev => ({ ...prev, storageGB: Number(e.target.value) }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Backup Retention (days)</label>
              <select value={resources.backupRetentionDays} onChange={e => setResources(prev => ({ ...prev, backupRetentionDays: Number(e.target.value) }))} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200">
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Custom Domain (optional)</label>
              <input
                type="text"
                value={resources.customDomain}
                onChange={e => setResources(prev => ({ ...prev, customDomain: e.target.value }))}
                placeholder="app.acme.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step: Integrations */}
      {currentStep === "integrations" && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-1">Integrations</h2>
          <p className="text-xs text-zinc-500 mb-4">Enable integrations now or configure them later in Settings.</p>
          <div className="grid md:grid-cols-2 gap-3">
            {integrations.map(integ => (
              <div
                key={integ.key}
                onClick={() => toggleIntegration(integ.key)}
                className={cn(
                  "bg-zinc-900 rounded-xl p-4 border cursor-pointer transition-all",
                  integ.enabled ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800 hover:border-zinc-600",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{integrationEmoji(integ.key)}</span>
                    <div>
                      <div className="font-medium text-zinc-200 text-sm">{integ.label}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{integ.description}</div>
                    </div>
                  </div>
                  <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ml-2", integ.enabled ? "border-indigo-500 bg-indigo-500" : "border-zinc-600")}>
                    {integ.enabled && <span className="text-white text-xs">✓</span>}
                  </div>
                </div>
                {integ.enabled && integ.configRequired && (
                  <div className="mt-3 pt-3 border-t border-zinc-700 text-xs text-amber-400">
                    ⚠ Configuration required after provisioning
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step: Review */}
      {currentStep === "review" && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-4">Review Configuration</h2>
          <div className="space-y-4">
            {[
              {
                title: "Plan", items: [
                  { label: "Selected plan", value: PLANS.find(p => p.id === selectedPlan)?.name ?? "—" },
                  { label: "Price", value: PLANS.find(p => p.id === selectedPlan)?.price ?? "—" },
                ],
              },
              {
                title: "Identity", items: [
                  { label: "Organization", value: identity.orgName || "—" },
                  { label: "URL slug", value: identity.slug || "—" },
                  { label: "Admin", value: `${identity.adminName} <${identity.adminEmail}>` },
                  { label: "MFA required", value: identity.mfaRequired ? "Yes" : "No" },
                ],
              },
              {
                title: "Resources", items: [
                  { label: "Region", value: resources.region },
                  { label: "Database", value: resources.dbSize },
                  { label: "Storage", value: `${resources.storageGB} GB` },
                  { label: "Backup retention", value: `${resources.backupRetentionDays} days` },
                  { label: "Custom domain", value: resources.customDomain || "None" },
                ],
              },
              {
                title: "Integrations", items: [
                  { label: "Enabled", value: enabledIntegrations > 0 ? integrations.filter(i => i.enabled).map(i => i.label).join(", ") : "None" },
                ],
              },
            ].map(section => (
              <div key={section.title} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300 mb-3">{section.title}</h3>
                <div className="space-y-2">
                  {section.items.map(item => (
                    <div key={item.label} className="flex justify-between text-sm">
                      <span className="text-zinc-500">{item.label}</span>
                      <span className="text-zinc-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step: Complete / Provisioning */}
      {currentStep === "complete" && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">
            {isProvisioning ? "Provisioning in Progress..." : "Provisioning Complete!"}
          </h2>
          <p className="text-xs text-zinc-500 mb-6">{provisionPct}% complete · {completeSteps}/{totalSteps} steps done</p>

          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${provisionPct}%` }} />
          </div>

          <div className="space-y-2 mb-8">
            {PROVISION_STEPS.map(step => (
              <div key={step.id} className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                <span className={cn("text-lg w-5 text-center", provisionStatusColor(step.status))}>{provisionStatusIcon(step.status)}</span>
                <span className={cn("text-sm flex-1", step.status === "pending" ? "text-zinc-500" : "text-zinc-200")}>{step.label}</span>
                {step.duration && <span className="text-xs text-zinc-500">{step.duration}</span>}
                {step.error && <span className="text-xs text-rose-400">{step.error}</span>}
              </div>
            ))}
          </div>

          {completeSteps === totalSteps && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <div className="text-lg font-bold text-emerald-400">Tenant Successfully Provisioned!</div>
              <div className="text-sm text-zinc-400 mt-1">{identity.orgName || "Your organization"} is ready to use.</div>
              <div className="flex gap-3 justify-center mt-4">
                <button className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">Open Dashboard</button>
                <button className="px-4 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-lg text-zinc-300 transition-colors">Copy Invite Link</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      {currentStep !== "complete" && (
        <div className="flex justify-between mt-8 pt-6 border-t border-zinc-800">
          <button
            onClick={goBack}
            disabled={currentIdx === 0}
            className={cn("px-4 py-2 text-sm rounded-lg transition-colors", currentIdx === 0 ? "text-zinc-600 cursor-not-allowed" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300")}
          >
            ← Back
          </button>
          <button
            onClick={goNext}
            disabled={!canProceed(currentStep)}
            className={cn("px-6 py-2 text-sm rounded-lg transition-colors font-medium", canProceed(currentStep) ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-zinc-700 text-zinc-500 cursor-not-allowed")}
          >
            {currentStep === "review" ? "🚀 Provision Tenant" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}
