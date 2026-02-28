import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function applyMigration() {
    const migrationPath = './database/migrations/V38__fix_schema_mismatches.sql';
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`Applying migration: ${migrationPath}`);

    // The RPC might not support multi-statement blocks easily if not wrapped in DO $$ or similar,
    // but our V38 uses DO $$ for logic. Let's try sending it over.

    const { data, error } = await supabase.rpc('sovereign_execute_sql', { sql_query: sql });

    if (error) {
        console.error("Migration Failed:", error.message);
        process.exit(1);
    } else {
        console.log("Migration Success!");
    }
}

applyMigration();
