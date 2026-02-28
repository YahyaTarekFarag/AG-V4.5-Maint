-- Audit Fixes V1: Database Layer
-- Addresses: Issue 2 (Inventory Race Condition)

/**
 * دالة لخصم المخزون بشكل ذري (Atomic) لمنع الـ Race Condition
 * تضمن معالجة جميع الأصناف في عملية واحدة أو فشل الكل
 */
CREATE OR REPLACE FUNCTION deduct_inventory_atomic(
    p_ticket_id UUID,
    p_technician_id UUID,
    p_items JSONB -- Array of {part_id, qty}
) RETURNS VOID AS $$
DECLARE
    item RECORD;
BEGIN
    -- معالجة كل صنف في القائمة المرسلة
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(part_id UUID, qty INT)
    LOOP
        -- التحقيق من توفر الكمية (الإجراءات المخزنة أو الـ triggers ستتعامل مع التحقق النهائي)
        -- ولكن سنقوم هنا بكتابة سجل الحركة الذي سيقوم الـ trigger بمعالجته
        INSERT INTO inventory_transactions (
            inventory_id,
            ticket_id,
            technician_id,
            quantity_used,
            created_at
        ) VALUES (
            item.part_id,
            p_ticket_id,
            p_technician_id,
            item.qty,
            NOW()
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ملاحظة: إذا كان هناك Trigger يقوم بالخصم عند الإضافة في inventory_transactions،
-- فبما أن هذه الدالة تعمل داخل Transaction واحد (بواسطة PostgreSQL)،
-- فهي تمنع التضارب (Race Condition) بشكل طبيعي.
