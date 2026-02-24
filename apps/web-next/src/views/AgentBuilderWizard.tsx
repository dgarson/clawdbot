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

import { Skeleton } from '../components/Skeleton';

function AgentBuilderWizardSkeleton() {
  return (
    <div className="flex h-full bg-gray-950 text-white">
      {/* Sidebar skeleton */}
      <div className="w-64 border-r border-gray-800 p-8 flex flex-col">
        <Skeleton className="h-7 w-32 mb-8" />
        <div className="space-y-8 relative">
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-800" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 relative z-10">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-12">
          <div className="max-w-4xl space-y-8">
            <div className="space-y-2">
              <Skeleton className="h-9 w-72" />
              <Skeleton className="h-4 w-96" />
            </div>
            {/* Template grid */}
            <div className="grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-6 rounded-2xl border border-gray-800 bg-gray-900 space-y-3">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-900 flex justify-between items-center">
          <Skeleton className="h-10 w-24 rounded-xl opacity-0" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function AgentBuilderWizard({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <AgentBuilderWizardSkeleton />;

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
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setCurrentStep('success');
    }, 2000);
  };

  if (currentStep === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="relative">
          <div className="w-24 h-24 bg-violet-600 rounded-full flex items-center justify-center text-5xl shadow-2xl shadow-violet-500/20">
            {formData.emoji}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 border-4 border-gray-950">
            <Check className="w-6 h-6 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Agent Created!</h1>
          <p className="text-gray-400">
            <span className="font-semibold text-white">{formData.name}</span> is ready to assist you.
          </p>
        </div>
        <button 
          className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-violet-600/20 active:scale-95 flex items-center gap-2"
          onClick={() => window.location.reload()}
        >
          <MessageSquare className="w-5 h-5" />
          Start Chatting
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-950 text-white">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-800 p-8 flex flex-col">
        <h2 className="text-xl font-bold mb-8">Create Agent</h2>
        <div className="space-y-8 relative">
          {/* Connection Line */}
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-800" />
          
          {STEPS.map((step, idx) => {
            const isCompleted = idx < stepIndex;
            const isActive = idx === stepIndex;
            
            return (
              <div key={step.id} className="flex items-center gap-4 relative z-10">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                  isCompleted ? "bg-violet-600 text-white" : 
                  isActive ? "border-2 border-violet-600 text-violet-600 bg-gray-950" : 
                  "border-2 border-gray-800 text-gray-500 bg-gray-950"
                )}>
                  {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={cn(
                  "font-medium transition-colors",
                  isActive ? "text-white" : "text-gray-500"
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-12">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 animate-pulse">Summoning your new agent...</p>
            </div>
          ) : (
            <div className="max-w-4xl">
              {currentStep === 'template' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">Choose a Template</h1>
                    <p className="text-gray-400">Start with a pre-configured personality or build from scratch.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setFormData({ ...formData, template: t.id })}
                        className={cn(
                          "p-6 rounded-2xl border text-left transition-all group",
                          formData.template === t.id 
                            ? "border-violet-600 bg-violet-600/10 ring-1 ring-violet-600" 
                            : "border-gray-800 bg-gray-900 hover:border-gray-700"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
                          formData.template === t.id ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 group-hover:bg-gray-700"
                        )}>
                          <t.icon className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold mb-1">{t.name}</h3>
                        <p className="text-sm text-gray-400">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 'identity' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">Who are they?</h1>
                    <p className="text-gray-400">Give your agent a name, an icon, and a specific role.</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Emoji</label>
                        <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl grid grid-cols-5 gap-2 w-fit">
                          {EMOJIS.map(e => (
                            <button
                              key={e}
                              onClick={() => setFormData({ ...formData, emoji: e })}
                              className={cn(
                                "w-10 h-10 flex items-center justify-center rounded-lg text-2xl transition-all",
                                formData.emoji === e ? "bg-violet-600 scale-110" : "hover:bg-gray-800"
                              )}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-6">
                        <div className="space-y-2">
                          <label htmlFor="wizard-agent-name" className="text-sm font-medium text-gray-400">Agent Name</label>
                          <input
                            id="wizard-agent-name"
                            type="text"
                            placeholder="e.g. Jarvis, Friday, Marvin"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="wizard-agent-role" className="text-sm font-medium text-gray-400">Role & Responsibilities</label>
                          <textarea
                            id="wizard-agent-role"
                            rows={4}
                            placeholder="Describe what this agent does..."
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent transition-all resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 'personality' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">Fine-tune Personality</h1>
                    <p className="text-gray-400">Adjust how your agent interacts and communicates.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-8 max-w-2xl">
                    {[
                      { key: 'formality', label: 'Formality', low: 'Casual', high: 'Formal' },
                      { key: 'humor', label: 'Humor', low: 'Serious', high: 'Playful' },
                      { key: 'verbosity', label: 'Verbosity', low: 'Concise', high: 'Detailed' },
                      { key: 'empathy', label: 'Empathy', low: 'Direct', high: 'Supportive' },
                    ].map(trait => (
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
                          onChange={e => setFormData({
                            ...formData,
                            personality: { ...formData.personality, [trait.key]: parseInt(e.target.value) }
                          })}
                          className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                        <div className="flex justify-between text-xs text-gray-500 font-medium">
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
                    <p className="text-gray-400">The underlying model powers the intelligence of your agent.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setFormData({ ...formData, model: m.id })}
                        className={cn(
                          "p-6 rounded-2xl border flex items-center justify-between text-left transition-all",
                          formData.model === m.id 
                            ? "border-violet-600 bg-violet-600/10 ring-1 ring-violet-600" 
                            : "border-gray-800 bg-gray-900 hover:border-gray-700"
                        )}
                      >
                        <div className="flex items-center gap-6">
                          <div className={cn(
                            "w-14 h-14 rounded-xl flex items-center justify-center",
                            formData.model === m.id ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400"
                          )}>
                            <Shield className="w-8 h-8" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold">{m.name}</h3>
                            <p className="text-gray-400">{m.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex gap-2 mb-1">
                            <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-400 uppercase tracking-wider font-bold">{m.speed}</span>
                            <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-400 uppercase tracking-wider font-bold">{m.quality}</span>
                          </div>
                          <span className="text-violet-500 font-bold">{m.cost}</span>
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
                    <p className="text-gray-400">Everything look correct? Your agent is ready to be deployed.</p>
                  </div>

                  <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="p-8 border-b border-gray-800 flex items-center gap-6 bg-gradient-to-r from-violet-600/10 to-transparent">
                      <div className="w-20 h-20 bg-violet-600 rounded-2xl flex items-center justify-center text-4xl shadow-xl">
                        {formData.emoji}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{formData.name || 'Unnamed Agent'}</h2>
                        <p className="text-gray-400">{MODELS.find(m => m.id === formData.model)?.name}</p>
                      </div>
                    </div>
                    
                    <div className="p-8 grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Role</h4>
                        <p className="text-gray-300 leading-relaxed">{formData.role || 'No role description provided.'}</p>
                      </div>
                      
                      <div className="space-y-6">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Personality</h4>
                        <div className="space-y-3">
                          {Object.entries(formData.personality).map(([key, val]) => (
                            <div key={key} className="flex items-center justify-between text-sm">
                              <span className="capitalize text-gray-400">{key}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-violet-600" style={{ width: `${val}%` }} />
                                </div>
                                <span className="text-gray-200 font-mono w-8 text-right">{val}%</span>
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

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-900 flex justify-between items-center">
          <button
            onClick={prevStep}
            disabled={stepIndex === 0 || loading}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
              stepIndex === 0 ? "opacity-0 pointer-events-none" : "hover:bg-gray-800 text-gray-400"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          
          <button
            onClick={nextStep}
            disabled={loading || (currentStep === 'identity' && !formData.name)}
            className={cn(
              "flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg",
              currentStep === 'review' 
                ? "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/20" 
                : "bg-white text-gray-900 hover:bg-gray-200"
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
  );
}
