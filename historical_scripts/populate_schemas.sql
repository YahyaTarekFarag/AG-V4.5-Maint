-- populate_schemas.sql
-- استعادة مخططات الواجهات السيادية (Sovereign UI Schemas)
-- Phase 11 Recovery

TRUNCATE public.ui_schemas RESTART IDENTITY;

-- 1. تذاكر الصيانة (tickets)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'tickets',
  '{
    "title": "سجل تذاكر الصيانة",
    "columns": [
      { "key": "asset_id", "label": "المعدة", "type": "text" },
      { "key": "status", "label": "الحالة", "type": "status" },
      { "key": "priority", "label": "الأولوية", "type": "badge" },
      { "key": "created_at", "label": "وقت البلاغ", "type": "date" }
    ],
    "searchable": true
  }'::jsonb,
  '{
    "title": "تفاصيل بلاغ الصيانة",
    "fields": [
      { "key": "branch_id", "label": "الفرع", "type": "select", "required": true, "dataSource": "branches", "dataLabel": "name", "dataValue": "id" },
      { "key": "asset_id", "label": "المعدة المعطلة", "type": "select", "dataSource": "maintenance_assets", "dataLabel": "name", "dataValue": "id" },
      { "key": "description", "label": "وصف العطل", "type": "textarea", "required": true },
      { "key": "priority", "label": "الأولوية", "type": "select", "options": [
          {"label": "عادي", "value": "normal"},
          {"label": "عالي", "value": "high"},
          {"label": "طارئ جداً", "value": "urgent"}
      ]},
      { "key": "status", "label": "حالة البلاغ", "type": "select", "options": [
          {"label": "جديد", "value": "open"},
          {"label": "تم الإسناد", "value": "assigned"},
          {"label": "قيد الإصلاح", "value": "in_progress"},
          {"label": "تم الإصلاح", "value": "resolved"},
          {"label": "مغلق", "value": "closed"}
      ]}
    ]
  }'::jsonb
);

-- 2. أصول الصيانة (maintenance_assets)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'maintenance_assets',
  '{
    "title": "الأصول والمعدات",
    "columns": [
      { "key": "name", "label": "اسم المعدة", "type": "text" },
      { "key": "branch_id", "label": "الفرع", "type": "text" },
      { "key": "category_id", "label": "التصنيف", "type": "text" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة / تعديل أصل فني",
    "fields": [
      { "key": "name", "label": "اسم المعدة", "type": "text", "required": true },
      { "key": "branch_id", "label": "الفرع التابع", "type": "select", "dataSource": "branches" },
      { "key": "category_id", "label": "التصنيف الفني", "type": "select", "dataSource": "maintenance_categories" }
    ]
  }'::jsonb
);

-- 3. تصنيفات الصيانة (maintenance_categories)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'maintenance_categories',
  '{
    "title": "تصنيفات الصيانة",
    "columns": [
      { "key": "name", "label": "اسم التصنيف", "type": "text" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة تصنيف فني",
    "fields": [
      { "key": "name", "label": "اسم التصنيف (أجهزة، تكييف، إلخ)", "type": "text", "required": true }
    ]
  }'::jsonb
);

-- 4. المخزون (inventory)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'inventory',
  '{
    "title": "إدارة المخزون",
    "columns": [
      { "key": "name", "label": "اسم القطعة", "type": "text" },
      { "key": "part_number", "label": "الرقم المرجعي", "type": "badge" },
      { "key": "quantity", "label": "الكمية", "type": "number" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة قطعة غيار",
    "fields": [
      { "key": "name", "label": "اسم القطعة", "type": "text", "required": true },
      { "key": "part_number", "label": "SKU / الرقم المرجعي", "type": "text" },
      { "key": "quantity", "label": "الكمية الابتدائية", "type": "number", "required": true },
      { "key": "unit", "label": "الوحدة", "type": "text" }
    ]
  }'::jsonb
);

-- 5. حركات المخزون (inventory_transactions)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'inventory_transactions',
  '{
    "title": "عمليات المخزون",
    "columns": [
      { "key": "inventory_id", "label": "القطعة", "type": "text" },
      { "key": "quantity", "label": "الكمية", "type": "number" },
      { "key": "type", "label": "النوع", "type": "badge" },
      { "key": "technician_id", "label": "الفني", "type": "text" }
    ]
  }'::jsonb,
  '{
    "title": "تسجيل حركة مخزنية",
    "fields": [
      { "key": "inventory_id", "label": "القطعة", "type": "select", "dataSource": "inventory" },
      { "key": "quantity", "label": "الكمية", "type": "number", "required": true },
      { "key": "type", "label": "نوع الحركة", "type": "select", "options": [
          {"label": "صرف", "value": "out"},
          {"label": "توريد", "value": "in"}
      ]},
      { "key": "technician_id", "label": "المستلم (الفني)", "type": "select", "dataSource": "profiles" }
    ]
  }'::jsonb
);

