import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Code,
  Loader2,
  Mail,
  MessageSquare,
  PenTool,
  Rocket,
  Shield,
  Sparkles,
  User,
  X,
  Zap,
  BarChart2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useGateway } from '../hooks/useGateway';
import { Skeleton } from '../components/Skeleton';

type Step = 'template' | 'identity' | 'personality' | 'model' | 'review' | 'success';

interface FormData {
  template: string;
  name: string;
  emoji: string;
  role: string;
  personality: {
    formality: number;
    humor: number;
    verbosity: number;
    empathy: number;
  };
  model: string;
  approvedAvatarDataUrl: string | null;
}

type AvatarCapabilityResult = {
  supported: boolean;
  provider: 'gemini';
  model?: string;
  reason?: string;
};

type AvatarGenerateResult = {
  provider: 'gemini';
  model: string;
  emoji: string;
  imageDataUrl: string;
};

type AgentsCreateResult = {
  ok: true;
  agentId: string;
  name: string;
  workspace: string;
};

const TEMPLATES = [
  { id: 'personal', name: 'Personal Assistant', icon: User, description: 'General help, scheduling, and admin tasks.' },
  { id: 'code', name: 'Code Reviewer', icon: Code, description: 'Debug code, review PRs, and architectural advice.' },
  { id: 'email', name: 'Email Manager', icon: Mail, description: 'Draft replies, sort inbox, and prioritize messages.' },
  { id: 'writer', name: 'Creative Writer', icon: PenTool, description: 'Blog posts, storytelling, and copy editing.' },
  { id: 'analyst', name: 'Data Analyst', icon: BarChart2, description: 'Process data, generate insights, and build reports.' },
  { id: 'blank', name: 'Blank Template', icon: Zap, description: 'Start from scratch with a clean slate.' },
];

const EMOJIS = ['🧠', '🤖', '⚡', '🎨', '🔍', '🏗️', '📣', '🛡️', '🧪', '💼', '🧙', '🚀', '🌈', '🐱', '🦊', '🦉', '💎', '🔑', '🎯', '👾'];

const MODELS = [
  { id: 'opus', name: 'Claude Opus', description: 'Best quality, high cost', cost: '$$$', speed: 'Slow', quality: 'Highest' },
  { id: 'sonnet', name: 'Claude Sonnet', description: 'Balanced performance', cost: '$$', speed: 'Fast', quality: 'High' },
  { id: 'haiku', name: 'Claude Haiku', description: 'Fast, low cost', cost: '$', speed: 'Blazing', quality: 'Good' },
];

const STEPS: { id: Step; label: string }[] = [
  { id: 'template', label: 'Template' },
  { id: 'identity', label: 'Identity' },
  { id: 'personality', label: 'Personality' },
  { id: 'model', label: 'Model' },
  { id: 'review', label: 'Review' },
];

function slugifyName(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'new-agent';
}

function buildSoulContent(formData: FormData): string {
  return [
    `# ${formData.name || 'Agent'}`,
    '',
    '## Role',
    formData.role || 'No role provided.',
    '',
    '## Personality',
    `- Formality: ${formData.personality.formality}%`,
    `- Humor: ${formData.personality.humor}%`,
    `- Verbosity: ${formData.personality.verbosity}%`,
    `- Empathy: ${formData.personality.empathy}%`,
    '',
    '## Model Preference',
    MODELS.find((model) => model.id === formData.model)?.name ?? formData.model,
  ].join('\n');
}

