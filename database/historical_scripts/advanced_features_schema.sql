-- ==========================================
-- المرحلة 6: التوسعة المعمارية (Advanced Features)
-- ==========================================

-- 1. تحديث جدول الموظفين لربط المدير بالفرع
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);

-- 2. تحديث جدول البلاغات لدورة الحياة المتقدمة
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS reported_at timestamptz DEFAULT NOW();
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS reported_image_url text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolved_image_url text;

-- 3. إنشاء جدول إعدادات النظام
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT NOW()
);

-- الإعداد الافتراضي: تقييد المديرين بفروعهم (true)
INSERT INTO public.system_settings (key, value) 
VALUES ('restrict_branch_submission', 'true')
ON CONFLICT (key) DO NOTHING;

-- منح الصلاحيات
GRANT SELECT, INSERT, UPDATE ON public.system_settings TO authenticated;
