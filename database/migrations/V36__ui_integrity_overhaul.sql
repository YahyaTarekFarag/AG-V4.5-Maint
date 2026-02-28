-- V36__ui_integrity_overhaul.sql
-- ============================================================
-- تدقيق وإصلاح نوافذ إدخال البيانات (UI Integrity)
-- ============================================================

DO $$
BEGIN
    -- 1. تحديث واجهة حركات المخزون (Inventory Transactions)
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'inventory_transactions',
        '{
            "columns": [
                {"key": "inventory_id", "label": "الصنف", "type": "select", "dataSource": "inventory"},
                {"key": "quantity_used", "label": "الكمية", "type": "number"},
                {"key": "transaction_type", "label": "نوع الحركة", "type": "status"},
                {"key": "technician_id", "label": "القائم بالعملية", "type": "select", "dataSource": "profiles"},
                {"key": "branch_id", "label": "الفرع/المستودع", "type": "select", "dataSource": "branches"},
                {"key": "created_at", "label": "التاريخ", "type": "date"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "inventory_id", "label": "الصنف", "type": "select", "dataSource": "inventory", "required": true},
                {"key": "quantity_used", "label": "الكمية", "type": "number", "required": true},
                {
                    "key": "transaction_type", 
                    "label": "نوع الحركة المخزنية", 
                    "type": "select", 
                    "required": true,
                    "options": [
                        {"label": "صرف (سحب من المخزن)", "value": "out"},
                        {"label": "توريد (إيداع في المخزن)", "value": "in"}
                    ]
                },
                {"key": "branch_id", "label": "الفرع / المستودع الموجه له", "type": "select", "dataSource": "branches", "required": true},
                {"key": "unit_cost_at_time", "label": "سعر الوحدة (في حال التوريد)", "type": "number"},
                {"key": "notes", "label": "ملاحظات إضافية", "type": "textarea"}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

    -- 2. تحديث واجهة الأصول والمعدات (Maintenance Assets)
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'maintenance_assets',
        '{
            "columns": [
                {"key": "name", "label": "اسم الأصل", "type": "text", "sortable": true},
                {"key": "category_id", "label": "التصنيف الفني", "type": "select", "dataSource": "maintenance_categories"},
                {"key": "branch_id", "label": "الفرع التابع له", "type": "select", "dataSource": "branches"},
                {"key": "status", "label": "الحالة التشغيلية", "type": "status"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "name", "label": "اسم الجهاز / الأصل", "type": "text", "required": true},
                {"key": "category_id", "label": "التصنيف", "type": "select", "dataSource": "maintenance_categories", "required": true},
                {"key": "branch_id", "label": "الفرع المستضيف", "type": "select", "dataSource": "branches", "required": true},
                {
                    "key": "status", 
                    "label": "الحالة التشغيلية الحالية", 
                    "type": "select", 
                    "required": true,
                    "options": [
                        {"label": "يعمل بكفاءة (Operational)", "value": "operational"},
                        {"label": "بطل معطل (Faulty)", "value": "faulty"},
                        {"label": "تحت الصيانة (Under Maintenance)", "value": "under_maintenance"}
                    ]
                },
                {"key": "serial_number", "label": "الرقم التسلسلي (Serial)", "type": "text"},
                {"key": "purchase_date", "label": "تاريخ الشراء", "type": "date"},
                {"key": "service_interval_days", "label": "دورة الصيانة الوقائية (أيام)", "type": "number", "defaultValue": 90}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

    -- 3. تحديث واجهة البلاغات (Tickets) لضمان الأولوية
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'tickets',
        '{
            "columns": [
                {"key": "asset_name", "label": "الأصل / الجهاز", "type": "text"},
                {"key": "status", "label": "الحالة", "type": "status"},
                {"key": "priority", "label": "الأولوية", "type": "status"},
                {"key": "created_at", "label": "تاريخ البلاغ", "type": "date"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "branch_id", "label": "الفرع", "type": "select", "dataSource": "branches", "required": true},
                {"key": "category_id", "label": "تصنيف العطل", "type": "select", "dataSource": "maintenance_categories", "required": true},
                {"key": "asset_id", "label": "تحديد الجهاز (اختياري)", "type": "select", "dataSource": "maintenance_assets"},
                {"key": "description", "label": "وصف العطل بالتفصيل", "type": "textarea", "required": true},
                {
                    "key": "priority", 
                    "label": "درجة الأهمية", 
                    "type": "select", 
                    "options": [
                        {"label": "عادي (Normal)", "value": "normal"},
                        {"label": "مرتفع (High)", "value": "high"},
                        {"label": "حرج جداً (Critical)", "value": "critical"}
                    ],
                    "defaultValue": "normal"
                },
                {"key": "is_emergency", "label": "حالة طوارئ قصوى؟", "type": "checkbox"},
                {"key": "reporter_name", "label": "اسم المبلغ", "type": "text"},
                {"key": "reporter_phone", "label": "رقم هاتف المبلغ", "type": "text"}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

END $$;
