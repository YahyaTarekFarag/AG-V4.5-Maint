import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkCols(table, expectedCols) {
    console.log(`Checking ${table}...`);
    const { data, error } = await supabase.rpc('get_table_columns', { p_table_name: table });
    if (error) {
        console.error(`❌ Error checking ${table}:`, error.message);
        return;
    }
    const actualCols = data.map(c => c.column_name);
    expectedCols.forEach(col => {
        if (actualCols.includes(col)) {
            console.log(`✅ ${table}.${col} exists.`);
        } else {
            console.error(`❌ ${table}.${col} MISSING!`);
        }
    });
}

async function verify() {
    await checkCols('inventory', ['branch_id', 'min_stock_level', 'part_number']);
    await checkCols('maintenance_categories', ['description']);
    await checkCols('technician_missions', ['mission_type', 'description', 'status']);
    await checkCols('payroll_logs', ['amount', 'notes', 'month', 'total_amount']);
    await checkCols('tickets', ['assigned_to', 'title']);
    console.log('--- Verification Complete ---');
}

verify();
