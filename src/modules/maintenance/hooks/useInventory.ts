import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { InventoryItem } from '@/types/database';

export const fetchInventory = async (branchId?: string): Promise<InventoryItem[]> => {
    let query = supabase
        .from('inventory')
        .select(`
            *,
            branch:branches(name),
            category:maintenance_categories(name)
        `)
        .order('name')
        .limit(300);

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[fetchInventory] Error:', error);
        throw new Error(error.message);
    }

    return (data as any) || [];
};

export const useInventory = (branchId?: string) => {
    return useQuery({
        queryKey: ['inventory', branchId],
        queryFn: () => fetchInventory(branchId),
        staleTime: 1000 * 60 * 10, // 10 minutes (inventory changes less often)
    });
};
