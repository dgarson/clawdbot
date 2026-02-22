import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { cn } from '../lib/utils';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  toast: (options: { message: string; type: ToastType; duration?: number }) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastIcon = ({ type }: { type: ToastType }) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    case 'info':
      return <Info className="w-5 h-5 text-blue-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  }
};

const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300); // Match animation duration
  }, [onRemove, toast.id]);

  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(handleRemove, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, handleRemove]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 shadow-lg min-w-[300px] max-w-md transition-all duration-300 animate-in slide-in-from-right-full fade-in",
        isExiting && "animate-out fade-out slide-out-to-right-full"
      )}
    >
      <div className="flex-shrink-0">
        <ToastIcon type={toast.type} />
      </div>
      <div className="flex-grow text-sm text-foreground">
        {toast.message}
      </div>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 ml-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(({ message, type, duration = 4000 }: { message: string; type: ToastType; duration?: number }) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      const next = [...prev, { id, message, type, duration }];
      if (next.length > 5) {
        return next.slice(next.length - 5);
      }
      return next;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
