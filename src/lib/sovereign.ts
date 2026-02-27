
/**
 * Sovereign Engine V11 - Centralized Schema Registry
 * This registry defines table metadata used by useSovereign and SovereignTable.
 */

export interface SovereignSchema {
    tableName: string;
    label: string;
    description?: string;
    icon?: string; // Lucide icon name
    color?: string; // Brand color (hex or tailwind class)
    selectString: string;
    rbacLevel: 'branch' | 'area' | 'sector' | 'brand' | 'global';
    directBranchColumn?: string;
    path: string;
    roles: string[];
    relationships?: Record<string, string>; // Maps column_id to registry table key (e.g., branch_id -> branches)
    actions?: {
        key: string;
        label: string;
        icon: string;
        color: string;
        condition?: (row: any) => boolean;
        isAssignMode?: boolean; // Specialized flag for the assignment workflow
    }[];
    formatting?: {
        statusColors?: Record<string, string>;
        statusLabels?: Record<string, string>;
        lowStockAlert?: string; // column key
    };
    filterableColumns?: {
        key: string;
        label: string;
        type: 'select' | 'date' | 'text' | 'status';
        dataSource?: string; // For select/relationship filters
    }[];
    metrics?: {
        label: string;
        key: string; // column to filter on
        type: 'count' | 'sum' | 'avg';
        filter?: Record<string, any>; // static filter for this metric
        color?: 'amber' | 'blue' | 'teal' | 'rose' | 'indigo' | 'zinc' | 'purple' | 'emerald';
        icon?: string;
    }[];
}

const MAINT_ROLES = ['admin', 'maint_manager', 'maint_supervisor'];
const OPS_ROLES = ['admin', 'brand_ops_manager', 'sector_manager', 'area_manager'];

