import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { Wifi, Eye, EyeOff, X } from 'lucide-react';

const GATEWAY_URL_KEY = 'openclaw.gateway.wsUrl';
const GATEWAY_TOKEN_KEY = 'openclaw.gateway.token';
const DEFAULT_GATEWAY_URL = 'ws://localhost:18789';

interface GatewayAuthModalProps {
  authError: string | null;
  onConnect: () => void;
  onDismiss: () => void;
}

function readLocalStorage(key: string): string {
  try {
    return window.localStorage.getItem(key)?.trim() || '';
  } catch {
    return '';
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore
  }
}

/**
 * Modal shown when the gateway rejects the connection due to auth failure.
 * Lets the user update the gateway URL and token, then reconnects.
 *
 * onConnect is called after saving to localStorage — the caller should
 * invoke gateway.reconnect() which re-reads both values.
 */
export function GatewayAuthModal({ authError, onConnect, onDismiss }: GatewayAuthModalProps) {
  const [url, setUrl] = useState(() => readLocalStorage(GATEWAY_URL_KEY) || DEFAULT_GATEWAY_URL);
  const [token, setToken] = useState(() => readLocalStorage(GATEWAY_TOKEN_KEY));
  const [showToken, setShowToken] = useState(false);
  const tokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tokenRef.current?.focus();
  }, []);

  function handleConnect() {
    writeLocalStorage(GATEWAY_URL_KEY, url.trim());
    writeLocalStorage(GATEWAY_TOKEN_KEY, token.trim());
    onConnect();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConnect();
    if (e.key === 'Escape') onDismiss();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gateway-auth-title"
      onKeyDown={handleKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div className="relative w-full max-w-md mx-4 bg-surface-1 border border-tok-border rounded-2xl shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <Wifi className="w-5 h-5 text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="gateway-auth-title" className="text-base font-semibold text-fg-primary">
                Connect to Gateway
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">Authentication required</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="p-1 rounded-lg text-fg-muted hover:text-fg-primary hover:bg-surface-2 transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Error banner */}
        {authError && (
          <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-xs text-red-400">{authError}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Gateway URL */}
          <div>
            <label htmlFor="gw-auth-url" className="block text-xs font-medium text-fg-secondary mb-1.5">
              Gateway URL
            </label>
            <input
              id="gw-auth-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://192.168.1.x:18789"
              className="w-full bg-surface-2 border border-tok-border text-fg-primary text-sm rounded-lg px-3 py-2 font-mono focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none placeholder:text-fg-muted"
            />
          </div>

          {/* Auth Token */}
          <div>
            <label htmlFor="gw-auth-token" className="block text-xs font-medium text-fg-secondary mb-1.5">
              Auth Token
            </label>
            <div className="relative">
              <input
                ref={tokenRef}
                id="gw-auth-token"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter gateway token"
                className="w-full bg-surface-2 border border-tok-border text-fg-primary text-sm rounded-lg px-3 py-2 pr-9 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none placeholder:text-fg-muted"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                aria-label={showToken ? 'Hide token' : 'Show token'}
                className={cn(
                  'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded',
                  'text-fg-muted hover:text-fg-primary transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none'
                )}
              >
                {showToken
                  ? <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                  : <Eye className="w-3.5 h-3.5" aria-hidden="true" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-fg-muted">
              Set on the gateway host with{' '}
              <code className="font-mono text-fg-secondary">openclaw config set gateway.auth.token &lt;value&gt;</code>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6">
          <button
            type="button"
            onClick={handleConnect}
            className="flex-1 py-2 px-4 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            Connect
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="py-2 px-4 bg-surface-2 hover:bg-surface-3 text-fg-secondary text-sm font-medium rounded-lg border border-tok-border transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default GatewayAuthModal;
