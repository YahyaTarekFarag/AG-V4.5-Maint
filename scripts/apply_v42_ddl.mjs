/**
 * تطبيق أوامر DDL مباشرة عبر اتصال PostgreSQL
 * يستخدم pg package للاتصال المباشر بقاعدة Supabase
 */
import pg from 'pg';
const { Client } = pg;

// Supabase Direct Connection
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
const projectRef = 'ccykgmqpyqyojuhiuztw';

const client = new Client({
    host: `aws-0-eu-central-1.pooler.supabase.com`,
    port: 6543,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password: process.env.SUPABASE_DB_PASSWORD || 'ASK_USER',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
});

// Also try the direct connection string
const client2 = new Client({
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD || 'ASK_USER',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
});

const ddlStatements = [
    // technician_missions
    "ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS mission_type TEXT DEFAULT 'field_visit'",
    "ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS description TEXT",
    "ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'",
    "ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS branch_id UUID",
    "ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false",
    // payroll_logs
    "ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS month TEXT",
    "ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false",
    // technician_attendance
    "ALTER TABLE public.technician_attendance ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE public.technician_attendance ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false",
    // inventory_transactions
    "ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS branch_id UUID",
    "ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'usage'",
    "ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false",
    // Schema reload
    "NOTIFY pgrst, 'reload schema'"
];

async function tryConnect(c, label) {
    try {
        await c.connect();
        console.log(`✅ Connected via ${label}`);
        return true;
    } catch (e) {
        console.log(`❌ ${label}: ${e.message}`);
        return false;
    }
}

async function apply() {
    console.log("🔧 === Applying V42 DDL via Direct PostgreSQL Connection ===\n");

    let activeClient = null;

    if (await tryConnect(client, 'Pooler (6543)')) {
        activeClient = client;
    } else if (await tryConnect(client2, 'Direct (5432)')) {
        activeClient = client2;
    } else {
        console.log("\n⚠️  لم يتمكن من الاتصال. يرجى تعيين SUPABASE_DB_PASSWORD في المتغيرات البيئية.");
        console.log("   يمكنك إيجاده في: Supabase Dashboard → Settings → Database → Connection string");
        console.log("   ثم تشغيل: SUPABASE_DB_PASSWORD=YOUR_PASSWORD node scripts/apply_v42_ddl.mjs");
        console.log("\n   أو الذهاب مباشرة إلى: Supabase Dashboard → SQL Editor");
        console.log("   والصق محتوى ملف: database/migrations/V42__fix_all_input_forms.sql");
        return;
    }

    let success = 0;
    let fail = 0;

    for (const sql of ddlStatements) {
        try {
            await activeClient.query(sql);
            console.log(`✅ ${sql.substring(0, 70)}...`);
            success++;
        } catch (e) {
            console.error(`❌ ${sql.substring(0, 50)}... => ${e.message}`);
            fail++;
        }
    }

    await activeClient.end();
    console.log(`\n📊 Results: ${success} succeeded, ${fail} failed`);
    console.log("✅ === DDL Applied! ===");
}

apply();
