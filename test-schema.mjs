import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
    const { data: uiSchemas, error: e1 } = await supabase.from('ui_schemas').select('table_name, form_config').in('table_name', ['ui_schemas', 'system_settings']);
    if (e1) console.error(e1.message);
    else console.log(JSON.stringify(uiSchemas, null, 2));
}
checkSchema();
