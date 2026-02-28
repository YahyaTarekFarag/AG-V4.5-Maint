import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { applyRBACFilter, getRBACSelect } from '@shared/lib/rbac';
import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';
import * as LucideIcons from 'lucide-react';
import clsx from 'clsx';

const ALL_ROLES = ['admin', 'brand_ops_manager', 'sector_manager', 'area_manager', 'manager', 'maintenance_manager', 'maintenance_supervisor', 'technician'];

export default function OmniSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{ type: string; id: string; label: string; sub?: string; path: string; icon?: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const { profile } = useAuth();
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);

    // Toggle with Shift+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.shiftKey && e.key === 'K') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setQuery('');
            setResults([]);
        }
    }, [isOpen]);

    // Search Logic (Debounced & Dynamic)
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                // ─── 1. Dynamic Table Search ───
                const searchables = Object.values(SOVEREIGN_REGISTRY).filter((s: any) => s.roles.includes(profile?.role || ''));

                const searchPromises = searchables.map(async (schema: any) => {
                    // Get searchable columns from the registry config
                    // Fallback to basic columns if none defined
                    const registryCols = schema.filterableColumns
                        ?.filter((c: any) => c.type === 'text' || c.key.includes('name'))
                        .map((c: any) => c.key) || [];

                    const searchCols = Array.from(new Set([
                        'name',
                        'full_name',
                        'employee_code',
                        'asset_name',
                        'qr_code',
                        'serial_number',
                        ...registryCols
                    ]));

                    const results = await Promise.all(searchCols.map(async (col) => {
                        try {
                            const subQ = supabase.from(schema.tableName).select(getRBACSelect(schema.tableName)).ilike(col, `%${query}%`).limit(2);
                            return await applyRBACFilter(subQ, schema.tableName, profile);
                        } catch (e) {
                            return { data: [] }; // Ignore individual column search failures (e.g. if column doesn't exist)
                        }
                    }));

                    const combined = results.flatMap(r => r.data || []).slice(0, 3);
                    return combined.map((item: any) => ({
                        type: schema.tableName,
                        id: item.id,
                        label: item.name || item.full_name || item.asset_name || item.label || item.id,
                        sub: schema.label,
                        path: schema.path,
                        icon: schema.icon
                    }));
                });

                const dynamicResults = (await Promise.all(searchPromises)).flat();

                // ─── 2. Page Shortcuts (Static + Dynamic) ───
                const pageShortcuts = [
                    { label: 'الرئيسية (لوحتك)', path: '/', icon: 'LayoutDashboard', roles: ALL_ROLES },
                    { label: 'الخريطة التشغيلية', path: '/map', icon: 'Map', roles: ['admin', 'manager', 'maintenance_manager', 'maintenance_supervisor', 'brand_ops_manager', 'sector_manager', 'area_manager'] },
                    ...Object.values(SOVEREIGN_REGISTRY).map(s => ({ label: s.label, path: s.path, icon: s.icon, roles: s.roles }))
                ].filter(p => (p.label as string).includes(query) && (p.roles as string[]).includes(profile?.role || ''));

                setResults([
                    ...dynamicResults,
                    ...pageShortcuts.map(p => ({ type: 'page', id: p.path, label: p.label, path: p.path, icon: p.icon }))
                ]);
            } catch (e) {
                console.error('Search error', e);
            } finally {
                setLoading(false);
                setActiveIndex(0);
            }
        }, 300);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const handleSelect = (result: any) => {
        navigate(result.path);
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
            <div className="absolute inset-0 bg-surface-950/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

            <div className="bg-surface-900/95 backdrop-blur-xl w-full max-w-2xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Search Bar */}
                <div className="p-4 flex items-center gap-4 border-b border-surface-800 bg-surface-800/50">
                    {loading ? <Loader2 className="w-6 h-6 text-brand-blaban animate-spin" /> : <Search className="w-6 h-6 text-surface-500" />}
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="ابحث عن بلاغ، معدة، أو موظف... (Shift + K)"
                        className="flex-1 bg-transparent border-none outline-none text-lg text-white placeholder-surface-500 font-medium"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') setActiveIndex(prev => Math.min(prev + 1, results.length - 1));
                            if (e.key === 'ArrowUp') setActiveIndex(prev => Math.max(prev - 1, 0));
                            if (e.key === 'Enter' && results[activeIndex]) handleSelect(results[activeIndex]);
                        }}
                    />
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-800 rounded-lg text-[10px] font-bold text-surface-400 border border-surface-700 uppercase">
                        <span>Esc</span>
                    </div>
                </div>

                {/* Results List */}
                <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
                    {results.length === 0 && !loading && (
                        <div className="p-8 text-center">
                            {query ? (
                                <p className="text-surface-500">لا توجد نتائج بحث عن "{query}"</p>
                            ) : (
                                <div className="space-y-4">
                                    <Command className="w-12 h-12 text-surface-800 mx-auto" />
                                    <p className="text-surface-500 font-medium">ابدأ الكتابة للبحث السريع في نظام بلبن الجديد</p>
                                </div>
                            )}
                        </div>
                    )}

                    {results.map((result, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSelect(result)}
                            className={clsx(
                                "w-full flex items-center justify-between p-4 rounded-2xl transition-all group",
                                idx === activeIndex ? "bg-brand-blaban text-white shadow-xl shadow-brand-blaban/30 scale-[1.02]" : "hover:bg-surface-800"
                            )}
                        >
                            <div className="flex items-center gap-4">
                                <div className={clsx(
                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                    idx === activeIndex ? "bg-white/20" : "bg-surface-800 text-surface-400"
                                )}>
                                    {(() => {
                                        const IconComp = (LucideIcons as any)[result.icon || ''] ||
                                            (result.type === 'page' ? LucideIcons.Command : LucideIcons.Search);
                                        return <IconComp className="w-5 h-5" />;
                                    })()}
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-white">{result.label}</p>
                                    {result.sub && (
                                        <p className={clsx(
                                            "text-xs mt-0.5",
                                            idx === activeIndex ? "text-white/70" : "text-surface-500"
                                        )}>
                                            {result.sub}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <ArrowRight className={clsx(
                                "w-5 h-5 transition-transform",
                                idx === activeIndex ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                            )} />
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-surface-950 border-t border-surface-800 flex items-center gap-6 text-[10px] text-surface-500 font-bold uppercase overflow-x-auto">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="px-1.5 py-1 bg-surface-800 border border-surface-700 rounded shadow-sm text-surface-300">↵</span>
                        للاختيار
                    </div>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="px-1.5 py-1 bg-surface-800 border border-surface-700 rounded shadow-sm text-surface-300">↓↑</span>
                        للتنقل
                    </div>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="px-1.5 py-1 bg-surface-800 border border-surface-700 rounded shadow-sm text-surface-300">Shift + K</span>
                        للإغلاق
                    </div>
                </div>
            </div>
        </div>
    );
}
