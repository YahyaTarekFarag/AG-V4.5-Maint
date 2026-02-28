import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function listTables() {
    const { data: tables, error } = await supabase.rpc('sovereign_execute_sql', {
        sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    });

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Actual Tables in Public Schema:");
    console.table(tables.map(t => t.table_name));
}

listTables();
