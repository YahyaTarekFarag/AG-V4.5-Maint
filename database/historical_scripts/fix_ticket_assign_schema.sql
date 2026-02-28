-- ==========================================
-- B.LABAN — FIX TICKET ASSIGNMENT SCHEMA
-- Adding assigned_to field to ui_schemas for tickets 
-- to enable the assignment workflow.
-- ==========================================

DO $$ 
DECLARE 
    current_fields jsonb;
    assigned_to_field jsonb := jsonb_build_object(
        'key', 'assigned_to', 
        'label', 'تعيين الفني المختص بالتنفيذ', 
        'type', 'select', 
        'dataSource', 'profiles',
        'dataLabel', 'full_name'
    );
BEGIN
    -- Get current fields
    SELECT form_config->'fields' INTO current_fields 
    FROM public.ui_schemas 
    WHERE table_name = 'tickets';

    -- Check if assigned_to already exists to avoid duplicates
    IF NOT (current_fields @> jsonb_build_array(jsonb_build_object('key', 'assigned_to'))) THEN
        UPDATE public.ui_schemas 
        SET form_config = jsonb_set(form_config, '{fields}', current_fields || assigned_to_field)
        WHERE table_name = 'tickets';
    END IF;
END $$;
