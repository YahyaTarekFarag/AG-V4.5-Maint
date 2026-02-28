import { supabase } from '@shared/lib/supabase';

export interface TicketUpdateData {
    ticketId: string;
    technicianId: string;
    partsUsed: { part_id: string, qty: number }[];
    laborCost: number;
    resolvedImageUrl: string;
    resolvedLat?: number;
    resolvedLng?: number;
    faultTypeId?: string;
    assetId?: string;
    downtimeStart?: string;
    submissionId?: string;
}

/**
 * MaintenanceOrchestrator
 * Centeralized logic for maintenance operations to ensure consistency and atomicity.
 */
export const MaintenanceOrchestrator = {
    /**
     * Completes a ticket resolution in a single atomic step using the RPC.
     */
    async resolveTicket(data: TicketUpdateData) {
        console.log('[Orchestrator] Resolving ticket:', data.ticketId);

        // We use the RPC 'resolve_ticket_v3' to ensure absolute atomicity
        const { data: result, error } = await supabase.rpc('resolve_ticket_v3', {
            p_ticket_id: data.ticketId,
            p_technician_id: data.technicianId,
            p_parts_used: data.partsUsed,
            p_labor_cost: data.laborCost,
            p_resolution_image_url: data.resolvedImageUrl,
            p_resolved_lat: data.resolvedLat || null,
            p_resolved_lng: data.resolvedLng || null,
            p_fault_type_id: data.faultTypeId || null,
            p_asset_id: data.assetId || null,
            p_downtime_start: data.downtimeStart || null,
            p_submission_id: data.submissionId || `resolve-${data.ticketId}-${Date.now()}`
        });

        if (error) {
            console.error('[Orchestrator] Failed to resolve ticket:', error);
            throw error;
        }

        return result;
    },

    /**
     * Handles ticket assignment logic.
     */
    async assignTicket(ticketId: string, technicianId: string, priority?: string) {
        console.log('[Orchestrator] Assigning ticket:', ticketId, 'to', technicianId);

        const updateData: any = {
            assigned_to: technicianId,
            status: 'assigned',
            assigned_at: new Date().toISOString()
        };

        if (priority) updateData.priority = priority;

        const { error } = await supabase
            .from('tickets')
            .update(updateData)
            .eq('id', ticketId);

        if (error) throw error;
    },

    /**
     * Starts work on a ticket, including geofencing validation and mission logging.
     */
    async startWork(ticket: any, profileId: string, coords: { lat: number, lng: number }) {
        console.log('[Orchestrator] Starting work on ticket:', ticket.id);

        // 1. Mission Logging (Idempotent)
        const submissionId = `mission-${ticket.id}-${profileId}-${Date.now()}`;
        const { error: missionError } = await supabase.rpc('log_technician_mission', {
            p_ticket_id: ticket.id,
            p_to_branch_id: ticket.branch_id,
            p_submission_id: submissionId
        });

        if (missionError) {
            console.warn('[Orchestrator] Mission logging failed (non-critical):', missionError);
        }

        // 2. Update Ticket Status
        const { error } = await supabase
            .from('tickets')
            .update({
                status: 'in_progress',
                started_at: new Date().toISOString(),
                started_lat: coords.lat,
                started_lng: coords.lng
            })
            .eq('id', ticket.id);

        if (error) throw error;
    },

    /**
     * Finalizes and closes a ticket with rating and comments.
     */
    async closeTicket(ticketId: string, rating: number, comment: string) {
        console.log('[Orchestrator] Closing ticket:', ticketId);

        const { error } = await supabase
            .from('tickets')
            .update({
                status: 'closed',
                rating_score: rating,
                rating_comment: comment,
                updated_at: new Date().toISOString()
            })
            .eq('id', ticketId);

        if (error) throw error;
    },

    /**
     * Validates if a ticket can be closed based on business rules.
     */
    validateStatusTransition(currentStatus: string, nextStatus: string): boolean {
        const allowedTransitions: Record<string, string[]> = {
            'open': ['assigned', 'cancelled', 'in_progress'],
            'assigned': ['in_progress', 'cancelled', 'open'],
            'in_progress': ['resolved', 'cancelled'],
            'resolved': ['closed', 'in_progress'], // Can be reopened to in_progress if rating failed
            'closed': [], // Terminal
            'cancelled': [] // Terminal
        };

        return allowedTransitions[currentStatus]?.includes(nextStatus) || false;
    }
};
