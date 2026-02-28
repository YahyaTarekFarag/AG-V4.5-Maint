import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual configuration extraction as importing from TS files in Node is tricky without more setup
const MAINT_CONFIG = {
    tickets: {
        tableName: 'tickets',
        label: 'بلاغات الصيانة',
        selectString: '*, branches:branch_id!inner(name, area_id, areas:area_id(name, sector_id, sectors:sector_id(name, brand_id))), maintenance_categories:category_id(name), profiles:assigned_to(full_name)',
        rbacLevel: 'branch'
    },
    maintenance_assets: {
        tableName: 'maintenance_assets',
        label: 'الأصول والمعدات',
        selectString: '*, branches:branch_id!inner(name, area_id, areas:area_id(name, sector_id, sectors:sector_id(name, brand_id))), maintenance_categories:category_id(name)',
        rbacLevel: 'branch'
    },
    maintenance_categories: {
        tableName: 'maintenance_categories',
        label: 'تصنيفات المعدات',
        selectString: '*',
        rbacLevel: 'global'
    }
};

const HR_CONFIG = {
    technician_attendance: {
        tableName: 'technician_attendance',
        label: 'سجل مناوبات الفنيين',
        selectString: '*, profiles:profile_id!inner(full_name, employee_code, brand_id, sector_id, area_id, branch_id)',
        rbacLevel: 'branch'
    },
    technician_missions: {
        tableName: 'technician_missions',
        label: 'مهام العمل الميداني',
        selectString: '*, profiles:profile_id!inner(full_name, brand_id, sector_id, area_id, branch_id), tickets:ticket_id(asset_name, description), from_branches:from_branch_id(name), to_branches:to_branch_id(name)',
        rbacLevel: 'branch'
    },
    payroll_logs: {
        tableName: 'payroll_logs',
        label: 'السجلات المالية للرواتب',
        selectString: '*, profiles:profile_id!inner(full_name, employee_code, brand_id, sector_id, area_id, branch_id)',
        rbacLevel: 'branch'
    },
    profiles: {
        tableName: 'profiles',
        label: 'إدارة الموارد البشرية',
        selectString: '*, branches:branch_id!inner(name, area_id, areas:area_id(name, sector_id, sectors:sector_id(name, brand_id)))',
        rbacLevel: 'branch'
    }
};

const INVENTORY_CONFIG = {
    inventory: {
        tableName: 'inventory',
        label: 'إدارة المخزون والمهمات',
        selectString: '*',
        rbacLevel: 'global'
    },
    inventory_transactions: {
        tableName: 'inventory_transactions',
        label: 'حركات العهدة والمخزون',
        selectString: '*, inventory:inventory_id(name), tickets:ticket_id(asset_name), profiles:technician_id!inner(full_name, brand_id, sector_id, area_id, branch_id)',
        rbacLevel: 'branch'
    }
};

const CORE_CONFIG = {
    branches: {
        tableName: 'branches',
        label: 'إدارة الفروع والشعب',
        selectString: '*, areas:area_id!inner(name, sector_id, sectors:sector_id!inner(name, brand_id, brands:brand_id(name)))',
        rbacLevel: 'branch'
    },
    sectors: {
        tableName: 'sectors',
        label: 'القواطع التشغيلية',
        selectString: '*, brands:brand_id!inner(name)',
        rbacLevel: 'sector'
    },
    areas: {
        tableName: 'areas',
        label: 'المناطق الجغرافية',
        selectString: '*, sectors:sector_id!inner(name, brands:brand_id!inner(name))',
        rbacLevel: 'area'
    }
};

const REGISTRY = {
    ...MAINT_CONFIG,
    ...HR_CONFIG,
    ...INVENTORY_CONFIG,
    ...CORE_CONFIG
};

async function updateSchemas() {
    console.log('--- Starting UI Schemas Update (Quantum) ---');

    // Load env manually
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('Error: .env.local not found');
        return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const getEnv = (key) => {
        const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim().replace(/['"]/g, '') : null;
    };

    const url = getEnv('VITE_SUPABASE_URL');
    const key = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY');

    if (!url || !key) {
        console.error('Error: Supabase URL or Key missing in .env.local');
        return;
    }

    const supabase = createClient(url, key);

    for (const [tableName, config] of Object.entries(REGISTRY)) {
        console.log(`Updating schema for: ${tableName}...`);

        const { error } = await supabase
            .from('ui_schemas')
            .upsert({
                table_name: tableName,
                label: config.label,
                rbac_level: config.rbacLevel,
                select_string: config.selectString
            }, { onConflict: 'table_name' });

        if (error) {
            console.error(`Error updating ${tableName}:`, error.message);
        } else {
            console.log(`Successfully updated ${tableName}.`);
        }
    }

    console.log('--- UI Schemas Update Complete ---');
}

updateSchemas();
