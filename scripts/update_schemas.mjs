import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function updateUiSchemas() {
    console.log("--- 🛠️ UPDATING UI SCHEMAS ---");

    // 1. Update Inventory Schema
    const inventoryUpdate = {
        list_config: {
            columns: [
                { key: "name", type: "text", label: "اسم الصنف", sortable: true },
                { key: "quantity", type: "number", label: "الكمية المتاحة" },
                { key: "min_quantity", type: "number", label: "حد الطلب" }
            ]
        },
        form_config: {
            title: "بيانات الصنف",
            fields: [
                { key: "name", type: "text", label: "اسم الصنف", required: true },
                { key: "part_number", type: "text", label: "رقم القطعة / الكود" },
                { key: "quantity", type: "number", label: "الكمية الحالية", required: true },
                { key: "unit", type: "text", label: "وحدة القياس", placeholder: "مثال: حبة، متر، لتر" },
                { key: "unit_cost", type: "number", label: "تكلفة الوحدة" },
                { key: "branch_id", type: "select", label: "الفرع", dataLabel: "name", dataValue: "id", dataSource: "branches" }
            ]
        }
    };

    const { error: invError } = await supabase
        .from('ui_schemas')
        .update(inventoryUpdate)
        .eq('table_name', 'inventory');

    if (invError) console.error("❌ Error updating inventory schema:", invError);
    else console.log("✅ Inventory schema updated successfully.");

    // 2. Refresh PostgREST Cache (if possible via RPC, otherwise manual)
    await supabase.rpc('sovereign_execute_sql', {
        sql_query: "NOTIFY pgrst, 'reload schema';"
    });
    console.log("🚀 Schema reload notification sent.");
}

updateUiSchemas();
