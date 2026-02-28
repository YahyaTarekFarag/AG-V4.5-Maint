import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    // Check columns of areas and branches
    const { data: q1 } = await supabase.rpc('sovereign_execute_sql', { sql_query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'areas';" });
    console.log("Areas columns:", q1?.map(r => r.column_name).join(', '));
    
    // Check if 'type' is in ui_schemas for inventory_transactions
    const { data: schemas } = await supabase.from('ui_schemas').select('form_config, list_config').eq('table_name', 'inventory_transactions');
    console.log("inventory_transactions ui_schema fields:");
    console.log(JSON.stringify(schemas?.[0]?.form_config?.fields, null, 2));

    // Check system_settings for question marks
    const { data: settings } = await supabase.from('system_settings').select('key, label, description_ar').limit(3);
    console.log("System settings:", settings);

    // Check ui_schemas for question marks
    const { data: uiSettings } = await supabase.from('ui_schemas').select('table_name, list_config').eq('table_name', 'system_settings');
    console.log("UI schema for system_settings headers:", JSON.stringify(uiSettings?.[0]?.list_config?.columns, null, 2));
}
inspect();
