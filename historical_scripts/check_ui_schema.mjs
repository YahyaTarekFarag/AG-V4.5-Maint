import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function checkSchema() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const getEnv = (key) => {
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim().replace(/['"]/g, '') : null;
    };

    const url = getEnv('VITE_SUPABASE_URL');
    const key = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');
    const supabase = createClient(url, key);

    // Try to get one row to see columns
    const { data, error } = await supabase
        .from('ui_schemas')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching ui_schemas:', error.message);
    } else {
        console.log('Columns in ui_schemas:', Object.keys(data[0] || {}));
    }
}

checkSchema();
