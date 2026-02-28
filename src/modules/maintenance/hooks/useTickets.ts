import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { Ticket } from '@/types/database';
import { toast } from 'react-hot-toast';

export const fetchTickets = async (branchId?: string): Promise<Ticket[]> => {
    let query = supabase
        .from('tickets')
        .select(`
            *,
            branch:branches(name),
            category:maintenance_categories(name),
            technician:profiles!assigned_to(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[fetchTickets] Error:', error);
        throw new Error(error.message);
    }

    return (data as any) || [];
};

export const useTickets = (branchId?: string) => {
    return useQuery({
        queryKey: ['tickets', branchId],
        queryFn: () => fetchTickets(branchId),
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
};

export const useUpdateTicketStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ ticketId, status }: { ticketId: string, status: string }) => {
            const { data, error } = await supabase
                .from('tickets')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', ticketId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            toast.success('تم تحديث حالة البلاغ');
        },
        onError: (error: any) => {
            toast.error(`فشل التحديث: ${error.message}`);
        }
    });
};
