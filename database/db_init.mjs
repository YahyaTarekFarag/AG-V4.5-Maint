// db_init.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

console.log('=======================================');
console.log(' FSC-MAINT-APP Database Initialization');
console.log('=======================================\n');

try {
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort(); // V01, V02, etc.

    console.log('📜 Migration Sequence Detected:');
    files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file}`);
    });

    console.log('\n🚀 How to Execute:');
    console.log('--- Option 1 (Supabase CLI):');
    console.log('    Place these files in "supabase/migrations" and run:');
    console.log('    > supabase db push');

    console.log('\n--- Option 2 (Supabase Dashboard SQL Editor):');
    console.log('    Copy and paste each file exactly in the order listed above.');

    console.log('\n--- Option 3 (PSQL):');
    console.log(`    cd database/migrations`);
    let psqlCommand = files.map(f => `\\i ${f}`).join('\n    ');
    console.log('    Run PSQL and execute:');
    console.log(`    ${psqlCommand}`);

} catch (error) {
    console.error('Error reading migrations directory:', error.message);
}
