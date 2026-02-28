-- ============================================================
-- ترقية جدول الحركات المخزنية
-- يجب تنفيذ هذا الكود في Supabase SQL Editor
-- ============================================================

-- 1. إضافة عمود نوع الحركة (صرف/توريد)
ALTER TABLE public.inventory_transactions 
    ADD COLUMN IF NOT EXISTS transaction_type text DEFAULT 'out';

-- 2. إضافة عمود معرف الفرع (الفرع المستلم أو المرجع)
ALTER TABLE public.inventory_transactions 
    ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

-- 3. إضافة عمود اسم المورد (للتوريدات الخارجية)
ALTER TABLE public.inventory_transactions 
    ADD COLUMN IF NOT EXISTS supplier_name text;

-- 4. إضافة عمود الملاحظات
ALTER TABLE public.inventory_transactions 
    ADD COLUMN IF NOT EXISTS notes text;

-- 5. جعل عمود الفني اختياري (لأن التوريد قد لا يتطلب فني)
ALTER TABLE public.inventory_transactions 
    ALTER COLUMN technician_id DROP NOT NULL;
