-- ==========================================
-- FSC-MAINT-APP Mock Data Seeding (V10.0)
-- ⚠️ Run this file AFTER running schema.sql and creating the admin user
-- ==========================================

-- 1. إضافة الفروع (Branches)
INSERT INTO public.branches (id, name, branch_lat, branch_lng)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'فرع القاهرة الرئيسي', 30.0444, 31.2357),
  ('22222222-2222-2222-2222-222222222222', 'فرع الإسكندرية الفرعي', 31.2001, 29.9187),
  ('33333333-3333-3333-3333-333333333333', 'فرع المنصورة', 31.0379, 31.3815);

-- 2. إضافة المخزون وقطع الغيار (Inventory)
INSERT INTO public.inventory (id, name, part_number, quantity, unit)
VALUES 
  ('a1111111-a111-a111-a111-a11111111111', 'موتور ثلاجة عرض 1.5 حصان', 'MTR-150-CW', 12, 'قطعة'),
  ('a2222222-a222-a222-a222-a22222222222', 'سير ماكينة تغليف مقاس 45', 'BLT-45X', 50, 'قطعة'),
  ('a3333333-a333-a333-a333-a33333333333', 'فلاتر مياه 3 مراحل', 'FLT-W3', 200, 'علبة'),
  ('a4444444-a444-a444-a444-a44444444444', 'مقياس حرارة رقمي (ترموستات)', 'THR-DIGI', 35, 'قطعة');

-- 3. بناء إعدادات الواجهات السيادية (UI Schemas Engine)
-- ეს جزء مهم جداً، وهو ما يجعل المحرك يبني الشاشات كالسحر
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES
(
  'inventory',
  '{
    "title": "إدارة المخزون وقطع الغيار",
    "searchable": true,
    "searchPlaceholder": "ابحث عن اسم القطعة أو الرقم المرجعي",
    "columns": [
      { "key": "name", "label": "اسم القطعة", "type": "text" },
      { "key": "part_number", "label": "الرقم المرجعي", "type": "badge" },
      { "key": "quantity", "label": "الكمية المتاحة", "type": "number" },
      { "key": "unit", "label": "الوحدة", "type": "text" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة / تعديل قطعة غيار",
    "fields": [
      { "key": "name", "label": "اسم القطعة", "type": "text", "required": true, "placeholder": "مثال: موتور تبريد" },
      { "key": "part_number", "label": "الرقم المرجعي (SKU)", "type": "text" },
      { "key": "quantity", "label": "الكمية الابتدائية", "type": "number", "required": true },
      { "key": "unit", "label": "وحدة القياس", "type": "text", "required": true, "placeholder": "مثال: قطعة، لتر، علبة" }
    ]
  }'::jsonb
),
(
  'branches',
  '{
    "title": "دليل الفروع",
    "searchable": true,
    "columns": [
      { "key": "name", "label": "اسم الفرع", "type": "text" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة / تعديل فرع",
    "fields": [
      { "key": "name", "label": "اسم الفرع", "type": "text", "required": true },
      { "key": "branch_lat", "label": "خط العرض (Latitude)", "type": "number", "required": true },
      { "key": "branch_lng", "label": "خط الطول (Longitude)", "type": "number", "required": true }
    ]
  }'::jsonb
),
(
  'tickets',
  '{
    "title": "سجل تذاكر الصيانة",
    "searchable": true,
    "columns": [
      { "key": "asset_name", "label": "اسم الماكينة", "type": "text" },
      { "key": "status", "label": "الحالة", "type": "status" },
      { "key": "priority", "label": "الأولوية", "type": "badge" },
      { "key": "created_at", "label": "تاريخ البلاغ", "type": "date" }
    ]
  }'::jsonb,
  '{
    "title": "رفع بلاغ صيانة جديد",
    "fields": [
      { "key": "branch_id", "label": "تحديد الفرع", "type": "select", "required": true, "dataSource": "branches", "dataLabel": "name", "dataValue": "id" },
      { "key": "asset_name", "label": "المعدة / الأصل المعطل", "type": "text", "required": true },
      { "key": "description", "label": "وصف العطل بدقة", "type": "textarea", "required": true },
      { "key": "priority", "label": "الأولوية", "type": "text", "placeholder": "normal, high, urgent" }
    ]
  }'::jsonb
);

-- 4. إضافة بعض البلاغات (Tickets) التجريبية
-- لاحظ أننا نفترض أن مدير النظام قام بإنشائها
INSERT INTO public.tickets (branch_id, asset_name, status, description, priority, reported_lat, reported_lng)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'ثلاجة عرض اللحوم', 'open', 'الثلاجة لا تبرد وصوت الموتور غريب ومستمر دون توقف', 'high', 30.0441, 31.2355),
  ('22222222-2222-2222-2222-222222222222', 'ماكينة الفاكيوم للصناعي', 'assigned', 'الماكينة تقطع الكيس ولا تسحب الهواء كاملاً', 'normal', 31.2003, 29.9189),
  ('11111111-1111-1111-1111-111111111111', 'مكيف كونسيلد صالة العرض', 'in_progress', 'تسريب مياه من الجريل الخاص بالمكيف وتوقف التبريد كلياً', 'urgent', 30.0450, 31.2350);
