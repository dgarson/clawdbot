import { spawn } from "node:child_process";
import http from "node:http";
import { URL } from "node:url";
import type { VoiceCallConfig } from "./config.js";
import type { CoreConfig } from "./core-bridge.js";
import type { CallManager } from "./manager.js";
import type { MediaStreamConfig } from "./media-stream.js";
import type { VoiceCallProvider } from "./providers/base.js";
import type { TwilioProvider } from "./providers/twilio.js";
import type { CallRecord, NormalizedEvent, WebhookContext } from "./types.js";
import { resolveAutoResponseDecision, type AutoResponseSource } from "./auto-response.js";
import { isVoiceDiagnosticsVerbose } from "./diagnostics.js";
import { MediaStreamHandler } from "./media-stream.js";
import { OpenAIRealtimeSTTProvider } from "./providers/stt-openai-realtime.js";

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug?: (message: string) => void;
};

/**
 * HTTP server for receiving voice call webhooks from providers.
 * Supports WebSocket upgrades for media streams when streaming is enabled.
 */
export class VoiceCallWebhookServer {
  private server: http.Server | null = null;
  private config: VoiceCallConfig;
  private manager: CallManager;
  private provider: VoiceCallProvider;
  private coreConfig: CoreConfig | null;
  private logger: Logger;

  /** Media stream handler for bidirectional audio (when streaming enabled) */
  private mediaStreamHandler: MediaStreamHandler | null = null;

  constructor(
    config: VoiceCallConfig,
    manager: CallManager,
    provider: VoiceCallProvider,
    coreConfig?: CoreConfig,
    logger?: Logger,
  ) {
    this.config = config;
    this.manager = manager;
    this.provider = provider;
    this.coreConfig = coreConfig ?? null;
    this.logger = logger ?? {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    // Initialize media stream handler if streaming is enabled
    if (config.streaming?.enabled) {
      this.initializeMediaStreaming();
    }
  }

  /**
   * Get the media stream handler (for wiring to provider).
   */
  getMediaStreamHandler(): MediaStreamHandler | null {
    return this.mediaStreamHandler;
  }

  /**
   * Initialize media streaming with OpenAI Realtime STT.
   */
  private initializeMediaStreaming(): void {
    const apiKey = this.config.streaming?.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn("[voice-call] Streaming enabled but no OpenAI API key found");
      return;
    }

    const sttProvider = new OpenAIRealtimeSTTProvider({
      apiKey,
      model: this.config.streaming?.sttModel,
      silenceDurationMs: this.config.streaming?.silenceDurationMs,
      vadThreshold: this.config.streaming?.vadThreshold,
    });

    const streamConfig: MediaStreamConfig = {
      sttProvider,
      shouldAcceptStream: ({ callId, token }) => {
        const call = this.manager.getCallByProviderCallId(callId);
        if (!call) {
          return false;
        }
        if (this.provider.name === "twilio") {
          const twilio = this.provider as TwilioProvider;
          if (!twilio.isValidStreamToken(callId, token)) {
            console.warn(`[voice-call] Rejecting media stream: invalid token for ${callId}`);
            return false;
          }
        }
        return true;
      },
      onTranscript: (providerCallId, transcript) => {
        console.log(`[voice-call] Transcript for ${providerCallId}: ${transcript}`);

        // Clear TTS queue on barge-in (user started speaking, interrupt current playback)
        if (this.provider.name === "twilio") {
          (this.provider as TwilioProvider).clearTtsQueue(providerCallId);
        }

        // Look up our internal call ID from the provider call ID
        const call = this.manager.getCallByProviderCallId(providerCallId);
        if (!call) {
          console.warn(`[voice-call] No active call found for provider ID: ${providerCallId}`);
          this.diag(
            `stream transcript dropped: providerCallId=${providerCallId} reason=no-active-call`,
          );
          return;
        }
        const hadPendingTranscriptWaiter = this.manager.hasPendingTranscriptWaiter(call.callId);

        // Create a speech event and process it through the manager
        const event: NormalizedEvent = {
          id: `stream-transcript-${Date.now()}`,
          type: "call.speech",
          callId: call.callId,
          providerCallId,
          timestamp: Date.now(),
          transcript,
          isFinal: true,
        };
        this.manager.processEvent(event);

        this.maybeAutoRespondToTranscript({
          source: "stream",
          call,
          transcript,
          hadPendingTranscriptWaiter,
        });
      },
      onSpeechStart: (providerCallId) => {
        if (this.provider.name === "twilio") {
          (this.provider as TwilioProvider).clearTtsQueue(providerCallId);
        }
      },
      onPartialTranscript: (callId, partial) => {
        console.log(`[voice-call] Partial for ${callId}: ${partial}`);
      },
      onConnect: (callId, streamSid) => {
        console.log(`[voice-call] Media stream connected: ${callId} -> ${streamSid}`);
        // Register stream with provider for TTS routing
        if (this.provider.name === "twilio") {
          (this.provider as TwilioProvider).registerCallStream(callId, streamSid);
        }

        // Speak initial message if one was provided when call was initiated
        // Use setTimeout to allow stream setup to complete
        setTimeout(() => {
          this.manager.speakInitialMessage(callId).catch((err) => {
            console.warn(`[voice-call] Failed to speak initial message:`, err);
          });
        }, 500);
      },
      onDisconnect: (callId) => {
        console.log(`[voice-call] Media stream disconnected: ${callId}`);
        if (this.provider.name === "twilio") {
          (this.provider as TwilioProvider).unregisterCallStream(callId);
        }
      },
    };

    this.mediaStreamHandler = new MediaStreamHandler(streamConfig);
    console.log("[voice-call] Media streaming initialized");
  }

