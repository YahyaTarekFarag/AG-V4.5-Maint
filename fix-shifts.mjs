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
            { field: "profile_id", label: "الفني", type: "text" },
            { field: "clock_in", label: "وقت الحضور", type: "datetime" },
            { field: "clock_out", label: "وقت الانصراف", type: "datetime" },
            { field: "created_at", label: "تاريخ الإنشاء", type: "datetime" }
        ]
    };
    const shiftsFormConfig = {
        title: "تحرير مناوبة",
        fields: [
            { key: "profile_id", label: "الفني", type: "select", dataSource: "profiles", required: true },
            { key: "clock_in", label: "وقت الحضور", type: "datetime", required: true },
            { key: "clock_out", label: "وقت الانصراف", type: "datetime" }
        ]
    };

    await supabase.from('ui_schemas').update({
        list_config: shiftsListConfig,
        form_config: shiftsFormConfig
    }).eq('table_name', 'shifts');

    console.log("Fixed shifts ui_schemas encoding.");
}
fixShifts();
