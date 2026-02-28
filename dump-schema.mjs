import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function dumpSchema() {
    const tables = ['shifts', 'tickets', 'technician_attendance', 'profiles', 'inventory_transactions', 'payroll_logs', 'inventory', 'branches', 'maintenance_assets', 'ui_schemas'];
    const results = {};

    for (const table of tables) {
        const { data, error } = await supabase.rpc('sovereign_execute_sql', {
            sql_query: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' ORDER BY ordinal_position;`
        });

        if (error) {
            console.error(`Error fetching schema for ${table}:`, error);
            // Fallback: try direct select from information_schema if rpc fails
            const { data: data2, error: error2 } = await supabase
                .from('information_schema.columns')
                .select('column_name, data_type, is_nullable')
                .eq('table_schema', 'public')
                .eq('table_name', table);

            if (error2) {
                results[table] = { error: error2.message };
            } else {
                results[table] = data2;
            }
        } else {
            results[table] = data;
        }
    }

    fs.writeFileSync('db_reality.json', JSON.stringify(results, null, 2));
    console.log("Schema dump completed: db_reality.json");
}

dumpSchema();
