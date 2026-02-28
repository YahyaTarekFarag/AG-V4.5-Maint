import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function getAllSchemas() {
    const { data: tables, error: e1 } = await supabase.rpc('sovereign_execute_sql', {
        sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    });

    if (e1) {
        console.error("Error fetching tables:", e1);
        return;
    }

    for (const table of tables) {
        const { data: columns, error: e2 } = await supabase.rpc('sovereign_execute_sql', {
            sql_query: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${table.table_name}'`
        });
        console.log(`\n--- Table: ${table.table_name} ---`);
        console.table(columns);
    }
}

getAllSchemas();
