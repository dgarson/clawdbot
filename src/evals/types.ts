export type EvaluationCaseResult = {
  pass: boolean;
  summary: string;
  score?: number;
  details?: Record<string, unknown>;
};

export type EvaluationCaseContext = {
  runId: string;
  startedAt: string;
  signal?: AbortSignal;
};

export type EvaluationCase = {
  id: string;
  suite: string;
  title: string;
  description?: string;
  tags?: string[];
  run: (context: EvaluationCaseContext) => EvaluationCaseResult | Promise<EvaluationCaseResult>;
};

export type EvaluationCaseRun = {
  id: string;
  suite: string;
  title: string;
  pass: boolean;
  summary: string;
  score?: number;
  details?: Record<string, unknown>;
  durationMs: number;
};

export type EvaluationRunReport = {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  cases: EvaluationCaseRun[];
  reportPath?: string;
};

export type EvaluationReportOutput = {
  baseDir: string;
  filePath?: string;
};

export type EvaluationRunOptions = {
  signal?: AbortSignal;
  reportOutput?: EvaluationReportOutput;
};

export type EvaluationRunner = {
  run(
    cases: readonly EvaluationCase[],
    options?: EvaluationRunOptions,
  ): Promise<EvaluationRunReport>;
};
