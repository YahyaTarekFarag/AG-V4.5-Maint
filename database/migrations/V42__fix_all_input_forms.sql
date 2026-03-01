-- V42__fix_all_input_forms.sql
-- ============================================================
-- المرحلة 17: إصلاح جميع نوافذ الإدخال المعطوبة
-- ============================================================

-- 1. إضافة الأعمدة الناقصة في technician_missions
ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS mission_type TEXT DEFAULT 'field_visit';
ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 2. إضافة الأعمدة الناقصة في payroll_logs
ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS month TEXT;
ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 3. إضافة notes في technician_attendance (إذا لم تكن موجودة)
ALTER TABLE public.technician_attendance ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.technician_attendance ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 4. Inventory Transactions - إضافة branch_id و transaction_type
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'usage' CHECK (transaction_type IN ('usage', 'restock', 'transfer', 'adjustment'));
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- 5. تحديث constraint الأدوار ليشمل كافة المسميات
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
    'admin', 'brand_ops_manager', 'sector_manager', 'area_manager', 'manager', 
    'maintenance_manager', 'maintenance_supervisor', 'maint_manager', 'maint_supervisor', 'technician'
));

-- 6. تنشيط Schema Cache
NOTIFY pgrst, 'reload schema';

-- === ui_schemas الشاملة ===

-- 6.1 tickets
UPDATE public.ui_schemas
SET 
  list_config = '{
    "title": "مركز إدارة البلاغات",
    "columns": [
      {"key": "title", "type": "text", "label": "عنوان البلاغ", "sortable": true},
      {"key": "status", "type": "status", "label": "الحالة", "sortable": true},
      {"key": "priority", "type": "badge", "label": "الأولوية", "sortable": true},
      {"key": "asset_name", "type": "text", "label": "المعدة"},
      {"key": "reported_at", "type": "date", "label": "تاريخ البلاغ", "sortable": true}
    ]
  }'::jsonb,
  form_config = '{
    "title": "تفاصيل البلاغ",
    "fields": [
      {"key": "title", "type": "text", "label": "عنوان البلاغ", "required": true, "placeholder": "مثال: عطل في التكييف المركزي"},
      {"key": "description", "type": "textarea", "label": "الوصف التفصيلي", "required": true},
      {"key": "asset_name", "type": "text", "label": "اسم المعدة"},
      {"key": "asset_id", "type": "select", "label": "الأصل المرتبط", "dataSource": "maintenance_assets", "dataLabel": "name", "dataValue": "id"},
      {"key": "category_id", "type": "select", "label": "تصنيف العطل", "dataSource": "maintenance_categories", "dataLabel": "name", "dataValue": "id"},
      {"key": "priority", "type": "select", "label": "الأولوية", "required": true, "options": [
        {"label": "عادية", "value": "normal"},
        {"label": "عالية", "value": "high"},
        {"label": "عاجلة", "value": "urgent"}
      ]},
      {"key": "status", "type": "select", "label": "الحالة", "required": true, "options": [
        {"label": "مفتوح", "value": "open"},
        {"label": "مُعيّن", "value": "assigned"},
        {"label": "جاري التنفيذ", "value": "in_progress"},
        {"label": "تم الحل", "value": "resolved"},
        {"label": "مغلق", "value": "closed"}
      ]},
      {"key": "is_emergency", "type": "checkbox", "label": "بلاغ طوارئ؟"}
    ]
  }'::jsonb
WHERE table_name = 'tickets';

