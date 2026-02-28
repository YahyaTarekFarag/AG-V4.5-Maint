import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function performSurgery() {
    const queries = {
        dna_tables: `
            SELECT 
              c.table_name, c.column_name, c.ordinal_position, c.data_type, c.udt_name, c.is_nullable, c.column_default,
              CASE WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY' ELSE '' END as key_type,
              CASE WHEN fk.column_name IS NOT NULL THEN 'FK → ' || fk.foreign_table || '.' || fk.foreign_column ELSE '' END as foreign_ref
            FROM information_schema.columns c
            LEFT JOIN (
              SELECT ku.table_name, ku.column_name FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
              WHERE tc.constraint_type = 'PRIMARY KEY'
            ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
            LEFT JOIN (
              SELECT kcu.table_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
              JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
              WHERE tc.constraint_type = 'FOREIGN KEY'
            ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
            WHERE c.table_schema = 'public' ORDER BY c.table_name, c.ordinal_position;`,
        enums: `SELECT t.typname AS enum_name, e.enumlabel AS enum_value FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' ORDER BY enum_name, enumsortorder;`,
        rpc_functions: `SELECT p.proname AS function_name, pg_get_function_arguments(p.oid) AS arguments, p.prosrc AS source_code FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' ORDER BY function_name;`,
        rls_policies: `SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public';`,
        ui_schemas_audit: `SELECT us.table_name, field->>'key' AS field_key, field->>'label' AS field_label, c.column_name AS actual_column, CASE WHEN c.column_name IS NULL THEN '❌ MISSING' ELSE '✅ OK' END AS status FROM ui_schemas us CROSS JOIN LATERAL jsonb_array_elements(us.form_config->'fields') AS field LEFT JOIN information_schema.columns c ON c.table_name = us.table_name AND c.column_name = field->>'key' AND c.table_schema = 'public' ORDER BY us.table_name;`
    };

    const auditResults = {};

    for (const [name, sql] of Object.entries(queries)) {
        console.log(`Extracting ${name}...`);
        const { data, error } = await supabase.rpc('sovereign_execute_sql', { sql_query: sql });
        if (error) {
            console.error(`Error in ${name}:`, error.message);
            auditResults[name] = { error: error.message };
        } else {
            auditResults[name] = data;
        }
    }

    fs.writeFileSync('database_dna_summary.json', JSON.stringify(auditResults, null, 2));
    console.log("Surgery Phase 1 Complete: database_dna_summary.json generated.");
}

performSurgery();
