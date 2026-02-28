-- V35__inventory_transfers_and_audit.sql
-- ============================================================
-- تطوير نظام المخزون: التحويلات بين الفروع، الجرد الدوري، والباركود
-- ============================================================

-- 1. جدول التحويلات بين الفروع (Inter-branch Transfers)
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    inventory_id uuid REFERENCES public.inventory(id) NOT NULL,
    from_branch_id uuid REFERENCES public.branches(id) NOT NULL,
    to_branch_id uuid REFERENCES public.branches(id) NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'completed', 'cancelled')),
    notes text,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- 2. جدول الجرد الدوري ومطابقة المخزون (Inventory Audits / Stocktake)
CREATE TABLE IF NOT EXISTS public.inventory_audits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id uuid REFERENCES public.branches(id) NOT NULL,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
    notes text,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_audit_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_id uuid REFERENCES public.inventory_audits(id) NOT NULL,
    inventory_id uuid REFERENCES public.inventory(id) NOT NULL,
    system_quantity integer NOT NULL,
    physical_quantity integer NOT NULL,
    difference integer GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
    created_at timestamptz DEFAULT NOW()
);

-- 3. إضافة حقل الباركود لجدول الأصناف
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'barcode') THEN
        ALTER TABLE public.inventory ADD COLUMN barcode text UNIQUE;
    END IF;
END $$;

-- 4. مشغل (Trigger) لمعالجة التحويلات عند اكتمالها
CREATE OR REPLACE FUNCTION public.handle_inventory_transfer()
RETURNS TRIGGER AS $$
DECLARE
    v_from_qty INTEGER;
    v_to_item_id UUID;
    v_item_name TEXT;
BEGIN
    -- معالجة فقط عند تغيير الحالة إلى 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- 1. التأكد من توفر الكمية في المصدر
        SELECT quantity, name INTO v_from_qty, v_item_name 
        FROM public.inventory 
        WHERE id = NEW.inventory_id FOR UPDATE;

        IF v_from_qty < NEW.quantity THEN
            RAISE EXCEPTION 'فشل التحويل: الرصيد الحالي للقطعة (%) في فرع المصدر هو (%) ولا يكفي لتحويل (%).', 
                v_item_name, v_from_qty, NEW.quantity;
        END IF;

        -- 2. خصم من المصدر
        UPDATE public.inventory 
        SET quantity = quantity - NEW.quantity, updated_at = NOW()
        WHERE id = NEW.inventory_id;

        -- 3. البحث عن نفس الصنف في فرع الوجهة (أو إنشاءه إذا لم يوجد)
        -- ملاحظة: نفترض أن الأصناف يتم ربطها بـ "كود الصنف" أو "الاسم" لنقلها بين الفروع
        -- في هذا النظام، سنبحث عن صنف بنفس الاسم والباركود في الفرع الجديد
        SELECT id INTO v_to_item_id 
        FROM public.inventory 
        WHERE (name, barcode) = (SELECT name, barcode FROM public.inventory WHERE id = NEW.inventory_id)
        AND branch_id = NEW.to_branch_id
        LIMIT 1;

        IF v_to_item_id IS NOT NULL THEN
            UPDATE public.inventory SET quantity = quantity + NEW.quantity, updated_at = NOW() WHERE id = v_to_item_id;
        ELSE
            -- إنشاء الصنف في الفرع الجديد إذا لم يكن موجوداً
            INSERT INTO public.inventory (name, unit, quantity, unit_cost, branch_id, barcode, category_id)
            SELECT name, unit, NEW.quantity, unit_cost, NEW.to_branch_id, barcode, category_id
            FROM public.inventory WHERE id = NEW.inventory_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_transfer_completed
    AFTER UPDATE ON public.inventory_transfers
    FOR EACH ROW EXECUTE FUNCTION public.handle_inventory_transfer();

-- تفعيل RLS
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audit_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Allow all for authenticated" ON public.inventory_transfers FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all for authenticated" ON public.inventory_audits FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all for authenticated" ON public.inventory_audit_items FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. مزامنة واجهة الاستخدام (UI Schema Sync) للجداول الجديدة
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
    'inventory_transfers',
    '{
        "columns": [
            {"key": "inventory_id", "label": "الصنف", "type": "select", "dataSource": "inventory"},
            {"key": "from_branch_id", "label": "من فرع", "type": "select", "dataSource": "branches"},
            {"key": "to_branch_id", "label": "إلى فرع", "type": "select", "dataSource": "branches"},
            {"key": "quantity", "label": "الكمية", "type": "number"},
            {"key": "status", "label": "الحالة", "type": "status"}
        ]
    }'::jsonb,
    '{
        "fields": [
            {"key": "inventory_id", "label": "الصنف المُراد تحويله", "type": "select", "dataSource": "inventory", "required": true},
            {"key": "from_branch_id", "label": "المستودع المصدر", "type": "select", "dataSource": "branches", "required": true},
            {"key": "to_branch_id", "label": "المستودع الوجهة", "type": "select", "dataSource": "branches", "required": true},
            {"key": "quantity", "label": "الكمية المحولة", "type": "number", "required": true},
            {"key": "status", "label": "حالة التحويل", "type": "status", "defaultValue": "pending"},
            {"key": "notes", "label": "ملاحظات التحويل", "type": "textarea"}
        ]
    }'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET
    list_config = EXCLUDED.list_config,
    form_config = EXCLUDED.form_config;

INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
    'inventory_audits',
    '{
        "columns": [
            {"key": "branch_id", "label": "المستودع", "type": "select", "dataSource": "branches"},
            {"key": "status", "label": "حالة الجرد", "type": "status"},
            {"key": "created_at", "label": "تاريخ البدء", "type": "date"},
            {"key": "created_by", "label": "بواسطة", "type": "select", "dataSource": "profiles"}
        ]
    }'::jsonb,
    '{
        "fields": [
            {"key": "branch_id", "label": "المستودع المُراد جرده", "type": "select", "dataSource": "branches", "required": true},
            {"key": "status", "label": "الحالة", "type": "status", "defaultValue": "draft"},
            {"key": "notes", "label": "ملاحظات الجرد", "type": "textarea"}
        ]
    }'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET
    list_config = EXCLUDED.list_config,
    form_config = EXCLUDED.form_config;
