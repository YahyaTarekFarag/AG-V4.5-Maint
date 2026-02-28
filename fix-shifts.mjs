import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function fixShifts() {
    const shiftsListConfig = {
        title: "سجل مناوبات الفنيين",
        subtitle: "إدارة ومتابعة فترات العمل والحضور والانصراف السابقة",
        searchable: true,
        searchPlaceholder: "البحث في المناوبات...",
        columns: [
            { key: "technician_id", label: "الفني", type: "text", sortable: true },
            { key: "start_at", label: "وقت الحضور", type: "date", sortable: true },
            { key: "end_at", label: "وقت الانصراف", type: "date", sortable: true },
            { key: "created_at", label: "تاريخ الإنشاء", type: "date", sortable: true }
        ]
    };
    const shiftsFormConfig = {
        title: "تحرير مناوبة",
        fields: [
            { key: "technician_id", label: "الفني", type: "select", dataSource: "profiles", dataValue: "id", dataLabel: "full_name", required: true },
            { key: "start_at", label: "وقت الحضور", type: "date", required: true },
            { key: "end_at", label: "وقت الانصراف", type: "date" }
        ]
    };

    const { error } = await supabase.from('ui_schemas').upsert({
        table_name: 'shifts',
        list_config: shiftsListConfig,
        form_config: shiftsFormConfig
    }, { onConflict: 'table_name' });

    if (error) {
        console.error("Error fixing shifts ui_schemas:", error.message);
    } else {
        console.log("Successfully synchronized shifts ui_schemas with real DB columns.");
    }
}
fixShifts();
