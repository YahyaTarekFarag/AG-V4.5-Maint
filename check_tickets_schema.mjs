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

async function checkSchema() {
    console.log('--- Tickets Table Schema ---');
    const { data, error } = await supabase.rpc('get_table_columns', { p_table_name: 'tickets' });
    if (error) {
        // Fallback to information_schema via query
        const { data: cols, error: err2 } = await supabase.from('tickets').select('*').limit(1);
        if (cols && cols.length > 0) {
            console.log('Columns found:', Object.keys(cols[0]));
        } else {
            console.log('Error getting schema:', error, err2);
        }
    } else {
        console.log('Columns:', data);
    }
}

checkSchema();
