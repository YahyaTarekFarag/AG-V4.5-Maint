import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { ToastType } from '../../contexts/ToastContext';
import clsx from 'clsx';

interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
}

const ICONS = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const COLORS = {
    success: 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400',
    error: 'border-red-500/50 text-red-600 dark:text-red-400',
    warning: 'border-amber-500/50 text-amber-600 dark:text-amber-400',
    info: 'border-blue-500/50 text-blue-600 dark:text-blue-400',
};

const BGS = {
    success: 'bg-emerald-50/80 dark:bg-emerald-950/40',
    error: 'bg-red-50/80 dark:bg-red-950/40',
    warning: 'bg-amber-50/80 dark:bg-amber-950/40',
    info: 'bg-blue-50/80 dark:bg-blue-950/40',
};

export default function ToastContainer({ toasts, onRemove }: { toasts: ToastProps[], onRemove: (id: string) => void }) {
    return (
        <div className="fixed bottom-6 left-6 z-[200] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
            {toasts.map((toast) => {
                const Icon = ICONS[toast.type as ToastType];
                return (
                    <div
                        key={toast.id}
                        className={clsx(
                            "pointer-events-auto glass-premium flex items-center gap-4 p-4 rounded-2xl border shadow-2xl animate-in slide-in-from-left-full duration-500 group",
                            COLORS[toast.type as ToastType],
                            BGS[toast.type as ToastType]
                        )}
                    >
                        <div className={clsx(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                            toast.type === 'success' ? 'bg-emerald-500/10' :
                                toast.type === 'error' ? 'bg-red-500/10' :
                                    toast.type === 'warning' ? 'bg-amber-500/10' : 'bg-blue-500/10'
                        )}>
                            <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold font-outfit tracking-wide leading-tight">
                                {toast.message}
                            </p>
                        </div>
                        <button
                            onClick={() => onRemove(toast.id)}
                            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
