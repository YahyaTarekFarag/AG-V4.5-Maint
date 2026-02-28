import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: uiSettings } = await supabase.from('ui_schemas').select('table_name, list_config, form_config');
    uiSettings.forEach(s => {
        const str = JSON.stringify(s);
        if (str.includes('?')) {
            console.log(`Schema containing '?' found: ${s.table_name}`);
        }
    });

    const { data: inv } = await supabase.from('ui_schemas').select('list_config, form_config').eq('table_name', 'inventory_transactions');
    console.log('inventory_transactions form fields:', JSON.stringify(inv[0]?.form_config?.fields));
}
check();
