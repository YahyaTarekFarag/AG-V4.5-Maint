import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function updateSchema(tableName, newFields) {
    console.log(`Updating UI Schema for ${tableName}...`);
    // Get existing schema
    const { data: schema, error: fetchError } = await supabase
        .from('ui_schemas')
        .select('*')
        .eq('table_name', tableName)
        .single();

    if (fetchError) {
        console.error(`❌ Schema not found for ${tableName}`);
        return;
    }

    const updatedFormFields = [...schema.form_config.fields];

    newFields.forEach(nf => {
        if (!updatedFormFields.some(f => f.key === nf.key)) {
            updatedFormFields.push(nf);
        }
    });

    const { error: updateError } = await supabase
        .from('ui_schemas')
        .update({
            form_config: { ...schema.form_config, fields: updatedFormFields }
        })
        .eq('id', schema.id);

    if (updateError) console.error(`❌ Failed to update ${tableName} schema:`, updateError.message);
    else console.log(`✅ Success: ${tableName} UI Schema updated.`);
}

async function run() {
    // 1. Inventory
    await updateSchema('inventory', [
        { key: 'branch_id', label: 'الفرع', type: 'select', dataSource: 'branches', required: true },
        { key: 'min_stock_level', label: 'الحد الأدنى للمخزون', type: 'number', required: true }
    ]);

    // 2. Maintenance Categories
    await updateSchema('maintenance_categories', [
        { key: 'description', label: 'الوصف التفصيلي', type: 'textarea' }
    ]);

    // 3. Payroll Logs
    await updateSchema('payroll_logs', [
        { key: 'amount', label: 'المبلغ', type: 'number', required: true },
        { key: 'month', label: 'الشهر', type: 'text', placeholder: 'YYYY-MM', required: true },
        { key: 'notes', label: 'ملاحظات', type: 'textarea' }
    ]);

    console.log('--- UI Schema Updates Complete ---');
}

run();
