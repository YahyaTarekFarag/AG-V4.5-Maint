-- V37__inventory_commitment_and_vendors.sql
-- ============================================================
-- تعميق نظام المخزون: الموردين، الأرصدة المحجوزة، والأتمتة الشرائية
-- ============================================================

-- 1. جدول الموردين (Suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    address text,
    tax_id text, -- الرقم الضريبي
    category text, -- نوع التوريد (كهرباء، سباكة، الخ)
    notes text,
    is_deleted boolean DEFAULT false,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- 2. إضافة حقل الرصيد المحجوز للأصناف
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory' AND column_name = 'reserved_quantity') THEN
        ALTER TABLE public.inventory ADD COLUMN reserved_quantity integer DEFAULT 0 CHECK (reserved_quantity >= 0);
    END IF;
END $$;

-- 3. جدول تخطيط القطع للبلاغات (Ticket Parts Planning / Reservations)
-- هذا الجدول يحجز القطع للبلاغ قبل البدء الفعلي في استهلاكها
CREATE TABLE IF NOT EXISTS public.ticket_parts_planned (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid REFERENCES public.tickets(id) NOT NULL,
    inventory_id uuid REFERENCES public.inventory(id) NOT NULL,
    quantity_planned integer NOT NULL CHECK (quantity_planned > 0),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'cancelled')),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

-- 4. أوامر الشراء (Purchase Orders)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id uuid REFERENCES public.suppliers(id),
    branch_id uuid REFERENCES public.branches(id),
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
    total_amount numeric(12, 2) DEFAULT 0,
    notes text,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    inventory_id uuid REFERENCES public.inventory(id),
    quantity_ordered integer NOT NULL CHECK (quantity_ordered > 0),
    estimated_unit_cost numeric(12, 2) DEFAULT 0,
    created_at timestamptz DEFAULT NOW()
);

-- 5. مشغل (Trigger) لتحديث الرصيد المحجوز آلياً
CREATE OR REPLACE FUNCTION public.sync_inventory_reservation()
RETURNS TRIGGER AS $$
BEGIN
    -- في حالة إضافة حجز جديد
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'pending' THEN
            UPDATE public.inventory 
            SET reserved_quantity = reserved_quantity + NEW.quantity_planned 
            WHERE id = NEW.inventory_id;
        END IF;
    
    -- في حالة تعديل الحجز (تغيير الكمية أو الحالة)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- إذا تغيرت الحالة من معلق إلى ملغى أو تم الاستهلاك
        IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
            UPDATE public.inventory 
            SET reserved_quantity = reserved_quantity - OLD.quantity_planned 
            WHERE id = NEW.inventory_id;
        -- إذا كانت لا تزال معلقة ولكن الكمية تغيرت
        ELSIF OLD.status = 'pending' AND NEW.status = 'pending' AND OLD.quantity_planned != NEW.quantity_planned THEN
            UPDATE public.inventory 
            SET reserved_quantity = reserved_quantity - OLD.quantity_planned + NEW.quantity_planned 
            WHERE id = NEW.inventory_id;
        -- إذا تغيرت من حالة أخرى إلى معلقة (إعادة تفعيل الحجز)
        ELSIF OLD.status != 'pending' AND NEW.status = 'pending' THEN
            UPDATE public.inventory 
            SET reserved_quantity = reserved_quantity + NEW.quantity_planned 
            WHERE id = NEW.inventory_id;
        END IF;

    -- في حالة حذف الحجز المباشر
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.status = 'pending' THEN
            UPDATE public.inventory 
            SET reserved_quantity = reserved_quantity - OLD.quantity_planned 
            WHERE id = OLD.inventory_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ui_reservation_change
    AFTER INSERT OR UPDATE OR DELETE ON public.ticket_parts_planned
    FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_reservation();

-- 6. أتمتة إنشاء طلب شراء آلي عند العجز (Auto-Reorder Engine)
CREATE OR REPLACE FUNCTION public.check_inventory_reorder()
RETURNS TRIGGER AS $$
DECLARE
    v_available INTEGER;
    v_po_exists BOOLEAN;
