import React, { useState } from "react";
import { cn } from "../lib/utils";

type OptimizationKind = 'clarity' | 'specificity' | 'format' | 'safety' | 'token-efficiency' | 'role-definition';
type IssueSeverity = 'high' | 'medium' | 'low';

interface PromptIssue {
  id: string;
  kind: OptimizationKind;
  severity: IssueSeverity;
  title: string;
  description: string;
  suggestion: string;
  tokenImpact: number;
}

interface OptimizedVersion {
  label: string;
  prompt: string;
  estimatedTokens: number;
  improvements: string[];
}

interface AnalysisResult {
  score: number;
  tokenCount: number;
  issues: PromptIssue[];
  optimizedVersions: OptimizedVersion[];
}

const SEED_PROMPT = "Write me a summary of the meeting. Make it good. Include the important stuff and don't miss anything. Also add action items if there are any. The summary should be professional.";

const SEED_RESULT: AnalysisResult = {
  score: 42,
  tokenCount: 46,
  issues: [
    {
      id: "1",
      kind: "clarity",
      severity: "high",
      title: "Vague instruction 'Make it good'",
      description: "The term 'good' is subjective and doesn't provide the AI with actionable quality benchmarks.",
      suggestion: "Replace with specific quality criteria: 'Write a structured summary with clear sections'",
      tokenImpact: 12,
    },
    {
      id: "2",
      kind: "specificity",
      severity: "high",
      title: "No context about meeting type",
      description: "Providing context helps the model understand the priority and tone of information.",
      suggestion: "Specify: meeting type, attendees, date, topic",
      tokenImpact: 15,
    },
    {
      id: "5",
      kind: "role-definition",
      severity: "medium",
      title: "No role assigned to the assistant",
      description: "Personas help ground the model's output in a specific domain expertise.",
      suggestion: "Add 'You are an expert meeting facilitator and note-taker.'",
      tokenImpact: 10,
    },
    {
      id: "3",
      kind: "format",
      severity: "medium",
      title: "No output format specified",
      description: "Structured output ensures consistent parsing and readability.",
      suggestion: "Add: '## Summary\\n## Key Decisions\\n## Action Items'",
      tokenImpact: 14,
    },
    {
      id: "4",
      kind: "token-efficiency",
      severity: "low",
      title: "Redundant phrase 'don't miss anything'",
      description: "Modern LLMs imply comprehensiveness unless told otherwise; filler phrases waste tokens.",
      suggestion: "Remove — implied by a comprehensive summary",
      tokenImpact: -4,
    },
    {
      id: "6",
      kind: "safety",
      severity: "low",
      title: "No length constraint",
      description: "Without boundaries, output may exceed context limits or become rambling.",
      suggestion: "Add: 'Keep the summary under 300 words.'",
      tokenImpact: -8,
    },
  ],
  optimizedVersions: [
    {
      label: "Concise",
      estimatedTokens: 68,
      prompt: "You are an expert meeting facilitator. Summarize the meeting notes into clear sections: ## Summary, ## Key Decisions, and ## Action Items. Focus only on high-priority items and keep the total length under 300 words.",
      improvements: ["Removed vague language", "Added output structure", "Defined token constraints"],
    },
    {
      label: "Detailed",
      estimatedTokens: 112,
      prompt: "You are an expert meeting facilitator and note-taker. Provide a detailed summary of the meeting including context (type, date, topic). Structure your response as follows:\n## Executive Summary\n## Key Discussion Points\n## Action Items (Owner, Task, Deadline)\nEnsure the tone is professional and the language is precise. Avoid redundant filler phrases.",
      improvements: ["Role definition", "Detailed formatting", "Contextual placeholders"],
    },
    {
      label: "Chain-of-Thought",
      estimatedTokens: 95,
      prompt: "Before writing the summary, first list the core themes discussed in the meeting notes. Then, synthesize these themes into a professional summary. Finally, extract any action items. Format the final output with clear Markdown headers.",
      improvements: ["Step-by-step reasoning", "Logical synthesis", "Markdown formatting"],
    },
  ],
};

