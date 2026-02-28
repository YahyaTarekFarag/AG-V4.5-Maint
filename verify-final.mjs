import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function verifyFinal() {
    const tables = ['inventory', 'inventory_transactions', 'branches', 'profiles'];

    for (const table of tables) {
        console.log(`Checking columns for [${table}]...`);
        const { data, error } = await supabase.rpc('get_table_columns', { p_table_name: table });

        if (error) {
            console.error(`Error fetching columns for ${table}:`, error.message);
            continue;
        }

        const columnNames = data.map(c => c.column_name);
        console.log(` - Columns: ${columnNames.join(', ')}`);

        // Check for required audit columns
        const required = ['created_at', 'updated_at', 'is_deleted'];
        for (const req of required) {
            if (!columnNames.includes(req)) {
                console.warn(` [WARNING] Missing ${req} in ${table}. Attempting to add...`);
                await supabase.rpc('sovereign_add_column', {
                    p_table: table,
                    p_column: req,
                    p_type: req === 'is_deleted' ? 'boolean' : 'timestamptz'
                });
            }
        }
    }
}

verifyFinal();
