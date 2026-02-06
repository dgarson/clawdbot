/**
 * Feedback subscriber — wires the LLM relevancy evaluator to fire at the
 * end of each agent turn that used memory_search.
 *
 * Called from attempt.ts as a fire-and-forget side-effect.
 */

import path from "node:path";
import type { MemoryOpsLogger } from "../ops-log/index.js";
import type { MemorySearchResult } from "../types.js";
import type { LlmCallParams, LlmCallResult } from "./llm-evaluator.js";
import type { RelevancyEvaluationContext } from "./types.js";
import { resolveStateDir } from "../../config/paths.js";
import { memLog } from "../memory-log.js";
import { createMemoryOpsLogger } from "../ops-log/index.js";
import { FeedbackStore } from "./feedback-store.js";
import { LlmRelevancyEvaluator } from "./llm-evaluator.js";

// ─── Lazy singletons ───────────────────────────────────────────────────────

let evaluator: LlmRelevancyEvaluator | null = null;
let store: FeedbackStore | null = null;
let opsLog: MemoryOpsLogger | null = null;
let configured = false;
let llmCallFn: ((params: LlmCallParams) => Promise<LlmCallResult>) | null = null;
let llmModelName = "unknown";

/**
 * Configure the memory feedback subsystem with an LLM call function.
 * Should be called once during agent runner startup.
 */
export function configureMemoryFeedback(params: {
  llmCall: (params: LlmCallParams) => Promise<LlmCallResult>;
  model: string;
}): void {
  llmCallFn = params.llmCall;
  llmModelName = params.model;
  configured = true;
}

/**
 * Tear down the feedback subscriber (for graceful shutdown).
 */
export function stopMemoryFeedbackSubscriber(): void {
  store?.close();
  store = null;
  evaluator = null;
  opsLog = null;
  configured = false;
  llmCallFn = null;
}

function ensureInitialized(): boolean {
  if (evaluator && store) return true;
  if (!configured || !llmCallFn) return false;

  try {
    const stateDir = resolveStateDir();
    const dbPath = path.join(stateDir, "memory", "feedback.db");

    evaluator = new LlmRelevancyEvaluator({
      llmCall: llmCallFn,
      model: llmModelName,
    });

    store = new FeedbackStore({ dbPath });
    opsLog = createMemoryOpsLogger(stateDir);
    return true;
  } catch (err) {
    memLog.warn("feedback subscriber: init failed", { error: String(err) });
    return false;
  }
}

// ─── Message parsing helpers ────────────────────────────────────────────────

type ContentBlock = {
  type: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  text?: string;
  thinking?: string;
  tool_use_id?: string;
  content?: unknown;
};

type MessageLike = {
  role: string;
  content: string | ContentBlock[];
};

function isMessageArray(msgs: unknown): msgs is MessageLike[] {
  return (
    Array.isArray(msgs) && msgs.length > 0 && typeof (msgs[0] as MessageLike)?.role === "string"
  );
}

function getContentBlocks(msg: MessageLike): ContentBlock[] {
  if (typeof msg.content === "string") {
    return [{ type: "text", text: msg.content }];
  }
  if (Array.isArray(msg.content)) {
    return msg.content as ContentBlock[];
  }
  return [];
}

type ExtractedMemorySearch = {
  query: string;
  results: MemorySearchResult[];
  userPrompt: string;
  agentResponse: string;
  backendAttribution: Record<string, string[]>;
};

/**
 * Extract memory_search tool invocations from the message history.
 */
