import { supabaseAdmin } from './supabase';

/**
 * Sovereign Power Utility
 * Provides high-privilege operations that bypass RLS using the service role key.
 * USE WITH EXTREME CAUTION.
 */
export const SovereignPower = {
    /**
     * Resets a user's role and linkage safely.
     */
    async resetUserLinkage(profileId: string) {
        if (!supabaseAdmin) throw new Error('Service key not configured');
        return await supabaseAdmin
            .from('profiles')
            .update({
                brand_id: null,
                sector_id: null,
                area_id: null,
                branch_id: null
            })
            .eq('id', profileId);
    },

    /**
     * Bulk update records bypassing RLS.
     */
    async bulkUpdate(tableName: string, data: any, filter: { column: string; value: any }) {
        if (!supabaseAdmin) throw new Error('Service key not configured');
        return await supabaseAdmin
            .from(tableName as any)
            .update(data)
            .eq(filter.column, filter.value);
    },

    /**
     * Hard delete records (Admin only).
     */
    async hardDelete(tableName: string, id: string) {
        if (!supabaseAdmin) throw new Error('Service key not configured');
        return await supabaseAdmin
            .from(tableName as any)
            .delete()
            .eq('id', id);
    }
};
