-- ==========================================
-- MASTER UI SCHEMA SYNC
-- Ensures all columns are visible in tables and forms
-- ==========================================

-- 1. PROFILES: Show full hierarchy in list and form
UPDATE public.ui_schemas SET
  list_config = '{
    "title": "إدارة شؤون الموظفين",
    "searchable": true,
    "columns": [
      {"key": "full_name", "label": "الاسم الكامل", "type": "text"},
      {"key": "employee_code", "label": "الكود", "type": "text"},
      {"key": "role", "label": "الدور", "type": "text"},
      {"key": "brand_id", "label": "البراند", "type": "text"},
      {"key": "sector_id", "label": "القطاع", "type": "text"},
      {"key": "area_id", "label": "المنطقة", "type": "text"},
      {"key": "branch_id", "label": "الفرع", "type": "text"}
    ]
  }'::jsonb,
  form_config = '{
    "title": "بيانات الموظف",
    "fields": [
      {"key": "full_name", "label": "الاسم الكامل", "type": "text", "required": true},
      {"key": "employee_code", "label": "كود الموظف", "type": "text", "required": true},
      {"key": "password", "label": "كلمة المرور", "type": "text", "required": true},
      {"key": "role", "label": "الصلاحية", "type": "select", "required": true, "options": [
        {"label": "مسؤول نظام", "value": "admin"},
        {"label": "مدير تشغيل", "value": "brand_ops_manager"},
        {"label": "مدير قطاع", "value": "sector_manager"},
        {"label": "مدير منطقة", "value": "area_manager"},
        {"label": "مدير فرع", "value": "manager"},
        {"label": "مدير صيانة", "value": "maint_manager"},
        {"label": "مشرف صيانة", "value": "maint_supervisor"},
        {"label": "فني", "value": "technician"}
      ]},
      {"key": "brand_id", "label": "البراند", "type": "select", "dataSource": "brands"},
      {"key": "sector_id", "label": "القطاع", "type": "select", "dataSource": "sectors"},
      {"key": "area_id", "label": "المنطقة", "type": "select", "dataSource": "areas"},
      {"key": "branch_id", "label": "الفرع", "type": "select", "dataSource": "branches"}
    ]
  }'::jsonb
WHERE table_name = 'profiles';

-- 2. BRANCHES: Show area connection
UPDATE public.ui_schemas SET
  list_config = '{
    "title": "دليل الفروع",
    "searchable": true,
    "columns": [
      {"key": "name", "label": "اسم الفرع", "type": "text"},
      {"key": "br_tel", "label": "رقم التليفون", "type": "text"},
      {"key": "area_id", "label": "المنطقة", "type": "text"}
    ]
  }'::jsonb,
  form_config = '{
    "title": "بيانات الفرع",
    "fields": [
      {"key": "name", "label": "اسم الفرع", "type": "text", "required": true},
      {"key": "br_tel", "label": "رقم التليفون", "type": "text"},
      {"key": "area_id", "label": "المنطقة", "type": "select", "required": true, "dataSource": "areas"},
      {"key": "latitude", "label": "Latitude", "type": "number"},
      {"key": "longitude", "label": "Longitude", "type": "number"}
    ]
  }'::jsonb
WHERE table_name = 'branches';

-- 3. TICKETS: Assignment and Priority
UPDATE public.ui_schemas SET
  list_config = '{
    "title": "إدارة البلاغات",
    "searchable": true,
    "columns": [
      {"key": "asset_name", "label": "المعدة", "type": "text"},
      {"key": "branch_id", "label": "الفرع", "type": "text"},
      {"key": "status", "label": "الحالة", "type": "status"},
      {"key": "priority", "label": "الأولوية", "type": "status"},
      {"key": "assigned_to", "label": "الفني المُكلف", "type": "text"},
      {"key": "created_at", "label": "تاريخ البلاغ", "type": "date"}
    ]
  }'::jsonb,
  form_config = '{
    "title": "بيانات البلاغ",
    "fields": [
      {"key": "asset_name", "label": "المعدة", "type": "text", "required": true},
      {"key": "description", "label": "وصف المشكلة", "type": "textarea"},
      {"key": "priority", "label": "الأولوية", "type": "select", "options": [
        {"label": "عادي", "value": "normal"},
        {"label": "مرتفع", "value": "high"},
        {"label": "عاجل", "value": "urgent"},
        {"label": "حرج", "value": "critical"}
      ]},
      {"key": "assigned_to", "label": "توجيه للفني", "type": "select", "dataSource": "profiles", "dataLabel": "full_name"}
    ]
  }'::jsonb
WHERE table_name = 'tickets';

-- 4. SECTORS: Brand relationship
UPDATE public.ui_schemas SET
  list_config = '{"title":"إدارة القطاعات","searchable":true,"columns":[{"key":"name","label":"اسم القطاع","type":"text"},{"key":"brand_id","label":"البراند","type":"text"}]}'::jsonb,
  form_config = '{"title":"بيانات القطاع","fields":[{"key":"name","label":"اسم القطاع","type":"text","required":true},{"key":"brand_id","label":"البراند","type":"select","required":true,"dataSource":"brands"}]}'::jsonb
WHERE table_name = 'sectors';

-- 5. AREAS: Sector relationship
UPDATE public.ui_schemas SET
  list_config = '{"title":"إدارة المناطق","searchable":true,"columns":[{"key":"name","label":"اسم المنطقة","type":"text"},{"key":"sector_id","label":"القطاع","type":"text"}]}'::jsonb,
  form_config = '{"title":"بيانات المنطقة","fields":[{"key":"name","label":"اسم المنطقة","type":"text","required":true},{"key":"sector_id","label":"القطاع","type":"select","required":true,"dataSource":"sectors"}]}'::jsonb
WHERE table_name = 'areas';
