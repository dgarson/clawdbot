/**
 * OpenClaw Gateway WebSocket Client
 *
 * Ported from ui/src/ui/gateway.ts for React/Zustand integration.
 * Protocol v3 compatible.
 */

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features?: { methods?: string[]; events?: string[] };
  snapshot?: GatewaySnapshot;
  canvasHostUrl?: string;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
};

export type GatewaySnapshot = {
  presence: PresenceEntry[];
  health: unknown;
  stateVersion: { presence: number; health: number };
  uptimeMs: number;
  configPath?: string;
  stateDir?: string;
  sessionDefaults?: {
    defaultAgentId: string;
    mainKey: string;
    mainSessionKey: string;
    scope?: string;
  };
  authMode?: "none" | "token" | "password" | "trusted-proxy";
  updateAvailable?: {
    currentVersion: string;
    latestVersion: string;
    channel: string;
  };
};

export type PresenceEntry = {
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  mode?: string;
  lastInputSeconds?: number;
  reason?: string;
  tags?: string[];
  text?: string;
  ts: number;
  deviceId?: string;
  roles?: string[];
  scopes?: string[];
  instanceId?: string;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
};

export type GatewayClientOptions = {
  url: string;
  token?: string;
  password?: string;
  instanceId?: string;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onClose?: (info: { code: number; reason: string }) => void;
  onGap?: (info: { expected: number; received: number }) => void;
  onConnectionChange?: (connected: boolean) => void;
};

const CONNECT_FAILED_CLOSE_CODE = 4008;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 800;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private opts: GatewayClientOptions) {}

  start() {
    this.closed = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error("gateway client stopped"));
    this.opts.onConnectionChange?.(false);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private connect() {
    if (this.closed) {return;}

    try {
      this.ws = new WebSocket(this.opts.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener("open", () => this.queueConnect());
    this.ws.addEventListener("message", (ev) =>
      this.handleMessage(String(ev.data ?? ""))
    );
    this.ws.addEventListener("close", (ev) => {
      const reason = String(ev.reason ?? "");
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${ev.code}): ${reason}`));
      this.opts.onClose?.({ code: ev.code, reason });
      this.opts.onConnectionChange?.(false);
      this.scheduleReconnect();
    });
    this.ws.addEventListener("error", () => {
      // close handler will fire
    });
  }

  private scheduleReconnect() {
    if (this.closed) {return;}
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) {
      if (p.timeoutId) {clearTimeout(p.timeoutId);}
      p.reject(err);
    }
    this.pending.clear();
  }

  private sendConnect() {
    if (this.connectSent) {return;}
    this.connectSent = true;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const scopes = ["operator.admin", "operator.approvals", "operator.pairing"];
    const role = "operator";

    const auth =
      this.opts.token || this.opts.password
        ? { token: this.opts.token, password: this.opts.password }
        : undefined;

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "control-ui-horizon",
        version: "0.1.0",
        platform: typeof navigator !== "undefined" ? navigator.platform ?? "web" : "web",
        mode: "webchat",
        instanceId: this.opts.instanceId,
      },
      role,
      scopes,
      caps: ["tool-events"],
      auth,
      locale: typeof navigator !== "undefined" ? navigator.language : "en",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    void this.request<GatewayHelloOk>("connect", params)
      .then((hello) => {
        this.backoffMs = 800;
        this.opts.onConnectionChange?.(true);
        this.opts.onHello?.(hello);
      })
      .catch(() => {
        this.ws?.close(CONNECT_FAILED_CLOSE_CODE, "connect failed");
      });
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };

    if (frame.type === "event") {
      const evt = parsed as GatewayEventFrame;

      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: unknown } | undefined;
        const nonce =
          payload && typeof payload.nonce === "string" ? payload.nonce : null;
        if (nonce) {
          this.connectNonce = nonce;
          this.sendConnect();
        }
        return;
      }

      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null) {
        if (this.lastSeq !== null && seq > this.lastSeq + 1) {
          this.opts.onGap?.({ expected: this.lastSeq + 1, received: seq });
        }
        this.lastSeq = seq;
      }

      try {
        this.opts.onEvent?.(evt);
      } catch (err) {
        console.error("[gateway] event handler error:", err);
      }
      return;
    }

    if (frame.type === "res") {
      const res = parsed as GatewayResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) {return;}
      this.pending.delete(res.id);
      if (pending.timeoutId) {clearTimeout(pending.timeoutId);}
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        const err = new Error(res.error?.message ?? "request failed");
        (err as unknown as Record<string, unknown>).code = res.error?.code;
        (err as unknown as Record<string, unknown>).details = res.error?.details;
        pending.reject(err);
      }
      return;
    }
  }

  request<T = unknown>(
    method: string,
    params?: unknown,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }

    const id = generateId();
    const frame = { type: "req", id, method, params };

    const p = new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timeoutId,
      });
    });

    this.ws.send(JSON.stringify(frame));
    return p;
  }

  private queueConnect() {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer !== null) {
      clearTimeout(this.connectTimer);
    }
    this.connectTimer = setTimeout(() => {
      this.sendConnect();
    }, 750);
  }
}
