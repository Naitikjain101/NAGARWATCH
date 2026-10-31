import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, durationMs = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, title, message, durationMs }]);

      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }
      return id;
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if invoked outside provider so components don't crash
    return {
      showToast: () => '',
      dismissToast: () => {},
      toasts: [],
    };
  }
  return context;
};

const typeConfig: Record<
  ToastType,
  { icon: React.ComponentType<{ className?: string }>; border: string; bg: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-200',
    bg: 'bg-white',
    iconColor: 'text-emerald-600',
  },
  error: {
    icon: AlertCircle,
    border: 'border-red-200',
    bg: 'bg-white',
    iconColor: 'text-red-600',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-200',
    bg: 'bg-white',
    iconColor: 'text-amber-600',
  },
  info: {
    icon: Info,
    border: 'border-blue-200',
    bg: 'bg-white',
    iconColor: 'text-blue-600',
  },
};

export const ToastContainer: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 sm:bottom-auto sm:top-5 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const config = typeConfig[toast.type];
        const Icon = config.icon;

        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto p-3 sm:p-4 rounded-lg border shadow-lg flex items-start gap-3 transition-all duration-200 font-sans',
              config.bg,
              config.border
            )}
          >
            <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', config.iconColor)} aria-hidden="true" />
            <div className="flex-1 space-y-0.5 min-w-0">
              <h4 className="text-xs sm:text-sm font-semibold text-[#172033] leading-snug">
                {toast.title}
              </h4>
              {toast.message && (
                <p className="text-xs text-[#687386] leading-relaxed break-words">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors shrink-0"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

