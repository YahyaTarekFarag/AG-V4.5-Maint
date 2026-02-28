import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function extractTruth() {
    const dna = {};

    console.log("Listing all tables...");
    const { data: tables, error: tableError } = await supabase.rpc('sovereign_list_tables');

    if (tableError) {
        console.error("Failed to list tables:", tableError.message);
        return;
    }

    for (const t of tables) {
        const tableName = t.table_name;
        console.log(`Extracting columns for [${tableName}]...`);
        const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { p_table_name: tableName });

        if (colError) {
            console.error(`Error fetching columns for ${tableName}:`, colError.message);
            dna[tableName] = { error: colError.message };
        } else {
            dna[tableName] = cols;
        }
    }

    fs.writeFileSync('database_dna_reality.json', JSON.stringify(dna, null, 2));
    console.log("Truth Extracted: database_dna_reality.json");
}

extractTruth();
