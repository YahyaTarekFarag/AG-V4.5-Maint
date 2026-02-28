-- V34__advanced_inventory_features.sql
-- ============================================================
-- تطوير نظام المخزون: التكلفة المرجحة، تعدد الفروع، وحدود الطلب
-- ============================================================

DO $$
BEGIN
    -- 1. إضافة أعمدة جديدة لجدول الأصناف
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'min_quantity') THEN
        ALTER TABLE public.inventory ADD COLUMN min_quantity INTEGER DEFAULT 5;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'branch_id') THEN
        ALTER TABLE public.inventory ADD COLUMN branch_id UUID REFERENCES public.branches(id);
    END IF;
END $$;

-- 2. تحديث دالة معالجة المخزون لدعم حساب التكلفة المرجحة (WAC)
CREATE OR REPLACE FUNCTION public.handle_inventory_deduction()
RETURNS TRIGGER AS $$
DECLARE
    v_current_qty INTEGER;
    v_current_cost NUMERIC(10, 2);
    v_item_name TEXT;
    v_new_qty INTEGER;
    v_new_cost NUMERIC(10, 2);
BEGIN
    -- جلب البيانات الحالية للصنف مع قفل الصف
    SELECT COALESCE(quantity, 0), COALESCE(unit_cost, 0), name 
    INTO v_current_qty, v_current_cost, v_item_name 
    FROM public.inventory 
    WHERE id = NEW.inventory_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'خطأ: صنف المخزن غير موجود (ID: %)', NEW.inventory_id;
    END IF;

    -- معالجة الحركة بناءً على النوع
    IF NEW.transaction_type = 'in' THEN
        -- حالة التوريد: زيادة الكمية وحساب التكلفة المرجحة (Weighted Average Cost)
        v_new_qty := v_current_qty + NEW.quantity_used;
        
        IF v_new_qty > 0 THEN
            -- معادلة WAC: (الرصيد القديم * التكلفة القديمة + الكمية الجديدة * التكلفة الجديدة) / الإجمالي
            v_new_cost := ((v_current_qty * v_current_cost) + (NEW.quantity_used * COALESCE(NEW.unit_cost_at_time, 0))) / v_new_qty;
        ELSE
            v_new_cost := COALESCE(NEW.unit_cost_at_time, 0);
        END IF;

        UPDATE public.inventory
        SET quantity = v_new_qty,
            unit_cost = ROUND(v_new_cost, 2),
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
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. تحديث دالة إحصائيات لوحة التحكم لتستخدم حد الطلب الديناميكي
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_v2(p_profile_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_branch_id UUID;
  v_result JSON;
  v_open INT;
  v_assigned INT;
  v_in_progress INT;
  v_resolved INT;
  v_available_techs INT;
  v_faulty_assets INT;
  v_low_stock INT;
  v_preventive_due INT;
  v_is_global BOOLEAN;
BEGIN
  -- جلب بيانات المستخدم
  SELECT role, branch_id INTO v_role, v_branch_id
  FROM public.profiles
  WHERE id = p_profile_id;

  v_is_global := v_role IN ('admin', 'maint_manager', 'maint_supervisor');

  -- حساب التذاكر
  SELECT count(*) INTO v_open FROM public.tickets WHERE status = 'open' AND is_deleted = false AND (v_is_global OR branch_id = v_branch_id);
  SELECT count(*) INTO v_assigned FROM public.tickets WHERE status = 'assigned' AND is_deleted = false AND (v_is_global OR branch_id = v_branch_id);
  SELECT count(*) INTO v_in_progress FROM public.tickets WHERE status = 'in_progress' AND is_deleted = false AND (v_is_global OR branch_id = v_branch_id);
  SELECT count(*) INTO v_resolved FROM public.tickets WHERE status = 'resolved' AND is_deleted = false AND (v_is_global OR branch_id = v_branch_id);

  -- الفنيين
  SELECT count(DISTINCT ta.profile_id) INTO v_available_techs FROM public.technician_attendance ta JOIN public.profiles p ON ta.profile_id = p.id WHERE ta.clock_out IS NULL AND ta.clock_in >= date_trunc('day', now()) AND (v_is_global OR p.branch_id = v_branch_id);

  -- الأصول
  SELECT count(*) INTO v_faulty_assets FROM public.maintenance_assets WHERE status = 'faulty' AND is_deleted = false AND (v_is_global OR branch_id = v_branch_id);

  -- المخزون المنخفض (باستخدام الرصيد الفعلي مقابل min_quantity لكل صنف)
  SELECT count(*) INTO v_low_stock 
  FROM public.inventory 
  WHERE quantity < COALESCE(min_quantity, 0) 
  AND is_deleted = false
  AND (v_is_global OR branch_id = v_branch_id OR branch_id IS NULL);

  -- الصيانة الوقائية
  SELECT count(*) INTO v_preventive_due FROM public.maintenance_assets WHERE is_deleted = false AND (v_is_global OR branch_id = v_branch_id) AND ((last_maintenance_at IS NULL AND created_at < NOW() - (service_interval_days * interval '1 day')) OR (last_maintenance_at IS NOT NULL AND last_maintenance_at < NOW() - (service_interval_days * interval '1 day')));

  v_result := json_build_object(
    'open', v_open,
    'assigned', v_assigned,
    'in_progress', v_in_progress,
    'resolved', v_resolved,
    'available_techs', v_available_techs,
    'faulty_assets', v_faulty_assets,
    'low_stock', v_low_stock,
    'preventive_due', v_preventive_due
  );

  RETURN v_result;
END;
$$;

-- 4. مزامنة واجهة الاستخدام (UI Schema Sync) لجدول المخزون
-- تصحيح أسماء الأعمدة لتبدأ باستخدام name بدلاً من item_name وإضافة الحقول الجديدة
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
    'inventory',
    '{
        "columns": [
            {"key": "name", "label": "اسم الصنف", "type": "text", "sortable": true},
            {"key": "quantity", "label": "الرصيد الكلي", "type": "number"},
            {"key": "min_quantity", "label": "حد الطلب", "type": "number"},
            {"key": "branch_id", "label": "المستودع", "type": "select", "dataSource": "branches"}
        ]
    }'::jsonb,
    '{
        "fields": [
            {"key": "name", "label": "اسم الصنف", "type": "text", "required": true},
            {"key": "unit", "label": "الوحدة", "type": "text", "required": true},
            {"key": "quantity", "label": "الكمية الابتدائية", "type": "number", "required": true},
            {"key": "unit_cost", "label": "تكلفة الوحدة", "type": "number"},
            {"key": "min_quantity", "label": "الحد الأدنى (تنبيه)", "type": "number"},
            {"key": "part_number", "label": "رقم القطعة / الكود", "type": "text"},
            {"key": "branch_id", "label": "المستودع التابع", "type": "select", "dataSource": "branches"}
        ]
    }'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET
    list_config = EXCLUDED.list_config,
    form_config = EXCLUDED.form_config;
