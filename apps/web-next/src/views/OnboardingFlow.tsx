import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, MessageSquare, ShieldCheck, TerminalSquare } from 'lucide-react';
import { cn } from '../lib/utils';

type GatewayMode = 'local' | 'remote';
type AuthMode = 'token' | 'none';
type StepId = 'welcome' | 'gateway' | 'permissions' | 'cli' | 'chat' | 'complete';
type CliStatus = 'idle' | 'detected' | 'installing' | 'success' | 'failed';
type OnboardingOutcome = 'in_progress' | 'completed' | 'skipped';

type PermissionKey =
  | 'automation'
  | 'notifications'
  | 'accessibility'
  | 'screenRecording'
  | 'microphone'
  | 'location';

interface PermissionState {
  key: PermissionKey;
  label: string;
  helper: string;
  optional: boolean;
  enabled: boolean;
  granted: boolean;
}

interface OnboardingState {
  step: StepId;
  gatewayMode: GatewayMode;
  authMode: AuthMode;
  permissions: PermissionState[];
  cliStatus: CliStatus;
  packageManager: string | null;
  selectedPrompt: string | null;
  outcome: OnboardingOutcome;
}

const STORAGE_KEY = 'openclaw.web.onboarding.v1';

const STEP_ORDER: StepId[] = ['welcome', 'gateway', 'permissions', 'cli', 'chat', 'complete'];

const SUGGESTED_PROMPTS = [
  'Connect Slack',
  'Set up my first daily summary',
  'Show what you can automate',
  'Run a quick health check',
];

const DEFAULT_PERMISSIONS: PermissionState[] = [
  { key: 'automation', label: 'Automation', helper: 'Control supported apps on your behalf', optional: false, enabled: true, granted: false },
  { key: 'notifications', label: 'Notifications', helper: 'Send reminders and status updates', optional: false, enabled: true, granted: false },
  { key: 'accessibility', label: 'Accessibility', helper: 'Read UI context to complete tasks', optional: false, enabled: true, granted: false },
  { key: 'screenRecording', label: 'Screen Recording', helper: 'Capture or stream screen context when needed', optional: true, enabled: false, granted: false },
  { key: 'microphone', label: 'Microphone', helper: 'Enable voice input and calls', optional: true, enabled: false, granted: false },
  { key: 'location', label: 'Location', helper: 'Use location-aware automations', optional: true, enabled: false, granted: false },
];

function isStepId(value: unknown): value is StepId {
  return typeof value === 'string' && STEP_ORDER.includes(value as StepId);
}

function isGatewayMode(value: unknown): value is GatewayMode {
  return value === 'local' || value === 'remote';
}

function isAuthMode(value: unknown): value is AuthMode {
  return value === 'token' || value === 'none';
}

function isCliStatus(value: unknown): value is CliStatus {
  return value === 'idle' || value === 'detected' || value === 'installing' || value === 'success' || value === 'failed';
}

function isOnboardingOutcome(value: unknown): value is OnboardingOutcome {
  return value === 'in_progress' || value === 'completed' || value === 'skipped';
}

function normalizePermissions(permissions: unknown): PermissionState[] {
  if (!Array.isArray(permissions)) {
    return DEFAULT_PERMISSIONS;
  }

  return DEFAULT_PERMISSIONS.map(defaultPermission => {
    const savedPermission = permissions.find(candidate => (
      typeof candidate === 'object'
      && candidate !== null
      && 'key' in candidate
      && candidate.key === defaultPermission.key
    )) as Partial<PermissionState> | undefined;

    return {
      ...defaultPermission,
      enabled: typeof savedPermission?.enabled === 'boolean' ? savedPermission.enabled : defaultPermission.enabled,
      granted: typeof savedPermission?.granted === 'boolean' ? savedPermission.granted : defaultPermission.granted,
    };
  });
}

