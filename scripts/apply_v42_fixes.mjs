/**
 * سكريبت تطبيق إصلاحات نوافذ الإدخال V42
 * يقوم بقراءة ملف SQL وتنفيذه عبر RPC
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run(sql, label) {
    try {
        const { data, error } = await supabase.rpc('sovereign_execute_sql', { sql_query: sql });
        if (error) {
            console.error(`❌ [${label}]`, error.message);
            return false;
        }
        console.log(`✅ [${label}] done`);
        return true;
    } catch (e) {
        console.error(`❌ [${label}]`, e.message);
        return false;
    }
}

async function applyFixes() {
    console.log("🛠️ === Applying V42 Input Form Fixes ===\n");

    // 1. Add missing columns
    const alterStatements = [
        // technician_missions
        ["ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS mission_type TEXT DEFAULT 'field_visit'", "missions.mission_type"],
        ["ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS description TEXT", "missions.description"],
        ["ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'", "missions.status"],
        ["ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id)", "missions.branch_id"],
        ["ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false", "missions.is_deleted"],
        // payroll_logs
        ["ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS month TEXT", "payroll.month"],
        ["ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS notes TEXT", "payroll.notes"],
        ["ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false", "payroll.is_deleted"],
        // technician_attendance
        ["ALTER TABLE public.technician_attendance ADD COLUMN IF NOT EXISTS notes TEXT", "attendance.notes"],
        ["ALTER TABLE public.technician_attendance ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false", "attendance.is_deleted"],
        // inventory_transactions
        ["ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id)", "inv_txn.branch_id"],
        ["ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'usage'", "inv_txn.transaction_type"],
        ["ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS notes TEXT", "inv_txn.notes"],
        ["ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false", "inv_txn.is_deleted"],
    ];

    for (const [sql, label] of alterStatements) {
        await run(sql, label);
    }

    // 2. Update ui_schemas via direct Supabase client
    console.log("\n📝 === Updating UI Schemas ===\n");

    const schemas = {
        tickets: {
            list_config: {
                title: "مركز إدارة البلاغات",
                columns: [
                    { key: "title", type: "text", label: "عنوان البلاغ", sortable: true },
                    { key: "status", type: "status", label: "الحالة", sortable: true },
                    { key: "priority", type: "badge", label: "الأولوية", sortable: true },
                    { key: "asset_name", type: "text", label: "المعدة" },
                    { key: "reported_at", type: "date", label: "تاريخ البلاغ", sortable: true }
                ]
            },
            form_config: {
                title: "تفاصيل البلاغ",
                fields: [
                    { key: "title", type: "text", label: "عنوان البلاغ", required: true, placeholder: "مثال: عطل في التكييف المركزي" },
                    { key: "description", type: "textarea", label: "الوصف التفصيلي", required: true },
                    { key: "asset_name", type: "text", label: "اسم المعدة" },
                    { key: "asset_id", type: "select", label: "الأصل المرتبط", dataSource: "maintenance_assets", dataLabel: "name", dataValue: "id" },
                    { key: "category_id", type: "select", label: "تصنيف العطل", dataSource: "maintenance_categories", dataLabel: "name", dataValue: "id" },
                    {
                        key: "priority", type: "select", label: "الأولوية", required: true, options: [
                            { label: "عادية", value: "normal" }, { label: "عالية", value: "high" }, { label: "عاجلة", value: "urgent" }
                        ]
                    },
                    {
                        key: "status", type: "select", label: "الحالة", required: true, options: [
                            { label: "مفتوح", value: "open" }, { label: "مُعيّن", value: "assigned" }, { label: "جاري التنفيذ", value: "in_progress" }, { label: "تم الحل", value: "resolved" }, { label: "مغلق", value: "closed" }
                        ]
                    },
                    { key: "is_emergency", type: "checkbox", label: "بلاغ طوارئ؟" }
                ]
            }
        },
        technician_attendance: {
            list_config: {
                title: "سجل الحضور والغياب",
                columns: [
                    { key: "profile_id", type: "select", label: "الموظف", dataSource: "profiles" },
                    { key: "clock_in", type: "datetime", label: "وقت الحضور", sortable: true },
                    { key: "clock_out", type: "datetime", label: "وقت الانصراف" },
                    { key: "is_valid", type: "checkbox", label: "صالحة" }
                ]
            },
            form_config: {
                title: "تسجيل حضور يدوي",
                fields: [
                    { key: "profile_id", type: "select", label: "الموظف", required: true, dataSource: "profiles", dataLabel: "full_name", dataValue: "id" },
                    { key: "clock_in", type: "datetime", label: "وقت الدخول", required: true },
                    { key: "clock_out", type: "datetime", label: "وقت الانصراف" },
                    { key: "clock_in_lat", type: "number", label: "خط عرض الدخول" },
                    { key: "clock_in_lng", type: "number", label: "خط طول الدخول" },
                    { key: "notes", type: "textarea", label: "ملاحظات" }
                ]
            }
        },
        profiles: {
            list_config: {
                title: "شؤون الموظفين",
                columns: [
                    { key: "full_name", type: "text", label: "الاسم", sortable: true },
                    { key: "employee_code", type: "badge", label: "كود الموظف" },
                    { key: "role", type: "status", label: "الصلاحية" },
                    { key: "branch_id", type: "select", label: "الفرع", dataSource: "branches" }
                ]
            },
            form_config: {
                title: "بيانات الموظف",
                fields: [
                    { key: "full_name", type: "text", label: "الاسم الكامل", required: true },
                    { key: "employee_code", type: "text", label: "الكود الوظيفي", required: true },
                    {
                        key: "role", type: "select", label: "الدور الوظيفي", required: true, options: [
                            { label: "أدمن النظام", value: "admin" },
                            { label: "مدير العلامة التجارية", value: "brand_ops_manager" },
                            { label: "مدير القطاع", value: "sector_manager" },
                            { label: "مدير المنطقة", value: "area_manager" },
                            { label: "مدير الفرع", value: "manager" },
                            { label: "مدير الصيانة", value: "maintenance_manager" },
                            { label: "مشرف الصيانة", value: "maintenance_supervisor" },
                            { label: "فني صيانة", value: "technician" }
                        ]
                    },
                    { key: "brand_id", type: "select", label: "العلامة التجارية", dataSource: "brands", dataLabel: "name", dataValue: "id" },
                    { key: "sector_id", type: "select", label: "القطاع", dataSource: "sectors", dataLabel: "name", dataValue: "id" },
                    { key: "area_id", type: "select", label: "المنطقة", dataSource: "areas", dataLabel: "name", dataValue: "id" },
                    { key: "branch_id", type: "select", label: "الفرع", dataSource: "branches", dataLabel: "name", dataValue: "id" }
                ]
            }
        },
        inventory: {
            list_config: {
                columns: [
                    { key: "name", type: "text", label: "اسم الصنف", sortable: true },
                    { key: "part_number", type: "text", label: "رقم القطعة" },
                    { key: "quantity", type: "number", label: "الكمية المتاحة" },
                    { key: "min_quantity", type: "number", label: "حد الطلب" },
                    { key: "unit_cost", type: "number", label: "تكلفة الوحدة" }
                ]
            },
            form_config: {
                title: "بيانات الصنف المخزني",
                fields: [
                    { key: "name", type: "text", label: "اسم الصنف", required: true },
                    { key: "part_number", type: "text", label: "رقم القطعة / الكود" },
                    { key: "quantity", type: "number", label: "الكمية الحالية", required: true },
                    { key: "unit", type: "text", label: "وحدة القياس", placeholder: "مثال: حبة، متر، لتر" },
                    { key: "unit_cost", type: "number", label: "تكلفة الوحدة" },
                    { key: "min_quantity", type: "number", label: "حد الطلب الأدنى" },
                    { key: "branch_id", type: "select", label: "المستودع / الفرع", dataSource: "branches", dataLabel: "name", dataValue: "id" }
                ]
            }
        },
        inventory_transactions: {
            list_config: {
                columns: [
                    { key: "inventory_id", type: "select", label: "الصنف", dataSource: "inventory" },
                    { key: "quantity_used", type: "number", label: "الكمية" },
                    { key: "unit_cost_at_time", type: "number", label: "التكلفة" },
                    { key: "transaction_type", type: "status", label: "النوع" },
                    { key: "created_at", type: "datetime", label: "التاريخ", sortable: true }
                ]
            },
            form_config: {
                title: "حركة مخزنية جديدة",
                fields: [
                    { key: "inventory_id", type: "select", label: "الصنف", required: true, dataSource: "inventory", dataLabel: "name", dataValue: "id" },
                    { key: "ticket_id", type: "select", label: "البلاغ المرتبط", dataSource: "tickets", dataLabel: "title", dataValue: "id" },
                    { key: "technician_id", type: "select", label: "الفني المستلم", required: true, dataSource: "profiles", dataLabel: "full_name", dataValue: "id" },
                    { key: "quantity_used", type: "number", label: "الكمية المصروفة", required: true },
                    { key: "unit_cost_at_time", type: "number", label: "تكلفة الوحدة وقت الصرف" },
                    {
                        key: "transaction_type", type: "select", label: "نوع الحركة", required: true, options: [
                            { label: "صرف / استخدام", value: "usage" }, { label: "إضافة مخزون", value: "restock" }, { label: "تحويل بين مستودعات", value: "transfer" }, { label: "تسوية جردية", value: "adjustment" }
                        ]
                    },
                    { key: "notes", type: "textarea", label: "ملاحظات" }
                ]
            }
        },
        payroll_logs: {
            list_config: {
                title: "السجلات المالية للرواتب",
                columns: [
                    { key: "profile_id", type: "select", label: "الموظف", dataSource: "profiles" },
                    { key: "date", type: "date", label: "التاريخ", sortable: true },
                    { key: "base_salary", type: "number", label: "الراتب الأساسي" },
                    { key: "total_allowance", type: "number", label: "البدلات" },
                    { key: "net_earning", type: "number", label: "الصافي" },
                    { key: "is_paid", type: "checkbox", label: "مدفوع" }
                ]
            },
            form_config: {
                title: "إضافة سجل مالي",
                fields: [
                    { key: "profile_id", type: "select", label: "الموظف", required: true, dataSource: "profiles", dataLabel: "full_name", dataValue: "id" },
                    { key: "date", type: "date", label: "التاريخ", required: true },
                    { key: "base_salary", type: "number", label: "الراتب الأساسي" },
                    { key: "total_allowance", type: "number", label: "إجمالي البدلات" },
                    { key: "total_star_bonus", type: "number", label: "مكافأة التميز" },
                    { key: "net_earning", type: "number", label: "صافي الاستحقاق" },
                    { key: "is_paid", type: "checkbox", label: "تم الصرف؟" },
                    { key: "notes", type: "textarea", label: "ملاحظات" }
                ]
            }
        },
        technician_missions: {
            list_config: {
                title: "المهام والزيارات الميدانية",
                columns: [
                    { key: "profile_id", type: "select", label: "الفني", dataSource: "profiles" },
                    { key: "mission_type", type: "badge", label: "نوع المهمة" },
                    { key: "status", type: "status", label: "الحالة" },
                    { key: "distance_km", type: "number", label: "المسافة (كم)" },
                    { key: "allowance_earned", type: "number", label: "البدل المستحق" }
                ]
            },
            form_config: {
                title: "إسناد مهمة ميدانية",
                fields: [
                    { key: "profile_id", type: "select", label: "الفني المكلف", required: true, dataSource: "profiles", dataLabel: "full_name", dataValue: "id" },
                    { key: "ticket_id", type: "select", label: "البلاغ المرتبط", dataSource: "tickets", dataLabel: "title", dataValue: "id" },
                    {
                        key: "mission_type", type: "select", label: "تصنيف المهمة", options: [
                            { label: "زيارة ميدانية", value: "field_visit" }, { label: "صيانة وقائية", value: "preventive" }, { label: "نقل معدات", value: "equipment_transfer" }, { label: "تفتيش دوري", value: "inspection" }
                        ]
                    },
                    { key: "from_branch_id", type: "select", label: "من فرع", dataSource: "branches", dataLabel: "name", dataValue: "id" },
                    { key: "to_branch_id", type: "select", label: "إلى فرع", dataSource: "branches", dataLabel: "name", dataValue: "id" },
                    { key: "description", type: "textarea", label: "وصف المهمة" },
                    {
                        key: "status", type: "select", label: "الحالة", options: [
                            { label: "معلقة", value: "pending" }, { label: "جاري التنفيذ", value: "in_progress" }, { label: "مكتملة", value: "completed" }, { label: "ملغية", value: "cancelled" }
                        ]
                    }
                ]
            }
        }
    };

    for (const [tableName, config] of Object.entries(schemas)) {
        const { error } = await supabase
            .from('ui_schemas')
            .update(config)
            .eq('table_name', tableName);

        if (error) console.error(`❌ [ui_schemas: ${tableName}]`, error.message);
        else console.log(`✅ [ui_schemas: ${tableName}] updated`);
    }

    // 3. Notify PostgREST to reload schema cache
    console.log("\n🚀 === Reloading Schema Cache ===");
    await run("NOTIFY pgrst, 'reload schema'", "Schema Cache Reload");

    console.log("\n✅ === All fixes applied! ===");
}

applyFixes();
