import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .reduce((acc, line) => {
        const [key, value] = line.split('=');
        if (key && value) acc[key.trim()] = value.trim();
        return acc;
    }, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
    console.log('--- Migrating tickets table for financial fields ---');

    const sql = `
        ALTER TABLE tickets 
        ADD COLUMN IF NOT EXISTS parts_cost NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS parts_used JSONB DEFAULT '[]'::jsonb;

        -- Create a trigger to auto-calculate total_cost if needed, 
        -- but we can also handle it in the UI/RPC for simplicity.
        -- Let's add a generated column if supported or just a simple update.
        COMMENT ON COLUMN tickets.parts_used IS 'Detailed list of parts used: [{name, qty, cost_unit, total}]';
    `;

    // Execute via RPC if available or we might need a different approach.
    // Since we don't have a generic "execute SQL" RPC usually, we'll use a script that
    // uses the supabase client to check if columns exist, then we can't really "alter table" 
    // without a dedicated RPC. 
    // I will try to call a pre-existing RPC 'exec_sql' if it exists, or provide the SQL to the user.

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Migration failed via RPC:', error);
        console.log('Please apply the following SQL manualy in Supabase SQL Editor:');
        console.log(sql);
    } else {
        console.log('Migration successful!');
    }
}

migrate();
villages
