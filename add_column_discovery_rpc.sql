-- ============================================================
-- FSC-MAINT-APP: SQL Column Discovery RPC
-- Run this in Supabase SQL Editor ONCE to enable the
-- "Generate SQL" feature in the Schema Builder page.
-- ============================================================

-- This function reads the real columns of any table and returns them.
-- SchemaBuilderPage calls it to compare with form fields and detect gaps.
CREATE OR REPLACE FUNCTION public.get_table_columns(p_table_name text)
RETURNS TABLE(column_name text, data_type text, is_nullable text)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        c.column_name::text,
        c.data_type::text,
        c.is_nullable::text
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = p_table_name
    ORDER BY c.ordinal_position;
$$;
