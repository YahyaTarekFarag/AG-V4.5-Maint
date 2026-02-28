import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
    const { data: schemas, error: e1 } = await supabase.from('ui_schemas').select('*').eq('table_name', 'inventory_transactions');
    if (e1 || !schemas || schemas.length === 0) {
        console.error("Schema not found or error:", e1);
        return;
    }
    const schema = schemas[0];
    
    // Fix form_config
    if (schema.form_config && schema.form_config.fields) {
        schema.form_config.fields = schema.form_config.fields.map(f => {
            if (f.key === 'quantity') return { ...f, key: 'quantity_used' };
            return f;
        });
    }

    // Fix list_config
    if (schema.list_config && schema.list_config.columns) {
        schema.list_config.columns = schema.list_config.columns.map(c => {
            if (c.key === 'quantity') return { ...c, key: 'quantity_used' };
            return c;
        });
    }

    const { error: e2 } = await supabase.from('ui_schemas').update({
        form_config: schema.form_config,
        list_config: schema.list_config
    }).eq('table_name', 'inventory_transactions');

    if (e2) console.error("Error updating:", e2);
    else console.log("inventory_transactions schema updated successfully to use quantity_used!");
}
fix();
