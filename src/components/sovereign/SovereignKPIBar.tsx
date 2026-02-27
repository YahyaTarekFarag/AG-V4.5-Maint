import { memo } from 'react';
import { SOVEREIGN_REGISTRY } from '../../lib/sovereign';
import * as LucideIcons from 'lucide-react';
import { Zap } from 'lucide-react';
import clsx from 'clsx';
import Skeleton from '../ui/Skeleton';

interface SovereignKPIBarProps {
    tableName: string;
    metrics: Record<string, number>;
    loading: boolean;
    customConfig?: any[]; // Dynamic KPIs from ui_schemas
}

const SovereignKPIBar = memo(({ tableName, metrics, loading, customConfig }: SovereignKPIBarProps) => {
    const config = SOVEREIGN_REGISTRY[tableName];

    // Priority: static registry > dynamic config
    const activeMetrics = config?.metrics || customConfig;

    if (!activeMetrics || activeMetrics.length === 0) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 px-1">
            {activeMetrics.map((m, idx) => {
                const value = metrics[m.label] ?? 0;
                const IconComp = (LucideIcons as any)[m.icon || 'TrendingUp'] || Zap;

                return (
                    <div
                        key={idx}
                        className="bg-white dark:bg-surface-900 rounded-3xl p-5 border border-surface-200 dark:border-surface-800 shadow-sm hover:shadow-md transition-all group overflow-hidden relative"
                    >
                        {/* Decorative Background Blob */}
                        <div className={clsx(
                            "absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700",
                            m.color === 'amber' || m.color === 'orange' ? "bg-brand-konafa" :
                                m.color === 'blue' || m.color === 'primary' ? "bg-brand-blaban" :
                                    m.color === 'purple' || m.color === 'basbosa' ? "bg-brand-basbosa" :
                                        m.color === 'brown' || m.color === 'shaltat' ? "bg-brand-shaltat" :
                                            m.color === 'red' || m.color === 'whem' ? "bg-brand-whem" :
                                                m.color === 'teal' ? "bg-teal-500" :
                                                    m.color === 'emerald' ? "bg-emerald-500" : "bg-primary-500"
                        )} />

                        <div className="flex items-start justify-between relative z-10">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                                    {m.label}
                                </p>
                                {loading ? (
                                    <Skeleton className="h-8 w-16 rounded-lg bg-surface-100 dark:bg-surface-800" />
                                ) : (
                                    <h3 className="text-2xl font-black text-surface-900 dark:text-white tabular-nums">
                                        {value.toLocaleString('ar-EG')}
                                    </h3>
                                )}
                            </div>

                            <div className={clsx(
                                "p-3 rounded-2xl transition-transform group-hover:rotate-12",
                                m.color === 'amber' || m.color === 'orange' ? "bg-brand-konafa/10 text-brand-konafa" :
                                    m.color === 'blue' || m.color === 'primary' ? "bg-brand-blaban/10 text-brand-blaban" :
                                        m.color === 'purple' || m.color === 'basbosa' ? "bg-brand-basbosa/10 text-brand-basbosa" :
                                            m.color === 'brown' || m.color === 'shaltat' ? "bg-brand-shaltat/10 text-brand-shaltat" :
                                                m.color === 'red' || m.color === 'whem' ? "bg-brand-whem/10 text-brand-whem" :
                                                    "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                            )}>
                                <IconComp className="w-5 h-5" />
                            </div>
                        </div>

                        {!loading && (
                            <div className="mt-4 flex items-center gap-1.5">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <p className="text-[10px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-tighter">
                                    تحديث مباشر
                                </p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});

export default SovereignKPIBar;
