import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function runSurgicalMigration() {
    const sql = fs.readFileSync('./database/migrations/V40__atomic_resolution_v3.sql', 'utf8');

    console.log('--- Phase 16: Applying Atomic RPC V3 ---');

    // تلميح: قد نحتاج لتعريف sovereign_execute_sql إذا لم يكن موجوداً
    // ولكن بما أنه خدمة داخلية، سنحاول استخدامه مباشرة أولاً
    const { data, error } = await supabase.rpc('sovereign_execute_sql', { sql_query: sql });

    if (error) {
        if (error.message.includes('not found')) {
            console.error('❌ Error: sovereign_execute_sql RPC is MISSING or DISABLED.');
            console.log('💡 Attempting to fall back to direct evaluation if possible (Not standard)...');
        } else {
            console.error('❌ SQL Execution Error:', error.message);
        }
        process.exit(1);
    }

    console.log('✅ Success: resolve_ticket_v3 applied successfully.');
}

runSurgicalMigration();
