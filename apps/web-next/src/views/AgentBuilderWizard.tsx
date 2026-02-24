import React, { useState } from 'react';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  User, 
  Code, 
  Mail, 
  PenTool, 
  BarChart2, 
  Zap, 
  Smile, 
  MessageSquare, 
  Shield, 
  Bot,
  Sparkles,
  Rocket
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useGateway } from '../hooks/useGateway';

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
}

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

export default function AgentBuilderWizard() {
  const [currentStep, setCurrentStep] = useState<Step>('template');
  const [loading, setLoading] = useState(false);
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
  });

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);

  const nextStep = () => {
    const nextIdx = stepIndex + 1;
    if (nextIdx < STEPS.length) {
      setCurrentStep(STEPS[nextIdx].id);
    } else if (currentStep === 'review') {
      handleCreate();
    }
  };

  const prevStep = () => {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) {
      setCurrentStep(STEPS[prevIdx].id);
    }
  };

  const handleCreate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setCurrentStep('success');
    }, 2000);
  };

  if (currentStep === 'success') {
    return (
      <>
        <a href="#abw-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-surface-0 focus:text-fg-primary focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
          Skip to main content
        </a>
        <main id="abw-main" className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="w-24 h-24 bg-violet-600 rounded-full flex items-center justify-center text-5xl shadow-2xl shadow-violet-500/20" aria-hidden="true">
              {formData.emoji}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 border-4 border-surface-0" aria-hidden="true">
              <Check className="w-6 h-6 text-fg-primary" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-fg-primary mb-2">Agent Created!</h1>
            <p className="text-fg-secondary">
              <span className="font-semibold text-fg-primary">{formData.name}</span> is ready to assist you.
            </p>
          </div>
          <button
            className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-fg-primary font-medium rounded-xl transition-all shadow-lg shadow-violet-600/20 active:scale-95 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            onClick={() => window.location.reload()}
          >
            <MessageSquare className="w-5 h-5" aria-hidden="true" />
            Start Chatting
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <a href="#abw-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-surface-0 focus:text-fg-primary focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none">
        Skip to main content
      </a>
      <div className="flex h-full bg-surface-0 text-fg-primary">
        {/* Sidebar — step tracker */}
        <nav className="hidden md:flex w-64 border-r border-tok-border p-8 flex-col" aria-label="Wizard steps">
          <h2 className="text-xl font-bold mb-8">Create Agent</h2>
          <ol className="space-y-8 relative">
            {/* Connection Line */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-surface-2" aria-hidden="true" />

            {STEPS.map((step, idx) => {
              const isCompleted = idx < stepIndex;
              const isActive = idx === stepIndex;

              return (
                <li key={step.id} className="flex items-center gap-4 relative z-10">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                      isCompleted ? "bg-violet-600 text-fg-primary" :
                      isActive ? "border-2 border-violet-600 text-violet-600 bg-surface-0" :
                      "border-2 border-tok-border text-fg-muted bg-surface-0"
                    )}
                    aria-current={isActive ? 'step' : undefined}
                  >
                    {isCompleted ? <Check className="w-4 h-4" aria-hidden="true" /> : <span aria-hidden="true">{idx + 1}</span>}
                    <span className="sr-only">{isCompleted ? 'Completed: ' : isActive ? 'Current: ' : ''}{step.label}</span>
                  </div>
                  <span className={cn("font-medium transition-colors", isActive ? "text-fg-primary" : "text-fg-muted")} aria-hidden="true">
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Mobile step indicator */}
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-tok-border bg-surface-1" aria-label="Wizard progress">
            <span className="text-sm font-semibold text-fg-primary">Create Agent</span>
            <div className="flex items-center gap-1.5" role="group" aria-label="Steps">
              {STEPS.map((step, idx) => (
                <div
                  key={step.id}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    idx < stepIndex ? "bg-violet-600" :
                    idx === stepIndex ? "bg-violet-400" :
                    "bg-surface-3"
                  )}
                  aria-label={`Step ${idx + 1}: ${step.label}${idx < stepIndex ? ' (completed)' : idx === stepIndex ? ' (current)' : ''}`}
                />
              ))}
            </div>
            <span className="text-xs text-fg-muted" aria-live="polite">{STEPS[stepIndex]?.label}</span>
          </div>

          <main id="abw-main" className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-12">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4" role="status" aria-live="polite">
                <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                <p className="text-fg-secondary motion-safe:animate-pulse">Summoning your new agent…</p>
              </div>
            ) : (
              <div className="max-w-4xl">
                {currentStep === 'template' && (
                  <section className="space-y-8 animate-in slide-in-from-right-4 duration-300" aria-label="Choose a template">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Choose a Template</h1>
                      <p className="text-fg-secondary">Start with a pre-configured personality or build from scratch.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setFormData({ ...formData, template: t.id })}
                          aria-pressed={formData.template === t.id}
                          className={cn(
                            "p-6 rounded-2xl border text-left transition-all group focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                            formData.template === t.id
                              ? "border-violet-600 bg-violet-600/10 ring-1 ring-violet-600"
                              : "border-tok-border bg-surface-1 hover:border-tok-border"
                          )}
                        >
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
                            formData.template === t.id ? "bg-violet-600 text-fg-primary" : "bg-surface-2 text-fg-secondary group-hover:bg-surface-3"
                          )}>
                            <t.icon className="w-6 h-6" aria-hidden="true" />
                          </div>
                          <h3 className="text-lg font-bold mb-1">{t.name}</h3>
                          <p className="text-sm text-fg-secondary">{t.description}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {currentStep === 'identity' && (
                  <section className="space-y-8 animate-in slide-in-from-right-4 duration-300" aria-label="Agent identity">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Who are they?</h1>
                      <p className="text-fg-secondary">Give your agent a name, an icon, and a specific role.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="flex gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-fg-secondary" id="emoji-picker-label">Emoji</label>
                          <div
                            className="p-4 bg-surface-1 border border-tok-border rounded-2xl grid grid-cols-5 gap-2 w-fit"
                            role="radiogroup"
                            aria-labelledby="emoji-picker-label"
                          >
                            {EMOJIS.map(e => (
                              <button
                                key={e}
                                onClick={() => setFormData({ ...formData, emoji: e })}
                                role="radio"
                                aria-checked={formData.emoji === e}
                                aria-label={`Select emoji ${e}`}
                                className={cn(
                                  "w-10 h-10 flex items-center justify-center rounded-lg text-2xl transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                                  formData.emoji === e ? "bg-violet-600 scale-110" : "hover:bg-surface-2"
                                )}
                              >
                                <span aria-hidden="true">{e}</span>
                              </button>
                            ))}
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
                              onChange={e => setFormData({ ...formData, name: e.target.value })}
                              className="w-full bg-surface-1 border border-tok-border rounded-xl px-4 py-3 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="wizard-agent-role" className="text-sm font-medium text-fg-secondary">Role & Responsibilities</label>
                            <textarea
                              id="wizard-agent-role"
                              rows={4}
                              placeholder="Describe what this agent does..."
                              value={formData.role}
                              onChange={e => setFormData({ ...formData, role: e.target.value })}
                              className="w-full bg-surface-1 border border-tok-border rounded-xl px-4 py-3 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none transition-all resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {currentStep === 'personality' && (
                  <section className="space-y-8 animate-in slide-in-from-right-4 duration-300" aria-label="Personality settings">
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
                      ].map(trait => {
                        const inputId = `personality-${trait.key}`;
                        return (
                          <div key={trait.key} className="space-y-4">
                            <div className="flex justify-between items-center">
                              <label htmlFor={inputId} className="font-medium text-lg">{trait.label}</label>
                              <span className="text-violet-500 font-bold" aria-live="polite">
                                {formData.personality[trait.key as keyof typeof formData.personality]}%
                              </span>
                            </div>
                            <input
                              id={inputId}
                              type="range"
                              min="0"
                              max="100"
                              value={formData.personality[trait.key as keyof typeof formData.personality]}
                              onChange={e => setFormData({
                                ...formData,
                                personality: { ...formData.personality, [trait.key]: parseInt(e.target.value) }
                              })}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={formData.personality[trait.key as keyof typeof formData.personality]}
                              className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                            />
                            <div className="flex justify-between text-xs text-fg-muted font-medium" aria-hidden="true">
                              <span>{trait.low}</span>
                              <span>{trait.high}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {currentStep === 'model' && (
                  <section className="space-y-8 animate-in slide-in-from-right-4 duration-300" aria-label="Select AI model">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Select Engine</h1>
                      <p className="text-fg-secondary">The underlying model powers the intelligence of your agent.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4" role="radiogroup" aria-label="AI model selection">
                      {MODELS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setFormData({ ...formData, model: m.id })}
                          role="radio"
                          aria-checked={formData.model === m.id}
                          className={cn(
                            "p-6 rounded-2xl border flex items-center justify-between text-left transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                            formData.model === m.id
                              ? "border-violet-600 bg-violet-600/10 ring-1 ring-violet-600"
                              : "border-tok-border bg-surface-1 hover:border-tok-border"
                          )}
                        >
                          <div className="flex items-center gap-6">
                            <div className={cn(
                              "w-14 h-14 rounded-xl flex items-center justify-center",
                              formData.model === m.id ? "bg-violet-600 text-fg-primary" : "bg-surface-2 text-fg-secondary"
                            )}>
                              <Shield className="w-8 h-8" aria-hidden="true" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold">{m.name}</h3>
                              <p className="text-fg-secondary">{m.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex gap-2 mb-1">
                              <span className="text-xs px-2 py-1 bg-surface-2 rounded text-fg-secondary uppercase tracking-wider font-bold">{m.speed}</span>
                              <span className="text-xs px-2 py-1 bg-surface-2 rounded text-fg-secondary uppercase tracking-wider font-bold">{m.quality}</span>
                            </div>
                            <span className="text-violet-500 font-bold">{m.cost}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {currentStep === 'review' && (
                  <section className="space-y-8 animate-in slide-in-from-right-4 duration-300" aria-label="Review and confirm">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Final Review</h1>
                      <p className="text-fg-secondary">Everything look correct? Your agent is ready to be deployed.</p>
                    </div>

                    <div className="bg-surface-1 border border-tok-border rounded-2xl overflow-hidden">
                      <div className="p-8 border-b border-tok-border flex items-center gap-6 bg-gradient-to-r from-violet-600/10 to-transparent">
                        <div className="w-20 h-20 bg-violet-600 rounded-2xl flex items-center justify-center text-4xl shadow-xl" aria-hidden="true">
                          {formData.emoji}
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">{formData.name || 'Unnamed Agent'}</h2>
                          <p className="text-fg-secondary">{MODELS.find(m => m.id === formData.model)?.name}</p>
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
                            {Object.entries(formData.personality).map(([key, val]) => (
                              <div key={key} className="flex items-center justify-between text-sm">
                                <span className="capitalize text-fg-secondary">{key}</span>
                                <div className="flex items-center gap-3">
                                  <div className="w-24 h-1.5 bg-surface-2 rounded-full overflow-hidden" role="progressbar" aria-valuenow={val} aria-valuemin={0} aria-valuemax={100} aria-label={`${key}: ${val}%`}>
                                    <div className="h-full bg-violet-600" style={{ width: `${val}%` }} />
                                  </div>
                                  <span className="text-fg-primary font-mono w-8 text-right">{val}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-violet-600/10 border border-violet-600/20 rounded-xl p-4 flex items-start gap-4">
                      <Bot className="w-6 h-6 text-violet-500 shrink-0" aria-hidden="true" />
                      <p className="text-sm text-violet-200/80">
                        Creating an agent will initialize a new neural workspace. You can always change these settings later in the agent management view.
                      </p>
                    </div>
                  </section>
                )}
              </div>
            )}
          </main>

          {/* Footer */}
          <div className="p-3 sm:p-4 md:p-6 border-t border-tok-border bg-surface-1 flex justify-between items-center">
            <button
              onClick={prevStep}
              disabled={stepIndex === 0 || loading}
              aria-label="Go to previous step"
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                stepIndex === 0 ? "opacity-0 pointer-events-none" : "hover:bg-surface-2 text-fg-secondary"
              )}
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
              Back
            </button>

            <button
              onClick={nextStep}
              disabled={loading || (currentStep === 'identity' && !formData.name)}
              aria-label={currentStep === 'review' ? 'Create agent' : 'Go to next step'}
              className={cn(
                "flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                currentStep === 'review'
                  ? "bg-violet-600 hover:bg-violet-500 text-fg-primary shadow-violet-600/20"
                  : "bg-white text-gray-900 hover:bg-gray-200"
              )}
            >
              {currentStep === 'review' ? (
                <>
                  Create Agent
                  <Rocket className="w-5 h-5" aria-hidden="true" />
                </>
              ) : (
                <>
                  Next Step
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
