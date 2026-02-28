import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testQuery() {
    let query = supabase
        .from('tickets')
        .select('*, branches(name, area_id), maintenance_categories(name)')
        .order('created_at', { ascending: false })
        .limit(1);

    const { data, error } = await query;
    console.log("Error:", error);
    console.log("Data count:", data ? data.length : 0);
}

testQuery();
