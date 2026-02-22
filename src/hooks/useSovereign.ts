import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UISchema, ListConfig } from '../types/schema';

const PAGE_SIZE = 50;

export function useSovereign(tableName: string) {
    const [schema, setSchema] = useState<UISchema | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ─── Pagination State ───
    const [page, setPage] = useState(0); // 0-indexed
    const [totalCount, setTotalCount] = useState(0);
    const [schemaCache, setSchemaCache] = useState<ListConfig | null>(null);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    // ─── Fetch Count ───
    const fetchCount = useCallback(async () => {
        try {
            // Try with is_deleted filter first
            let { count, error: countError } = await supabase
                .from(tableName as any)
                .select('*', { count: 'exact', head: true })
                .eq('is_deleted', false);

            if (countError && countError.message.includes('column "is_deleted" does not exist')) {
                const result = await supabase
                    .from(tableName as any)
                    .select('*', { count: 'exact', head: true });
                count = result.count;
            }

            setTotalCount(count || 0);
        } catch { /* silent */ }
    }, [tableName]);

    // ─── Load Page Data ───
    const loadPage = useCallback(async (config: ListConfig, pageNum: number) => {
        try {
            const from = pageNum * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            let query = supabase.from(tableName as any).select('*');
            query = query.eq('is_deleted', false);

            if (config.defaultSort) {
                query = query.order(config.defaultSort.column, { ascending: config.defaultSort.ascending });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            query = query.range(from, to);

            const { data: rows, error: rowsError } = await query;

            // Fallback if is_deleted doesn't exist
            if (rowsError && rowsError.message.includes('column "is_deleted" does not exist')) {
                let retryQuery = supabase
                    .from(tableName as any)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(from, to);

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
    }, [tableName]);

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

            // 2. Fetch Count + First Page in parallel
            await Promise.all([
                fetchCount(),
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

    // ─── Fetch ALL rows (for export only — not rendered) ───
    const fetchAllRows = useCallback(async (): Promise<any[]> => {
        try {
            let query = supabase.from(tableName as any).select('*');
            query = query.eq('is_deleted', false);
            query = query.order('created_at', { ascending: false });

            const { data: rows, error: rowsError } = await query;

            if (rowsError && rowsError.message.includes('column "is_deleted" does not exist')) {
                const { data: retryRows } = await supabase
                    .from(tableName as any)
                    .select('*')
                    .order('created_at', { ascending: false });
                return retryRows || [];
            }
            if (rowsError) throw rowsError;
            return rows || [];
        } catch {
            return data; // fallback to current page data
        }
    }, [tableName, data]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    return {
        schema,
        data,
        loading,
        error,
        refetch: fetchAll,
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
