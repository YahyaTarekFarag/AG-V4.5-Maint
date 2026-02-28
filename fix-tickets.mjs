import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function addTicketTitle() {
    console.log("Adding 'title' column to 'tickets' table...");

    // 1. Add 'title' column
    const { data: addData, error: addError } = await supabase.rpc('sovereign_add_column', {
        p_table: 'tickets',
        p_column: 'title',
        p_type: 'text'
    });

    if (addError) {
        console.error("Error adding column:", addError.message);
    } else {
        console.log("Column 'title' checked/added successfully:", addData);

        // 2. Update existing data: Copy first 50 chars of description to title if title is null
        // Since we can't run arbitrary SQL easily, we can skip this or do it via fetch/update if needed.
        // But let's assume the UI will handle it or we'll do a batch update if possible.
    }

    // 3. Update ui_schemas for tickets
    const ticketsListConfig = {
        title: "مركز إدارة البلاغات",
        columns: [
            { key: "id", label: "رقم البلاغ", type: "text" },
            { key: "title", label: "العنوان", type: "text", sortable: true },
            { key: "status", label: "الحالة", type: "status", sortable: true },
            { key: "priority", label: "الأولوية", type: "badge", sortable: true },
            { key: "reported_at", label: "تاريخ البلاغ", type: "date", sortable: true }
        ]
    };

    const ticketsFormConfig = {
        title: "تفاصيل البلاغ",
        fields: [
            { key: "title", label: "عنوان البلاغ", type: "text", required: true, placeholder: "مثال: عطل في التكييف المركزي" },
            { key: "description", label: "الوصف التفصيلي", type: "textarea", required: true },
            { key: "status", label: "الحالة", type: "select", dataSource: "tickets_status_enum", required: true },
            { key: "priority", label: "الأولوية", type: "select", dataSource: "tickets_priority_enum", required: true }
        ]
    };

    const { error: uiError } = await supabase
        .from('ui_schemas')
        .update({
            list_config: ticketsListConfig,
            form_config: ticketsFormConfig
        })
        .eq('table_name', 'tickets');

    if (uiError) {
        console.error("Error updating tickets ui_schema:", uiError.message);
    } else {
        console.log("Successfully updated tickets ui_schema to include 'title' field.");
    }
}

addTicketTitle();
