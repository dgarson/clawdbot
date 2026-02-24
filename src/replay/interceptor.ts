import { redactSensitiveText } from "../logging/redact.js";
import type { ReplayRecorder } from "./recorder.js";
import type { ReplayEvent } from "./types.js";

export type ReplayInterceptorMode = "off" | "capture" | "replay";

export interface ReplayInterceptorExecuteInput {
  toolName: string;
  toolCallId?: string;
  params: unknown;
  invoke: () => Promise<unknown>;
}

type RecordedToolCallOutcome =
  | { ok: true; result: unknown }
  | { ok: false; error: { name: string; message: string } };

interface RecordedToolCallPayload {
  toolName: string;
  params: unknown;
  outcome: RecordedToolCallOutcome;
}

export interface ReplayInterceptorOptions {
  mode: ReplayInterceptorMode;
  recorder?: ReplayRecorder;
  events?: readonly ReplayEvent[];
  redacted?: boolean;
}

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function redactString(value: string): string {
  return redactSensitiveText(value, { mode: "tools" });
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      redactValue(entry),
    ]);
    return Object.fromEntries(entries);
  }
  return value;
}

function toReplayError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }
  return {
    name: "Error",
    message: String(error),
  };
}

function isRecordedToolCallEvent(event: ReplayEvent): boolean {
  return event.category === "tool" && event.type === "tool.call";
}

function parseRecordedToolCall(event: ReplayEvent): RecordedToolCallPayload {
  const data = event.data;
  const toolName = typeof data.toolName === "string" ? data.toolName : undefined;
  const outcome = data.outcome as Record<string, unknown> | undefined;
  const ok = outcome?.ok;

  if (!toolName || !outcome || typeof ok !== "boolean") {
    throw new Error(`Invalid recorded tool.call event at seq=${event.seq}`);
  }

  if (ok) {
    return {
      toolName,
      params: data.params,
      outcome: { ok: true, result: outcome.result },
    };
  }

  const error = outcome.error as Record<string, unknown> | undefined;
  const name = typeof error?.name === "string" ? error.name : "Error";
  const message = typeof error?.message === "string" ? error.message : "Replay tool call failed";
  return {
    toolName,
    params: data.params,
    outcome: { ok: false, error: { name, message } },
  };
}

export class ReplayInterceptor {
  #mode: ReplayInterceptorMode;
  #recorder?: ReplayRecorder;
  #redacted: boolean;
  #recordedToolCalls: ReplayEvent[];
  #cursor = 0;

  constructor(options: ReplayInterceptorOptions) {
    this.#mode = options.mode;
    this.#recorder = options.recorder;
    this.#redacted = options.redacted ?? false;
    this.#recordedToolCalls = (options.events ?? []).filter(isRecordedToolCallEvent);
  }

  async execute(input: ReplayInterceptorExecuteInput): Promise<unknown> {
    if (this.#mode === "off") {
      return await input.invoke();
    }
    if (this.#mode === "replay") {
      return this.#executeFromReplay(input);
    }
    return await this.#executeAndCapture(input);
  }

  get replayCursor() {
    return this.#cursor;
  }

  #executeFromReplay(input: ReplayInterceptorExecuteInput): unknown {
    const event = this.#recordedToolCalls[this.#cursor];
    if (!event) {
      throw new Error(
        `Replay underflow: no recorded tool.call event at index ${this.#cursor} for ${input.toolName}`,
      );
    }
    this.#cursor += 1;

    const payload = parseRecordedToolCall(event);
    if (payload.toolName !== input.toolName) {
      throw new Error(
        `Replay divergence at seq=${event.seq}: expected tool ${payload.toolName}, got ${input.toolName}`,
      );
    }

    if (!payload.outcome.ok) {
      const err = new Error(payload.outcome.error.message);
      err.name = payload.outcome.error.name;
      throw err;
    }

    return cloneValue(payload.outcome.result);
  }

  async #executeAndCapture(input: ReplayInterceptorExecuteInput): Promise<unknown> {
    const started = Date.now();
    try {
      const result = await input.invoke();
      this.#recorder?.emit({
        category: "tool",
        type: "tool.call",
        correlationId: input.toolCallId,
        durationMs: Date.now() - started,
        data: {
          toolName: input.toolName,
          params: this.#redacted ? redactValue(input.params) : cloneValue(input.params),
          outcome: {
            ok: true,
            result: this.#redacted ? redactValue(result) : cloneValue(result),
          },
        },
      });
      return result;
    } catch (error) {
      const replayError = toReplayError(error);
      this.#recorder?.emit({
        category: "tool",
        type: "tool.call",
        correlationId: input.toolCallId,
        durationMs: Date.now() - started,
        data: {
          toolName: input.toolName,
          params: this.#redacted ? redactValue(input.params) : cloneValue(input.params),
          outcome: {
            ok: false,
            error: this.#redacted
              ? (redactValue(replayError) as { name: string; message: string })
              : replayError,
          },
        },
      });
      throw error;
    }
  }
}