function hydrateStoredState(parsed: Partial<OnboardingState>): OnboardingState {
  const initial = createInitialState();
  const inferredOutcome = parsed.step === 'complete' ? 'completed' : initial.outcome;

  return {
    step: isStepId(parsed.step) ? parsed.step : initial.step,
    gatewayMode: isGatewayMode(parsed.gatewayMode) ? parsed.gatewayMode : initial.gatewayMode,
    authMode: isAuthMode(parsed.authMode) ? parsed.authMode : initial.authMode,
    permissions: normalizePermissions(parsed.permissions),
    cliStatus: isCliStatus(parsed.cliStatus) ? parsed.cliStatus : initial.cliStatus,
    packageManager: typeof parsed.packageManager === 'string' ? parsed.packageManager : detectPackageManager(),
    selectedPrompt: typeof parsed.selectedPrompt === 'string' ? parsed.selectedPrompt : null,
    outcome: isOnboardingOutcome(parsed.outcome) ? parsed.outcome : inferredOutcome,
  };
}

function createInitialState(): OnboardingState {
  return {
    step: 'welcome',
    gatewayMode: 'local',
    authMode: 'token',
    permissions: DEFAULT_PERMISSIONS,
    cliStatus: 'idle',
    packageManager: null,
    selectedPrompt: null,
    outcome: 'in_progress',
  };
}

function detectPackageManager(): string | null {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('macintosh')) {return 'pnpm';}
  if (ua.includes('linux')) {return 'npm';}
  return null;
}

function nextStep(step: StepId): StepId {
  const idx = STEP_ORDER.indexOf(step);
  return STEP_ORDER[Math.min(idx + 1, STEP_ORDER.length - 1)];
}

function prevStep(step: StepId): StepId {
  const idx = STEP_ORDER.indexOf(step);
  return STEP_ORDER[Math.max(idx - 1, 0)];
}

