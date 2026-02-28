import { SovereignSchema } from '@engine/lib/sovereign';

const MAINT_ROLES = ['admin', 'maintenance_manager', 'maintenance_supervisor'];
const OPS_ROLES = ['admin', 'brand_ops_manager', 'sector_manager', 'area_manager'];

export const MAINT_CONFIG: Record<string, SovereignSchema> = {
    tickets: {
        tableName: 'tickets',
        label: 'سجل البلاغات والأعطال',
        description: 'متابعة وإدارة كافة بلاغات الأعطال الفنية والصيانة من كافة الفروع حتى إتمام الإصلاح.',
        icon: 'Ticket',
        color: 'blue',
        selectString: '*, branches:branch_id!inner(name, area_id, areas:area_id(name, sector_id, sectors:sector_id(name, brand_id))), manager:manager_id(full_name), assigned_to_profile:assigned_to(full_name), maintenance_assets:asset_id(name), maintenance_categories:category_id(name), reporter_name, reporter_job, reporter_phone, breakdown_time',
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
                key: 'ops_view',
                label: 'غرفة العمليات (التفاصيل)',
                icon: 'Wrench',
                color: 'blue',
                condition: () => true,
                isAssignMode: false,
                onClick: () => { window.location.href = '/my-tickets'; }
            },
            {
                key: 'assign',
                label: 'تعيين فني للإصلاح',
                icon: 'UserPlus',
                color: 'purple',
                condition: (row: any) => row.status === 'open' || row.status === 'assigned',
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
            { key: 'status', label: 'تم الإصلاح - بانتظار الاعتماد', type: 'count', filter: { status: 'resolved' }, color: 'teal', icon: 'CheckCircle2' }
        ]
    },
    assets: {
        tableName: 'maintenance_assets',
        label: 'الأصول والمعدات',
        description: 'إدارة وتتبع المعدات الفنية، كود الجرد (QR)، والضمان المالي.',
        icon: 'Box',
        color: 'indigo',
        selectString: '*, qr_code, serial_number, branches:branch_id(name), categories:category_id(name)',
        rbacLevel: 'branch',
        directBranchColumn: 'branch_id',
        path: '/manage/assets',
        roles: [...MAINT_ROLES, ...OPS_ROLES],
        relationships: {
            branch_id: 'branches',
            category_id: 'maintenance_categories'
        },
        filterableColumns: [
            { key: 'status', label: 'الحالة التشغيلية', type: 'status' },
            { key: 'category_id', label: 'التصنيف', type: 'select', dataSource: 'maintenance_categories' },
            { key: 'qr_code', label: 'كود QR', type: 'text' },
            { key: 'serial_number', label: 'الرقم التسلسلي', type: 'text' }
        ],
        metrics: [
            { key: 'id', label: 'إجمالي الأصول', type: 'count', icon: 'Box', color: 'blue' },
            { key: 'status', label: 'أصول متعطلة (مؤقت)', type: 'count', filter: { status: 'faulty' }, color: 'rose', icon: 'AlertTriangle' }
        ]
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
        roles: MAINT_ROLES,
        supportsSoftDelete: false
    }
};