export function extractMemorySearches(messages: MessageLike[]): ExtractedMemorySearch[] {
  const searches: ExtractedMemorySearch[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    const blocks = getContentBlocks(msg);
    for (const block of blocks) {
      if (block.type !== "tool_use" || block.name !== "memory_search") continue;

      const query = String(block.input?.query ?? "");
      if (!query) continue;

      const toolUseId = block.id;

      // Find the corresponding tool_result
      let results: MemorySearchResult[] = [];
      // Tool results come in the next user message as tool_result blocks
      for (let j = i + 1; j < messages.length; j++) {
        const resultMsg = messages[j];
        if (resultMsg.role !== "user") continue;
        const resultBlocks = getContentBlocks(resultMsg);
        const resultBlock = resultBlocks.find(
          (b) => b.type === "tool_result" && b.tool_use_id === toolUseId,
        );
        if (resultBlock) {
          results = parseToolResultContent(resultBlock.content);
          break;
        }
        break; // only check the immediately following user message
      }

      if (results.length === 0) continue;

      // Find the user message that preceded this assistant message (= landingPrompt)
      let userPrompt = "";
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].role === "user") {
          const userBlocks = getContentBlocks(messages[j]);
          userPrompt = userBlocks
            .filter((b) => b.type === "text" && b.text)
            .map((b) => b.text!)
            .join("\n");
          break;
        }
      }

      // Find the final assistant message's text + thinking
      let agentResponse = "";
      const lastAssistant = messages.findLast((m) => m.role === "assistant");
      if (lastAssistant) {
        const assistantBlocks = getContentBlocks(lastAssistant);
        agentResponse = assistantBlocks
          .filter((b) => (b.type === "text" && b.text) || (b.type === "thinking" && b.thinking))
          .map((b) => b.text ?? b.thinking ?? "")
          .join("\n");
      }

      // Build backend attribution from sourceBackend on each result
      const backendAttribution: Record<string, string[]> = {};
      for (const r of results) {
        const backend = r.sourceBackend ?? "unknown";
        if (!backendAttribution[backend]) {
          backendAttribution[backend] = [];
        }
        backendAttribution[backend].push(r.path);
      }

      searches.push({ query, results, userPrompt, agentResponse, backendAttribution });
    }
  }

  return searches;
}

function parseToolResultContent(content: unknown): MemorySearchResult[] {
  if (!content) return [];

  // The tool result content may be a string (JSON), an array of text blocks, etc.
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    // Array of content blocks
    for (const block of content) {
      if (typeof block === "string") {
        text += block;
      } else if (typeof block === "object" && block !== null && "text" in block) {
        text += String((block as { text: string }).text);
      }
    }
  }

  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (r: unknown) => typeof r === "object" && r !== null && "path" in r && "score" in r,
      ) as MemorySearchResult[];
    }
    // Sometimes results are wrapped in an object
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.results)) {
      return parsed.results.filter(
        (r: unknown) => typeof r === "object" && r !== null && "path" in r && "score" in r,
      ) as MemorySearchResult[];
    }
  } catch {
    // Not valid JSON, skip
  }

  return [];
}

// ─── Main handler ───────────────────────────────────────────────────────────

/**
 * Handle the end of an agent turn. Extracts memory_search data from messages
 * and fires the evaluator if appropriate.
 *
 * This is called fire-and-forget from attempt.ts.
 */
export function handleAgentEnd(
  event: { messages: unknown[]; success: boolean },
  context: { agentId?: string; sessionKey?: string },
): void {
  try {
    if (!event.success) return;
    if (!isMessageArray(event.messages)) return;
    if (!ensureInitialized()) return;

    const searches = extractMemorySearches(event.messages);
    if (searches.length === 0) return;

    for (const search of searches) {
      if (
        !evaluator!.shouldEvaluate({
          sessionKey: context.sessionKey,
          resultCount: search.results.length,
        })
      ) {
        continue;
      }

      const evalContext: RelevancyEvaluationContext = {
        results: search.results,
        retrievalQuery: search.query,
        landingPrompt: search.userPrompt,
        agentResponse: search.agentResponse,
        backendAttribution: search.backendAttribution,
        queryTraceId: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sessionKey: context.sessionKey,
      };

      evaluator!
        .evaluate(evalContext)
        .then((feedback) => {
          store?.storeFeedback(feedback, context.sessionKey);
          opsLog?.log({
            action: "feedback.evaluated",
            traceId: feedback.queryTraceId,
            sessionKey: context.sessionKey,
            status: "success",
            detail: {
              query: search.query.slice(0, 200),
              resultCount: search.results.length,
              precision: feedback.aggregate.precision,
              meanRelevance: feedback.aggregate.meanRelevanceScore,
              model: llmModelName,
              backends: Object.keys(search.backendAttribution),
            },
          });
          memLog.trace("feedback subscriber: evaluation stored", {
            queryTraceId: feedback.queryTraceId,
            precision: feedback.aggregate.precision,
          });
        })
        .catch((err) => {
          opsLog?.log({
            action: "feedback.evaluated",
            traceId: evalContext.queryTraceId,
            sessionKey: context.sessionKey,
            status: "failure",
            detail: { query: search.query.slice(0, 200), error: String(err) },
          });
          memLog.warn("feedback subscriber: evaluation failed", { error: String(err) });
        });
    }
  } catch (err) {
    memLog.warn("feedback subscriber: handleAgentEnd error", { error: String(err) });
  }
}
