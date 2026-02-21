import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { UISchema, ListConfig } from '../types/schema';

export function useSovereign(tableName: string) {
    const [schema, setSchema] = useState<UISchema | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async (config: ListConfig) => {
        try {
            let query = supabase.from(tableName as any).select('*');

            // Check if table has is_deleted column by attempting to filter
            // In a more robust implementation, we could cache the columns list
            // but here we follow the "Zero Conflict" rule and assume audit compliance
            query = query.eq('is_deleted', false);

            if (config.defaultSort) {
                query = query.order(config.defaultSort.column, { ascending: config.defaultSort.ascending });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data: rows, error: rowsError } = await query;

            // Fallback if is_deleted doesn't exist on this specific table yet
            if (rowsError && rowsError.message.includes('column "is_deleted" does not exist')) {
                const { data: retryRows, error: retryError } = await supabase
                    .from(tableName as any)
                    .select('*')
                    .order('created_at', { ascending: false });

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

            // 2. Fetch Data
            await loadData(schemaData.list_config);

        } catch (e: any) {
            setError(e.message || 'Unknown error fetching sovereign data');
        } finally {
            setLoading(false);
        }
    }, [tableName, loadData]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    return {
        schema,
        data,
        loading,
        error,
        refetch: fetchAll,
        setData // Allow local updates for immediate feedback
    };
}
