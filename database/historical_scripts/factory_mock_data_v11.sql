-- ==========================================================
-- FSC-MAINT-APP DATA FACTORY (V11.0)
-- الغرض: حقن بيانات تجريبية شاملة لاختبار كافة وظائف النظام
-- ==========================================================

-- 1. تطهير البيانات القديمة (اختياري - لضمان نظافة الاختبار)
TRUNCATE public.tickets, public.maintenance_assets, public.inventory, public.branches, public.maintenance_categories, public.technician_attendance RESTART IDENTITY CASCADE;

-- 2. إعداد الفروع (Branches) - تغطية جغرافية واسعة
INSERT INTO public.branches (id, name, branch_lat, branch_lng, address)
VALUES 
  ('b1111111-1111-1111-1111-111111111111', 'فرع القاهرة - مدينة نصر', 30.0595, 31.3260, 'شارع عباس العقاد - مدينة نصر'),
  ('b2222222-2222-2222-2222-222222222222', 'فرع الإسكندرية - زيزينيا', 31.2422, 29.9678, 'طريق الحرية - زيزينيا'),
  ('b3333333-3333-3333-3333-333333333333', 'فرع المنصورة - المشاية', 31.0441, 31.3533, 'شارع المشاية السفلية - المنصورة');

-- 3. تصنيفات الصيانة (Categories)
INSERT INTO public.maintenance_categories (id, name, description)
VALUES 
  ('c1111111-1111-1111-1111-111111111111', 'تبريد وتجميد', 'صيانة الثلاجات، الفريزرات، وغرف التبريد'),
  ('c2222222-2222-2222-2222-222222222222', 'تجهيزات مطابخ', 'صيانة الماجينات، الأفران، والخلاطات الصناعية'),
  ('c3333333-3333-3333-3333-333333333333', 'كهرباء وإضاءة', 'لوحات التحكم، التوصيلات، وأنظمة الإنارة'),
  ('c4444444-4444-4444-4444-444411111111', 'سباكة وصرف', 'مضخات المياه، الوصلات، وصيانة الأحواض');

-- 4. الأصول والمعدات (Assets) - مرتبطة بالفروع
INSERT INTO public.maintenance_assets (id, branch_id, name, serial_number, status, last_maintenance_at)
VALUES 
  ('a1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'ثلاجة عرض ألبان 3 متر', 'ALBN-SR-001', 'operational', now() - interval '5 days'),
  ('a2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 'ماكينة تعبئة علب', 'PCK-AUTO-404', 'maintenance', now() - interval '1 day'),
  ('a3333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222', 'غرفة تبريد مركزية', 'COLD-RM-002', 'operational', now() - interval '10 days'),
  ('a4444444-4444-4444-4444-444411111111', 'b3333333-3333-3333-3333-333333333333', 'خلاط صناعي 20 لتر', 'MIX-IND-77', 'operational', now() - interval '2 days');

-- 5. المخزون وقطع الغيار (Inventory)
INSERT INTO public.inventory (id, name, part_number, quantity, unit, min_quantity)
VALUES 
  ('i1111111-1111-1111-1111-111111111111', 'موتور تبريد 1.5 حصان', 'MTR-15-EXT', 8, 'قطعة', 2),
  ('i2222222-2222-2222-2222-222222222222', 'فريون R404A (إسطوانة)', 'GAS-404-13', 15, 'إسطوانة', 3),
  ('i3333333-3333-3333-3333-333333333333', 'لوحة تحكم ديجيتال', 'CTRL-PANEL-V2', 5, 'شريحة', 1),
  ('i4444444-4444-4444-4444-444411111111', 'طقم جوانات سيليكون', 'SKO-GASKT', 100, 'قطعة', 20);

-- 6. سجل البلاغات (Tickets) - دورة حياة كاملة
-- بانتظار المدير (Open)
INSERT INTO public.tickets (id, branch_id, asset_id, status, description, priority, created_at)
VALUES (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'open', 'الثلاجة لا تبرد وتصدر صوتاً مرتفعاً جداً عند بدء التشغيل', 'urgent', now() - interval '2 hours');

-- قيد العمل (In Progress)
INSERT INTO public.tickets (id, branch_id, asset_id, status, description, priority, created_at, started_at)
VALUES (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'in_progress', 'تسريب مياه من غرفة التبريد يغطي الأرضية بشكل خطير', 'high', now() - interval '1 day', now() - interval '4 hours');

-- تم الإصلاح (Resolved)
INSERT INTO public.tickets (id, branch_id, asset_id, status, description, priority, created_at, started_at, resolved_at, resolved_image_url)
VALUES (gen_random_uuid(), 'b3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444411111111', 'resolved', 'الخلاط يتوقف فجأة أثناء التشغيل ويسخن بسرعة', 'normal', now() - interval '3 days', now() - interval '2 days', now() - interval '1 day', 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=600');

-- مغلّق (Closed) مع تقييم
INSERT INTO public.tickets (id, branch_id, asset_id, status, description, priority, created_at, started_at, resolved_at, closed_at, rating_score, rating_comment)
VALUES (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111111', NULL, 'closed', 'انقطاع الكهرباء عن الإضاءة الخارجية للفرع بالكامل', 'urgent', now() - interval '7 days', now() - interval '7 days', now() - interval '6 days', now() - interval '5 days', 5, 'تم الإصلاح بسرعة ودقة عالية، الفريق كان محترفاً جداً');

-- 7. سجل الحضور (Attendance) - لاختبار الـ HR Dashboard
INSERT INTO public.technician_attendance (profile_id, clock_in, clock_out, lat, lng)
SELECT 
  id, 
  now() - interval '8 hours', 
  now() - interval '1 hour',
  30.0595,
  31.3260
FROM public.profiles 
WHERE role IN ('technician', 'maint_supervisor')
LIMIT 5;

-- 8. إعدادات النظام المتقدمة
INSERT INTO public.system_settings (key, value)
VALUES 
  ('geofencing_enabled', 'true'),
  ('geofencing_radius', '200'),
  ('maintenance_cutoff_hour', '22')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