-- 6.2 technician_attendance
UPDATE public.ui_schemas
SET 
  list_config = '{
    "title": "سجل الحضور والغياب",
    "columns": [
      {"key": "profile_id", "type": "select", "label": "الموظف", "dataSource": "profiles"},
      {"key": "clock_in", "type": "datetime", "label": "وقت الحضور", "sortable": true},
      {"key": "clock_out", "type": "datetime", "label": "وقت الانصراف"},
      {"key": "is_valid", "type": "checkbox", "label": "صالحة"}
    ]
  }'::jsonb,
  form_config = '{
    "title": "تسجيل حضور يدوي",
    "fields": [
      {"key": "profile_id", "type": "select", "label": "الموظف", "required": true, "dataSource": "profiles", "dataLabel": "full_name", "dataValue": "id"},
      {"key": "clock_in", "type": "datetime", "label": "وقت الدخول", "required": true},
      {"key": "clock_out", "type": "datetime", "label": "وقت الانصراف"},
      {"key": "clock_in_lat", "type": "number", "label": "خط عرض الدخول"},
      {"key": "clock_in_lng", "type": "number", "label": "خط طول الدخول"},
      {"key": "notes", "type": "textarea", "label": "ملاحظات"}
    ]
  }'::jsonb
WHERE table_name = 'technician_attendance';

-- 6.3 profiles
UPDATE public.ui_schemas
SET 
  list_config = '{
    "title": "شؤون الموظفين",
    "columns": [
      {"key": "full_name", "type": "text", "label": "الاسم", "sortable": true},
      {"key": "employee_code", "type": "badge", "label": "كود الموظف"},
      {"key": "role", "type": "status", "label": "الصلاحية"},
      {"key": "branch_id", "type": "select", "label": "الفرع", "dataSource": "branches"}
    ]
  }'::jsonb,
  form_config = '{
    "title": "بيانات الموظف",
    "fields": [
      {"key": "full_name", "type": "text", "label": "الاسم الكامل", "required": true},
      {"key": "employee_code", "type": "text", "label": "الكود الوظيفي", "required": true},
      {"key": "role", "type": "select", "label": "الدور الوظيفي", "required": true, "options": [
        {"label": "أدمن النظام", "value": "admin"},
        {"label": "مدير العلامة التجارية", "value": "brand_ops_manager"},
        {"label": "مدير القطاع", "value": "sector_manager"},
        {"label": "مدير المنطقة", "value": "area_manager"},
        {"label": "مدير الفرع", "value": "manager"},
        {"label": "مدير الصيانة", "value": "maintenance_manager"},
        {"label": "مشرف الصيانة", "value": "maintenance_supervisor"},
        {"label": "فني صيانة", "value": "technician"}
      ]},
      {"key": "brand_id", "type": "select", "label": "العلامة التجارية", "dataSource": "brands", "dataLabel": "name", "dataValue": "id"},
      {"key": "sector_id", "type": "select", "label": "القطاع", "dataSource": "sectors", "dataLabel": "name", "dataValue": "id"},
      {"key": "area_id", "type": "select", "label": "المنطقة", "dataSource": "areas", "dataLabel": "name", "dataValue": "id"},
      {"key": "branch_id", "type": "select", "label": "الفرع", "dataSource": "branches", "dataLabel": "name", "dataValue": "id"}
    ]
  }'::jsonb
WHERE table_name = 'profiles';

-- 6.4 inventory 
UPDATE public.ui_schemas
SET 
  list_config = '{
    "columns": [
      {"key": "name", "type": "text", "label": "اسم الصنف", "sortable": true},
      {"key": "part_number", "type": "text", "label": "رقم القطعة"},
      {"key": "quantity", "type": "number", "label": "الكمية المتاحة"},
      {"key": "min_quantity", "type": "number", "label": "حد الطلب"},
      {"key": "unit_cost", "type": "number", "label": "تكلفة الوحدة"}
    ]
  }'::jsonb,
  form_config = '{
    "title": "بيانات الصنف المخزني",
    "fields": [
      {"key": "name", "type": "text", "label": "اسم الصنف", "required": true},
      {"key": "part_number", "type": "text", "label": "رقم القطعة / الكود"},
      {"key": "quantity", "type": "number", "label": "الكمية الحالية", "required": true},
      {"key": "unit", "type": "text", "label": "وحدة القياس", "placeholder": "مثال: حبة، متر، لتر"},
      {"key": "unit_cost", "type": "number", "label": "تكلفة الوحدة"},
      {"key": "min_quantity", "type": "number", "label": "حد الطلب الأدنى"},
      {"key": "branch_id", "type": "select", "label": "المستودع / الفرع", "dataSource": "branches", "dataLabel": "name", "dataValue": "id"}
    ]
  }'::jsonb
