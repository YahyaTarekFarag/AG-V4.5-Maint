-- V33__fix_inventory_trigger_logic.sql
-- ============================================================
-- إصلاح منطق تحديث المخزون لتمييز نوع الحركة (صرف/توريد)
-- ومنع الأرصدة السالبة مع رسائل خطأ تفصيلية
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_inventory_deduction()
RETURNS TRIGGER AS $$
DECLARE
    v_current_qty INTEGER;
    v_item_name TEXT;
BEGIN
    -- 1. جلب البيانات الحالية للصنف مع قفل الصف لمنع التضارب
    SELECT COALESCE(quantity, 0), name INTO v_current_qty, v_item_name 
    FROM public.inventory 
    WHERE id = NEW.inventory_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'خطأ: صنف المخزن غير موجود (ID: %)', NEW.inventory_id;
    END IF;

    -- 2. معالجة الحركة بناءً على النوع
    IF NEW.transaction_type = 'in' THEN
        -- حالة التوريد: زيادة الكمية
        UPDATE public.inventory
        SET quantity = COALESCE(quantity, 0) + NEW.quantity_used,
            updated_at = NOW()
        WHERE id = NEW.inventory_id;
        
    ELSIF NEW.transaction_type = 'out' THEN
        -- حالة الصرف: خصم الكمية مع التحقق من الرصيد
        IF v_current_qty < NEW.quantity_used THEN
            RAISE EXCEPTION 'عجز في المخزون للصنف (%): الرصيد المتاح (%) لا يكفي لخصم الكمية المطلوبة (%).', 
                v_item_name, v_current_qty, NEW.quantity_used;
        END IF;

        UPDATE public.inventory
        SET quantity = v_current_qty - NEW.quantity_used,
            updated_at = NOW()
        WHERE id = NEW.inventory_id;
    ELSE
        -- نوع حركة غير معروف
        RAISE EXCEPTION 'خطأ: نوع الحركة المخزنية غير معروف (%). يجب أن يكون "in" أو "out".', NEW.transaction_type;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إعادة إنشاء التريجر للتأكد من ربطه بالدالة المحدثة
DROP TRIGGER IF EXISTS on_inventory_transaction_deduct ON public.inventory_transactions;
CREATE TRIGGER on_inventory_transaction_deduct
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_deduction();
