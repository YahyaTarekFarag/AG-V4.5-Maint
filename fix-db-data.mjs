import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function fixDB() {
    // 1. Fix inventory_transactions 'type' column error by removing it from ui_schemas
    const { data: invSchemas, error: e1 } = await supabase.from('ui_schemas').select('*').eq('table_name', 'inventory_transactions');
    if (!e1 && invSchemas && invSchemas.length > 0) {
        const schema = invSchemas[0];
        if (schema.form_config && schema.form_config.fields) {
            schema.form_config.fields = schema.form_config.fields.filter(f => f.key !== 'type');
        }
        if (schema.list_config && schema.list_config.columns) {
            schema.list_config.columns = schema.list_config.columns.filter(c => c.field !== 'type' && c.key !== 'type');
        }
        await supabase.from('ui_schemas').update({
            form_config: schema.form_config,
            list_config: schema.list_config
        }).eq('table_name', 'inventory_transactions');
        console.log("Fixed inventory_transactions ui_schemas (removed missing 'type' column).");
    }

    // 2. Fix encoding (question marks) in system_settings ui_schema
    const systemSettingsListConfig = {
        title: "إعدادات النظام السياسية",
        subtitle: "إدارة تفضيلات النظام العامة والصلاحيات",
        searchable: true,
        searchPlaceholder: "البحث في الإعدادات...",
        columns: [
            { field: "key", label: "مفتاح الإعداد", type: "text" },
            { field: "value", label: "القيمة", type: "text" },
            { field: "updated_at", label: "تاريخ التحديث", type: "datetime" }
        ]
    };
    const systemSettingsFormConfig = {
        title: "تعديل الإعداد",
        fields: [
            { key: "key", label: "مفتاح الإعداد", type: "text", required: true, readonly: true },
            { key: "value", label: "القيمة", type: "textarea", required: true }
        ]
    };

    const { error: e2 } = await supabase.from('ui_schemas').update({
        list_config: systemSettingsListConfig,
        form_config: systemSettingsFormConfig
    }).eq('table_name', 'system_settings');

    if (e2) console.error("Error updating system_settings ui_schema:", e2);
    else console.log("Fixed system_settings ui_schemas encoding (Arabic labels restored).");

    // 3. Fix encoding (question marks) in ui_schemas ui_schema
    const uiSchemasListConfig = {
        title: "إعدادات محرك الواجهات (للمطورين)",
        subtitle: "إدارة الهيكل المرئي والنماذج الديناميكية للنظام ككل",
        searchable: true,
        searchPlaceholder: "ابحث عن اسم الجدول...",
        columns: [
            { field: "table_name", label: "اسم الجدول", type: "text" },
            { field: "created_at", label: "تاريخ الإنشاء", type: "datetime" }
        ]
    };

    const { error: e3 } = await supabase.from('ui_schemas').update({
        list_config: uiSchemasListConfig
    }).eq('table_name', 'ui_schemas');

    if (e3) console.error("Error updating ui_schemas schema representation:", e3);
    else console.log("Fixed ui_schemas ui_schemas encoding (Arabic labels restored).");

    // Check if system_settings has mangled keys/labels
    const { data: appSettings } = await supabase.from('system_settings').select('*');
    if (appSettings) {
        // If there are other columns like description_ar we should fix them, but usually they are just key/value pairs
        console.log("System Settings keys:", appSettings.map(a => a.key).join(", "));
    }
}
fixDB();
