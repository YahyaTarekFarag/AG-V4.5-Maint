
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, Users, Building2, Package, Wrench, Settings, LogOut, ClipboardList, Map, Timer, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar() {
    const { profile, signOut } = useAuth();

    const ROLE_LABELS: Record<string, string> = {
        admin: 'مسؤول نظام',
        brand_ops_manager: 'مدير تشغيل البراند',
        sector_manager: 'مدير قطاع',
        area_manager: 'مدير منطقة',
        manager: 'مدير فرع',
        maint_manager: 'مدير صيانة',
        maint_supervisor: 'مشرف صيانة',
        technician: 'فني صيانة',
    };

    const ALL_ROLES = Object.keys(ROLE_LABELS);
    const MAINT_ROLES = ['maint_manager', 'maint_supervisor'];
    const OPS_ROLES = ['admin', 'brand_ops_manager', 'sector_manager', 'area_manager'];

    const navItems = [
        { label: 'الرئيسية', path: '/', icon: LayoutDashboard, roles: ALL_ROLES },
        { label: 'بلاغاتي', path: '/my-tickets', icon: ClipboardList, roles: ['manager'] },
        { label: 'مهامي', path: '/tech-tickets', icon: Timer, roles: ['technician'] },
        { label: 'لوحة الصيانة', path: '/maint-dashboard', icon: Wrench, roles: MAINT_ROLES },
        { label: 'كل البلاغات', path: '/tickets', icon: Wrench, roles: ['admin', ...MAINT_ROLES] },
        { label: 'الخريطة التشغيلية', path: '/map', icon: Map, roles: ['admin', 'manager', ...MAINT_ROLES, ...OPS_ROLES] },
        { label: 'إدارة المخزون', path: '/inventory', icon: Package, roles: ['admin', 'technician', ...MAINT_ROLES] },
        { label: 'البراندات', path: '/brands', icon: Building2, roles: ['admin'] },
        { label: 'القطاعات', path: '/sectors', icon: Building2, roles: ['admin', 'brand_ops_manager'] },
        { label: 'المناطق', path: '/areas', icon: Building2, roles: ['admin', 'brand_ops_manager', 'sector_manager'] },
        { label: 'الفروع', path: '/branches', icon: Building2, roles: ['admin', ...OPS_ROLES] },
        { label: 'الموظفين', path: '/users', icon: Users, roles: ['admin'] },
        { label: 'إعدادات الواجهات', path: '/settings', icon: Settings, roles: ['admin'] },
        { label: 'إعدادات النظام', path: '/admin/settings', icon: ShieldCheck, roles: ['admin'] },
    ];

    // RBAC Filtering at the UI level based on profiles table, not RLS
    const authorizedLinks = navItems.filter(item => profile && item.roles.includes(profile.role));

    return (
        <aside className="w-64 bg-surface-900 text-white flex flex-col min-h-screen fixed right-0 top-0 bottom-0 z-40 transition-transform shadow-2xl">
            <div className="p-6 flex items-center gap-4 border-b border-surface-800">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
                    <Settings className="w-6 h-6 text-white animate-spin-slow" />
                </div>
                <div>
                    <h2 className="text-lg font-bold tracking-tight">نظام الصيانة V10</h2>
                </div>
            </div>

            <div className="p-6 pb-4 border-b border-surface-800 bg-surface-800/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-surface-700 rounded-full flex items-center justify-center text-primary-400 font-bold text-lg shrink-0 border border-surface-600 shadow-inner">
                        {profile?.full_name?.charAt(0) || 'M'}
                    </div>
                    <div className="overflow-hidden">
                        <p className="font-semibold text-sm truncate">{profile?.full_name}</p>
                        <p className="text-xs text-primary-400 capitalize mt-0.5">
                            {ROLE_LABELS[profile?.role || ''] || profile?.role}
                        </p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
                {authorizedLinks.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => clsx(
                            "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-medium",
                            isActive
                                ? "bg-primary-600 text-white shadow-md shadow-primary-900/40"
                                : "text-surface-300 hover:bg-surface-800 hover:text-white"
                        )}
                    >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-surface-800 bg-surface-800/10">
                <button
                    onClick={() => signOut()}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all"
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span>تسجيل الخروج</span>
                </button>
            </div>
        </aside>
    );
}
