-- ==========================================
-- B.LABAN ENTERPRISE — Global Label Standardization V13.1 (FIXED)
-- ==========================================

-- 1. حوكمة مسميات سجل البلاغات والأعطال (Tickets)
UPDATE public.ui_schemas
SET 
  form_config = jsonb_set(form_config, '{title}', '"إنشاء مأمورية صيانة جديدة"') || jsonb_build_object('description', 'حوكمة متكاملة لمنظومة البلاغات، الكوادر الفنية، ومعايير الجودة التشغيلية'),
  list_config = jsonb_set(list_config, '{columns}', 
    '[
      {"key": "status", "label": "الحالة التشغيلية", "type": "status"},
      {"key": "asset_name", "label": "توصيف الأصل/المعدة", "type": "text"},
      {"key": "branches.name", "label": "موقع الصيانة (الفرع)", "type": "text"},
      {"key": "reporter_name", "label": "المسؤول عن التبليغ", "type": "text"},
      {"key": "created_at", "label": "توقيت تسجيل البلاغ", "type": "date"}
    ]'::jsonb
  )
WHERE table_name = 'tickets';

-- 2. توحيد مسميات إدارة الأصول والمعدات (Maintenance Assets)
UPDATE public.ui_schemas
SET 
  form_config = jsonb_set(form_config, '{title}', '"إضافة أصل فني للمنظومة"') || jsonb_build_object('description', 'قاعدة بيانات مركزية للأصول، المعدات، والعهد التقنية الموزعة جغرافياً'),
  list_config = jsonb_set(list_config, '{columns}', 
    '[
      {"key": "name", "label": "توصيف المعدة", "type": "text"},
      {"key": "maintenance_categories.name", "label": "التخصص التقني", "type": "text"},
      {"key": "branches.name", "label": "الموقع الجغرافي التابع", "type": "text"},
      {"key": "status", "label": "مؤشر الاعتمادية (MTBF)", "type": "status"}
    ]'::jsonb
  )
WHERE table_name = 'maintenance_assets';

-- 3. ترقية مسميات الموارد البشرية والكوادر (Profiles)
UPDATE public.ui_schemas
SET 
  form_config = jsonb_set(form_config, '{title}', '"تعديل ملف الكادر الوظيفي"') || jsonb_build_object('description', 'إدارة الصلاحيات، الأدوار القيادية، والارتباطات الهيكلية للموظفين'),
  list_config = jsonb_set(list_config, '{columns}', 
    '[
      {"key": "full_name", "label": "الاسم الرباعي المعتمد", "type": "text"},
      {"key": "role", "label": "المستوى الوظيفي", "type": "status"},
      {"key": "branches.name", "label": "المقر الإداري الحالي", "type": "text"},
      {"key": "employee_code", "label": "الرقم الوظيفي (ID)", "type": "text"}
    ]'::jsonb
  )
WHERE table_name = 'profiles';

-- 4. حوكمة المخزون وسلاسل الإمداد (Inventory)
UPDATE public.ui_schemas
SET 
  form_config = jsonb_set(form_config, '{title}', '"تعريف صنف مخزني استراتيجي"') || jsonb_build_object('description', 'حوكمة عجز المخزون، قطع الغيار، ومعدلات الاستهلاك الفني'),
  list_config = jsonb_set(list_config, '{columns}', 
    '[
      {"key": "name", "label": "توصيف الصنف / المادة الخام", "type": "text"},
      {"key": "quantity", "label": "الرصيد التشغيلي المتاح", "type": "text"},
      {"key": "unit", "label": "وحدة التوريد", "type": "text"}
    ]'::jsonb
  )
WHERE table_name = 'inventory';

-- 5. سجل الحضور والانتظام الميداني (Attendance)
UPDATE public.ui_schemas
SET 
  list_config = jsonb_set(list_config, '{columns}', 
    '[
      {"key": "profiles.full_name", "label": "أخصائي الصيانة", "type": "text"},
      {"key": "clock_in", "label": "توقيت المباشرة الميدانية", "type": "date"},
      {"key": "clock_out", "label": "توقيت إنهاء المهام", "type": "date"}
    ]'::jsonb
  )
WHERE table_name = 'technician_attendance';

-- 6. مركز الاستحقاقات والبدلات المالية (Payroll)
UPDATE public.ui_schemas
SET 
  form_config = jsonb_set(form_config, '{title}', '"سجل الاستحقاق المالي المجمع"') || jsonb_build_object('description', 'المتابعة المركزية للبدلات التشغيلية، حوافز الإنجاز، والتسويات المالية'),
  list_config = jsonb_set(list_config, '{columns}', 
    '[
      {"key": "profiles.full_name", "label": "المستفيد", "type": "text"},
      {"key": "net_earning", "label": "صافي الاستحقاق المالي", "type": "text"},
      {"key": "date", "label": "الفترة المالية", "type": "date"}
    ]'::jsonb
  )
WHERE table_name = 'payroll_logs';
