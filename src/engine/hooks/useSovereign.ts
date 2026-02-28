import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@shared/lib/supabase';
import { UISchema, ListConfig } from '@/types/schema';

import { useAuth } from '@shared/hooks/useAuth';
import { applyRBACFilter, getSecureProfileSelect, getRBACSelect } from '@shared/lib/rbac';
import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';

const PAGE_SIZE = 50;
const SCHEMA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Schema Cache Helpers ───
function getCachedSchema(tableName: string) {
    try {
        const raw = sessionStorage.getItem(`schema_${tableName}`);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > SCHEMA_CACHE_TTL) {
            sessionStorage.removeItem(`schema_${tableName}`);
            return null;
        }
        return data;
    } catch { return null; }
}

function setCachedSchema(tableName: string, data: any) {
    try {
        sessionStorage.setItem(`schema_${tableName}`, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* quota exceeded — silent */ }
}

export function useSovereign(tableName: string) {

    const { profile } = useAuth();

    const [schema, setSchema] = useState<UISchema | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [metricsData, setMetricsData] = useState<Record<string, number>>({});

    // ─── Resolve Actual Database Table Name ───
    const sovConfig = SOVEREIGN_REGISTRY[tableName];
    const resolvedTableName = sovConfig?.tableName || tableName;
    const supportsSoftDelete = sovConfig?.supportsSoftDelete !== false;

    // ─── Relation Joins — To show names instead of IDs ───
    const getSelectString = useCallback(() => {
        if (resolvedTableName === 'profiles') {
            return getSecureProfileSelect(profile?.role || '');
        }
        if (sovConfig) return sovConfig.selectString;
        return '*';
    }, [resolvedTableName, profile?.role, sovConfig]);

    // ─── Pagination State ───
    const [page, setPage] = useState(0); // 0-indexed
    const [totalCount, setTotalCount] = useState(0);
    const [schemaCache, setSchemaCache] = useState<ListConfig | null>(null);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    // ─── Helper: Apply Active Filters ───
    const applyFilters = useCallback((query: any) => {
        let q = query;
        Object.entries(filters).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;

            if (typeof value === 'object' && ('start' in value || 'end' in value)) {
                // Date Range
                if (value.start) q = q.gte(key, value.start);
                if (value.end) q = q.lte(key, value.end);
            } else if (Array.isArray(value)) {
                // Multi-select matches
                if (value.length > 0) q = q.in(key, value);
            } else {
                // Exact match (Select/Status)
                q = q.eq(key, value);
            }
        });
        return q;
    }, [filters]);

    // ─── Fetch Count ───
    const fetchCount = useCallback(async () => {
        try {
            // [RESCUE FIX] Use RBAC select string to ensure joins are present for filtering
            let query = supabase.from(resolvedTableName as any).select(getRBACSelect(resolvedTableName), { count: 'exact', head: true });
            if (supportsSoftDelete) {
                query = query.eq('is_deleted', false);
            }
            query = applyFilters(query);
            query = applyRBACFilter(query, tableName, profile);

            const { count, error: countError } = await query;

            if (countError) {
                // Fallback: try simpler count without joins
                console.warn('Count with joins failed, trying simple count:', countError.message);
                let fallbackQuery = supabase.from(resolvedTableName as any).select('*', { count: 'exact', head: true });
                if (supportsSoftDelete) {
                    fallbackQuery = fallbackQuery.eq('is_deleted', false);
                }
                const { count: fallbackCount } = await fallbackQuery;
                setTotalCount(fallbackCount || 0);
            } else {
                setTotalCount(count || 0);
            }
        } catch { /* silent */ }
    }, [tableName, profile, applyFilters]);

    // ─── جلب المقاييس (KPIs) - حساب محلي من بيانات الجدول ───
    const fetchMetrics = useCallback(async () => {
        const config = SOVEREIGN_REGISTRY[tableName];
        const metrics = config?.metrics;

        if (!metrics || metrics.length === 0) return;

        try {
            const sovConfig = SOVEREIGN_REGISTRY[tableName];
            const supportsSoftDelete = sovConfig?.supportsSoftDelete !== false;

            // Fetch lightweight count data for metrics
            const results: Record<string, number> = {};

            for (const metric of metrics) {
                let query = supabase.from(resolvedTableName as any).select('*', { count: 'exact', head: true });
                if (supportsSoftDelete) {
                    query = query.eq('is_deleted', false);
                }
                // Apply metric-specific filters
                if (metric.filter) {
                    for (const [fKey, fVal] of Object.entries(metric.filter)) {
                        query = query.eq(fKey, fVal);
                    }
                }
                // Apply RBAC
                query = applyRBACFilter(query, tableName, profile);

                const { count } = await query;
                results[metric.label] = count || 0;
            }

            setMetricsData(results);
        } catch (e) {
            console.error('Metrics calculation error', e);
            setMetricsData({});
        }
    }, [tableName, profile]);


    // ─── تحميل بيانات الصفحة (Pagination) ───
    const loadPage = useCallback(async (config: ListConfig, pageNum: number) => {
        try {
            const from = pageNum * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const sovConfig = SOVEREIGN_REGISTRY[tableName];
            const supportsSoftDelete = sovConfig?.supportsSoftDelete !== false;

            // تحسين: استخدام select string مخزون مسبقاً
            let query = supabase.from(resolvedTableName as any).select(getSelectString());

            // تطبيق فلاتر الحذف الحركي
            if (supportsSoftDelete) {
                query = query.eq('is_deleted', false);
            }

            // تطبيق فلاتر الواجهة
            query = applyFilters(query);

            // تطبيق حوكمة البيانات (RBAC)
            query = applyRBACFilter(query, tableName, profile);

            // تحسين: الترتيب الافتراضي الذكي
            if (config.defaultSort) {
                query = query.order(config.defaultSort.column, { ascending: config.defaultSort.ascending });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            // تحديد النطاق المطلبو للبيانات
            query = query.range(from, to);

            const { data: rows, error: rowsError } = await query;

            if (rowsError) {
                console.error(`Error loading data for ${tableName}:`, rowsError);
                setData([]);
            } else {
                setData(rows || []);
            }
        } catch (e: any) {
            console.error(`Error loading data for ${tableName}:`, e);
            setData([]);
        }
    }, [tableName, profile, applyFilters, getSelectString]);

    const [debugState, setDebugState] = useState<string[]>([]);
    const dlog = (msg: string) => setDebugState(prev => [...prev, msg + ' at ' + new Date().toISOString()]);

    // ─── Initial Fetch (Schema + First Page + Count) ───
    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        setDebugState(['Started fetchAll']);
        try {
            dlog('Fetching schema...');
            // 1. Try cache first, then DB
            let schemaData = getCachedSchema(tableName);
            if (!schemaData) {
                const { data, error: schemaError } = await supabase
                    .from('ui_schemas')
                    .select('*')
                    .eq('table_name', resolvedTableName)
                    .single();
                if (schemaError) throw new Error(`Schema not found for table: ${tableName}`);
                schemaData = data;
                setCachedSchema(tableName, schemaData);
            }

            dlog('Schema fetched. Setting states...');
            setSchema(schemaData as UISchema);
            setSchemaCache(schemaData.list_config);

            dlog('Initiating parallel fetches...');
            // 2. Fetch Count + Metrics + First Page in parallel

            dlog('Starting fetchCount');
            const p1 = fetchCount().then(() => dlog('fetchCount done'));
            dlog('Starting fetchMetrics');
            const p2 = fetchMetrics().then(() => dlog('fetchMetrics done'));
            dlog('Starting loadPage');
            const p3 = loadPage(schemaData.list_config, 0).then(() => dlog('loadPage done'));

            await Promise.all([p1, p2, p3]);

            dlog('All fetches complete');
            setPage(0);

        } catch (e: any) {
            dlog(`Error in fetchAll: ${e.message}`);
            setError(e.message || 'Unknown error fetching sovereign data');
        } finally {
            dlog('Reached finally block, setting loading false');
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableName, loadPage, fetchCount]);

    // ─── Refresh Data Only (no schema re-fetch) ───
    const refreshData = useCallback(async () => {
        if (!schemaCache) return;
        try {
            await Promise.all([
                fetchCount(),
                loadPage(schemaCache, page),
            ]);
        } catch (e) {
            console.error('Refresh error:', e);
        }
    }, [schemaCache, page, fetchCount, loadPage]);

    // ─── Page Change Handler ───
    const goToPage = useCallback(async (newPage: number) => {
        if (newPage < 0 || newPage >= totalPages || !schemaCache) return;
        setLoading(true);
        try {
            await loadPage(schemaCache, newPage);
            setPage(newPage);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [totalPages, schemaCache, loadPage]);

    // ─── Fetch ALL rows (Server-Side RPC for Memory Safety) ───
    const fetchAllRows = useCallback(async (): Promise<any[]> => {
        try {
            if (totalCount > 5000) {
                alert(`تحذير الأداء: لا يمكن تصدير أكثر من 5000 سجل دفعة واحدة للحفاظ على استقرار النظام (المطلوب: ${totalCount} سجل). يرجى استخدام الفلاتر لتضييق نطاق التصدير.`);
                return [];
            }

            const { data: exportData, error } = await supabase.rpc('export_sovereign_data', {
                p_table_name: resolvedTableName,
                p_profile_id: profile?.id || null
            });

            if (error) {
                console.error('Export RPC Error:', error);
                throw error;
            }

            return exportData || [];
        } catch (e) {
            console.error('Export Retrieval Error:', e);
            // Fallback to current page data if RPC fails
            return data;
        }
    }, [tableName, profile, data, totalCount]);


    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        // Realtime Subscription: Depends ONLY on tableName to avoid redundant resubscriptions
        let debounceTimer: any = null;
        const channel = supabase.channel(`sovereign-live-${tableName}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: resolvedTableName }, (payload) => {
                // Optimistic Local Patch
                if (payload.eventType === 'INSERT') {
                    setData(prev => [payload.new, ...prev].slice(0, PAGE_SIZE));
                } else if (payload.eventType === 'UPDATE') {
                    setData(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
                } else if (payload.eventType === 'DELETE') {
                    setData(prev => prev.filter(r => r.id !== payload.old.id));
                }

                // Debounce to avoid rapid re-fetching
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    refreshData();
                    fetchMetrics();
                }, 1000);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') dlog('Sovereign Live Channel Active');
            });

        return () => {
            clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
            dlog('Sovereign Live Channel Terminated');
        };
    }, [tableName, refreshData, fetchMetrics]);

    return {
        schema,
        data,
        loading,
        error,
        refetch: fetchAll,
        filters,
        setFilters,
        metricsData,
        setData,
        debugState,
        // Pagination
        page,
        totalPages,
        totalCount,
        pageSize: PAGE_SIZE,
        goToPage,
        fetchAllRows,
    };
}
