// basic_test.ts - Simple benchmark for OpenClaw agent

import { runAgentTask } from "../agents/runtime"; // Assuming import path

export async function basicWebSearchTest() {
  const task =
    'Search the web for "AI agent evaluation harness" and provide a one-paragraph summary.';
  const result = await runAgentTask(task);

  // Dummy evaluation: check if result contains key words
  const score =
    result.toLowerCase().includes("evaluation") && result.toLowerCase().includes("harness") ? 1 : 0;

  return { task, result, score };
}

// Run the test
if (require.main === module) {
  void basicWebSearchTest().then(console.log);
}
