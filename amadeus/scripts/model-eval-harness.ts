/**
 * Model Evaluation Harness
 * 
 * Reads discovery agent output JSONL files, scores against rubric criteria,
 * and outputs results to reports/model-eval-YYYY-MM-DD.json
 * 
 * Phase 1: Skeleton with stub scoring functions
 * Phase 2: Full implementation with live evals
 * 
 * Usage: npx ts-node scripts/model-eval-harness.ts [--input <dir>] [--output <dir>]
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// ============================================================================
// Types
// ============================================================================

interface EvalResult {
  runId: string;
  model: string;
  taskType: string;
  timestamp: string;
  // Accuracy scoring
  accuracy: number;        // 1-5 scale
  accuracyGrade: string;   // A-F
  // Latency
  latencyMs: number;
  latencyBucket: string;   // L1-L4
  // Cost
  inputTokens: number;
  outputTokens: number;
  costPer1K: number;       // $
  // Tool reliability
  toolCallsTotal: number;
  toolCallsCorrect: number;
  toolReliabilityPct: number;
  // Metadata
  notes?: string;
}

interface AggregatedScore {
  model: string;
  taskType: string;
  samples: number;
  avgAccuracy: number;
  avgLatencyMs: number;
  avgCostPer1K: number;
  avgToolReliabilityPct: number;
  grade: string;
}

// ============================================================================
// Configuration
// ============================================================================

const LATENCY_BUCKETS = {
  L1: { max: 2000, label: 'Fast' },
  L2: { max: 5000, label: 'Normal' },
  L3: { max: 15000, label: 'Slow' },
  L4: { max: Infinity, label: 'Very Slow' },
};

const TASK_TYPES = [
  'T1-Reasoning',
  'T2-CodeGen',
  'T3-Summarization',
  'T4-SearchSynthesis',
  'T5-Creative',
  'T6-StructuredOutput',
  'T7-ToolCall',
];

const MODEL_ALIASES = [
  'minimax-m2.5',
  'GLM-5',
  'Grok-4',
  'Claude-Sonnet-4.6',
  'Claude-Opus-4.6',
  'Claude-Haiku-3.5',
];

// ============================================================================
// Helper Functions
// ============================================================================

function getLatencyBucket(latencyMs: number): string {
  if (latencyMs < LATENCY_BUCKETS.L1.max) return 'L1';
  if (latencyMs < LATENCY_BUCKETS.L2.max) return 'L2';
  if (latencyMs < LATENCY_BUCKETS.L3.max) return 'L3';
  return 'L4';
}

function getAccuracyGrade(score: number): string {
  if (score >= 4.5) return 'A';
  if (score >= 3.5) return 'B';
  if (score >= 2.5) return 'C';
  if (score >= 1.5) return 'D';
  return 'F';
}

function calculateCostPer1K(inputTokens: number, outputTokens: number, model: string): number {
  // Pricing by model (approximate, update from provider docs)
  const PRICING: Record<string, { input: number; output: number }> = {
    'minimax-m2.5': { input: 0.001, output: 0.003 },
    'GLM-5': { input: 0.005, output: 0.015 },
    'Grok-4': { input: 0.01, output: 0.03 },
    'Claude-Sonnet-4.6': { input: 0.015, output: 0.075 },
    'Claude-Opus-4.6': { input: 0.075, output: 0.375 },
    'Claude-Haiku-3.5': { input: 0.0008, output: 0.004 },
  };
  
  const pricing = PRICING[model] || PRICING['Claude-Sonnet-4.6'];
  const totalTokens = inputTokens + outputTokens;
  return ((inputTokens * pricing.input) + (outputTokens * pricing.output)) / (totalTokens / 1000);
}

function formatDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ============================================================================
// Scoring Functions (Phase 1: Stubs - expand in Phase 2)
// ============================================================================

/**
 * Phase 1: Stub scorer that returns placeholder values.
 * Phase 2: Implement actual LLM-as-judge or rule-based scoring.
 */
function scoreOutput(output: any, taskType: string): Partial<EvalResult> {
  // TODO: Phase 2 - implement actual scoring
  // Ideas: 
  // - LLM-as-judge: prompt another model to rate quality 1-5
  // - Rule-based: regex matches for correctness criteria
  // - Heuristic: length, structure, tool call validity
  
  return {
    accuracy: 3.0,           // placeholder
    accuracyGrade: 'C',
    latencyMs: 0,             // will be populated from metadata
    latencyBucket: 'L2',
    toolCallsTotal: 0,
    toolCallsCorrect: 0,
    toolReliabilityPct: 0,
  };
}

// ============================================================================
// File Processing
// ============================================================================

function findJsonlFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`);
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      files.push(fullPath);
    } else if (entry.isDirectory()) {
      files.push(...findJsonlFiles(fullPath));
    }
  }
  
  return files;
}

function parseJsonlFile(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      console.warn(`Failed to parse line in ${filePath}`);
      return null;
    }
  }).filter(Boolean);
}

function inferTaskType(record: any): string {
  // TODO: Phase 2 - more sophisticated task type inference
  // Could use: prompt keywords, output format, tool calls present
  
  const prompt = (record.prompt || '').toLowerCase();
  const response = (record.response || '').toLowerCase();
  
  if (prompt.includes('debug') || prompt.includes('why') || prompt.includes('reason')) {
    return 'T1-Reasoning';
  }
  if (prompt.includes('write code') || prompt.includes('function') || prompt.includes('implement')) {
    return 'T2-CodeGen';
  }
  if (prompt.includes('summarize') || prompt.includes('summary') || prompt.includes('condense')) {
    return 'T3-Summarization';
  }
  if (prompt.includes('search') || prompt.includes('research') || prompt.includes('find')) {
    return 'T4-SearchSynthesis';
  }
  if (prompt.includes('idea') || prompt.includes('brainstorm') || prompt.includes('create')) {
    return 'T5-Creative';
  }
  if (prompt.includes('json') || prompt.includes('yaml') || prompt.includes('extract')) {
    return 'T6-StructuredOutput';
  }
  if (record.tool_calls || record.functions) {
    return 'T7-ToolCall';
  }
  
  return 'T1-Reasoning'; // default
}

function inferModel(record: any): string {
  // TODO: Phase 2 - read from record metadata
  // Could use: model field, provider, or config
  
  return record.model || 'Claude-Sonnet-4.6'; // default
}

// ============================================================================
// Main Evaluation Logic
// ============================================================================

function runEvaluation(inputDir: string, outputDir: string): void {
  console.log('🔍 Model Evaluation Harness');
  console.log('============================');
  console.log(`Input directory: ${inputDir}`);
  console.log(`Output directory: ${outputDir}`);
  console.log('');
  
  // Find all JSONL files
  const jsonlFiles = findJsonlFiles(inputDir);
  console.log(`Found ${jsonlFiles.length} JSONL file(s)`);
  
  if (jsonlFiles.length === 0) {
    console.log('No input files found. Exiting.');
    return;
  }
  
  // Process each file
  const results: EvalResult[] = [];
  
  for (const file of jsonlFiles) {
    console.log(`\nProcessing: ${path.basename(file)}`);
    const records = parseJsonlFile(file);
    console.log(`  → ${records.length} record(s)`);
    
    for (const record of records) {
      const taskType = inferTaskType(record);
      const model = inferModel(record);
      
      // Extract metadata if available
      const latencyMs = record.latency_ms || record.latencyMs || 3000;
      const inputTokens = record.input_tokens || record.promptTokens || 0;
      const outputTokens = record.output_tokens || record.completionTokens || 0;
      
      // Score the output (Phase 1: stub)
      const scoring = scoreOutput(record, taskType);
      
      const result: EvalResult = {
        runId: record.runId || record.id || `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        model,
        taskType,
        timestamp: record.timestamp || new Date().toISOString(),
        accuracy: scoring.accuracy || 3.0,
        accuracyGrade: scoring.accuracyGrade || 'C',
        latencyMs,
        latencyBucket: getLatencyBucket(latencyMs),
        inputTokens,
        outputTokens,
        costPer1K: calculateCostPer1K(inputTokens, outputTokens, model),
        toolCallsTotal: scoring.toolCallsTotal || 0,
        toolCallsCorrect: scoring.toolCallsCorrect || 0,
        toolReliabilityPct: scoring.toolReliabilityPct || 0,
        notes: record.notes || '',
      };
      
      results.push(result);
    }
  }
  
  // Aggregate by model × task type
  const aggregated = aggregateResults(results);
  
  // Write outputs
  ensureDir(outputDir);
  
  const dateStr = formatDate();
  const rawOutputPath = path.join(outputDir, `model-eval-${dateStr}.json`);
  const summaryOutputPath = path.join(outputDir, `model-eval-${dateStr}-summary.json`);
  
  fs.writeFileSync(rawOutputPath, JSON.stringify(results, null, 2));
  fs.writeFileSync(summaryOutputPath, JSON.stringify(aggregated, null, 2));
  
  console.log('\n✅ Evaluation complete');
  console.log(`  Raw results: ${rawOutputPath}`);
  console.log(`  Summary: ${summaryOutputPath}`);
  console.log(`  Total evaluations: ${results.length}`);
}

function aggregateResults(results: EvalResult[]): AggregatedScore[] {
  const groups: Record<string, EvalResult[]> = {};
  
  for (const result of results) {
    const key = `${result.model}:${result.taskType}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(result);
  }
  
  const aggregated: AggregatedScore[] = [];
  
  for (const [key, groupResults] of Object.entries(groups)) {
    const [model, taskType] = key.split(':');
    
    const avgAccuracy = groupResults.reduce((sum, r) => sum + r.accuracy, 0) / groupResults.length;
    const avgLatencyMs = groupResults.reduce((sum, r) => sum + r.latencyMs, 0) / groupResults.length;
    const avgCostPer1K = groupResults.reduce((sum, r) => sum + r.costPer1K, 0) / groupResults.length;
    const avgToolReliability = groupResults.reduce((sum, r) => sum + r.toolReliabilityPct, 0) / groupResults.length;
    
    aggregated.push({
      model,
      taskType,
      samples: groupResults.length,
      avgAccuracy: Math.round(avgAccuracy * 100) / 100,
      avgLatencyMs: Math.round(avgLatencyMs),
      avgCostPer1K: Math.round(avgCostPer1K * 1000) / 1000,
      avgToolReliabilityPct: Math.round(avgToolReliability),
      grade: getAccuracyGrade(avgAccuracy),
    });
  }
  
  return aggregated.sort((a, b) => a.model.localeCompare(b.model));
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  
  // Default paths
  const defaultInput = path.join(process.cwd(), 'data', 'discovery-runs');
  const defaultOutput = path.join(process.cwd(), 'reports');
  
  let inputDir = defaultInput;
  let outputDir = defaultOutput;
  
  // Simple arg parsing
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputDir = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputDir = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: npx ts-node model-eval-harness.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --input <dir>   Input directory with JSONL files (default: data/discovery-runs)');
      console.log('  --output <dir>  Output directory for reports (default: reports)');
      console.log('  --help, -h      Show this help message');
      console.log('');
      console.log('Example:');
      console.log('  npx ts-node scripts/model-eval-harness.ts --input ./data/runs --output ./reports');
      process.exit(0);
    }
  }
  
  runEvaluation(inputDir, outputDir);
}

main();