  /**
   * Start the webhook server.
   */
  async start(): Promise<string> {
    const { port, bind, path: webhookPath } = this.config.serve;
    const streamPath = this.config.streaming?.streamPath || "/voice/stream";

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res, webhookPath).catch((err) => {
          console.error("[voice-call] Webhook error:", err);
          res.statusCode = 500;
          res.end("Internal Server Error");
        });
      });

      // Handle WebSocket upgrades for media streams
      if (this.mediaStreamHandler) {
        this.server.on("upgrade", (request, socket, head) => {
          const url = new URL(request.url || "/", `http://${request.headers.host}`);

          if (url.pathname === streamPath) {
            console.log("[voice-call] WebSocket upgrade for media stream");
            this.mediaStreamHandler?.handleUpgrade(request, socket, head);
          } else {
            socket.destroy();
          }
        });
      }

      this.server.on("error", reject);

      this.server.listen(port, bind, () => {
        const url = `http://${bind}:${port}${webhookPath}`;
        console.log(`[voice-call] Webhook server listening on ${url}`);
        if (this.mediaStreamHandler) {
          console.log(`[voice-call] Media stream WebSocket on ws://${bind}:${port}${streamPath}`);
        }
        resolve(url);
      });
    });
  }

  /**
   * Stop the webhook server.
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming HTTP request.
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    webhookPath: string,
  ): Promise<void> {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // Check path
    if (!url.pathname.startsWith(webhookPath)) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    // Only accept POST
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("Method Not Allowed");
      return;
    }

    // Read body
    let body = "";
    try {
      body = await this.readBody(req, MAX_WEBHOOK_BODY_BYTES);
    } catch (err) {
      if (err instanceof Error && err.message === "PayloadTooLarge") {
        res.statusCode = 413;
        res.end("Payload Too Large");
        return;
      }
      throw err;
    }

    // Build webhook context
    const ctx: WebhookContext = {
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody: body,
      url: `http://${req.headers.host}${req.url}`,
      method: "POST",
      query: Object.fromEntries(url.searchParams),
      remoteAddress: req.socket.remoteAddress ?? undefined,
    };

    // Verify signature
    const verification = this.provider.verifyWebhook(ctx);
    if (!verification.ok) {
      console.warn(`[voice-call] Webhook verification failed: ${verification.reason}`);
      res.statusCode = 401;
      res.end("Unauthorized");
      return;
    }

    // Parse events
    const result = this.provider.parseWebhookEvent(ctx);

    // Process each event
    for (const event of result.events) {
      const preEventCall = this.resolveCallForEvent(event);
      const hadPendingTranscriptWaiter =
        event.type === "call.speech" && event.isFinal && preEventCall
          ? this.manager.hasPendingTranscriptWaiter(preEventCall.callId)
          : false;
      try {
        this.manager.processEvent(event);
      } catch (err) {
        console.error(`[voice-call] Error processing event ${event.type}:`, err);
        continue;
      }

      if (event.type === "call.speech" && event.isFinal) {
        const call = this.resolveCallForEvent(event) ?? preEventCall;
        if (!call) {
          this.diag(
            `webhook speech event could not resolve call: eventCallId=${event.callId} providerCallId=${
              event.providerCallId ?? "unset"
            }`,
          );
          continue;
        }

        this.diag(
          `webhook speech event received: provider=${this.provider.name} callId=${call.callId} ` +
            `providerCallId=${event.providerCallId ?? "unset"} direction=${call.direction} ` +
            `mode=${String(call.metadata?.mode ?? "unset")} pendingWaiter=${hadPendingTranscriptWaiter}`,
        );

        // This path is especially important when Twilio TTS falls back to <Say>/<Gather>,
        // where transcripts arrive via webhook SpeechResult instead of the media stream path.
        this.maybeAutoRespondToTranscript({
          source: "webhook",
          call,
          transcript: event.transcript,
          hadPendingTranscriptWaiter,
        });
      }
    }

    // Send response
    res.statusCode = result.statusCode || 200;

    if (result.providerResponseHeaders) {
      for (const [key, value] of Object.entries(result.providerResponseHeaders)) {
        res.setHeader(key, value);
      }
    }

    res.end(result.providerResponseBody || "OK");
  }

  /**
   * Read request body as string with timeout protection.
   */
  private readBody(
    req: http.IncomingMessage,
    maxBytes: number,
    timeoutMs = 30_000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn: () => void) => {
        if (done) {
          return;
        }
        done = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        finish(() => {
          const err = new Error("Request body timeout");
          req.destroy(err);
          reject(err);
        });
      }, timeoutMs);

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      req.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          finish(() => {
            req.destroy();
            reject(new Error("PayloadTooLarge"));
          });
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => finish(() => resolve(Buffer.concat(chunks).toString("utf-8"))));
      req.on("error", (err) => finish(() => reject(err)));
      req.on("close", () => finish(() => reject(new Error("Connection closed"))));
    });
  }

  /**
   * Handle auto-response using the agent system.
   * Supports tool calling for richer voice interactions.
   */
  private async handleAutoResponse(
    callId: string,
    userMessage: string,
    source: AutoResponseSource,
  ): Promise<void> {
    console.log(
      `[voice-call] Auto-responding to call ${callId} via ${source} transcript: "${userMessage}"`,
    );

    // Get call context for conversation history
    const call = this.manager.getCall(callId);
    if (!call) {
      console.warn(`[voice-call] Call ${callId} not found for auto-response`);
      return;
    }

    if (!this.coreConfig) {
      console.warn("[voice-call] Core config missing; skipping auto-response");
      return;
    }

    try {
      const { generateVoiceResponse } = await import("./response-generator.js");

      const result = await generateVoiceResponse({
        voiceConfig: this.config,
        coreConfig: this.coreConfig,
        callId,
        from: call.from,
        transcript: call.transcript,
        userMessage,
      });

      if (result.error) {
        console.error(`[voice-call] Response generation error: ${result.error}`);
        this.diag(
          `auto-response generation failed: callId=${callId} source=${source} error=${result.error}`,
        );
        return;
      }

      if (result.text) {
        console.log(`[voice-call] AI response: "${result.text}"`);
        const speakResult = await this.manager.speak(callId, result.text);
        if (!speakResult.success) {
          console.warn(
            `[voice-call] Auto-response speech failed for ${callId}: ${
              speakResult.error ?? "unknown error"
            }`,
          );
          this.diag(
            `auto-response speak failed: callId=${callId} source=${source} error=${
              speakResult.error ?? "unknown"
            }`,
          );
        }
      } else {
        this.diag(`auto-response generated no text: callId=${callId} source=${source}`);
      }
    } catch (err) {
      console.error(`[voice-call] Auto-response error:`, err);
      this.diag(
        `auto-response exception: callId=${callId} source=${source} error=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private maybeAutoRespondToTranscript(params: {
    source: AutoResponseSource;
    call: CallRecord;
    transcript: string;
    hadPendingTranscriptWaiter?: boolean;
  }): void {
    const mode =
      typeof params.call.metadata?.mode === "string" ? params.call.metadata.mode : undefined;
    const decision = resolveAutoResponseDecision({
      direction: params.call.direction,
      mode,
      transcript: params.transcript,
      hasPendingTranscriptWaiter:
        params.hadPendingTranscriptWaiter ??
        this.manager.hasPendingTranscriptWaiter(params.call.callId),
    });

    if (!decision.shouldRespond) {
      this.diag(
        `auto-response skipped: source=${params.source} callId=${params.call.callId} reason=${decision.reason}`,
      );
      return;
    }

    this.diag(
      `auto-response scheduled: source=${params.source} callId=${params.call.callId} reason=${decision.reason}`,
    );
    this.handleAutoResponse(params.call.callId, params.transcript, params.source).catch((err) => {
      console.warn(`[voice-call] Failed to auto-respond:`, err);
      this.diag(
        `auto-response scheduling failed: source=${params.source} callId=${params.call.callId} error=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  private resolveCallForEvent(event: NormalizedEvent): CallRecord | undefined {
    return (
      this.manager.getCall(event.callId) ||
      (event.providerCallId
        ? this.manager.getCallByProviderCallId(event.providerCallId)
        : undefined)
    );
  }

  private isVoiceVerboseDiagnosticsEnabled(): boolean {
    return isVoiceDiagnosticsVerbose(this.coreConfig);
  }

  private diag(message: string): void {
    if (!this.isVoiceVerboseDiagnosticsEnabled()) {
      return;
    }
    if (this.logger.debug) {
      this.logger.debug(`[voice-call][diag] ${message}`);
      return;
    }
    this.logger.info(`[voice-call][diag] ${message}`);
  }
}

/**
 * Resolve the current machine's Tailscale DNS name.
 */
export type TailscaleSelfInfo = {
  dnsName: string | null;
  nodeId: string | null;
};

/**
 * Run a tailscale command with timeout, collecting stdout.
 */
function runTailscaleCommand(
  args: string[],
  timeoutMs = 2500,
): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    const proc = spawn("tailscale", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    proc.stdout.on("data", (data) => {
      stdout += data;
    });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ code: -1, stdout: "" });
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout });
    });
  });
}

