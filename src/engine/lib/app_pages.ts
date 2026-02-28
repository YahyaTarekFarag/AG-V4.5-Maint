import { SovereignSchema } from './sovereign';

const ALL_ROLES = ['admin', 'brand_ops_manager', 'sector_manager', 'area_manager', 'manager', 'maintenance_manager', 'maintenance_supervisor', 'technician'];
const OPS_ROLES = ['admin', 'brand_ops_manager', 'sector_manager', 'area_manager', 'manager', 'maintenance_manager', 'maintenance_supervisor'];
const ADMIN_ROLES = ['admin'];

export const APP_PAGES_CONFIG: Record<string, SovereignSchema> = {
    dashboard: {
        label: 'المنصة الاستراتيجية الشاملة',
        path: '/',
        icon: 'LayoutDashboard',
        roles: ALL_ROLES,
        isCustomPage: true
    },
    manager_tickets: {
        label: 'مركز إدارة البلاغات (العمليات)',
        path: '/my-tickets',
        icon: 'ClipboardList',
        roles: ['manager', 'admin', 'maintenance_manager', 'brand_ops_manager', 'sector_manager', 'area_manager'],
        isCustomPage: true
    },
    tech_tickets: {
        label: 'جدول التكليفات التشغيلية',
        path: '/tech-tickets',
        icon: 'Timer',
        roles: ['technician'],
        isCustomPage: true
    },
    my_salary: {
        label: 'مركز الاستحقاقات والبدلات',
        path: '/my-salary',
        icon: 'Wallet',
        roles: ['technician'],
        isCustomPage: true
    },
    maint_dashboard: {
        label: 'مركز قيادة العمليات الفنية',
        path: '/maint-dashboard',
        icon: 'Wrench',
        roles: ['admin', 'maintenance_manager', 'maintenance_supervisor', 'brand_ops_manager', 'sector_manager', 'area_manager'],
        isCustomPage: true
    },
    attendance_live: {
        label: 'سجل الحضور والانتظام الميداني',
        path: '/attendance-live',
        icon: 'Fingerprint',
        roles: ['admin', 'maintenance_manager', 'maintenance_supervisor', 'brand_ops_manager', 'sector_manager', 'area_manager'],
        isCustomPage: true
    },
    diagnostics: {
        label: 'مركز التشخيص والتدقيق',
        path: '/diagnostics',
        icon: 'ShieldCheck',
        roles: ['admin'],
        isCustomPage: true
    },
    reports: {
        label: 'مركز التقارير والذكاء التشغيلي',
        path: '/reports',
        icon: 'BarChart3',
        roles: ['admin', 'maintenance_manager', 'brand_ops_manager'],
        isCustomPage: true
    },
    gis_map: {
        label: 'منظومة الربط الجغرافي (GIS)',
        path: '/map',
        icon: 'Map',
        roles: OPS_ROLES,
        isCustomPage: true
    },
    settings: {
        label: 'تهيئة تفضيلات النظام',
        path: '/settings',
        icon: 'Settings',
        roles: ADMIN_ROLES,
        isCustomPage: true
    },
    admin_settings: {
        label: 'إدارة السياسات والحوكمة الأمنية',
        path: '/admin/settings',
        icon: 'ShieldCheck',
        roles: ADMIN_ROLES,
        isCustomPage: true
    }
};
