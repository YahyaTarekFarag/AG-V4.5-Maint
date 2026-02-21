/**
 * FSC-MAINT-APP — Full Supabase Database Backup Script
 * Pulls ALL data from ALL tables and saves as JSON + SQL restore script
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ccykgmqpyqyojuhiuztw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeWtnbXFweXF5b2p1aGl1enR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYzOTU1MCwiZXhwIjoyMDg3MjE1NTUwfQ.nKHZhnjao4SeQpma0gRfPPJX-1wC10Xv-5JjA0rKoF4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
    'profiles',
    'brands',      // may not exist yet
    'sectors',     // may not exist yet
    'areas',       // may not exist yet
    'branches',
    'inventory',
    'tickets',
    'inventory_transactions',
    'shifts',
    'ui_schemas',
    'system_settings',
    'maintenance_assets', // may not exist
];

const BACKUP_DIR = path.join(process.cwd(), 'backups', 'v0.0_pre_restructure');

async function main() {
    console.log('🔄 Starting Full Database Backup...');
    console.log(`📂 Backup directory: ${BACKUP_DIR}`);

    // Create backup directory
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const fullBackup = {};
    const sqlLines = [
        '-- ==========================================',
        '-- FSC-MAINT-APP Full Database Backup',
        `-- Generated: ${new Date().toISOString()}`,
        '-- Tag: v0.0-backup (Pre-Restructuring)',
        '-- ==========================================',
        '',
    ];

    for (const tableName of TABLES) {
        console.log(`  📋 Pulling table: ${tableName}...`);
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*');

            if (error) {
                if (error.message.includes('does not exist') || error.code === '42P01' || error.message.includes('relation')) {
                    console.log(`     ⚠️  Table "${tableName}" does not exist — skipped.`);
                    continue;
                }
                console.log(`     ❌ Error: ${error.message}`);
                continue;
            }

            const rows = data || [];
            fullBackup[tableName] = rows;
            console.log(`     ✅ ${rows.length} rows`);

            // Generate SQL INSERT statements
            if (rows.length > 0) {
                sqlLines.push(`-- Table: ${tableName} (${rows.length} rows)`);
                sqlLines.push(`-- Columns: ${Object.keys(rows[0]).join(', ')}`);

                for (const row of rows) {
                    const cols = Object.keys(row);
                    const vals = cols.map(c => {
                        const v = row[c];
                        if (v === null || v === undefined) return 'NULL';
                        if (typeof v === 'number') return String(v);
                        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
                        if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
                        return `'${String(v).replace(/'/g, "''")}'`;
                    });
                    sqlLines.push(`INSERT INTO public.${tableName} (${cols.join(', ')}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING;`);
                }
                sqlLines.push('');
            }
        } catch (e) {
            console.log(`     ❌ Exception on "${tableName}": ${e.message}`);
        }
    }

    // Also backup the column structure
    console.log('\n  📐 Pulling table column info...');
    try {
        const { data: columns } = await supabase.rpc('get_table_columns_info');
        if (columns) {
            fullBackup['__schema_columns__'] = columns;
            console.log(`     ✅ ${columns.length} columns found`);
        }
    } catch {
        // Try direct information_schema query via REST
        console.log('     ℹ️  RPC not available, schema info will be inferred from data.');
    }

    // Save JSON
    const jsonPath = path.join(BACKUP_DIR, 'full_backup.json');
    fs.writeFileSync(jsonPath, JSON.stringify(fullBackup, null, 2), 'utf-8');
    console.log(`\n💾 JSON backup saved: ${jsonPath}`);

    // Save SQL
    const sqlPath = path.join(BACKUP_DIR, 'restore_data.sql');
    fs.writeFileSync(sqlPath, sqlLines.join('\n'), 'utf-8');
    console.log(`💾 SQL backup saved: ${sqlPath}`);

    // Summary
    const tableCount = Object.keys(fullBackup).filter(k => !k.startsWith('__')).length;
    const totalRows = Object.values(fullBackup)
        .filter(v => Array.isArray(v))
        .reduce((sum, arr) => sum + arr.length, 0);

    console.log(`\n✅ Backup Complete!`);
    console.log(`   📊 Tables backed up: ${tableCount}`);
    console.log(`   📝 Total rows: ${totalRows}`);
    console.log(`   📂 Location: ${BACKUP_DIR}`);
}

main().catch(err => {
    console.error('❌ Backup failed:', err);
    process.exit(1);
});
