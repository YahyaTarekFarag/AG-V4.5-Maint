-- seed.sql
-- بيانات الخادم الأساسية والأولية للتشغيل (Seed Data)
-- يُرجى تنفيذ هذا الملف بعد تطبيق جميع ملفات (Migrations V01 - V25)
-- لتأسيس الهيكل الإداري الأولي للنظام.

-- 1. إدراج تصنيفات الصيانة الافتراضية إذا لم تكن موجودة
INSERT INTO maintenance_categories (name)
VALUES 
    ('سباكة'),
    ('كهرباء'),
    ('تكييف'),
    ('أجهزة منزلية'),
    ('نجارة'),
    ('ديكور وطلاء'),
    ('أخرى')
ON CONFLICT (name) DO NOTHING;

-- 2. إدراج المناطق والفروع (أمثلة للتهيئة)
-- هذا الجزء مخصص للاختبار المحلي فقط (يمكن تجاوزه في بيئة الإنتاج)
DO $$
DECLARE
   v_brand_id uuid;
   v_sector_id uuid;
   v_area_id uuid;
   v_branch_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM brands WHERE name = 'الشركة الرئيسية') THEN
        INSERT INTO brands (name) VALUES ('الشركة الرئيسية') RETURNING id INTO v_brand_id;
        INSERT INTO sectors (name, brand_id) VALUES ('القطاع العام', v_brand_id) RETURNING id INTO v_sector_id;
        INSERT INTO areas (name, sector_id) VALUES ('المنطقة الشمالية', v_sector_id) RETURNING id INTO v_area_id;
        INSERT INTO branches (name, area_id) VALUES ('الفرع الرئيسي - الرياض', v_area_id);
    END IF;
END $$;

-- 3. الأدوار وصلاحيات النظام
-- الأدوار تُعرّف في جدول profiles من نوع enum('admin', 'maint_manager', 'maint_supervisor', 'technician', 'branch_manager')
-- ولذلك لا يوجد جدول أدوار، ولكن يجب ضمان وجود حساب مدير عام (Admin) للبدء
-- (يتم إنشاء الحسابات عادة عبر Supabase Auth وليس هنا، ولكن هذا تلميح للمبرمج).

-- ملاحظة: يمكن إضافة بيانات قطع الغيار الافتراضية هنا إذا لزم الأمر