export default function OnboardingFlow() {
  const [state, setState] = useState<OnboardingState>(createInitialState);
  const [installError, setInstallError] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [resumedFromStorage, setResumedFromStorage] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setState(prev => ({ ...prev, packageManager: detectPackageManager() }));
      setHasHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<OnboardingState>;
      const hydratedState = hydrateStoredState(parsed);
      setState(hydratedState);
      setResumedFromStorage(true);
    } catch {
      setState(prev => ({ ...prev, packageManager: detectPackageManager() }));
      setResumedFromStorage(false);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hasHydrated, state]);

  const stepIndex = STEP_ORDER.indexOf(state.step);
  const totalSteps = STEP_ORDER.length - 1;
  const progressPct = Math.round((Math.min(stepIndex, totalSteps) / totalSteps) * 100);
  const canContinue = useMemo(() => {
    if (state.step === 'gateway') {
      return !(state.gatewayMode === 'remote' && state.authMode === 'none');
    }
    if (state.step === 'chat') {
      return Boolean(state.selectedPrompt);
    }
    if (state.step === 'cli') {
      return state.cliStatus !== 'installing';
    }
    return true;
  }, [state]);

  const advance = () => setState(prev => {
    const next = nextStep(prev.step);
    return {
      ...prev,
      step: next,
      outcome: next === 'complete' && prev.outcome === 'in_progress' ? 'completed' : prev.outcome,
    };
  });
  const goBack = () => setState(prev => ({ ...prev, step: prevStep(prev.step) }));

  const togglePermission = (key: PermissionKey) => {
    setState(prev => ({
      ...prev,
      permissions: prev.permissions.map(permission => (
        permission.key === key
          ? { ...permission, enabled: !permission.enabled, granted: permission.enabled ? false : permission.granted }
          : permission
      )),
    }));
  };

  const grantPermission = (key: PermissionKey) => {
    setState(prev => ({
      ...prev,
      permissions: prev.permissions.map(permission => (
        permission.key === key && permission.enabled ? { ...permission, granted: true } : permission
      )),
    }));
  };

  const installCli = async () => {
    setInstallError(null);
    setState(prev => ({ ...prev, cliStatus: 'installing' }));

    await new Promise(resolve => setTimeout(resolve, 900));

    if (!state.packageManager) {
      setState(prev => ({ ...prev, cliStatus: 'failed' }));
      setInstallError('No package manager detected. Continue and install later from docs.');
      return;
    }

    setState(prev => ({ ...prev, cliStatus: 'success' }));
  };

  const skipSetup = () => {
    setState(prev => ({ ...prev, step: 'complete', outcome: 'skipped' }));
    setInstallError(null);
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/70 p-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">OpenClaw onboarding</h1>
            <button type="button" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" onClick={skipSetup}>Skip setup</button>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Step {Math.min(stepIndex + 1, totalSteps)} of {totalSteps}</p>
          <div className="mt-3 h-2 w-full rounded-full bg-[var(--color-surface-2)]">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </header>

        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6 md:p-8">
          {state.step === 'welcome' && (
            <div className="space-y-4">
              {resumedFromStorage && <p className="rounded-xl bg-primary/10 p-3 text-sm text-indigo-200">Welcome back — we saved your progress.</p>}
              <h2 className="text-3xl font-semibold">Welcome to OpenClaw</h2>
              <p className="text-[var(--color-text-primary)]">Setup takes about 3 minutes. OpenClaw runs locally so you stay in control of data, permissions, and automations.</p>
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">What we&apos;ll do now</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
                  <li>Choose where your Gateway runs</li>
                  <li>Review permissions</li>
                  <li>Optionally install the CLI</li>
                  <li>Start your first onboarding chat</li>
                </ul>
              </div>
            </div>
          )}

          {state.step === 'gateway' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">Where should your Gateway run?</h2>
                <p className="text-sm text-[var(--color-text-secondary)]">Pick the setup that matches how you work.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <button type="button" onClick={() => setState(prev => ({ ...prev, gatewayMode: 'local' }))} className={cn('rounded-xl border p-4 text-left', state.gatewayMode === 'local' ? 'border-primary bg-primary/10' : 'border-[var(--color-border)]')}>
                  <p className="font-medium">This Mac (recommended)</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Best for first-time setup. OAuth and local app integrations work out of the box.</p>
                </button>
                <button type="button" onClick={() => setState(prev => ({ ...prev, gatewayMode: 'remote' }))} className={cn('rounded-xl border p-4 text-left', state.gatewayMode === 'remote' ? 'border-primary bg-primary/10' : 'border-[var(--color-border)]')}>
                  <p className="font-medium">Remote host</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Use SSH or tailnet when your Gateway runs elsewhere.</p>
                </button>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-sm font-medium">Authentication</p>
                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input checked={state.authMode === 'token'} onChange={() => setState(prev => ({ ...prev, authMode: 'token' }))} type="radio" name="auth-mode" />
                    Generate a secure token (recommended)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input checked={state.authMode === 'none'} onChange={() => setState(prev => ({ ...prev, authMode: 'none' }))} type="radio" name="auth-mode" />
                    Disable auth (development only)
                  </label>
                </div>
                {state.authMode === 'none' && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4" />Anyone with network access to this Gateway can control it.</p>
                )}
                {state.authMode === 'none' && state.gatewayMode === 'remote' && (
                  <p className="mt-2 text-xs text-rose-300">Remote mode requires token auth.</p>
                )}
              </div>
            </div>
          )}

          {state.step === 'permissions' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">Review permissions</h2>
                <p className="text-sm text-[var(--color-text-secondary)]">OpenClaw only asks for what you enable. You can change these anytime in System Settings.</p>
              </div>
              <div className="space-y-3">
                {state.permissions.map(permission => (
                  <div key={permission.key} className="rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{permission.label} {permission.optional ? <span className="text-xs text-[var(--color-text-muted)]">(optional)</span> : null}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">{permission.helper}</p>
                      </div>
                      <label className="text-sm">
                        <input type="checkbox" checked={permission.enabled} onChange={() => togglePermission(permission.key)} /> Enable
                      </label>
                    </div>
                    {permission.enabled && (
                      <button type="button" className="mt-3 rounded-lg border border-[var(--color-surface-3)] px-3 py-1.5 text-sm hover:border-[var(--color-surface-3)]" onClick={() => grantPermission(permission.key)}>
                        {permission.granted ? 'Granted' : 'Grant access'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.step === 'cli' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Install the CLI (optional)</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Use terminal commands for automation, debugging, and scripts. You can skip this now and install later.</p>
              <div className="rounded-xl border border-[var(--color-border)] p-4 text-sm">
                {state.packageManager ? (
                  <p className="flex items-center gap-2 text-emerald-300"><TerminalSquare className="h-4 w-4" />Detected: {state.packageManager}</p>
                ) : (
                  <p className="text-amber-300">No package manager detected. We&apos;ll show manual install steps.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={installCli} disabled={state.cliStatus === 'installing'} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium hover:bg-primary disabled:opacity-50">
                  {state.cliStatus === 'installing' ? 'Installing…' : 'Install with detected package manager'}
                </button>
                <button type="button" onClick={() => setState(prev => ({ ...prev, cliStatus: 'idle' }))} className="rounded-lg border border-[var(--color-surface-3)] px-4 py-2 text-sm">Skip for now</button>
              </div>
              {state.cliStatus === 'success' && <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />CLI installed successfully.</p>}
              {state.cliStatus === 'failed' && <p className="text-sm text-rose-300">{installError}</p>}
            </div>
          )}

          {state.step === 'chat' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">You&apos;re all set</h2>
              <p className="text-sm text-[var(--color-text-primary)]">Hey — I’m your OpenClaw assistant. Want to connect a channel, build an automation, or do a quick system check first?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map(prompt => (
                  <button key={prompt} type="button" onClick={() => setState(prev => ({ ...prev, selectedPrompt: prompt }))} className={cn('rounded-lg border p-3 text-left text-sm', state.selectedPrompt === prompt ? 'border-primary bg-primary/10' : 'border-[var(--color-border)]')}>
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
                <p className="flex items-center gap-2 text-[var(--color-text-primary)]"><MessageSquare className="h-4 w-4" />Type a message…</p>
                {state.selectedPrompt && <p className="mt-2 text-indigo-300">Selected: {state.selectedPrompt}</p>}
              </div>
            </div>
          )}

          {state.step === 'complete' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h2 className="text-3xl font-semibold">{state.outcome === 'skipped' ? 'Setup skipped' : 'Setup complete'}</h2>
              <p className="text-[var(--color-text-primary)]">{state.outcome === 'skipped' ? 'You can run onboarding later from settings.' : 'Your OpenClaw workspace is ready.'}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium hover:bg-primary">Open dashboard</button>
                <button type="button" className="rounded-lg border border-[var(--color-surface-3)] px-4 py-2 text-sm">Start chatting</button>
              </div>
            </div>
          )}
        </section>

        {state.step !== 'complete' && (
          <footer className="flex items-center justify-between">
            <button type="button" onClick={goBack} disabled={state.step === 'welcome'} className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />Back
            </button>
            <button type="button" onClick={advance} disabled={!canContinue} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium hover:bg-primary disabled:opacity-40">
              {state.step === 'welcome' ? 'Get started' : state.step === 'chat' ? 'Finish setup' : 'Continue'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </footer>
        )}

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/70 p-4 text-xs text-[var(--color-text-secondary)]">
          <p className="flex items-center gap-2"><Info className="h-4 w-4" />This mock flow matches docs/start onboarding requirements and persists state in localStorage for resume behavior.</p>
        </div>
      </div>
    </div>
  );
}
