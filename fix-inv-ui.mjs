import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function fixInventoryUI() {
    console.log("Enhancing Inventory & Transactions UI Schemas...");

    // 1. inventory_transactions improvement
    const txFormConfig = {
        title: "تسجيل حركة مخزنية",
        fields: [
            {
                key: "inventory_id",
                type: "select",
                label: "الصنف",
                required: true,
                dataSource: "inventory",
                dataValue: "id",
                dataLabel: "name"
            },
            {
                key: "transaction_type",
                type: "select",
                label: "نوع الحركة",
                required: true,
                options: [
                    { value: "deduction", label: "صرف صيانة" },
                    { value: "addition", label: "توريد/إضافة" },
                    { value: "adjustment", label: "تسوية مخزنية" },
                    { value: "return", label: "رتجاع عهدة" }
                ]
            },
            {
                key: "quantity_used",
                type: "number",
                label: "الكمية",
                required: true
            },
            {
                key: "unit_cost_at_time",
                type: "number",
                label: "التكلفة (اختياري)"
            },
            {
                key: "branch_id",
                type: "select",
                label: "الفرع",
                dataSource: "branches",
                dataValue: "id",
                dataLabel: "name"
            },
            {
                key: "notes",
                type: "textarea",
                label: "ملاحظات وتفاصيل"
            }
        ]
    };

    const { error: txError } = await supabase
        .from('ui_schemas')
        .update({ form_config: txFormConfig })
        .eq('table_name', 'inventory_transactions');

    if (txError) console.error("Error updating transactions UI:", txError.message);
    else console.log("Updated inventory_transactions UI schema.");

    // 2. inventory improvement
    const invFormConfig = {
        title: "بيانات الصنف",
        fields: [
            { key: "name", label: "اسم الصنف", type: "text", required: true },
            { key: "part_number", label: "رقم القطعة / الكود", type: "text" },
            { key: "quantity", label: "الكمية الحالية", type: "number", required: true },
            { key: "unit", label: "وحدة القياس", type: "text", placeholder: "مثال: حبة، متر، لتر" },
            { key: "unit_cost", label: "تكلفة الوحدة", type: "number" },
            { key: "branch_id", type: "select", label: "الفرع", dataSource: "branches", dataValue: "id", dataLabel: "name" }
        ]
    };

    const { error: invError } = await supabase
        .from('ui_schemas')
        .update({ form_config: invFormConfig })
        .eq('table_name', 'inventory');

    if (invError) console.error("Error updating inventory UI:", invError.message);
    else console.log("Updated inventory UI schema.");
}

fixInventoryUI();
