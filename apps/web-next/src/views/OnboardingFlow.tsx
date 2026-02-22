import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { Sparkles, ChevronRight, ChevronLeft, Check, Bot, Zap, Brain, Users, Settings } from 'lucide-react';

type ProficiencyLevel = 'beginner' | 'standard' | 'expert';

interface QuizAnswer {
  question: number;
  value: number;
}

interface SetupStep {
  id: number;
  title: string;
  description: string;
}

const QUIZ_QUESTIONS = [
  {
    id: 0,
    question: 'Have you used AI assistants before?',
    options: [
      { label: 'Not really', value: 0, emoji: '👋' },
      { label: "Yes, I've used ChatGPT or similar", value: 2, emoji: '🤖' },
      { label: "I've built or configured AI tools", value: 3, emoji: '⚙️' },
    ],
  },
  {
    id: 1,
    question: 'How comfortable are you with configuration files?',
    options: [
      { label: "What's a config file?", value: 0, emoji: '😅' },
      { label: "I can edit them if I need to", value: 2, emoji: '📝' },
      { label: 'I write YAML and JSON daily', value: 3, emoji: '💻' },
    ],
  },
  {
    id: 2,
    question: "What's your main goal with OpenClaw?",
    options: [
      { label: 'Personal assistant for everyday tasks', value: 0, emoji: '🧑‍💼' },
      { label: 'Automate workflows and processes', value: 2, emoji: '⚡' },
      { label: 'Build and manage a fleet of agents', value: 3, emoji: '🚀' },
    ],
  },
];

const LEVEL_DESCRIPTIONS: Record<ProficiencyLevel, {
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  features: string[];
}> = {
  beginner: {
    title: 'Guided Mode',
    subtitle: "We'll walk you through everything step by step",
    emoji: '🌱',
    color: 'text-green-400',
    features: [
      'Simple, friendly interface',
      'Step-by-step agent creation',
      'Helpful tooltips everywhere',
      'Pre-configured templates',
    ],
  },
  standard: {
    title: 'Standard Mode',
    subtitle: 'Balanced power and simplicity',
    emoji: '⚡',
    color: 'text-violet-400',
    features: [
      'Visual form-based agent builder',
      'Schedule automations easily',
      'Connect channels and skills',
      'Usage analytics dashboard',
    ],
  },
  expert: {
    title: 'Expert Mode',
    subtitle: 'Full control over everything',
    emoji: '🔬',
    color: 'text-blue-400',
    features: [
      'Direct file editing (SOUL.md, etc.)',
      'Raw cron expressions',
      'Config editor with JSON/YAML',
      'Debug views and logs',
    ],
  },
};

const TEMPLATE_OPTIONS = [
  { id: 'assistant', emoji: '🧑‍💼', name: 'Personal Assistant', description: 'Schedule, tasks, reminders' },
  { id: 'coder', emoji: '💻', name: 'Code Reviewer', description: 'PR reviews, code analysis' },
  { id: 'writer', emoji: '🎨', name: 'Creative Writer', description: 'Content creation, brainstorming' },
  { id: 'analyst', emoji: '📊', name: 'Data Analyst', description: 'Data queries, reports' },
  { id: 'email', emoji: '📧', name: 'Email Manager', description: 'Inbox triage, drafting' },
  { id: 'blank', emoji: '⬜', name: 'Blank Agent', description: 'Start from scratch' },
];

const SETUP_STEPS: SetupStep[] = [
  { id: 1, title: 'Welcome', description: 'Quick setup quiz' },
  { id: 2, title: 'Your Level', description: 'Interface mode' },
  { id: 3, title: 'First Agent', description: 'Create your agent' },
  { id: 4, title: "You're Ready!", description: 'Start exploring' },
];

