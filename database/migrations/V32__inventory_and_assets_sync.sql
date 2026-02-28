-- V32__inventory_and_assets_sync.sql
-- ==============================================================================
-- PHASE 11: FINAL SYSTEM UNIFICATION
-- Goal: Ensure database columns match the application registry and fix mismatches.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Ensure inventory_transactions has unit_cost_at_time (Rescue from V28 if missed)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_transactions' AND column_name = 'unit_cost_at_time'
    ) THEN
        ALTER TABLE public.inventory_transactions ADD COLUMN unit_cost_at_time NUMERIC(10, 2) DEFAULT 0;
    END IF;

    -- 2. Sync UI Schema for maintenance_assets (Table name unification)
    -- This ensures that regardless of the UI key (assets), the DB schema is correctly mapped to maintenance_assets.
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

    -- 3. Sync UI Schema for inventory_transactions
    INSERT INTO public.ui_schemas (table_name, list_config, form_config)
    VALUES (
        'inventory_transactions',
        '{
            "columns": [
                {"key": "inventory_id", "label": "الصنف", "type": "select", "dataSource": "inventory"},
                {"key": "quantity_used", "label": "الكمية", "type": "number"},
                {"key": "unit_cost_at_time", "label": "التكلفة", "type": "number"},
                {"key": "transaction_type", "label": "النوع", "type": "status"},
                {"key": "technician_id", "label": "الفني", "type": "select", "dataSource": "profiles"},
                {"key": "created_at", "label": "التاريخ", "type": "date"}
            ]
        }'::jsonb,
        '{
            "fields": [
                {"key": "inventory_id", "label": "الصنف", "type": "select", "dataSource": "inventory", "required": true},
                {"key": "quantity_used", "label": "الكمية", "type": "number", "required": true},
                {"key": "transaction_type", "label": "نوع الحركة", "type": "status", "required": true},
                {"key": "notes", "label": "ملاحظات", "type": "text"}
            ]
        }'::jsonb
    ) ON CONFLICT (table_name) DO UPDATE SET
        list_config = EXCLUDED.list_config,
        form_config = EXCLUDED.form_config;

END $$;
