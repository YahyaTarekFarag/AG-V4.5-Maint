-- V31__restore_essential_ui_schemas.sql
-- ==============================================================================
-- PHASE 9: DATA INTEGRITY RECOVERY
-- Goal: Ensure core master-data tables have UI schemas defined in the database.
-- This prevents "Schema not found" errors and 406 Not Acceptable responses.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Brands Schema
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'brands',
        '{
            "columns": [
                {"key": "name", "label": "اسم العلامة التجارية", "type": "text", "sortable": true},
                {"key": "created_at", "label": "تاريخ التسجيل", "type": "date"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "name", "label": "اسم العلامة التجارية", "type": "text", "required": true}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

    -- 2. Sectors Schema
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'sectors',
        '{
            "columns": [
                {"key": "name", "label": "اسم القطاع", "type": "text", "sortable": true},
                {"key": "brand_id", "label": "العلامة التجارية", "type": "select", "dataSource": "brands"},
                {"key": "created_at", "label": "تاريخ الإنشاء", "type": "date"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "name", "label": "اسم القطاع", "type": "text", "required": true},
                {"key": "brand_id", "label": "العلامة التجارية", "type": "select", "dataSource": "brands", "required": true}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

    -- 3. Areas Schema
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'areas',
        '{
            "columns": [
                {"key": "name", "label": "اسم المنطقة", "type": "text", "sortable": true},
                {"key": "sector_id", "label": "القطاع التابع", "type": "select", "dataSource": "sectors"},
                {"key": "created_at", "label": "تاريخ الإنشاء", "type": "date"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "name", "label": "اسم المنطقة", "type": "text", "required": true},
                {"key": "sector_id", "label": "القطاع التابع", "type": "select", "dataSource": "sectors", "required": true}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

    -- 4. Branches Schema
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'branches',
        '{
            "columns": [
                {"key": "name", "label": "اسم الفرع", "type": "text", "sortable": true},
                {"key": "area_id", "label": "المنطقة", "type": "select", "dataSource": "areas"},
                {"key": "latitude", "label": "خط العرض", "type": "text"},
                {"key": "longitude", "label": "خط الطول", "type": "text"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "name", "label": "اسم الفرع", "type": "text", "required": true},
                {"key": "area_id", "label": "المنطقة", "type": "select", "dataSource": "areas", "required": true},
                {"key": "latitude", "label": "خط العرض", "type": "text"},
                {"key": "longitude", "label": "خط الطول", "type": "text"}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

    -- 5. Maintenance Categories Schema
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'maintenance_categories',
        '{
            "columns": [
                {"key": "name", "label": "اسم الفئة", "type": "text", "sortable": true},
                {"key": "description", "label": "الوصف", "type": "text"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "name", "label": "اسم الفئة", "type": "text", "required": true},
                {"key": "description", "label": "الوصف", "type": "text"}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

    -- 6. Inventory Schema
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'inventory',
        '{
            "columns": [
                {"key": "item_name", "label": "اسم الصنف", "type": "text", "sortable": true},
                {"key": "quantity", "label": "الكمية المتاحة", "type": "number"},
                {"key": "min_stock_level", "label": "حد الطلب", "type": "number"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "item_name", "label": "اسم الصنف", "type": "text", "required": true},
                {"key": "quantity", "label": "الكمية", "type": "number", "required": true},
                {"key": "min_stock_level", "label": "حد الطلب", "type": "number"}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

    -- 7. Maintenance Assets Schema
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'maintenance_assets',
        '{
            "columns": [
                {"key": "name", "label": "اسم الأصل", "type": "text", "sortable": true},
                {"key": "category_id", "label": "التصنيف", "type": "select", "dataSource": "maintenance_categories"},
                {"key": "branch_id", "label": "الفرع", "type": "select", "dataSource": "branches"},
                {"key": "status", "label": "الحالة التشغيلية", "type": "status"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "name", "label": "اسم الأصل", "type": "text", "required": true},
                {"key": "category_id", "label": "التصنيف", "type": "select", "dataSource": "maintenance_categories", "required": true},
                {"key": "branch_id", "label": "الفرع", "type": "select", "dataSource": "branches", "required": true},
                {"key": "status", "label": "الحالة", "type": "status", "required": true}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

END $$;