export default function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(1);
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [proficiency, setProficiency] = useState<ProficiencyLevel | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [complete, setComplete] = useState(false);

  const totalScore = answers.reduce((sum, a) => sum + a.value, 0);

  function scoreToLevel(score: number): ProficiencyLevel {
    if (score <= 2) return 'beginner';
    if (score <= 5) return 'standard';
    return 'expert';
  }

  function handleQuizAnswer(value: number) {
    const newAnswers = [...answers.filter(a => a.question !== quizStep), { question: quizStep, value }];
    setAnswers(newAnswers);
    if (quizStep < QUIZ_QUESTIONS.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      const score = newAnswers.reduce((s, a) => s + a.value, 0);
      setProficiency(scoreToLevel(score));
      setCurrentStep(2);
    }
  }

  function handleNext() {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
    else setComplete(true);
  }

  function handleBack() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  if (complete) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center text-5xl mx-auto mb-6 shadow-2xl shadow-violet-900/50">
            🎉
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">You're all set!</h1>
          <p className="text-gray-400 mb-8">
            Your workspace is ready. Your first agent is configured in{' '}
            <span className="text-violet-400 font-medium">{LEVEL_DESCRIPTIONS[proficiency ?? 'standard'].title}</span>.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="w-full py-3 px-6 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Bot className="w-5 h-5" />
              Start chatting with your agent
            </button>
            <button
              type="button"
              className="w-full py-3 px-6 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
            >
              Explore the dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Left sidebar - progress */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">OpenClaw</span>
        </div>

        <div className="space-y-4">
          {SETUP_STEPS.map((step, idx) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <div key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                    isCompleted ? 'bg-violet-600 text-white' :
                    isCurrent ? 'bg-violet-600/20 border-2 border-violet-500 text-violet-400' :
                    'bg-gray-800 border border-gray-700 text-gray-500'
                  )}>
                    {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                  </div>
                  {idx < SETUP_STEPS.length - 1 && (
                    <div className={cn('w-px flex-1 mt-1', isCompleted ? 'bg-violet-600/50' : 'bg-gray-800')} style={{ minHeight: '24px' }} />
                  )}
                </div>
                <div className="pb-6">
                  <p className={cn('text-sm font-medium', isCurrent ? 'text-white' : isCompleted ? 'text-gray-300' : 'text-gray-600')}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto">
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">Setup progress</p>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${((currentStep - 1) / (SETUP_STEPS.length - 1)) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">{currentStep} of {SETUP_STEPS.length} steps</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          {/* Step 1: Quiz */}
          {currentStep === 1 && (
            <div className="max-w-lg w-full">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Welcome to OpenClaw</h1>
                <p className="text-gray-400">Let's personalize your experience. Just 3 quick questions.</p>
              </div>

              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
                <div className="flex items-center gap-2 mb-6">
                  {QUIZ_QUESTIONS.map((q, i) => (
                    <div key={q.id} className={cn(
                      'flex-1 h-1 rounded-full transition-all duration-300',
                      i < quizStep ? 'bg-violet-600' : i === quizStep ? 'bg-violet-500/50' : 'bg-gray-800'
                    )} />
                  ))}
                </div>

                <p className="text-xs text-gray-500 mb-2">Question {quizStep + 1} of {QUIZ_QUESTIONS.length}</p>
                <h2 className="text-lg font-semibold text-white mb-6">
                  {QUIZ_QUESTIONS[quizStep].question}
                </h2>

                <div className="space-y-3">
                  {QUIZ_QUESTIONS[quizStep].options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleQuizAnswer(opt.value)}
                      className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-violet-500/50 rounded-xl transition-all duration-200 text-left group"
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span className="text-gray-200 group-hover:text-white font-medium">{opt.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-violet-400 ml-auto transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Level result */}
          {currentStep === 2 && proficiency && (
            <div className="max-w-lg w-full">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Your Interface Mode</h1>
                <p className="text-gray-400">Based on your answers, we recommend:</p>
              </div>

              <div className="space-y-4">
                {(Object.entries(LEVEL_DESCRIPTIONS) as [ProficiencyLevel, typeof LEVEL_DESCRIPTIONS[ProficiencyLevel]][]).map(([level, info]) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setProficiency(level)}
                    className={cn(
                      'w-full p-5 rounded-2xl border transition-all duration-200 text-left',
                      proficiency === level
                        ? 'bg-violet-600/10 border-violet-500 ring-2 ring-violet-500/30'
                        : 'bg-gray-900 border-gray-800 hover:border-gray-600'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{info.emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={cn('text-base font-bold text-white')}>{info.title}</h3>
                          {level === proficiency && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-medium">Recommended</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mb-3">{info.subtitle}</p>
                        <ul className="space-y-1">
                          {info.features.map((f) => (
                            <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                              <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                You can always change this in Settings → Interface
              </p>
            </div>
          )}

          {/* Step 3: First agent */}
          {currentStep === 3 && (
            <div className="max-w-xl w-full">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Create Your First Agent</h1>
                <p className="text-gray-400">Choose a template to get started quickly, or start blank.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {TEMPLATE_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplate(t.id)}
                    className={cn(
                      'p-4 rounded-xl border text-left transition-all duration-200',
                      selectedTemplate === t.id
                        ? 'bg-violet-600/10 border-violet-500 ring-2 ring-violet-500/30'
                        : 'bg-gray-900 border-gray-800 hover:border-gray-600'
                    )}
                  >
                    <span className="text-3xl block mb-2">{t.emoji}</span>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.description}</p>
                  </button>
                ))}
              </div>

              {selectedTemplate && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <label htmlFor="agent-name-input" className="block text-sm text-gray-400 mb-2">Agent Name</label>
                  <input
                    id="agent-name-input"
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder={TEMPLATE_OPTIONS.find(t => t.id === selectedTemplate)?.name ?? 'My Agent'}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Done */}
          {currentStep === 4 && proficiency && (
            <div className="max-w-lg w-full text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center text-4xl mx-auto mb-6 shadow-2xl shadow-violet-900/30">
                🎊
              </div>
              <h1 className="text-3xl font-bold text-white mb-3">You're ready!</h1>
              <p className="text-gray-400 mb-8 text-lg">
                OpenClaw is configured in{' '}
                <span className={cn('font-semibold', LEVEL_DESCRIPTIONS[proficiency].color)}>
                  {LEVEL_DESCRIPTIONS[proficiency].title}
                </span>.
                {agentName && (
                  <> Your agent <span className="text-white font-semibold">"{agentName}"</span> is ready to chat.</>
                )}
              </p>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { icon: Bot, label: 'Chat', desc: 'Talk to your agents', color: 'text-violet-400' },
                  { icon: Zap, label: 'Automate', desc: 'Schedule tasks', color: 'text-amber-400' },
                  { icon: Settings, label: 'Configure', desc: 'Customize everything', color: 'text-gray-400' },
                ].map(({ icon: Icon, label, desc, color }) => (
                  <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
                    <Icon className={cn('w-6 h-6 mx-auto mb-2', color)} />
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        {currentStep !== 1 && (
          <div className="border-t border-gray-800 px-8 py-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <div className="flex items-center gap-2">
              {SETUP_STEPS.map((s) => (
                <div key={s.id} className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  currentStep === s.id ? 'bg-violet-500 w-6' : currentStep > s.id ? 'bg-violet-600' : 'bg-gray-700'
                )} />
              ))}
            </div>
            <button
              type="button"
              onClick={currentStep === 4 ? () => setComplete(true) : handleNext}
              disabled={currentStep === 3 && !selectedTemplate}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all',
                currentStep === 4
                  ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:opacity-90'
                  : 'bg-violet-600 text-white hover:bg-violet-500',
                currentStep === 3 && !selectedTemplate && 'opacity-40 cursor-not-allowed'
              )}
            >
              {currentStep === 4 ? 'Get Started' : 'Continue'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