BEGIN
    -- حساب الكمية المتاحة (الرصيد الكلي - المحجوز)
    v_available := NEW.quantity - NEW.reserved_quantity;

    -- إذا هبط المتاح عن الحد الأدنى
    IF v_available < NEW.min_quantity THEN
        -- تحقق من عدم وجود طلب شراء "مسودة" أو "مرسل" لنفس الصنف في نفس الفرع
        SELECT EXISTS (
            SELECT 1 FROM public.purchase_order_items poi
            JOIN public.purchase_orders po ON poi.po_id = po.id
            WHERE poi.inventory_id = NEW.id 
            AND po.branch_id = NEW.branch_id
            AND po.status IN ('draft', 'sent')
        ) INTO v_po_exists;

        IF NOT v_po_exists THEN
            -- إنشاء مسودة طلب شراء آلياً (Auto-Draft PO)
            -- نستخدم مورد افتراضي أو نتركه خالياً للإدارة
            DECLARE
                v_po_id UUID;
            BEGIN
                INSERT INTO public.purchase_orders (branch_id, status, notes)
                VALUES (NEW.branch_id, 'draft', 'طلب شراء آلي ناتج عن هبوط الرصيد المتاح عن الحد الأدنى لبند: ' || NEW.name)
                RETURNING id INTO v_po_id;

                INSERT INTO public.purchase_order_items (po_id, inventory_id, quantity_ordered, estimated_unit_cost)
                VALUES (v_po_id, NEW.id, GREATEST(NEW.min_quantity * 2, 10), NEW.unit_cost);
            END;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_inventory_reorder_check
    AFTER UPDATE OF quantity, reserved_quantity ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION public.check_inventory_reorder();

-- 7. عرض تقييم المخزون المالي (Inventory Valuation View)
CREATE OR REPLACE VIEW public.v_inventory_valuation AS
SELECT 
    b.name AS branch_name,
    i.category_id,
    COUNT(i.id) AS unique_items,
    SUM(i.quantity) AS total_physical_units,
    SUM(i.reserved_quantity) AS total_reserved_units,
    SUM(i.quantity - i.reserved_quantity) AS total_available_units,
    SUM(i.quantity * i.unit_cost) AS total_value_wac
FROM public.inventory i
JOIN public.branches b ON i.branch_id = b.id
WHERE i.is_deleted = false
GROUP BY b.name, i.category_id;

-- RLS & UI Configuration Mappings
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_parts_planned ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Allow all for authenticated" ON public.suppliers FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all for authenticated" ON public.ticket_parts_planned FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all for authenticated" ON public.purchase_orders FOR ALL TO authenticated USING (true);
  CREATE POLICY "Allow all for authenticated" ON public.purchase_order_items FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- إلحاق إعدادات الواجهة (UI Schemas)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
    'suppliers',
    '{"columns": [{"key": "name", "label": "المورد", "type": "text"}, {"key": "contact_person", "label": "مسؤول الاتصال", "type": "text"}, {"key": "phone", "label": "الهاتف", "type": "text"}, {"key": "category", "label": "التصنيف", "type": "text"}]}'::jsonb,
    '{"fields": [{"key": "name", "label": "اسم الشركة / المورد", "type": "text", "required": true}, {"key": "contact_person", "label": "اسم المسؤول", "type": "text"}, {"key": "phone", "label": "رقم التواصل", "type": "text"}, {"key": "email", "label": "البريد الإلكتروني", "type": "email"}, {"key": "category", "label": "نوع التوريدات", "type": "text"}, {"key": "tax_id", "label": "الرقم الضريبي", "type": "text"}, {"key": "address", "label": "العنوان الرئيسي", "type": "textarea"}]}'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET list_config = EXCLUDED.list_config, form_config = EXCLUDED.form_config;

INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
    'purchase_orders',
    '{"columns": [{"key": "id", "label": "رقم الطلب", "type": "text"}, {"key": "supplier_id", "label": "المورد", "type": "select", "dataSource": "suppliers"}, {"key": "status", "label": "الحالة", "type": "status"}, {"key": "total_amount", "label": "القيمة الإجمالية", "type": "number"}]}'::jsonb,
    '{"fields": [{"key": "supplier_id", "label": "المورد", "type": "select", "dataSource": "suppliers", "required": true}, {"key": "branch_id", "label": "المستودع المستلم", "type": "select", "dataSource": "branches", "required": true}, {"key": "status", "label": "حالة الطلب", "type": "status", "defaultValue": "draft"}, {"key": "total_amount", "label": "إجمالي الفاتورة", "type": "number"}, {"key": "notes", "label": "ملاحظات الشراء", "type": "textarea"}]}'::jsonb
) ON CONFLICT (table_name) DO UPDATE SET list_config = EXCLUDED.list_config, form_config = EXCLUDED.form_config;