WHERE table_name = 'inventory';

-- 6.5 inventory_transactions
UPDATE public.ui_schemas
SET 
  list_config = '{
    "columns": [
      {"key": "inventory_id", "type": "select", "label": "الصنف", "dataSource": "inventory"},
      {"key": "quantity_used", "type": "number", "label": "الكمية"},
      {"key": "unit_cost_at_time", "type": "number", "label": "التكلفة"},
      {"key": "transaction_type", "type": "status", "label": "النوع"},
      {"key": "created_at", "type": "datetime", "label": "التاريخ", "sortable": true}
    ]
  }'::jsonb,
  form_config = '{
    "title": "حركة مخزنية جديدة",
    "fields": [
      {"key": "inventory_id", "type": "select", "label": "الصنف", "required": true, "dataSource": "inventory", "dataLabel": "name", "dataValue": "id"},
      {"key": "ticket_id", "type": "select", "label": "البلاغ المرتبط", "dataSource": "tickets", "dataLabel": "title", "dataValue": "id"},
      {"key": "technician_id", "type": "select", "label": "الفني المستلم", "required": true, "dataSource": "profiles", "dataLabel": "full_name", "dataValue": "id"},
      {"key": "quantity_used", "type": "number", "label": "الكمية المصروفة", "required": true},
      {"key": "unit_cost_at_time", "type": "number", "label": "تكلفة الوحدة وقت الصرف"},
      {"key": "transaction_type", "type": "select", "label": "نوع الحركة", "required": true, "options": [
        {"label": "صرف / استخدام", "value": "usage"},
        {"label": "إضافة مخزون", "value": "restock"},
        {"label": "تحويل بين مستودعات", "value": "transfer"},
        {"label": "تسوية جردية", "value": "adjustment"}
      ]},
      {"key": "notes", "type": "textarea", "label": "ملاحظات"}
    ]
  }'::jsonb
WHERE table_name = 'inventory_transactions';

-- 6.6 payroll_logs
UPDATE public.ui_schemas
SET 
  list_config = '{
    "title": "السجلات المالية للرواتب",
    "columns": [
      {"key": "profile_id", "type": "select", "label": "الموظف", "dataSource": "profiles"},
      {"key": "date", "type": "date", "label": "التاريخ", "sortable": true},
      {"key": "base_salary", "type": "number", "label": "الراتب الأساسي"},
      {"key": "total_allowance", "type": "number", "label": "البدلات"},
      {"key": "net_earning", "type": "number", "label": "الصافي"},
      {"key": "is_paid", "type": "checkbox", "label": "مدفوع"}
    ]
  }'::jsonb,
  form_config = '{
    "title": "إضافة سجل مالي",
    "fields": [
      {"key": "profile_id", "type": "select", "label": "الموظف", "required": true, "dataSource": "profiles", "dataLabel": "full_name", "dataValue": "id"},
      {"key": "date", "type": "date", "label": "التاريخ", "required": true},
      {"key": "base_salary", "type": "number", "label": "الراتب الأساسي"},
      {"key": "total_allowance", "type": "number", "label": "إجمالي البدلات"},
      {"key": "total_star_bonus", "type": "number", "label": "مكافأة التميز"},
      {"key": "net_earning", "type": "number", "label": "صافي الاستحقاق"},
      {"key": "is_paid", "type": "checkbox", "label": "تم الصرف؟"},
      {"key": "notes", "type": "textarea", "label": "ملاحظات"}
    ]
  }'::jsonb
WHERE table_name = 'payroll_logs';

