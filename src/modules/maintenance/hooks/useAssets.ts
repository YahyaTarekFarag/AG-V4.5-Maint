import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { MaintenanceAsset } from '@/types/database';

export const fetchAssets = async (branchId?: string): Promise<MaintenanceAsset[]> => {
    let query = supabase
        .from('maintenance_assets')
        .select(`
            *,
            branch:branches(name),
            category:maintenance_categories(name)
        `)
        .order('name')
        .limit(200);

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[fetchAssets] Error:', error);
        throw new Error(error.message);
    }

    return (data as any) || [];
};

export const useAssets = (branchId?: string) => {
    return useQuery({
        queryKey: ['assets', branchId],
        queryFn: () => fetchAssets(branchId),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
};