export async function getTailscaleSelfInfo(): Promise<TailscaleSelfInfo | null> {
  const { code, stdout } = await runTailscaleCommand(["status", "--json"]);
  if (code !== 0) {
    return null;
  }

  try {
    const status = JSON.parse(stdout);
    return {
      dnsName: status.Self?.DNSName?.replace(/\.$/, "") || null,
      nodeId: status.Self?.ID || null,
    };
  } catch {
    return null;
  }
}

export async function getTailscaleDnsName(): Promise<string | null> {
  const info = await getTailscaleSelfInfo();
  return info?.dnsName ?? null;
}

export async function setupTailscaleExposureRoute(opts: {
  mode: "serve" | "funnel";
  path: string;
  localUrl: string;
}): Promise<string | null> {
  const dnsName = await getTailscaleDnsName();
  if (!dnsName) {
    console.warn("[voice-call] Could not get Tailscale DNS name");
    return null;
  }

  const { code } = await runTailscaleCommand([
    opts.mode,
    "--bg",
    "--yes",
    "--set-path",
    opts.path,
    opts.localUrl,
  ]);

  if (code === 0) {
    const publicUrl = `https://${dnsName}${opts.path}`;
    console.log(`[voice-call] Tailscale ${opts.mode} active: ${publicUrl}`);
    return publicUrl;
  }

  console.warn(`[voice-call] Tailscale ${opts.mode} failed`);
  return null;
}

