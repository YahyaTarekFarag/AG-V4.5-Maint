-- ==========================================
-- المرحلة 9: أتمتة المخازن (Inventory Automation)
-- تفعيل الخصم التلقائي عند تسجيل استهلاك قطع الغيار
-- ==========================================

-- 1. وظيفة معالجة خصم المخزون المحسنة (Atomic Update)
CREATE OR REPLACE FUNCTION public.handle_inventory_deduction()
RETURNS TRIGGER AS $$
BEGIN
    -- تحديث الكمية مع قفل الصف لضمان عدم حدوث تضارب (Race Condition)
    UPDATE public.inventory
    SET quantity = quantity - NEW.quantity_used,
        updated_at = NOW()
    WHERE id = NEW.inventory_id
    AND quantity >= NEW.quantity_used;

    -- إذا لم يتم تحديث أي صف، فهذا يعني أن الرصيد غير كافٍ أو الصنف غير موجود
    IF NOT FOUND THEN
        RAISE EXCEPTION 'عجز في المخزون: الرصيد المتاح لا يكفي لإتمام عملية الخصم المطلوبة.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. إعداد التريجر على جدول المعاملات المخزنية
DROP TRIGGER IF EXISTS on_inventory_transaction_deduct ON public.inventory_transactions;
CREATE TRIGGER on_inventory_transaction_deduct
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_deduction();

-- 3. إضافة حقل "التكلفة التقديرية" لقطع الغيار (لتحليل النفقات مستقبلاً)
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS unit_cost DECIMAL DEFAULT 0;

-- 4. تحديث الـ View الخاص بأداء الفنيين ليشمل تكلفة قطع الغيار المستهلكة
CREATE OR REPLACE VIEW public.v_technician_performance AS
SELECT 
    p.full_name as technician_name,
    p.employee_code,
    COUNT(t.id) as tickets_solved,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.started_at))/3600)::numeric(10,2) as avg_repair_hours,
    AVG(t.rating_score)::numeric(10,1) as avg_rating,
    SUM(it.quantity_used * i.unit_cost)::numeric(10,2) as total_parts_cost
FROM public.profiles p
JOIN public.tickets t ON p.id = t.assigned_to
LEFT JOIN public.inventory_transactions it ON t.id = it.ticket_id
LEFT JOIN public.inventory i ON it.inventory_id = i.id
WHERE t.status IN ('resolved', 'closed') AND t.started_at IS NOT NULL AND t.resolved_at IS NOT NULL
GROUP BY p.id, p.full_name, p.employee_code;
