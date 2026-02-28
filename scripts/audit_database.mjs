import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function audit() {
    console.log("--- 🕵️ DATABASE ATOMIC AUDIT ---");

    const runQuery = async (query, label) => {
        const { data, error } = await supabase.rpc('sovereign_execute_sql', {
            sql_query: query
        });
        if (error) {
            console.error(`\n❌ [${label}] Error:`, error);
            return null;
        }
        console.log(`\n✅ [${label}]:`, JSON.stringify(data, null, 2));
        return data;
    };

    // 1. Tables list
    await runQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", "TABLES");

    // 2. Views list
    await runQuery("SELECT table_name FROM information_schema.views WHERE table_schema = 'public'", "VIEWS");

    // 3. Shifts (View) Columns
    await runQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'shifts' AND table_schema = 'public'", "SHIFTS COLUMNS");

    // 4. Technician Attendance Columns
    await runQuery("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'technician_attendance' AND table_schema = 'public'", "ATTENDANCE COLUMNS");

    // 5. UI Schemas
    const { data: uiSchemas, error: uiError } = await supabase.from('ui_schemas').select('*');
    if (uiError) console.error("\n❌ [UI SCHEMAS] Error:", uiError);
    else console.log("\n✅ [UI SCHEMAS]:", JSON.stringify(uiSchemas, null, 2));

    // 6. Constraints
    await runQuery(`
        SELECT 
            tc.table_name, 
            tc.constraint_type, 
            tc.constraint_name, 
            cc.check_clause, 
            kcu.column_name 
        FROM information_schema.table_constraints tc 
        LEFT JOIN information_schema.check_constraints cc 
            ON tc.constraint_name = cc.constraint_name 
        LEFT JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_type;
    `, "CONSTRAINTS");
}

audit();