const SIMULATED_RESULT: AnalysisResult = {
  score: 88,
  tokenCount: 32,
  issues: [
    {
      id: "gen-1",
      kind: "clarity",
      severity: "low",
      title: "Prompt is well-structured",
      description: "The prompt seems clear, but consider adding specific examples.",
      suggestion: "Add a 'Few-shot' example for better consistency.",
      tokenImpact: 20,
    },
    {
      id: "gen-2",
      kind: "token-efficiency",
      severity: "medium",
      title: "Minor redundancy",
      description: "Some phrases can be compressed.",
      suggestion: "Rephrase descriptive adjectives.",
      tokenImpact: -5,
    },
  ],
  optimizedVersions: [
    {
      label: "Standard",
      estimatedTokens: 45,
      prompt: "Refined version of your prompt...",
      improvements: ["Compressed phrasing"],
    },
  ],
};

export default function PromptOptimizer() {
  const [prompt, setPrompt] = useState(SEED_PROMPT);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setResult(null);

    setTimeout(() => {
      if (prompt.trim() === SEED_PROMPT) {
        setResult(SEED_RESULT);
      } else {
        setResult({
          ...SIMULATED_RESULT,
          tokenCount: Math.ceil(prompt.length / 4),
        });
      }
      setIsAnalyzing(false);
      setActiveTab(0);
    }, 800);
  };

  const getScoreColor = (score: number) => {
    if (score <= 40) return "text-rose-400";
    if (score <= 70) return "text-amber-400";
    return "text-emerald-400";
  };

  const getScoreBorder = (score: number) => {
    if (score <= 40) return "border-rose-400";
    if (score <= 70) return "border-amber-400";
    return "border-emerald-400";
  };

  const getSeverityColor = (severity: IssueSeverity) => {
    switch (severity) {
      case 'high': return "text-rose-400 bg-rose-400/10 border-rose-400/20";
      case 'medium': return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      case 'low': return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    }
  };

  const getKindColor = (kind: OptimizationKind) => {
    switch (kind) {
      case 'clarity': return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case 'specificity': return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case 'format': return "bg-pink-500/10 text-pink-400 border-pink-500/20";
      case 'safety': return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case 'token-efficiency': return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case 'role-definition': return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    }
  };

  const tokenCount = Math.ceil(prompt.length / 4);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-bold">Prompt Optimizer</h1>
          <p className="text-zinc-400">Analyze and refine your LLM instructions for better results.</p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel: Editor */}
          <section className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 flex flex-col h-[600px]">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Input Prompt</label>
                <span className="text-xs text-zinc-500 font-mono">{tokenCount} tokens</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="flex-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-sm leading-relaxed"
                placeholder="Paste your prompt here..."
              />
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !prompt.trim()}
                className={cn(
                  "w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2",
                  isAnalyzing 
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                    : "bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                )}
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </>
                ) : "Analyze Prompt"}
              </button>
            </div>
          </section>

          {/* Right Panel: Analysis */}
          <section className="space-y-4">
            {!result && !isAnalyzing && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 flex flex-col items-center justify-center text-center h-[600px] space-y-4">
                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium">Ready for analysis</h3>
                  <p className="text-zinc-500 max-w-xs mx-auto">Enter a prompt in the editor to see improvement suggestions and optimized versions.</p>
                </div>
              </div>
            )}

            {isAnalyzing && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 flex flex-col items-center justify-center text-center h-[600px] space-y-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-zinc-800 rounded-full"></div>
                  <div className="w-20 h-20 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                </div>
                <div className="space-y-2">
                  <p className="text-zinc-300 font-medium animate-pulse">Running analysis engines...</p>
                  <p className="text-zinc-500 text-sm">Evaluating clarity, safety, and efficiency</p>
                </div>
              </div>
            )}

            {result && !isAnalyzing && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Score and Stats */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center gap-8">
                  <div className="relative flex items-center justify-center">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-800" />
                      <circle 
                        cx="48" 
                        cy="48" 
                        r="40" 
                        stroke="currentColor" 
                        strokeWidth="8" 
                        fill="transparent" 
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * result.score) / 100}
                        className={cn("transition-all duration-1000", getScoreColor(result.score))} 
                      />
                    </svg>
                    <span className={cn("absolute text-2xl font-bold", getScoreColor(result.score))}>{result.score}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Optimization Score</h3>
                    <p className="text-zinc-500 text-sm">Based on {result.issues.length} identified areas for improvement.</p>
                  </div>
                </div>

                {/* Issues List */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Analysis Results</h3>
                    <span className="text-xs text-zinc-500">{result.issues.length} Issues found</span>
                  </div>
                  <div className="divide-y divide-zinc-800 max-h-[300px] overflow-y-auto">
                    {result.issues.sort((a, b) => {
                      const priority = { high: 0, medium: 1, low: 2 };
                      return priority[a.severity] - priority[b.severity];
                    }).map((issue) => (
                      <div key={issue.id} className="p-4 hover:bg-zinc-800/50 transition-colors space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border", getSeverityColor(issue.severity))}>
                                {issue.severity}
                              </span>
                              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border", getKindColor(issue.kind))}>
                                {issue.kind.replace('-', ' ')}
                              </span>
                              <h4 className="font-semibold text-sm">{issue.title}</h4>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed">{issue.description}</p>
                          </div>
                          <div className={cn("text-xs font-mono font-bold whitespace-nowrap", issue.tokenImpact < 0 ? "text-emerald-400" : "text-amber-400")}>
                            {issue.tokenImpact > 0 ? `+${issue.tokenImpact}` : issue.tokenImpact} tokens
                          </div>
                        </div>
                        <div className="bg-zinc-950/50 p-2 rounded border border-zinc-800/50 flex gap-2">
                          <span className="text-emerald-400 text-xs font-bold uppercase">Fix:</span>
                          <p className="text-xs text-zinc-300 italic">"{issue.suggestion}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optimized Versions */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="flex border-b border-zinc-800">
                    {result.optimizedVersions.map((v, i) => (
                      <button
                        key={v.label}
                        onClick={() => setActiveTab(i)}
                        className={cn(
                          "px-6 py-3 text-sm font-medium transition-colors border-b-2",
                          activeTab === i 
                            ? "bg-zinc-800 text-white border-indigo-500" 
                            : "text-zinc-500 border-transparent hover:text-zinc-300"
                        )}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 uppercase font-medium">Estimated Tokens:</span>
                        <span className="text-sm font-mono text-indigo-400">{result.optimizedVersions[activeTab].estimatedTokens}</span>
                        <span className={cn(
                          "text-xs font-mono px-1.5 py-0.5 rounded",
                          result.optimizedVersions[activeTab].estimatedTokens > result.tokenCount 
                            ? "text-amber-400 bg-amber-400/10" 
                            : "text-emerald-400 bg-emerald-400/10"
                        )}>
                          ({result.optimizedVersions[activeTab].estimatedTokens - result.tokenCount > 0 ? '+' : ''}
                          {result.optimizedVersions[activeTab].estimatedTokens - result.tokenCount})
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 relative group">
                      <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                        {result.optimizedVersions[activeTab].prompt}
                      </pre>
                      <button 
                        onClick={() => navigator.clipboard.writeText(result.optimizedVersions[activeTab].prompt)}
                        className="absolute top-2 right-2 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy to clipboard"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Key Improvements</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.optimizedVersions[activeTab].improvements.map((imp) => (
                          <span key={imp} className="px-2 py-1 bg-emerald-400/10 text-emerald-400 text-[10px] rounded-full border border-emerald-400/20">
                            ✓ {imp}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
