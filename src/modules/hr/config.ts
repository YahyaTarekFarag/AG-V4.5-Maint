import { SovereignSchema } from '@engine/lib/sovereign';

const MAINT_ROLES = ['admin', 'maintenance_manager', 'maintenance_supervisor'];
const OPS_ROLES = ['admin', 'brand_ops_manager', 'sector_manager', 'area_manager'];

export const HR_CONFIG: Record<string, SovereignSchema> = {
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
        supportsSoftDelete: false,
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
        selectString: '*, distance_km, allowance_earned, profiles:profile_id!inner(full_name, brand_id, sector_id, area_id, branch_id), tickets:ticket_id(asset_name, status), from_branches:from_branch_id(name), to_branches:to_branch_id(name)',
        rbacLevel: 'branch',
        directBranchColumn: 'branch_id',
        path: '/manage/technician_missions',
        roles: [...MAINT_ROLES, ...OPS_ROLES],
        supportsSoftDelete: false,
        relationships: {
            profile_id: 'profiles',
            ticket_id: 'tickets',
            from_branch_id: 'branches',
            to_branch_id: 'branches'
        },
        formatting: {
            statusLabels: {
                pending: 'معلقة',
                in_progress: 'جاري التنفيذ',
                completed: 'مكتملة',
                cancelled: 'ملغية'
            },
            statusColors: {
                pending: 'amber',
                in_progress: 'blue',
                completed: 'teal',
                cancelled: 'zinc'
            }
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
        supportsSoftDelete: false,
        relationships: {
            profile_id: 'profiles'
        }
    },
    profiles: {
        tableName: 'profiles',
        label: 'إدارة الموارد البشرية',
        description: 'إدارة بيانات الموظفين، الأدوار، والارتباطات الهيكلية بقطاعات التشغيل.',
        icon: 'Users',
        color: 'indigo',
        selectString: '*, base_daily_rate, star_bonus_rate, per_km_allowance, branches:branch_id!inner(name, area_id, areas:area_id(name, sector_id, sectors:sector_id(name, brand_id)))',
        rbacLevel: 'branch',
        directBranchColumn: 'branch_id',
        path: '/manage/profiles',
        roles: [...OPS_ROLES, 'maintenance_manager'],
        relationships: {
            brand_id: 'brands',
            sector_id: 'sectors',
            area_id: 'areas',
            branch_id: 'branches'
        },
        filterableColumns: [
            { key: 'role', label: 'الدور الوظيفي', type: 'status' },
            { key: 'branch_id', label: 'الفرع', type: 'select', dataSource: 'branches' },
            { key: 'employee_code', label: 'كود الموظف', type: 'text' }
        ]
    }
};
