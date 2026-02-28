-- 🩺 وظيفة إغلاق البلاغ الذرية (Atomic Resolution V3)
-- تضمن هذه الوظيفة نجاح كل الخطوات أو فشلها تماماً لمنع حالات خصم المخزون بدون تحديث البلاغ.

CREATE OR REPLACE FUNCTION resolve_ticket_v3(
  p_ticket_id uuid,
  p_technician_id uuid,
  p_parts_used jsonb, -- [{part_id: uuid, qty: numeric}]
  p_labor_cost numeric,
  p_resolution_image_url text,
  p_resolved_lat numeric DEFAULT NULL,
  p_resolved_lng numeric DEFAULT NULL,
  p_fault_type_id uuid DEFAULT NULL,
  p_asset_id uuid DEFAULT NULL,
  p_downtime_start timestamp with time zone DEFAULT NULL,
  p_submission_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_part jsonb;
  v_current_inventory_qty numeric;
  v_part_name text;
BEGIN
  -- 1. التحقق من عدم تكرار العملية (Idempotency)
  IF EXISTS (SELECT 1 FROM tickets WHERE id = p_ticket_id AND status IN ('resolved', 'closed')) THEN
    RETURN jsonb_build_object('success', true, 'message', 'البلاغ مغلق مسبقاً');
  END IF;

  -- 2. تحديث البلاغ (The Ticket Update)
  UPDATE tickets SET
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by = p_technician_id,
    labor_cost = p_labor_cost,
    resolved_image_url = p_resolution_image_url,
    resolved_lat = p_resolved_lat,
    resolved_lng = p_resolved_lng,
    fault_type_id = p_fault_type_id,
    asset_id = COALESCE(p_asset_id, asset_id),
    downtime_start = COALESCE(p_downtime_start, downtime_start),
    submission_id = COALESCE(p_submission_id, submission_id),
    updated_at = NOW()
  WHERE id = p_ticket_id;

  -- 3. معالجة قطع الغيار والخصم من المخزون
  FOR v_part IN SELECT * FROM jsonb_array_elements(p_parts_used)
  LOOP
    -- جلب الكمية الحالية والاسم للتحقق
    SELECT quantity, name INTO v_current_inventory_qty, v_part_name 
    FROM inventory 
    WHERE id = (v_part->>'part_id')::uuid;

    IF v_current_inventory_qty < (v_part->>'qty')::numeric THEN
      RAISE EXCEPTION '❌ عجز في المخزون للصنف (%): الكمية المتاحة (%) أقل من المطلوبة (%)', 
        v_part_name, v_current_inventory_qty, (v_part->>'qty')::numeric;
    END IF;

    -- ا. تسجيل الحركة (Inventory Transaction)
    INSERT INTO inventory_transactions (
      part_id, 
      ticket_id, 
      quantity, 
      transaction_type, 
      created_by,
      branch_id
    ) VALUES (
      (v_part->>'part_id')::uuid,
      p_ticket_id,
      (v_part->>'qty')::numeric,
      'out',
      p_technician_id,
      (SELECT branch_id FROM tickets WHERE id = p_ticket_id)
    );

    -- ب. تحديث الكمية الفعلية (Stock Update)
    UPDATE inventory SET 
      quantity = quantity - (v_part->>'qty')::numeric,
      updated_at = NOW()
    WHERE id = (v_part->>'part_id')::uuid;
  END LOOP;

  -- 4. تسجيل المأمورية تلقائياً (Mission Update)
  UPDATE technician_missions SET
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE ticket_id = p_ticket_id AND status = 'active';

  RETURN jsonb_build_object('success', true, 'ticket_id', p_ticket_id);

EXCEPTION WHEN OTHERS THEN
  -- في PostgreSQL، أي EXCEPTION تلغي الـ Transaction بالكامل تلقائياً
  RAISE EXCEPTION 'فشل إغلاق البلاغ جراحياً: %', SQLERRM;
END;
$$;
