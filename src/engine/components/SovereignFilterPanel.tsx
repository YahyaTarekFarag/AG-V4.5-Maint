import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@shared/lib/supabase';
import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';
import { X, Filter, RotateCcw, ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

interface SovereignFilterPanelProps {
    tableName: string;
    filters: Record<string, any>;
    onChange: (filters: Record<string, any>) => void;
    isOpen: boolean;
    onClose: () => void;
}

export default function SovereignFilterPanel({ tableName, filters, onChange, isOpen, onClose }: SovereignFilterPanelProps) {
    const config = SOVEREIGN_REGISTRY[tableName];
    const [lookupData, setLookupData] = useState<Record<string, any[]>>({});
    const [localFilters, setLocalFilters] = useState<Record<string, any>>(filters);

    // Sync local state with props when opened
    useEffect(() => {
        if (isOpen) setLocalFilters(filters);
    }, [isOpen, filters]);

    const fetchLookups = useCallback(async () => {
        if (!config?.filterableColumns) return;

        const lookupCols = config.filterableColumns.filter((c: any) => c.type === 'select' && c.dataSource);

        for (const col of lookupCols) {
            if (!col.dataSource) continue;
            try {
                const { data } = await supabase.from(col.dataSource as any).select('*');
                if (data) {
                    setLookupData(prev => ({ ...prev, [col.key]: data }));
                }
            } catch (e) {
                console.error(`Error fetching filter lookup for ${col.key}`, e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, tableName]);

    useEffect(() => {
        if (isOpen) fetchLookups();
    }, [isOpen, fetchLookups]);

    const handleApply = () => {
        onChange(localFilters);
        onClose();
    };

    const updateFilter = (key: string, value: any) => {
        setLocalFilters(prev => ({ ...prev, [key]: value }));
    };

    const updateDateRange = (key: string, type: 'start' | 'end', value: string) => {
        const currentRange = localFilters[key] || {};
        const newRange = { ...currentRange, [type]: value };
        if (!newRange.start && !newRange.end) {
            setLocalFilters(prev => {
                const updated = { ...prev };
                delete updated[key];
                return updated;
            });
        } else {
            setLocalFilters(prev => ({
                ...prev,
                [key]: newRange
            }));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-surface-900/20 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative w-full max-w-sm glass-premium h-full shadow-2xl flex flex-col animate-in slide-in-from-left sm:slide-in-from-right duration-500">
                <div className="absolute inset-0 bg-surface-950/80 -z-10" />
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-surface-900/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2.5 bg-brand-konafa text-white rounded-xl shadow-lg shadow-brand-konafa/30">
                            <Filter className="w-5 h-5" />
                        </div>
                        <h3 className="text-2xl font-black text-surface-900 dark:text-white font-outfit tracking-tight">تخصيص البحث</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-800 rounded-full transition-colors">
                        <X className="w-6 h-6 text-surface-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {config?.filterableColumns?.map((col: any) => (
                        <div key={col.key} className="space-y-3">
                            <label className="text-sm font-bold text-surface-600 dark:text-surface-400 flex items-center gap-2">
                                {col.label}
                                {localFilters[col.key] && (
                                    <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                                )}
                            </label>

                            {col.type === 'status' ? (
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(config.formatting?.statusLabels || {}).map(([val, label]) => {
                                        const isSelected = localFilters[col.key] === val;
                                        return (
                                            <button
                                                key={val}
                                                onClick={() => updateFilter(col.key, isSelected ? null : val)}
                                                className={clsx(
                                                    "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                                                    isSelected
                                                        ? "bg-brand-blaban text-white border-brand-blaban shadow-lg scale-105"
                                                        : "bg-surface-800 text-surface-400 border-surface-700 hover:border-brand-blaban"
                                                )}
                                            >
                                                {String(label)}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : col.type === 'select' ? (
                                <div className="relative group">
                                    <select
                                        value={localFilters[col.key] || ''}
                                        onChange={(e) => updateFilter(col.key, e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blaban/30 focus:border-brand-blaban transition-all appearance-none cursor-pointer text-white"
                                    >
                                        <option value="">عرض الكل</option>
                                        {lookupData[col.key]?.map((item) => (
                                            <option key={item.id} value={item.id} className="bg-surface-900 border-none">
                                                {item.name || item.full_name || item.label || item.id}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 pointer-events-none group-focus-within:rotate-180 transition-transform" />
                                </div>
                            ) : col.type === 'date' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider pr-1">من تاريخ</span>
                                        <input
                                            type="date"
                                            value={localFilters[col.key]?.start || ''}
                                            onChange={(e) => updateDateRange(col.key, 'start', e.target.value)}
                                            className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-blaban/30 outline-none text-white"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider pr-1">إلى تاريخ</span>
                                        <input
                                            type="date"
                                            value={localFilters[col.key]?.end || ''}
                                            onChange={(e) => updateDateRange(col.key, 'end', e.target.value)}
                                            className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-xl text-xs focus:ring-2 focus:ring-brand-blaban/30 outline-none text-white"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    placeholder={`بحث بـ ${col.label}...`}
                                    value={localFilters[col.key] || ''}
                                    onChange={(e) => updateFilter(col.key, e.target.value)}
                                    className="w-full px-4 py-2.5 bg-surface-800 border border-surface-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-blaban/30 outline-none text-white placeholder:text-surface-500"
                                />
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t border-white/5 bg-surface-900/50 flex flex-col gap-3">
                    <button
                        onClick={handleApply}
                        className="btn-3d w-full py-4 bg-brand-blaban text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-brand-blaban/30 transition-all active:scale-95 translate-y-0 hover:-translate-y-1"
                    >
                        <Check className="w-5 h-5" />
                        <span>تطبيق الفلاتر المحددة</span>
                    </button>
                    <button
                        onClick={() => onChange({})}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-surface-800 text-surface-400 rounded-xl text-sm font-bold hover:bg-surface-700 transition-all"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>إعادة ضبط الافتراضي</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