function AgentBuilderWizardSkeleton() {
  return (
    <div className="flex h-full bg-[var(--color-surface-0)] text-fg-primary">
      <div className="w-64 border-r border-[var(--color-border)] p-8 flex flex-col">
        <Skeleton className="h-7 w-32 mb-8" />
        <div className="space-y-8 relative">
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-[var(--color-surface-2)]" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 relative z-10">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-12">
          <div className="max-w-4xl space-y-8">
            <div className="space-y-2">
              <Skeleton className="h-9 w-72" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] space-y-3">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-1)] flex justify-between items-center">
          <Skeleton className="h-10 w-24 rounded-xl opacity-0" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function AgentBuilderWizard({ isLoading = false }: { isLoading?: boolean }) {
  const gateway = useGateway();
  const [currentStep, setCurrentStep] = useState<Step>('template');
  const [loading, setLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarCapabilityLoading, setAvatarCapabilityLoading] = useState(false);
  const [avatarCapability, setAvatarCapability] = useState<AvatarCapabilityResult | null>(null);
  const [avatarGenerating, setAvatarGenerating] = useState(false);
  const [avatarApprovalOpen, setAvatarApprovalOpen] = useState(false);
  const [avatarCandidate, setAvatarCandidate] = useState<AvatarGenerateResult | null>(null);
  const [formData, setFormData] = useState<FormData>({
    template: 'blank',
    name: '',
    emoji: '🤖',
    role: '',
    personality: {
      formality: 50,
      humor: 50,
      verbosity: 50,
      empathy: 50,
    },
    model: 'sonnet',
    approvedAvatarDataUrl: null,
  });

  const stepIndex = STEPS.findIndex((step) => step.id === currentStep);

  const loadAvatarCapability = useCallback(async () => {
    if (!gateway.isConnected) {
      setAvatarCapability({
        supported: false,
        provider: 'gemini',
        reason: 'Connect to Gateway to use avatar generation.',
      });
      return;
    }

    setAvatarCapabilityLoading(true);
    try {
      const result = await gateway.call<AvatarCapabilityResult>('agents.avatar.capabilities', {});
      setAvatarCapability(result);
    } catch (error) {
      setAvatarCapability({
        supported: false,
        provider: 'gemini',
        reason: error instanceof Error ? error.message : 'Failed to check Gemini avatar capability.',
      });
    } finally {
      setAvatarCapabilityLoading(false);
    }
  }, [gateway.call, gateway.isConnected]);

  useEffect(() => {
    void loadAvatarCapability();
  }, [loadAvatarCapability]);

  const identityReadyForGeneration =
    formData.name.trim().length > 0 && formData.role.trim().length > 0;

  const generateAvatarDisabledReason = useMemo(() => {
    if (!gateway.isConnected) {
      return 'Connect to Gateway to use avatar generation.';
    }
    if (avatarCapabilityLoading) {
      return 'Checking Gemini configuration...';
    }
    if (!avatarCapability?.supported) {
      return (
        avatarCapability?.reason ||
        'Gemini must be configured to use this feature (set GEMINI_API_KEY in env or config.env).'
      );
    }
    if (!identityReadyForGeneration) {
      return 'Both Agent Name and Role & Responsibilities are required.';
    }
    if (avatarGenerating) {
      return 'Avatar generation in progress.';
    }
    return null;
  }, [
    gateway.isConnected,
    avatarCapabilityLoading,
    avatarCapability,
    identityReadyForGeneration,
    avatarGenerating,
  ]);

  const handleGenerateAvatar = useCallback(async () => {
    if (generateAvatarDisabledReason) {
      return;
    }

    setAvatarError(null);
    setAvatarGenerating(true);
    try {
      const generated = await gateway.call<AvatarGenerateResult>('agents.avatar.generate', {
        name: formData.name.trim(),
        description: formData.role.trim(),
      });
      setAvatarCandidate(generated);
      setAvatarApprovalOpen(true);
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Failed to generate avatar.');
    } finally {
      setAvatarGenerating(false);
    }
  }, [generateAvatarDisabledReason, gateway.call, formData.name, formData.role]);

  const handleApproveAvatar = useCallback(() => {
    if (!avatarCandidate) {
      return;
    }
    setFormData((prev) => ({
      ...prev,
      emoji: avatarCandidate.emoji,
      approvedAvatarDataUrl: avatarCandidate.imageDataUrl,
    }));
    setAvatarApprovalOpen(false);
  }, [avatarCandidate]);

  const handleCreate = useCallback(async () => {
    if (loading) {
      return;
    }

    setWizardError(null);
    setLoading(true);

    try {
      if (!gateway.isConnected) {
        throw new Error('Gateway is not connected.');
      }

      const agentName = formData.name.trim() || 'New Agent';
      const workspaceSlug = slugifyName(agentName);
      const createPayload: Record<string, unknown> = {
        name: agentName,
        workspace: `~/.openclaw/agents/${workspaceSlug}`,
        emoji: formData.emoji,
      };

      if (formData.approvedAvatarDataUrl) {
        createPayload.avatarDataUrl = formData.approvedAvatarDataUrl;
        createPayload.avatarFilename = 'avatars/generated-avatar.png';
      }

      const created = await gateway.call<AgentsCreateResult>('agents.create', createPayload);

      const soulContent = buildSoulContent(formData);
      await gateway.call('agents.files.set', {
        agentId: created.agentId,
        name: 'SOUL.md',
        content: soulContent,
      });

      setCurrentStep('success');
    } catch (error) {
      setWizardError(error instanceof Error ? error.message : 'Failed to create agent.');
    } finally {
      setLoading(false);
    }
  }, [gateway.call, gateway.isConnected, loading, formData]);

  const nextStep = useCallback(() => {
    const nextIdx = stepIndex + 1;
    if (nextIdx < STEPS.length) {
      setCurrentStep(STEPS[nextIdx].id);
      return;
    }
    if (currentStep === 'review') {
      void handleCreate();
    }
  }, [currentStep, handleCreate, stepIndex]);

  const prevStep = useCallback(() => {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) {
      setCurrentStep(STEPS[prevIdx].id);
    }
  }, [stepIndex]);

  if (isLoading) {
    return <AgentBuilderWizardSkeleton />;
  }

  if (currentStep === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="relative">
          {formData.approvedAvatarDataUrl ? (
            <img
              src={formData.approvedAvatarDataUrl}
              alt={`${formData.name || 'Agent'} avatar`}
              className="w-24 h-24 rounded-full object-cover shadow-2xl shadow-violet-500/20"
            />
          ) : (
            <div className="w-24 h-24 bg-violet-600 rounded-full flex items-center justify-center text-5xl shadow-2xl shadow-violet-500/20">
              {formData.emoji}
            </div>
          )}
          <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 border-4 border-surface-0">
            <Check className="w-6 h-6 text-fg-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-fg-primary mb-2">Agent Created!</h1>
          <p className="text-fg-secondary">
            <span className="font-semibold text-fg-primary">{formData.name}</span> is ready to assist you.
          </p>
        </div>
        <button
          className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-fg-primary font-medium rounded-xl transition-all shadow-lg shadow-violet-600/20 active:scale-95 flex items-center gap-2"
          onClick={() => window.location.reload()}
        >
          <MessageSquare className="w-5 h-5" />
          Start Chatting
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full bg-surface-0 text-fg-primary">
        <div className="hidden md:flex w-64 border-r border-tok-border p-8 flex-col">
          <h2 className="text-xl font-bold mb-8">Create Agent</h2>
          <div className="space-y-8 relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-surface-2" />

            {STEPS.map((step, idx) => {
              const isCompleted = idx < stepIndex;
              const isActive = idx === stepIndex;

              return (
                <div key={step.id} className="flex items-center gap-4 relative z-10">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                    isCompleted ? 'bg-violet-600 text-fg-primary' :
                    isActive ? 'border-2 border-violet-600 text-violet-600 bg-surface-0' :
                    'border-2 border-tok-border text-fg-muted bg-surface-0',
                  )}>
                    {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={cn(
                    'font-medium transition-colors',
                    isActive ? 'text-fg-primary' : 'text-fg-muted',
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-tok-border bg-surface-1">
            <span className="text-sm font-semibold text-fg-primary">Create Agent</span>
            <div className="flex items-center gap-1.5">
              {STEPS.map((step, idx) => (
                <div
                  key={step.id}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    idx < stepIndex ? 'bg-violet-600' :
                    idx === stepIndex ? 'bg-violet-400' :
                    'bg-surface-3',
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-fg-muted">{STEPS[stepIndex]?.label}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-12">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-fg-secondary animate-pulse">Creating your new agent...</p>
              </div>
            ) : (
              <div className="max-w-4xl">
                {wizardError && (
                  <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
                    {wizardError}
                  </div>
                )}

                {currentStep === 'template' && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Choose a Template</h1>
                      <p className="text-fg-secondary">Start with a pre-configured personality or build from scratch.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => setFormData({ ...formData, template: template.id })}
                          className={cn(
                            'p-6 rounded-2xl border text-left transition-all group',
                            formData.template === template.id
                              ? 'border-violet-600 bg-violet-600/10 ring-1 ring-violet-600'
                              : 'border-tok-border bg-surface-1 hover:border-tok-border',
                          )}
                        >
                          <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors',
                            formData.template === template.id
                              ? 'bg-violet-600 text-fg-primary'
                              : 'bg-surface-2 text-fg-secondary group-hover:bg-surface-3',
                          )}>
                            <template.icon className="w-6 h-6" />
                          </div>
                          <h3 className="text-lg font-bold mb-1">{template.name}</h3>
                          <p className="text-sm text-fg-secondary">{template.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 'identity' && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Who are they?</h1>
                      <p className="text-fg-secondary">Give your agent a name, an icon, and a specific role.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="flex gap-6">
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-fg-secondary">Emoji</label>
                          <div className="p-4 bg-surface-1 border border-tok-border rounded-2xl grid grid-cols-5 gap-2 w-fit">
                            {EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => setFormData({ ...formData, emoji })}
                                className={cn(
                                  'w-10 h-10 flex items-center justify-center rounded-lg text-2xl transition-all',
                                  formData.emoji === emoji ? 'bg-violet-600 scale-110' : 'hover:bg-surface-2',
                                )}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>

                          <div className="p-4 bg-surface-1 border border-tok-border rounded-2xl w-44">
                            <p className="text-xs text-fg-muted mb-2">Current Avatar</p>
                            {formData.approvedAvatarDataUrl ? (
                              <img
                                src={formData.approvedAvatarDataUrl}
                                alt="Approved generated avatar"
                                className="w-20 h-20 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-xl bg-violet-600 flex items-center justify-center text-4xl">
                                {formData.emoji}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 space-y-6">
                          <div className="space-y-2">
                            <label htmlFor="wizard-agent-name" className="text-sm font-medium text-fg-secondary">Agent Name</label>
                            <input
                              id="wizard-agent-name"
                              type="text"
                              placeholder="e.g. Jarvis, Friday, Marvin"
                              value={formData.name}
                              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                              className="w-full bg-surface-1 border border-tok-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="wizard-agent-role" className="text-sm font-medium text-fg-secondary">Role & Responsibilities</label>
                            <textarea
                              id="wizard-agent-role"
                              rows={4}
                              placeholder="Describe what this agent does..."
                              value={formData.role}
                              onChange={(event) => setFormData({ ...formData, role: event.target.value })}
                              className="w-full bg-surface-1 border border-tok-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all resize-none"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <div title={generateAvatarDisabledReason ?? ''} className="inline-flex">
                              <button
                                onClick={() => void handleGenerateAvatar()}
                                disabled={Boolean(generateAvatarDisabledReason)}
                                className={cn(
                                  'flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all',
                                  generateAvatarDisabledReason
                                    ? 'bg-surface-2 text-fg-muted cursor-not-allowed border border-tok-border'
                                    : 'bg-violet-600 hover:bg-violet-500 text-fg-primary shadow-lg shadow-violet-600/20',
                                )}
                              >
                                {avatarGenerating ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Generating Avatar...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4" />
                                    Generate Avatar & Emoji
                                  </>
                                )}
                              </button>
                            </div>
                            {avatarCapability?.supported && (
                              <span className="text-xs text-fg-muted">Uses Gemini Nano Banana</span>
                            )}
                          </div>

                          {avatarError && (
                            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                              {avatarError}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 'personality' && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Fine-tune Personality</h1>
                      <p className="text-fg-secondary">Adjust how your agent interacts and communicates.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 max-w-2xl">
                      {[
                        { key: 'formality', label: 'Formality', low: 'Casual', high: 'Formal' },
                        { key: 'humor', label: 'Humor', low: 'Serious', high: 'Playful' },
                        { key: 'verbosity', label: 'Verbosity', low: 'Concise', high: 'Detailed' },
                        { key: 'empathy', label: 'Empathy', low: 'Direct', high: 'Supportive' },
                      ].map((trait) => (
                        <div key={trait.key} className="space-y-4">
                          <div className="flex justify-between items-center">
                            <label className="font-medium text-lg">{trait.label}</label>
                            <span className="text-violet-500 font-bold">{formData.personality[trait.key as keyof typeof formData.personality]}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={formData.personality[trait.key as keyof typeof formData.personality]}
                            onChange={(event) => setFormData({
                              ...formData,
                              personality: {
                                ...formData.personality,
                                [trait.key]: Number.parseInt(event.target.value, 10),
                              },
                            })}
                            className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-violet-600"
                          />
                          <div className="flex justify-between text-xs text-fg-muted font-medium">
                            <span>{trait.low}</span>
                            <span>{trait.high}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 'model' && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Select Engine</h1>
                      <p className="text-fg-secondary">The underlying model powers the intelligence of your agent.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {MODELS.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setFormData({ ...formData, model: model.id })}
                          className={cn(
                            'p-6 rounded-2xl border flex items-center justify-between text-left transition-all',
                            formData.model === model.id
                              ? 'border-violet-600 bg-violet-600/10 ring-1 ring-violet-600'
                              : 'border-tok-border bg-surface-1 hover:border-tok-border',
                          )}
                        >
                          <div className="flex items-center gap-6">
                            <div className={cn(
                              'w-14 h-14 rounded-xl flex items-center justify-center',
                              formData.model === model.id ? 'bg-violet-600 text-fg-primary' : 'bg-surface-2 text-fg-secondary',
                            )}>
                              <Shield className="w-8 h-8" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold">{model.name}</h3>
                              <p className="text-fg-secondary">{model.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex gap-2 mb-1">
                              <span className="text-xs px-2 py-1 bg-surface-2 rounded text-fg-secondary uppercase tracking-wider font-bold">{model.speed}</span>
                              <span className="text-xs px-2 py-1 bg-surface-2 rounded text-fg-secondary uppercase tracking-wider font-bold">{model.quality}</span>
                            </div>
                            <span className="text-violet-500 font-bold">{model.cost}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 'review' && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Final Review</h1>
                      <p className="text-fg-secondary">Everything look correct? Your agent is ready to be deployed.</p>
                    </div>

                    <div className="bg-surface-1 border border-tok-border rounded-2xl overflow-hidden">
                      <div className="p-8 border-b border-tok-border flex items-center gap-6 bg-gradient-to-r from-violet-600/10 to-transparent">
                        {formData.approvedAvatarDataUrl ? (
                          <img
                            src={formData.approvedAvatarDataUrl}
                            alt={`${formData.name || 'Agent'} avatar`}
                            className="w-20 h-20 rounded-2xl object-cover shadow-xl"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-violet-600 rounded-2xl flex items-center justify-center text-4xl shadow-xl">
                            {formData.emoji}
                          </div>
                        )}
                        <div>
                          <h2 className="text-2xl font-bold">{formData.name || 'Unnamed Agent'}</h2>
                          <p className="text-fg-secondary">{MODELS.find((model) => model.id === formData.model)?.name}</p>
                        </div>
                      </div>

                      <div className="p-8 grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-fg-muted uppercase tracking-widest">Role</h4>
                          <p className="text-fg-primary leading-relaxed">{formData.role || 'No role description provided.'}</p>
                        </div>

                        <div className="space-y-6">
                          <h4 className="text-xs font-bold text-fg-muted uppercase tracking-widest">Personality</h4>
                          <div className="space-y-3">
                            {Object.entries(formData.personality).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between text-sm">
                                <span className="capitalize text-fg-secondary">{key}</span>
                                <div className="flex items-center gap-3">
                                  <div className="w-24 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-violet-600" style={{ width: `${value}%` }} />
                                  </div>
                                  <span className="text-fg-primary font-mono w-8 text-right">{value}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-violet-600/10 border border-violet-600/20 rounded-xl p-4 flex items-start gap-4">
                      <Bot className="w-6 h-6 text-violet-500 shrink-0" />
                      <p className="text-sm text-violet-200/80">
                        Creating an agent will initialize a new neural workspace. You can always change these settings later in the agent management view.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 md:p-6 border-t border-tok-border bg-surface-1 flex justify-between items-center">
            <button
              onClick={prevStep}
              disabled={stepIndex === 0 || loading}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                stepIndex === 0 ? 'opacity-0 pointer-events-none' : 'hover:bg-surface-2 text-fg-secondary',
              )}
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <button
              onClick={nextStep}
              disabled={loading || (currentStep === 'identity' && !formData.name.trim())}
              className={cn(
                'flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg',
                currentStep === 'review'
                  ? 'bg-violet-600 hover:bg-violet-500 text-fg-primary shadow-violet-600/20'
                  : 'bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]',
              )}
            >
              {currentStep === 'review' ? (
                <>
                  Create Agent
                  <Rocket className="w-5 h-5" />
                </>
              ) : (
                <>
                  Next Step
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {avatarApprovalOpen && avatarCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-tok-border bg-surface-1 shadow-2xl">
            <div className="flex items-center justify-between border-b border-tok-border px-5 py-4">
              <h2 className="text-lg font-semibold text-fg-primary">Approve Generated Avatar</h2>
              <button
                onClick={() => setAvatarApprovalOpen(false)}
                className="rounded-md p-1 text-fg-muted hover:text-fg-primary hover:bg-surface-2"
                aria-label="Close avatar approval modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <p className="text-sm text-fg-secondary">
                Review the generated avatar and emoji. Approving will keep this avatar for the rest of the builder flow.
              </p>
              <div className="flex items-center gap-5 rounded-xl border border-tok-border bg-surface-2 p-4">
                <img
                  src={avatarCandidate.imageDataUrl}
                  alt="Generated avatar candidate"
                  className="w-28 h-28 rounded-xl object-cover"
                />
                <div className="space-y-2">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-fg-muted">Suggested Emoji</p>
                    <p className="text-3xl">{avatarCandidate.emoji}</p>
                  </div>
                  <p className="text-xs text-fg-muted">Model: {avatarCandidate.model}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-tok-border px-5 py-4">
              <button
                onClick={() => setAvatarApprovalOpen(false)}
                className="px-4 py-2 rounded-lg border border-tok-border text-fg-secondary hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveAvatar}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-fg-primary font-semibold"
              >
                Approve Avatar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
