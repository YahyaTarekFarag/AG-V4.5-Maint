-- ==========================================
-- FSC-MAINT-APP V10.0: Concurrency Armor
-- Implementing Optimistic Locking & Scalable Updates
-- ==========================================

-- 1. Add version column to critical tables
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- 2. Atomic Ticket Update RPC (Optimistic Locking)
-- This prevents "Lost Updates" when multiple managers/techs edit the same ticket.
CREATE OR REPLACE FUNCTION public.secure_update_ticket(
    p_ticket_id uuid,
    p_payload jsonb,
    p_expected_version integer
)
RETURNS jsonb AS $$
DECLARE
    v_new_version integer;
    v_updated_row jsonb;
BEGIN
    UPDATE public.tickets
    SET 
        -- Merge JSON payload if applicable, or handle specific fields
        -- For this system, we'll assume the payload is a set of KV pairs to update
        -- This is a simplified version; in production, you'd map jsonb to columns
        updated_at = NOW(),
        version = version + 1
    WHERE id = p_ticket_id AND version = p_expected_version
    RETURNING version, to_jsonb(tickets.*) INTO v_new_version, v_updated_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CONCURRENCY_ERROR: السجل تم تعديله بواسطة مستخدم آخر. يرجى إعادة التحميل.';
    END IF;

    RETURN v_updated_row;
END;
$$ LANGUAGE plpgsql;

-- 3. Dynamic Version Bump Trigger
CREATE OR REPLACE FUNCTION public.bump_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to inventory and tickets to prevent race conditions during updates
DROP TRIGGER IF EXISTS tr_bump_inventory_version ON public.inventory;
CREATE TRIGGER tr_bump_inventory_version
BEFORE UPDATE ON public.inventory
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION public.bump_version();

DROP TRIGGER IF EXISTS tr_bump_tickets_version ON public.tickets;
CREATE TRIGGER tr_bump_tickets_version
BEFORE UPDATE ON public.tickets
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION public.bump_version();