export async function cleanupTailscaleExposureRoute(opts: {
  mode: "serve" | "funnel";
  path: string;
}): Promise<void> {
  await runTailscaleCommand([opts.mode, "off", opts.path]);
}

/**
 * Setup Tailscale serve/funnel for the webhook server.
 * This is a helper that shells out to `tailscale serve` or `tailscale funnel`.
 */
export async function setupTailscaleExposure(config: VoiceCallConfig): Promise<string | null> {
  if (config.tailscale.mode === "off") {
    return null;
  }

  const mode = config.tailscale.mode === "funnel" ? "funnel" : "serve";
  // Include the path suffix so tailscale forwards to the correct endpoint
  // (tailscale strips the mount path prefix when proxying)
  const localUrl = `http://127.0.0.1:${config.serve.port}${config.serve.path}`;
  return setupTailscaleExposureRoute({
    mode,
    path: config.tailscale.path,
    localUrl,
  });
}

/**
 * Cleanup Tailscale serve/funnel.
 */
export async function cleanupTailscaleExposure(config: VoiceCallConfig): Promise<void> {
  if (config.tailscale.mode === "off") {
    return;
  }

  const mode = config.tailscale.mode === "funnel" ? "funnel" : "serve";
  await cleanupTailscaleExposureRoute({ mode, path: config.tailscale.path });
}
