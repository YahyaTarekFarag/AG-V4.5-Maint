import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: inv, error: e1 } = await supabase.from('inventory_transactions').select('*').limit(1);
    if (e1) console.error("INV ERROR:", e1);
    else console.log("Inventory Columns:", Object.keys(inv[0] || {}).join(', '));

    const { data: maint, error: e2 } = await supabase.from('maintenance_categories').select('*').limit(1);
    if (e2) console.error("MAINT ERROR:", e2);
    else console.log("Maintenance Columns:", Object.keys(maint[0] || {}).join(', '));
}
check();