-- 6.7 technician_missions
UPDATE public.ui_schemas
SET 
  list_config = '{
    "title": "المهام والزيارات الميدانية",
    "columns": [
      {"key": "profile_id", "type": "select", "label": "الفني", "dataSource": "profiles"},
      {"key": "mission_type", "type": "badge", "label": "نوع المهمة"},
      {"key": "status", "type": "status", "label": "الحالة"},
      {"key": "distance_km", "type": "number", "label": "المسافة (كم)"},
      {"key": "allowance_earned", "type": "number", "label": "البدل المستحق"}
    ]
  }'::jsonb,
  form_config = '{
    "title": "إسناد مهمة ميدانية",
    "fields": [
      {"key": "profile_id", "type": "select", "label": "الفني المكلف", "required": true, "dataSource": "profiles", "dataLabel": "full_name", "dataValue": "id"},
      {"key": "ticket_id", "type": "select", "label": "البلاغ المرتبط", "dataSource": "tickets", "dataLabel": "title", "dataValue": "id"},
      {"key": "mission_type", "type": "select", "label": "تصنيف المهمة", "options": [
        {"label": "زيارة ميدانية", "value": "field_visit"},
        {"label": "صيانة وقائية", "value": "preventive"},
        {"label": "نقل معدات", "value": "equipment_transfer"},
        {"label": "تفتيش دوري", "value": "inspection"}
      ]},
      {"key": "from_branch_id", "type": "select", "label": "من فرع", "dataSource": "branches", "dataLabel": "name", "dataValue": "id"},
      {"key": "to_branch_id", "type": "select", "label": "إلى فرع", "dataSource": "branches", "dataLabel": "name", "dataValue": "id"},
      {"key": "description", "type": "textarea", "label": "وصف المهمة"},
      {"key": "status", "type": "select", "label": "الحالة", "options": [
        {"label": "معلقة", "value": "pending"},
        {"label": "جاري التنفيذ", "value": "in_progress"},
        {"label": "مكتملة", "value": "completed"},
        {"label": "ملغية", "value": "cancelled"}
      ]}
    ]
  }'::jsonb
WHERE table_name = 'technician_missions';

-- 6.8 branches - تصحيح أسماء أعمدة الموقع (latitude/longitude بعد V12)
UPDATE public.ui_schemas
SET 
  form_config = jsonb_set(
    form_config,
    '{fields}',
    (
      SELECT jsonb_agg(
        CASE 
          WHEN f->>'key' = 'branch_lat' THEN jsonb_set(f, '{key}', '"latitude"')
          WHEN f->>'key' = 'branch_lng' THEN jsonb_set(f, '{key}', '"longitude"')
          ELSE f
        END
      )
      FROM jsonb_array_elements(form_config->'fields') f
    )
  ),
  list_config = jsonb_set(
    list_config,
    '{columns}',
    (
      SELECT jsonb_agg(
        CASE 
          WHEN c->>'key' = 'branch_lat' THEN jsonb_set(c, '{key}', '"latitude"')
          WHEN c->>'key' = 'branch_lng' THEN jsonb_set(c, '{key}', '"longitude"')
          ELSE c
        END
      )
      FROM jsonb_array_elements(list_config->'columns') c
    )
  )
WHERE table_name = 'branches';

-- 6.9 shifts View - تحديث للتوافق السلس
UPDATE public.ui_schemas
SET 
  list_config = '{
    "title": "سجل المناوبات",
    "columns": [
      {"key": "technician_id", "type": "text", "label": "الفني", "sortable": true},
      {"key": "start_at", "type": "datetime", "label": "بداية المناوبة", "sortable": true},
      {"key": "end_at", "type": "datetime", "label": "نهاية المناوبة", "sortable": true}
    ]
  }'::jsonb,
  form_config = '{
    "title": "مناوبة الفني",
    "fields": [
      {"key": "technician_id", "type": "select", "label": "الفني", "required": true, "dataLabel": "full_name", "dataValue": "id", "dataSource": "profiles"},
      {"key": "start_at", "type": "datetime", "label": "وقت البدء", "required": true},
      {"key": "end_at", "type": "datetime", "label": "وقت الانتهاء"}
    ]
  }'::jsonb
WHERE table_name = 'shifts';
