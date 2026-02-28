-- V28__inventory_historical_cost.sql
-- ==========================================
-- حفظ التكلفة التاريخية لقطع الغيار عند الصرف
-- ==========================================

-- 1. إضافة عمود تكلفة الوحدة لحظة الصرف لجدول الحركات
ALTER TABLE public.inventory_transactions 
ADD COLUMN IF NOT EXISTS unit_cost_at_time NUMERIC(10, 2) DEFAULT 0;

-- 2. تحديث الـ RPC ليدعم تسجيل التكلفة التاريخية
CREATE OR REPLACE FUNCTION public.resolve_ticket_complete(
    p_ticket_id UUID,
    p_technician_id UUID,
    p_parts_used JSONB, -- Array of {part_id, qty}
    p_labor_cost NUMERIC,
    p_resolved_image_url TEXT,
    p_resolved_lat DOUBLE PRECISION,
    p_resolved_lng DOUBLE PRECISION,
    p_fault_type_id UUID,
    p_asset_id UUID,
    p_downtime_start TIMESTAMP WITH TIME ZONE,
    p_submission_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_item RECORD;
    v_part_price NUMERIC;
    v_total_parts_cost NUMERIC := 0;
BEGIN
    -- 0. التحقق من التكرار (Idempotency Check)
    IF p_submission_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tickets WHERE submission_id = p_submission_id) THEN
        RETURN;
    END IF;

    -- 1. معالجة المخزون (Atomic & Deadlock-Free)
    FOR v_item IN 
        SELECT (x->>'part_id')::UUID as part_id, (x->>'qty')::INT as qty
        FROM jsonb_array_elements(p_parts_used) AS x
        ORDER BY (x->>'part_id')::UUID
    LOOP
        -- قفل السجل لمنع التعارض وحساب السعر الحالي
        SELECT unit_cost INTO v_part_price FROM public.inventory WHERE id = v_item.part_id FOR UPDATE;
        
        v_total_parts_cost := v_total_parts_cost + (COALESCE(v_part_price, 0) * v_item.qty);

        -- تسجيل حركة المخزون مع حفظ السعر التاريخي
        INSERT INTO public.inventory_transactions (
            inventory_id,
            ticket_id,
            technician_id,
            quantity_used,
            unit_cost_at_time,
            transaction_type,
            notes,
            created_at
        ) VALUES (
            v_item.part_id,
            p_ticket_id,
            p_technician_id,
            v_item.qty,
            COALESCE(v_part_price, 0),
            'out',
            'صرف تلقائي عند إغلاق البلاغ رقم: ' || p_ticket_id,
            NOW()
        );
    END LOOP;

    -- 2. تحديث بيانات البلاغ والحسابات المالية
    UPDATE public.tickets
    SET 
        status = 'resolved',
        resolved_at = NOW(),
        resolved_lat = p_resolved_lat,
        resolved_lng = p_resolved_lng,
        resolved_image_url = p_resolved_image_url,
        fault_type_id = p_fault_type_id,
        asset_id = p_asset_id,
        downtime_start = p_downtime_start,
        parts_cost = v_total_parts_cost,
        labor_cost = p_labor_cost,
        total_cost = v_total_parts_cost + p_labor_cost,
        parts_used = p_parts_used,
        submission_id = p_submission_id,
        updated_at = NOW()
    WHERE id = p_ticket_id;

    -- 3. تحديث حالة المعدة لتصبح صالحة للتشغيل
    IF p_asset_id IS NOT NULL THEN
        UPDATE public.maintenance_assets
        SET status = 'operational', updated_at = NOW()
        WHERE id = p_asset_id;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
