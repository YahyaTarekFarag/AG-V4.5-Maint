import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addCol(table, col, type) {
    console.log(`Adding ${col} (${type}) to ${table}...`);
    const { data, error } = await supabase.rpc('sovereign_add_column', {
        p_table: table,
        p_column: col,
        p_type: type
    });
    if (error) console.error(`❌ Failed to add ${col} to ${table}:`, error.message);
    else console.log(`✅ Success: ${col} added to ${table}`);
}

async function runRepair() {
    // 1. Inventory Repair
    await addCol('inventory', 'branch_id', 'uuid');
    await addCol('inventory', 'min_stock_level', 'numeric');

    // 2. Maintenance Categories Repair
    await addCol('maintenance_categories', 'description', 'text');

    // 3. Technician Missions Repair
    await addCol('technician_missions', 'mission_type', 'text');
    await addCol('technician_missions', 'description', 'text');
    await addCol('technician_missions', 'status', 'text');

    // 4. Payroll Logs Repair (if they exist but are hollow)
    await addCol('payroll_logs', 'amount', 'numeric');
    await addCol('payroll_logs', 'notes', 'text');
    await addCol('payroll_logs', 'month', 'text');
    await addCol('payroll_logs', 'total_amount', 'numeric');

    console.log('--- Column Injection Complete ---');
}

runRepair();
