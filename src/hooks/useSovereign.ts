import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UISchema, ListConfig } from '../types/schema';

import { useAuth } from '../contexts/AuthContext';
import { applyRBACFilter, getSecureProfileSelect, getRBACSelect } from '../lib/rbac';
import { SOVEREIGN_REGISTRY } from '../lib/sovereign';

const PAGE_SIZE = 50;

export function useSovereign(tableName: string) {

    const { profile } = useAuth();

    const [schema, setSchema] = useState<UISchema | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [metricsData, setMetricsData] = useState<Record<string, number>>({});

    // ─── Relation Joins — To show names instead of IDs ───
    const getSelectString = useCallback(() => {
        const config = SOVEREIGN_REGISTRY[tableName];
        if (tableName === 'profiles') {
            return getSecureProfileSelect(profile?.role || '');
        }
        if (config) return config.selectString;
        return '*';
    }, [tableName, profile?.role]);

    // ─── Pagination State ───
    const [page, setPage] = useState(0); // 0-indexed
    const [totalCount, setTotalCount] = useState(0);
    const [schemaCache, setSchemaCache] = useState<ListConfig | null>(null);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    // ─── Helper: Identify Missing Column Error ───
    const isMissingColumnError = (e: any) => {
        return e && e.message && (e.message.includes('is_deleted') || e.code === '42703');
    };

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
            let query = supabase.from(tableName as any).select(getRBACSelect(tableName), { count: 'exact', head: true });
            query = query.eq('is_deleted', false);
            query = applyFilters(query);
            query = applyRBACFilter(query, tableName, profile);

            const { count, error: countError } = await query;

            if (countError) {
                if (isMissingColumnError(countError)) {
                    const { count: retryCount } = await supabase
                        .from(tableName as any)
                        .select('*', { count: 'exact', head: true });
                    setTotalCount(retryCount || 0);
                } else {
                    console.error('Count error:', countError);
                }
            } else {
                setTotalCount(count || 0);
            }
        } catch { /* silent */ }
    }, [tableName, profile, applyFilters]);

    // ─── جلب المقاييس (KPIs) - تحديث QUANTUM مجمع ───
    const fetchMetrics = useCallback(async (currentSchema?: UISchema) => {
        const activeSchema = currentSchema || schema;
        const config = SOVEREIGN_REGISTRY[tableName];
        const metrics = config?.metrics || activeSchema?.page_config?.kpi_cards;

        if (!metrics || metrics.length === 0) return;

        try {
            // [QUANTUM FIX] تحويل الطلبات المتعددة لطلب RPC واحد مجمع لمنع استنزاف قاعدة البيانات
            const { data: results, error: metricsError } = await supabase.rpc('get_table_metrics', {
                p_table_name: tableName,
                p_metrics: metrics
            });

            if (metricsError) throw metricsError;
            setMetricsData(results || {});
        } catch (e) {
            console.error('Metrics RPC error', e);
            // Fallback for safety
            setMetricsData({});
        }
    }, [tableName, schema]);

    // ─── تحميل بيانات الصفحة (Pagination) ───
    const loadPage = useCallback(async (config: ListConfig, pageNum: number) => {
        try {
            const from = pageNum * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            // تحسين: استخدام select string مخزون مسبقاً
            let query = supabase.from(tableName as any).select(getSelectString());

            // تطبيق فلاتر الحذف الحركي
            query = query.eq('is_deleted', false);

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

            // معالجة الخطأ في حالة غياب حقل (created_at) أو (is_deleted)
            if (rowsError && (isMissingColumnError(rowsError) || rowsError.code === '42703')) {
                let retryQuery = supabase
                    .from(tableName as any)
                    .select(getSelectString())
                    .range(from, to);

                // المحاولة بالترتيب البديل (updated_at أو بدون ترتيب)
                const { data: retryRows, error: retryError } = await retryQuery;
                if (retryError) throw retryError;
                setData(retryRows || []);
            } else if (rowsError) {
                throw rowsError;
            } else {
                setData(rows || []);
            }
        } catch (e: any) {
            console.error(`Error loading data for ${tableName}:`, e);
            throw e;
        }
    }, [tableName, profile, applyFilters, getSelectString]);

    // ─── Initial Fetch (Schema + First Page + Count) ───
    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Schema
            const { data: schemaData, error: schemaError } = await supabase
                .from('ui_schemas')
                .select('*')
                .eq('table_name', tableName)
                .single();

            if (schemaError) throw new Error(`Schema not found for table: ${tableName}`);
            setSchema(schemaData as UISchema);
            setSchemaCache(schemaData.list_config);

            // 2. Fetch Count + Metrics + First Page in parallel
            await Promise.all([
                fetchCount(),
                fetchMetrics(schemaData as UISchema),
                loadPage(schemaData.list_config, 0),
            ]);
            setPage(0);

        } catch (e: any) {
            setError(e.message || 'Unknown error fetching sovereign data');
        } finally {
            setLoading(false);
        }
    }, [tableName, loadPage, fetchCount]);

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

    // ─── Fetch ALL rows (Chunked for Memory Safety) ───
    const fetchAllRows = useCallback(async (): Promise<any[]> => {
        const MAX_EXPORT_LIMIT = 10000; // حماية ضد انفجار الذاكرة
        try {
            if (totalCount > MAX_EXPORT_LIMIT) {
                alert(`تنبيه: حجم البيانات كبير جداً (${totalCount.toLocaleString('ar-EG')} سجل). سيتم تصدير أول ${MAX_EXPORT_LIMIT.toLocaleString('ar-EG')} سجل فقط لضمان استقرار المتصفح.`);
            }

            let allRows: any[] = [];
            let hasMore = true;
            let offset = 0;
            const CHUNK_SIZE = 1000;

            while (hasMore) {
                // [RESCUE FIX] Use RBAC select string for Export to ensure hierarchical filters work
                let query = supabase.from(tableName as any).select(getRBACSelect(tableName));
                query = query.eq('is_deleted', false);
                query = applyFilters(query);

                // Centralized RBAC protection in Export
                query = applyRBACFilter(query, tableName, profile);


                query = query.order('created_at', { ascending: false });
                query = query.range(offset, offset + CHUNK_SIZE - 1);

                const { data: rows, error: rowsError } = await query;
                if (rowsError) throw rowsError;

                if (rows && rows.length > 0) {
                    allRows = [...allRows, ...rows];
                    offset += CHUNK_SIZE;
                    if (rows.length < CHUNK_SIZE || allRows.length >= MAX_EXPORT_LIMIT) hasMore = false;
                } else {
                    hasMore = false;
                }
            }
            return allRows;
        } catch (e) {
            console.error('Export Error:', e);
            return data; // fallback to current page data
        }
    }, [tableName, data, profile, getSelectString]);


    useEffect(() => {
        fetchAll();

        // Systemic Realtime Upgrade: Auto-sync any data changes globally
        const channel = supabase.channel(`sovereign-live-${tableName}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
                // Debounce/Throttle is handled inside the Realtime callback if needed
                fetchAll();
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [tableName, fetchAll]); // filters removed as they are used inside fetchAll which is already debounced/stabilized

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
        // Pagination
        page,
        totalPages,
        totalCount,
        pageSize: PAGE_SIZE,
        goToPage,
        fetchAllRows,
    };
}
