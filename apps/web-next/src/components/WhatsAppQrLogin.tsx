import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Smartphone, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { WebLoginStartResponse, WebLoginWaitResponse } from '../types';

// ============================================================================
// Types
// ============================================================================

interface WhatsAppQrLoginProps {
  gateway: {
    call: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  };
  onComplete?: (phoneNumber: string) => void;
  onCancel?: () => void;
  compact?: boolean;
  mockMode?: boolean;
}

type LoginStatus = 'idle' | 'loading' | 'waiting' | 'connected' | 'error' | 'expired';

// ============================================================================
// Confetti Animation Component
// ============================================================================

function ConfettiPiece({ delay, color }: { delay: number; color: string }) {
  const style = {
    left: `${Math.random() * 100}%`,
    animationDelay: `${delay}ms`,
    backgroundColor: color,
  };

  return (
    <div
      className="absolute w-2 h-2 rounded-sm animate-bounce"
      style={style}
    />
  );
}

function SuccessConfetti() {
  const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <ConfettiPiece
          key={i}
          delay={i * 50}
          color={colors[i % colors.length]}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_QR_DATA_URL = 'data:image/svg+xml;base64,' + btoa(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="white"/>
  <g fill="black">
    ${Array.from({ length: 25 }, (_, row) =>
      Array.from({ length: 25 }, (_, col) =>
        Math.random() > 0.5
          ? `<rect x="${col * 8}" y="${row * 8}" width="8" height="8"/>`
          : ''
      ).join('')
    ).join('')}
  </g>
</svg>
`);

// ============================================================================
// Main Component
// ============================================================================

export default function WhatsAppQrLogin({
  gateway,
  onComplete,
  onCancel,
  compact = false,
  mockMode = false,
}: WhatsAppQrLoginProps) {
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clear any pending timeouts
   */
  const clearTimers = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    if (qrExpiryRef.current) {
      clearTimeout(qrExpiryRef.current);
      qrExpiryRef.current = null;
    }
  }, []);

  /**
   * Start the login flow
   */
  const startLogin = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setQrDataUrl(null);
    setPhoneNumber(null);
    setMessage(null);
    clearTimers();

    try {
      if (mockMode) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        setQrDataUrl(MOCK_QR_DATA_URL);
        setMessage('Scan this QR code with your WhatsApp app');
        setStatus('waiting');
        
        // Simulate scan after 3 seconds
        pollingRef.current = setTimeout(() => {
          setStatus('connected');
          setPhoneNumber('+1 (555) 123-4567');
          setMessage('Connected successfully!');
          setShowConfetti(true);
          onComplete?.('+1 (555) 123-4567');
        }, 3000);
        
        return;
      }

      const result = await gateway.call<WebLoginStartResponse>('web.login.start', {
        force: false,
        timeoutMs: 30000,
      });

      setQrDataUrl(result.qrDataUrl ?? null);
      setMessage(result.message || 'Scan this QR code with your WhatsApp app');
      setStatus('waiting');

      // Set QR expiry timer (20 seconds warning, 30 seconds actual expiry)
      qrExpiryRef.current = setTimeout(() => {
        setStatus('expired');
        setMessage('QR code expired. Please refresh.');
      }, 25000);

      // Start polling for connection
      void pollForConnection();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start login');
      setStatus('error');
    }
  }, [gateway, mockMode, clearTimers, onComplete]);

  /**
   * Poll for connection status
   */
  const pollForConnection = useCallback(async () => {
    try {
      if (mockMode) {return;} // Handled in startLogin

      const result = await gateway.call<WebLoginWaitResponse>('web.login.wait', {
        timeoutMs: 120000,
      });

      if (result.connected) {
        clearTimers();
        setStatus('connected');
        setPhoneNumber(result.phoneNumber || null);
        setMessage(result.message || 'Connected successfully!');
        setShowConfetti(true);
        onComplete?.(result.phoneNumber || '');
      } else if (result.error) {
        clearTimers();
        setError(result.error);
        setStatus('error');
        setMessage(result.message ?? null);
      }
      // If not connected and no error, continue polling is handled by the RPC wait

    } catch (err) {
      // Don't show error for polling failures, just retry
      console.warn('[WhatsApp QR] Poll error:', err);
    }
  }, [gateway, mockMode, clearTimers, onComplete]);

  /**
   * Cancel login flow
   */
  const cancelLogin = useCallback(() => {
    clearTimers();
    setStatus('idle');
    setQrDataUrl(null);
    setMessage(null);
    setError(null);
    onCancel?.();
  }, [clearTimers, onCancel]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  /**
   * Auto-start on mount
   */
  useEffect(() => {
    if (status === 'idle') {
      void startLogin();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // Render States
  // ============================================================================

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-xl bg-gray-800 animate-pulse flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-sm text-gray-400">Generating QR code...</p>
          </div>
        );

      case 'waiting':
      case 'expired':
        return (
          <div className="flex flex-col items-center">
            {/* QR Code */}
            <div
              className={cn(
                'relative bg-white rounded-2xl p-4 mb-4',
                status === 'expired' && 'opacity-50'
              )}
            >
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="WhatsApp QR Code"
                  className={cn(
                    'w-48 h-48 object-contain',
                    compact && 'w-36 h-36'
                  )}
                />
              )}
              {status === 'expired' && (
                <div className="absolute inset-0 bg-gray-900/80 rounded-2xl flex items-center justify-center">
                  <button
                    type="button"
                    onClick={startLogin}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 rounded-lg text-white text-sm font-medium hover:bg-violet-500 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh QR
                  </button>
                </div>
              )}
            </div>

            {/* Status message */}
            <p className="text-sm text-gray-400 text-center mb-4">
              {message || 'Open WhatsApp on your phone and scan this code'}
            </p>

            {/* Instructions */}
            <div className="text-xs text-gray-500 space-y-1 text-center">
              <p>1. Open WhatsApp on your phone</p>
              <p>2. Tap Settings → Linked Devices</p>
              <p>3. Tap "Link a Device" and scan</p>
            </div>

            {/* Refresh button */}
            {status === 'waiting' && (
              <button
                type="button"
                onClick={startLogin}
                className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh QR code
              </button>
            )}
          </div>
        );

      case 'connected':
        return (
          <div className="relative flex flex-col items-center justify-center py-4">
            {showConfetti && <SuccessConfetti />}
            
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            
            <h3 className="text-lg font-semibold text-white mb-1">
              Connected!
            </h3>
            
            {phoneNumber && (
              <p className="text-sm text-gray-400 mb-2">
                {phoneNumber}
              </p>
            )}
            
            <p className="text-xs text-gray-500">
              Your WhatsApp is now linked to OpenClaw
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-lg font-semibold text-white mb-1">
              Connection Failed
            </h3>
            
            <p className="text-sm text-gray-400 mb-4 text-center">
              {error || message || 'Something went wrong. Please try again.'}
            </p>
            
            <button
              type="button"
              onClick={startLogin}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 rounded-lg text-white text-sm font-medium hover:bg-violet-500 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (compact) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center">
              <span className="text-lg">📱</span>
            </div>
            <h4 className="text-sm font-medium text-white">WhatsApp</h4>
          </div>
          {status !== 'idle' && status !== 'connected' && (
            <button
              type="button"
              onClick={cancelLogin}
              className="p-1 rounded hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
        
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-600/20 flex items-center justify-center">
            <span className="text-2xl">📱</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Link WhatsApp</h3>
            <p className="text-xs text-gray-500">Scan with your phone</p>
          </div>
        </div>
        
        {onCancel && status !== 'connected' && (
          <button
            type="button"
            onClick={cancelLogin}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}

// Export named for flexibility
export { WhatsAppQrLogin };
