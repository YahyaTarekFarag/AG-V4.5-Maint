import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
        const parts = line.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        env[key] = val;
    }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking connection with anon key to URL:", supabaseUrl);
    const { data, error } = await supabase.from('ui_schemas').select('table_name');
    if (error) {
        console.error("Error accessing ui_schemas:", error);
    } else {
        console.log("Success! Found", data?.length || 0, "schemas.");
        if (data && data.length > 0) {
            console.log("Schemas:", data.map(d => d.table_name).join(', '));
        } else {
            console.log("The ui_schemas table is EMPTY.");
        }
    }
}

check();
