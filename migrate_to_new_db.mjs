import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ivvsdbzbhbiabjebiggs.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2dnNkYnpiaGJpYWJqZWJpZ2dzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc5NDc1NywiZXhwIjoyMDg3MzcwNzU3fQ.5r5AD7D-c98WmybTs-g_qtyqrEgn2KNOPOg9hSzMJwA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
    console.log('🚀 Starting Intelligent Data Migration V2...');

    // 1. Load backup data
    const backupPath = path.join(process.cwd(), 'backups', 'v0.0_pre_restructure', 'full_backup.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

    // 2. Define Table Order (Dependency order)
    const order = ['brands', 'sectors', 'areas', 'branches', 'profiles', 'inventory', 'tickets', 'inventory_transactions', 'shifts', 'ui_schemas', 'system_settings'];

    // 3. V11 Schema Whitelist & Mappings
    const v11Schema = {
        brands: ['id', 'name', 'is_deleted', 'created_at'],
        sectors: ['id', 'name', 'brand_id', 'is_deleted', 'created_at'],
        areas: ['id', 'name', 'sector_id', 'is_deleted', 'created_at'],
        branches: ['id', 'name', 'br_tel', 'area_id', 'latitude', 'longitude', 'restrict_branch_submission', 'is_active', 'created_at'],
        profiles: ['id', 'employee_code', 'full_name', 'role', 'brand_id', 'sector_id', 'area_id', 'branch_id', 'created_at'],
        tickets: ['id', 'asset_name', 'description', 'priority', 'status', 'branch_id', 'assigned_to', 'reported_by', 'reported_lat', 'reported_lng', 'started_lat', 'started_lng', 'resolved_lat', 'resolved_lng', 'resolved_at', 'rating_score', 'rating_comment', 'created_at'],
        inventory: ['id', 'item_name', 'sku', 'quantity', 'unit', 'min_threshold', 'last_restocked'],
        inventory_transactions: ['id', 'item_id', 'ticket_id', 'technician_id', 'type', 'quantity', 'reason', 'created_at'],
        ui_schemas: ['table_name', 'list_config', 'form_config', 'updated_at'],
        system_settings: ['key', 'value', 'description', 'updated_at'],
        shifts: ['id', 'technician_id', 'start_time', 'end_time', 'status', 'created_at']
    };

    for (const tableName of order) {
        if (!backup[tableName] || backup[tableName].length === 0) continue;

        console.log(`\n📦 Migrating: ${tableName} (${backup[tableName].length} rows)`);

        const validCols = v11Schema[tableName];
        const rows = backup[tableName];

        const processedRows = rows.map(originalRow => {
            const cleanRow = {};

            // --- MAPPINGS ---
            if (tableName === 'inventory') {
                if (originalRow.name) originalRow.item_name = originalRow.name;
                if (originalRow.part_number) originalRow.sku = originalRow.part_number;
            }
            if (tableName === 'shifts') {
                if (originalRow.start_at) originalRow.start_time = originalRow.start_at;
                if (originalRow.end_at) originalRow.end_time = originalRow.end_at;
            }
            if (tableName === 'ui_schemas' && originalRow.created_at) originalRow.updated_at = originalRow.created_at;
            if (tableName === 'system_settings' && originalRow.id) originalRow.key = originalRow.key || originalRow.id;

            // --- WHITENING ---
            validCols.forEach(col => {
                if (originalRow[col] !== undefined) {
                    cleanRow[col] = originalRow[col];
                }
            });
            return cleanRow;
        });

        const { error } = await supabase.from(tableName).upsert(processedRows, { onConflict: (tableName === 'ui_schemas' ? 'table_name' : (tableName === 'system_settings' ? 'key' : 'id')) });

        if (error) {
            if (error.message.includes('violates foreign key constraint')) {
                console.warn(`     ⚠️  FK Warning in ${tableName}: Data migrated partially or skipped due to missing references (Users/Auth).`);
                console.warn(`        Details: ${error.message}`);
            } else {
                console.error(`     ❌ Error: ${error.message}`);
            }
        } else {
            console.log(`     ✅ Successfully Migrated Rows`);
        }
    }

    console.log('\n🏁 Intelligent Migration Complete!');
}

main().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
