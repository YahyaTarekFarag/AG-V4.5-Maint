import { SovereignSchema } from '@engine/lib/sovereign';

const MAINT_ROLES = ['admin', 'maintenance_manager', 'maintenance_supervisor'];
const OPS_ROLES = ['admin', 'brand_ops_manager', 'sector_manager', 'area_manager'];

export const INVENTORY_CONFIG: Record<string, SovereignSchema> = {
    inventory: {
        tableName: 'inventory',
        label: 'إدارة المخزون والمهمات',
        description: 'متابعة توافر قطع الغيار، الأدوات، والعهدة الفنية في المستودعات.',
        icon: 'Package',
        color: 'emerald',
        selectString: '*',
        rbacLevel: 'global',
        path: '/manage/inventory',
        roles: MAINT_ROLES,
        supportsSoftDelete: false,
        formatting: {
            lowStockAlert: 'quantity'
        },
        relationships: {
            branch_id: 'branches'
        },
        metrics: [
            { key: 'id', label: 'إجمالي الأصناف', type: 'count', icon: 'Package', color: 'blue' },
            { key: 'quantity', label: 'نواقص المخزون', type: 'count', filter: { low_stock: true }, color: 'rose', icon: 'AlertTriangle' }
        ]
    },
    inventory_transactions: {
        tableName: 'inventory_transactions',
        label: 'حركات قطع الغيار',
        description: 'سجل استهلاك المواد وقطع الغيار وربطها بالبلاغات الفنية والكوادر.',
        icon: 'ArrowRightLeft',
        color: 'blue',
        selectString: '*, unit_cost_at_time, inventory:inventory_id(name, unit), tickets:ticket_id(asset_name, status), profiles:technician_id(full_name), branches:branch_id(name)',
        rbacLevel: 'global',
        path: '/manage/inventory_transactions',
        roles: [...MAINT_ROLES, ...OPS_ROLES],
        supportsSoftDelete: false,
        relationships: {
            inventory_id: 'inventory',
            ticket_id: 'tickets',
            technician_id: 'profiles',
            branch_id: 'branches'
        },
        formatting: {
            statusLabels: {
                out: 'صرف (سحب)',
                in: 'توريد (إيداع)'
            },
            statusColors: {
                out: 'amber',
                in: 'teal'
            }
        }
    }
};
