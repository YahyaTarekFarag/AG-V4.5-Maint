import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL (e.g., https://xxxxx.supabase.co -> xxxxx)
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

const ddlStatements = [
    "ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS mission_type TEXT DEFAULT 'field_visit';",
    "ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS description TEXT;",
    "ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';",
    "ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS branch_id UUID;",
    "ALTER TABLE public.technician_missions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;",
    "ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS month TEXT;",
    "ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS notes TEXT;",
    "ALTER TABLE public.payroll_logs ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;",
    "ALTER TABLE public.technician_attendance ADD COLUMN IF NOT EXISTS notes TEXT;",
    "ALTER TABLE public.technician_attendance ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;",
    "ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS branch_id UUID;",
    "ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'usage';",
    "ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS notes TEXT;",
    "ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;",
    "NOTIFY pgrst, 'reload schema';"
];

// Combine all DDL into one batch
const batchSQL = ddlStatements.join('\n');

async function applyViaREST() {
    console.log("🔧 === Applying DDL via Supabase REST (pg/query) ===\n");
    console.log(`Project: ${projectRef}`);

    // Method 1: Try direct SQL via PostgREST rpc with a new DDL function
    // First create the DDL function
    const createFnSQL = `
        CREATE OR REPLACE FUNCTION public.exec_ddl(sql text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $fn$
        BEGIN
            EXECUTE sql;
        END;
        $fn$;
    `;

    // Try to create DDL function via PostgREST
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sovereign_execute_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                sql_query: `SELECT 1 as test`
            })
        });
        const data = await res.json();
        console.log("Connection test:", res.ok ? "✅ Connected" : "❌ Failed", JSON.stringify(data).substring(0, 100));
    } catch (e) {
        console.error("Connection failed:", e.message);
        return;
    }

    // Try each DDL via rpc/exec_ddl  
    for (const ddl of ddlStatements) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_ddl`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SERVICE_KEY,
                    'Authorization': `Bearer ${SERVICE_KEY}`
                },
                body: JSON.stringify({ sql: ddl })
            });
            if (res.ok) {
                console.log(`✅ ${ddl.substring(0, 70)}`);
            } else {
                const err = await res.json();
                console.error(`❌ ${ddl.substring(0, 50)}... =>`, err.message || JSON.stringify(err).substring(0, 100));
            }
        } catch (e) {
            console.error(`❌ ${ddl.substring(0, 50)}... =>`, e.message);
        }
    }

    console.log("\n✅ Done. If DDL failed, run V42 migration file from Supabase Dashboard SQL Editor.");
}

applyViaREST();