export const SOVEREIGN_REGISTRY: Record<string, SovereignSchema> = {
    tickets: {
        tableName: 'tickets',
        label: 'سجل البلاغات والأعطال',
        description: 'متابعة وإدارة كافة بلاغات الأعطال الفنية والصيانة من كافة الفروع حتى إتمام الإصلاح.',
        icon: 'Ticket',
        color: 'blue',
        selectString: '*, branches:branch_id(name, area_id, areas:area_id(name, sector_id, sectors:sector_id(name, brand_id))), manager:manager_id(full_name), assigned_to_profile:assigned_to(full_name), maintenance_assets:asset_id(name), maintenance_categories:category_id(name), reporter_name, reporter_job, reporter_phone, breakdown_time',
        rbacLevel: 'branch',
        directBranchColumn: 'branch_id',
        path: '/manage/tickets',
        roles: [...MAINT_ROLES, ...OPS_ROLES],
        relationships: {
            branch_id: 'branches',
            area_id: 'areas',
            sector_id: 'sectors',
            brand_id: 'brands',
            category_id: 'maintenance_categories',
            asset_id: 'maintenance_assets',
            assigned_to: 'profiles',
            manager_id: 'profiles'
        },
        actions: [
            {
                key: 'assign',
                label: 'تعيين فني للإصلاح',
                icon: 'UserPlus',
                color: 'purple',
                condition: (row) => row.status === 'open' || row.status === 'assigned',
                isAssignMode: true
            }
        ],
        formatting: {
            statusColors: {
                open: 'amber',
                assigned: 'blue',
                in_progress: 'purple',
                resolved: 'teal',
                closed: 'zinc'
            },
            statusLabels: {
                open: 'بلاغ جديد',
                assigned: 'تم الإسناد للفني',
                in_progress: 'قيد الإصلاح',
                resolved: 'تم الإصلاح - بانتظار الاعتماد',
                closed: 'بلاغ مُغلق'
            }
        },
        filterableColumns: [
            { key: 'status', label: 'حالة البلاغ', type: 'status' },
            { key: 'branch_id', label: 'الفرع', type: 'select', dataSource: 'branches' },
            { key: 'assigned_to', label: 'الفني المكلّف', type: 'select', dataSource: 'profiles' },
            { key: 'priority', label: 'الأولوية', type: 'status' },
            { key: 'created_at', label: 'تاريخ البلاغ', type: 'date' }
        ],
        metrics: [
            { key: 'id', label: 'إجمالي البلاغات', type: 'count', icon: 'Ticket', color: 'blue' },
            { key: 'status', label: 'بلاغات جديدة', type: 'count', filter: { status: 'open' }, color: 'amber', icon: 'AlertCircle' },
            { key: 'status', label: 'تحت الإصلاح', type: 'count', filter: { status: 'in_progress' }, color: 'purple', icon: 'Wrench' },
            { key: 'status', label: 'بانتظار الاعتماد', type: 'count', filter: { status: 'resolved' }, color: 'teal', icon: 'CheckCircle2' }
        ]
    },
    maintenance_assets: {
        tableName: 'maintenance_assets',
        label: 'إدارة الأصول والمعدات',
        description: 'قاعدة بيانات شاملة لكافة الأجهزة والمعدات والأصول الفنية في كافة الفروع.',
        icon: 'Box',
        color: 'blue',
        selectString: '*, branches:branch_id(name, area_id, areas:area_id(name, sector_id, sectors:sector_id(name, brand_id))), maintenance_categories:category_id(name)',
        rbacLevel: 'branch',
        directBranchColumn: 'branch_id',
        path: '/manage/maintenance_assets',
        roles: [...MAINT_ROLES, ...OPS_ROLES],
        relationships: {
            branch_id: 'branches',
            category_id: 'maintenance_categories'
        },
        filterableColumns: [
            { key: 'branch_id', label: 'الفرع', type: 'select', dataSource: 'branches' },
            { key: 'category_id', label: 'التصنيف الفني', type: 'select', dataSource: 'maintenance_categories' }
        ],
        metrics: [
            { key: 'id', label: 'إجمالي الأصول', type: 'count', icon: 'Box', color: 'blue' },
            { key: 'category_id', label: 'أصول تقنية', type: 'count', filter: { category_id: 'e6a8d67c-1234-5678-90ab-cdef12345678' }, color: 'indigo', icon: 'Cpu' }
        ]
    },
    branches: {
        tableName: 'branches',
        label: 'قائمة الفروع',
        description: 'إدارة بيانات المواقع الجغرافية للفروع ونطاق التغطية التشغيلية.',
        icon: 'Store',
        color: 'emerald',
        selectString: '*, areas:area_id(name, sector_id, sectors:sector_id(name, brand_id, brands:brand_id(name)))',
        rbacLevel: 'area', // or specific branch if filtered
        directBranchColumn: 'id',
        path: '/manage/branches',
        roles: OPS_ROLES,
        relationships: {
            area_id: 'areas'
        }
    },
    profiles: {
        tableName: 'profiles',
        label: 'إدارة الموارد البشرية',
        description: 'إدارة بيانات الموظفين، الأدوار، والارتباطات الهيكلية بقطاعات التشغيل.',
        icon: 'Users',
        color: 'indigo',
        selectString: '*, brands:brand_id(name), sectors:sector_id(name), areas:area_id(name), branches:branch_id(name)',
        rbacLevel: 'branch',
        directBranchColumn: 'branch_id',
        path: '/manage/profiles',
        roles: [...OPS_ROLES, 'maint_manager'],
        relationships: {
            brand_id: 'brands',
            sector_id: 'sectors',
            area_id: 'areas',
            branch_id: 'branches'
        },
        filterableColumns: [
            { key: 'role', label: 'الدور الوظيفي', type: 'status' },
            { key: 'branch_id', label: 'الفرع', type: 'select', dataSource: 'branches' }
        ]
    },
    sectors: {
        tableName: 'sectors',
        label: 'قطاعات التشغيل',
        description: 'الهيكل التنظيمي الرئيسي لإدارة العلامات التجارية والأنشطة الكبرى.',
        icon: 'Layers',
        color: 'rose',
        selectString: '*, brands:brand_id(name)',
        rbacLevel: 'brand',
        directBranchColumn: 'brand_id',
        path: '/manage/sectors',
        roles: ['admin', 'brand_ops_manager'],
        relationships: {
            brand_id: 'brands'
        }
    },
    areas: {
        tableName: 'areas',
        label: 'المناطق التشغيلية',
        description: 'إدارة النطاقات الجغرافية والمناطق التي تشرف على الفروع وتتبع القطاعات.',
        icon: 'Map',
        color: 'amber',
        selectString: '*, sectors:sector_id(name, brands:brand_id(name))',
        rbacLevel: 'sector',
        directBranchColumn: 'sector_id',
        path: '/manage/areas',
        roles: ['admin', 'brand_ops_manager', 'sector_manager'],
        relationships: {
            sector_id: 'sectors'
        }
    },
    maintenance_categories: {
        tableName: 'maintenance_categories',
        label: 'تصنيفات الأعطال',
        description: 'توزيع التخصصات الفنية (كهرباء، سباكة، معدات) لضمان دقة الإسناد.',
        icon: 'Tags',
        color: 'zinc',
        selectString: '*',
        rbacLevel: 'global',
        path: '/manage/maintenance_categories',
        roles: MAINT_ROLES
    },
    technician_attendance: {
        tableName: 'technician_attendance',
        label: 'سجل مناوبات الفنيين',
        description: 'متابعة الحضور والانصراف المباشر للفنيين وتتبع الموقع الجغرافي النشط.',
        icon: 'Clock',
        color: 'purple',
        selectString: '*, profiles:profile_id!inner(full_name, employee_code, brand_id, sector_id, area_id, branch_id)',
        rbacLevel: 'branch',
        directBranchColumn: 'branch_id',
        path: '/manage/technician_attendance',
        roles: [...MAINT_ROLES, ...OPS_ROLES],
        relationships: {
            profile_id: 'profiles'
        }
    },
    technician_missions: {
        tableName: 'technician_missions',
        label: 'مهام العمل الميداني',
        description: 'تتبع الزيارات الميدانية، الصيانة الوقائية، والمهام التي تتم خارج نطاق البلاغات.',
        icon: 'MapPin',
        color: 'blue',
        selectString: '*, profiles:profile_id!inner(full_name, brand_id, sector_id, area_id, branch_id), tickets:ticket_id(asset_name, description), from_branches:from_branch_id(name), to_branches:to_branch_id(name)',
        rbacLevel: 'branch',
        directBranchColumn: 'branch_id',
        path: '/manage/technician_missions',
        roles: [...MAINT_ROLES, ...OPS_ROLES],
        relationships: {
            profile_id: 'profiles',
            ticket_id: 'tickets',
            from_branch_id: 'branches',
            to_branch_id: 'branches'
        }
    },
    payroll_logs: {
        tableName: 'payroll_logs',
        label: 'السجلات المالية للرواتب',
        description: 'إدارة المستحقات المالية، الحوافز، وتقييم الأداء الشهري للفنيين.',
        icon: 'CreditCard',
        color: 'emerald',
        selectString: '*, profiles:profile_id!inner(full_name, employee_code, brand_id, sector_id, area_id, branch_id)',
        rbacLevel: 'branch',
        directBranchColumn: 'branch_id',
        path: '/manage/payroll_logs',
        roles: [...MAINT_ROLES, ...OPS_ROLES],
        relationships: {
            profile_id: 'profiles'
        }
    },
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
        formatting: {
            lowStockAlert: 'quantity'
        },
        metrics: [
            { key: 'id', label: 'إجمالي الأصناف', type: 'count', icon: 'Package', color: 'blue' },
            { key: 'quantity', label: 'نواقص المخزون', type: 'count', filter: { quantity: 10 }, color: 'rose', icon: 'AlertTriangle' }
        ]
    },
    inventory_transactions: {
        tableName: 'inventory_transactions',
        label: 'حركات العهدة والمخزون',
        description: 'تتبع حركة قطع الغيار بين الفنيين والمخازن وربطها بلاغات الإصلاح.',
        icon: 'Repeat',
        color: 'blue',
        selectString: '*, inventory:inventory_id(name), tickets:ticket_id(asset_name), profiles:technician_id!inner(full_name, brand_id, sector_id, area_id, branch_id)',
        rbacLevel: 'branch',
        directBranchColumn: 'branch_id',
        path: '/manage/inventory_transactions',
        roles: [...MAINT_ROLES, ...OPS_ROLES],
        relationships: {
            inventory_id: 'inventory',
            ticket_id: 'tickets',
            technician_id: 'profiles'
        }
    }
};