-- 6. حضور الفنيين (technician_attendance)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'technician_attendance',
  '{
    "title": "سجل الحضور والغياب",
    "columns": [
      { "key": "profile_id", "label": "الموظف", "type": "text" },
      { "key": "clock_in", "label": "وقت الحضور", "type": "datetime" },
      { "key": "clock_out", "label": "وقت الانصراف", "type": "datetime" }
    ]
  }'::jsonb,
  '{
    "title": "تسجيل حضور يدوي",
    "fields": [
      { "key": "profile_id", "label": "الموظف", "type": "select", "dataSource": "profiles" },
      { "key": "clock_in", "label": "وقت الدخول", "type": "datetime" }
    ]
  }'::jsonb
);

-- 7. مهام العمل (technician_missions)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'technician_missions',
  '{
    "title": "المهام والزيارات",
    "columns": [
      { "key": "profile_id", "label": "الفني", "type": "text" },
      { "key": "mission_type", "label": "نوع المهمة", "type": "badge" },
      { "key": "status", "label": "الحالة", "type": "status" }
    ]
  }'::jsonb,
  '{
    "title": "إسناد مهمة جديدة",
    "fields": [
      { "key": "profile_id", "label": "الفني المكلف", "type": "select", "dataSource": "profiles" },
      { "key": "mission_type", "label": "تصنيف المهمة", "type": "text" },
      { "key": "description", "label": "وصف المهمة", "type": "textarea" }
    ]
  }'::jsonb
);

-- 8. حسابات الرواتب (payroll_logs)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'payroll_logs',
  '{
    "title": "سجلات الرواتب",
    "columns": [
      { "key": "profile_id", "label": "الموظف", "type": "text" },
      { "key": "month", "label": "الشهر", "type": "text" },
      { "key": "total_amount", "label": "المبلغ الإجمالي", "type": "number" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة سجل مالي",
    "fields": [
      { "key": "profile_id", "label": "الموظف", "type": "select", "dataSource": "profiles" },
      { "key": "amount", "label": "المبلغ", "type": "number" },
      { "key": "notes", "label": "ملاحظات الصرف", "type": "textarea" }
    ]
  }'::jsonb
);

-- 9. الموظفين (profiles)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'profiles',
  '{
    "title": "شؤون الموظفين",
    "columns": [
      { "key": "full_name", "label": "الاسم", "type": "text" },
      { "key": "employee_code", "label": "كود الموظف", "type": "badge" },
      { "key": "role", "label": "الصلاحية", "type": "text" }
    ]
  }'::jsonb,
  '{
    "title": "بيانات الموظف",
    "fields": [
      { "key": "full_name", "label": "الاسم الكامل", "type": "text", "required": true },
      { "key": "employee_code", "label": "الكود الوظيفي", "type": "text", "required": true },
      { "key": "role", "label": "الدور", "type": "select", "options": [
          {"label": "مدير فرع", "value": "manager"},
          {"label": "فني صيانة", "value": "technician"},
          {"label": "أدمن", "value": "admin"}
      ]}
    ]
  }'::jsonb
);

-- 10. الفروع (branches)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'branches',
  '{
    "title": "دليل الفروع",
    "columns": [
      { "key": "name", "label": "اسم الفرع", "type": "text" },
      { "key": "area_id", "label": "المنطقة", "type": "text" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة فرع جديد",
    "fields": [
      { "key": "name", "label": "اسم الفرع", "type": "text", "required": true },
      { "key": "area_id", "label": "المنطقة التابع لها", "type": "select", "dataSource": "areas" }
    ]
  }'::jsonb
);

-- 11. القطاعات (sectors)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'sectors',
  '{
    "title": "قطاعات التشغيل",
    "columns": [
      { "key": "name", "label": "القطاع", "type": "text" },
      { "key": "brand_id", "label": "العلامة التجارية", "type": "text" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة قطاع",
    "fields": [
      { "key": "name", "label": "اسم القطاع", "type": "text", "required": true },
      { "key": "brand_id", "label": "العلامة التجارية", "type": "text" }
    ]
  }'::jsonb
);

-- 12. المناطق (areas)
INSERT INTO public.ui_schemas (table_name, list_config, form_config)
VALUES (
  'areas',
  '{
    "title": "المناطق الجغرافية",
    "columns": [
      { "key": "name", "label": "المنطقة", "type": "text" },
      { "key": "sector_id", "label": "القطاع التابع له", "type": "text" }
    ]
  }'::jsonb,
  '{
    "title": "إضافة منطقة",
    "fields": [
      { "key": "name", "label": "اسم المنطقة", "type": "text", "required": true },
      { "key": "sector_id", "label": "القطاع المشرف", "type": "select", "dataSource": "sectors" }
    ]
  }'::jsonb
);
