import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import SovereignKPICard, { KPICardConfig } from '../components/sovereign/SovereignKPICard';
import { Users, Clock, ClipboardList, Timer, Map, Wrench, Package, AlertTriangle } from 'lucide-react';
import ShiftStatus from '../components/layout/ShiftStatus';
import Skeleton from '../components/ui/Skeleton';

// Fallback static KPI cards if no schema defines them
const DEFAULT_ADMIN_KPIS: KPICardConfig[] = [
    { label: 'إجمالي البلاغات', table: 'tickets', aggregate: 'count', color: 'blue', icon: 'Wrench', link_to: '/manage/tickets' },
    { label: 'بلاغات قيد المعالجة', table: 'tickets', aggregate: 'count', filter: { status: 'in_progress' }, color: 'amber', icon: 'Activity', link_to: '/manage/tickets' },
    { label: 'بانتظار الاعتماد المكتبي', table: 'tickets', aggregate: 'count', filter: { status: 'resolved' }, color: 'red', icon: 'AlertTriangle', link_to: '/manage/tickets' },
    { label: 'بلاغات مكتملة الإجراء', table: 'tickets', aggregate: 'count', filter: { status: 'closed' }, color: 'green', icon: 'CheckCircle', link_to: '/manage/tickets' },
];
const DEFAULT_MANAGER_KPIS: (userId: string) => KPICardConfig[] = (uid) => [
    { label: 'سجل بلاغات الفرع', table: 'tickets', aggregate: 'count', filter: { manager_id: uid }, color: 'blue', icon: 'Wrench', link_to: '/my-tickets' },
    { label: 'بانتظار المصادقة', table: 'tickets', aggregate: 'count', filter: { manager_id: uid, status: 'resolved' }, color: 'red', icon: 'AlertTriangle', link_to: '/my-tickets' },
    { label: 'بلاغات قيد الإصلاح', table: 'tickets', aggregate: 'count', filter: { manager_id: uid, status: 'in_progress' }, color: 'amber', icon: 'Activity', link_to: '/my-tickets' },
    { label: 'بلاغات منجزة تماماً', table: 'tickets', aggregate: 'count', filter: { manager_id: uid, status: 'closed' }, color: 'green', icon: 'CheckCircle', link_to: '/my-tickets' },
];
const DEFAULT_TECH_KPIS: (userId: string) => KPICardConfig[] = (uid) => [
    { label: 'المهام المسندة', table: 'tickets', aggregate: 'count', filter: { assigned_to: uid, status: 'assigned' }, color: 'blue', icon: 'Wrench', link_to: '/tech-tickets' },
    { label: 'بلاغات قيد العمل', table: 'tickets', aggregate: 'count', filter: { assigned_to: uid, status: 'in_progress' }, color: 'amber', icon: 'Activity', link_to: '/tech-tickets' },
    { label: 'إنجازات اليوم', table: 'tickets', aggregate: 'count', filter: { assigned_to: uid, status: 'resolved' }, color: 'green', icon: 'CheckCircle', link_to: '/tech-tickets' },
];
const DEFAULT_MAINT_KPIS: KPICardConfig[] = [
    { label: 'بلاغات تشغيلية نشطة', table: 'tickets', aggregate: 'count', filter: { status: 'open' }, color: 'blue', icon: 'Wrench', link_to: '/maint-dashboard' },
    { label: 'بانتظار الإسناد الفني', table: 'tickets', aggregate: 'count', filter: { status: 'open' }, color: 'amber', icon: 'AlertTriangle', link_to: '/maint-dashboard' },
    { label: 'عمليات قيد المعالجة', table: 'tickets', aggregate: 'count', filter: { status: 'in_progress' }, color: 'purple', icon: 'Activity', link_to: '/maint-dashboard' },
    { label: 'أرشيف العمليات المنجزة', table: 'tickets', aggregate: 'count', filter: { status: 'closed' }, color: 'green', icon: 'CheckCircle', link_to: '/maint-dashboard' },
];
const DEFAULT_OPS_KPIS: KPICardConfig[] = [
    { label: 'إجمالي البلاغات', table: 'tickets', aggregate: 'count', color: 'blue', icon: 'Wrench', link_to: '/manage/tickets' },
    { label: 'بلاغات تحت المعالجة', table: 'tickets', aggregate: 'count', filter: { status: 'in_progress' }, color: 'amber', icon: 'Activity', link_to: '/manage/tickets' },
    { label: 'إحصائيات الفروع', table: 'branches', aggregate: 'count', color: 'purple', icon: 'Building', link_to: '/manage/branches' },
];
// Custom debounce to avoid extra dependencies
function debounce(fn: Function, delay: number) {
    let timeoutId: any;
    const debounced = (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
    debounced.cancel = () => clearTimeout(timeoutId);
    return debounced;
}

export default function Dashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    // Create a debounced loadStats to prevent rapid re-fetching
    const debouncedLoadStats = debounce(() => {
        loadStats();
    }, 2000);

    const [stats, setStats] = useState({
        open: 0,
        assigned: 0,
        inProgress: 0,
        resolved: 0,
        availableTechs: 0,
        faultyAssets: 0,
        lowStock: 0,
        pendingClosure: 0,
        loading: true
    });
    const [kpiCards, setKpiCards] = useState<KPICardConfig[]>([]);

    useEffect(() => {
        if (!profile) return;
        loadKPICards();
        loadStats();
        const subscription = supabase.channel('dashboard-stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => debouncedLoadStats())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_attendance' }, () => debouncedLoadStats())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_assets' }, () => debouncedLoadStats())
            .subscribe();
        return () => {
            subscription.unsubscribe();
            debouncedLoadStats.cancel();
        };
    }, [profile]);

    const loadStats = async () => {
        if (!profile) return;
        try {
            // [QUANTUM OPTIMIZATION] Single-trip RPC to replace 7 parallel select requests
            const { data, error } = await supabase.rpc('get_dashboard_stats', { p_profile_id: profile.id });

            if (error) throw error;

            setStats({
                open: data.open || 0,
                assigned: data.assigned || 0,
                inProgress: data.in_progress || 0,
                resolved: data.resolved || 0,
                availableTechs: data.available_techs || 0,
                faultyAssets: data.faulty_assets || 0,
                lowStock: data.low_stock || 0,
                pendingClosure: (profile.role === 'manager' ? data.resolved : 0) || 0,
                loading: false
            });

        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            setStats(prev => ({ ...prev, loading: false }));
        }
    };

    // Aggregated KPI cards from all schemas
    const loadKPICards = async () => {
        const { data } = await supabase
            .from('ui_schemas' as any)
            .select('table_name, list_config, page_config, nav_config');

        if (!data) return;

        // Collect all KPIs from all tables
        let aggregatedKPIs: KPICardConfig[] = [];
        data.forEach(s => {
            const configs = (s as any).page_config?.kpi_cards || [];
            // Filter by role if defined in nav_config or config itself (SaaS logic)
            const allowedRoles = s.nav_config?.roles || [];
            if (allowedRoles.length === 0 || allowedRoles.includes(profile?.role)) {
                aggregatedKPIs = [...aggregatedKPIs, ...configs];
            }
        });

        if (aggregatedKPIs.length > 0) {
            setKpiCards(aggregatedKPIs);
        } else {
            // Fallback to static defaults if absolutely nothing is defined
            if (profile?.role === 'admin') setKpiCards(DEFAULT_ADMIN_KPIS);
            else if (profile?.role === 'manager') setKpiCards(DEFAULT_MANAGER_KPIS(profile.id));
            else if (profile?.role === 'technician') setKpiCards(DEFAULT_TECH_KPIS(profile.id));
            else if (profile?.role === 'maint_manager' || profile?.role === 'maint_supervisor') setKpiCards(DEFAULT_MAINT_KPIS);
            else if (['brand_ops_manager', 'sector_manager', 'area_manager'].includes(profile?.role || '')) setKpiCards(DEFAULT_OPS_KPIS);
        }
    };

    const shortcuts =
        profile?.role === 'manager' ? [
            { icon: ClipboardList, label: 'تسجيل بلاغ صيانة جديد', desc: 'إبلاغ عن عطل فني مع تحديد الموقع الجغرافي', path: '/my-tickets', color: 'bg-brand-konafa' },
            { icon: Map, label: 'الخريطة الميدانية', desc: 'تتبع مواقع الفنيين المتاحين في المنطقة', path: '/map', color: 'bg-accent-sky' },
        ] :
            profile?.role === 'technician' ? [
                { icon: Timer, label: 'قائمة المهام المفتوحة', desc: 'بدء المناوبة ومباشرة أعمال الإصلاح المسندة', path: '/tech-tickets', color: 'bg-brand-blaban' },
            ] :
                (profile?.role === 'maint_manager' || profile?.role === 'maint_supervisor') ? [
                    { icon: Wrench, label: 'لوحة إدارة الصيانة', desc: 'مركز التحكم وتوزيع التكليفات الفنية المركزية', path: '/maint-dashboard', color: 'bg-brand-blaban' },
                    { icon: Map, label: 'الخريطة الميدانية', desc: 'توزيع الفروع ونطاقات العمل الميداني للفنيين', path: '/map', color: 'bg-accent-sky' },
                ] :
                    ['brand_ops_manager', 'sector_manager', 'area_manager'].includes(profile?.role || '') ? [
                        { icon: Wrench, label: 'سجل البلاغات العام', desc: 'استعراض حالة العمليات في كافة القطاعات التشغيلية', path: '/manage/tickets', color: 'bg-brand-blaban' },
                        { icon: Map, label: 'تغطية الفروع', desc: 'استعراض النطاق الجغرافي والمواقع التابعة', path: '/map', color: 'bg-accent-sky' },
                    ] : [
                        { icon: Wrench, label: 'إدارة كافة البلاغات', desc: 'الرقابة الشاملة على جودة الصيانة وسير الإصلاحات', path: '/manage/tickets', color: 'bg-brand-blaban' },
                        { icon: Map, label: 'الخريطة المتكاملة', desc: 'نطاق التغطية الشامل للفروع والكوادر الفنية', path: '/map', color: 'bg-accent-sky' },
                        { icon: Users, label: 'إدارة الكوادر البشرية', desc: 'ضبط صلاحيات الوصول وإعدادات حسابات الموظفين', path: '/manage/profiles', color: 'bg-brand-basbosa' },
                    ];

    return (
        <DashboardLayout>
            <div className="fixed inset-0 -z-10 mesh-gradient opacity-30 dark:opacity-20 pointer-events-none" />
            <ShiftStatus />
            <div className="mb-8 relative">
                <h2 className="text-4xl font-black text-white transition-colors font-outfit tracking-tight">
                    أهلاً بك، الزميل {profile?.full_name} — شريك النجاح 👋
                </h2>
                <p className="text-surface-500 mt-2 text-lg transition-colors font-medium opacity-80 backdrop-blur-sm inline-block">
                    {profile?.role === 'admin' && 'منصة الإدارة العليا للنظام — الرقابة الإستراتيجية والتحكم الشامل'}
                    {profile?.role === 'manager' && 'إدارة بلاغات المواقع — متابعة مستويات الجودة وضمان استمرارية العمل'}
                    {profile?.role === 'technician' && 'واجهة الكادر الفني — تتبع المسار التشغيلي وإنجاز مهام الإصلاح الميدانية'}
                    {profile?.role === 'maint_manager' && 'مركز قيادة الصيانة — الحوكمة التشغيلية، التقييم، وإدارة الموارد الاستراتيجية'}
                    {profile?.role === 'maint_supervisor' && 'خلاصة الإشراف الميداني — إدارة التدفقات التشغيلية وحركة القوى الفنية'}
                    {['brand_ops_manager', 'sector_manager', 'area_manager'].includes(profile?.role || '') && 'مركز التقارير القيادية والتشغيلية — تحليل مؤشرات الأداء العام'}
                </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {kpiCards.map((card, i) => (
                    <SovereignKPICard key={i} config={card} userId={profile?.id} />
                ))}

                {/* Low Stock KPI (Critical for Maintenance) */}
                {(profile?.role === 'admin' || profile?.role === 'maint_manager' || profile?.role === 'maint_supervisor') && stats.lowStock > 0 && (
                    <div
                        onClick={() => navigate('/manage/inventory')}
                        className="bg-surface-900 p-6 rounded-2xl border border-amber-900/30 shadow-sm relative overflow-hidden group hover:border-amber-400 transition-all cursor-pointer"
                    >
                        <div className="flex items-center gap-4 mb-2 text-amber-600">
                            <Package className="w-5 h-5" />
                            <span className="text-sm font-bold">رصد عجز المخزون الاستراتيجي</span>
                        </div>
                        <div className="text-3xl font-bold text-white">
                            {stats.loading ? <Skeleton variant="rectangular" width="4rem" height="2rem" /> : stats.lowStock}
                        </div>
                        <p className="text-xs text-surface-500 mt-1">الأصناف التي تجاوزت حد إعادة الطلب الأدنى</p>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform opacity-50" />
                    </div>
                )}
            </div>

            {/* Manager Pending Action Alert */}
            {profile?.role === 'manager' && stats.pendingClosure > 0 && (
                <div className="bg-gradient-to-r from-red-900/10 to-orange-900/10 border border-red-900/30 rounded-2xl p-5 mb-8 flex items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-red-500/20">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-red-400">إشعار إداري: مهام بانتظار المصادقة الختامية</p>
                        تم رصد {stats.pendingClosure} مهمة عمل مكتملة فنياً بانتظار اعتماد الإغلاق من طرفكم.
                    </div>
                    <button onClick={() => navigate('/my-tickets')} className="mr-auto px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-red-500/10">
                        فحص المهام والمصادقة
                    </button>
                </div>
            )}


            {profile?.role !== 'technician' && (
                <div className="bg-gradient-to-r from-emerald-900/10 to-teal-900/10 border border-emerald-900/30 rounded-2xl p-5 mb-8 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-emerald-400">الكوادر الفنية النشطة ميدانياً</p>
                        <p className="text-2xl font-bold text-emerald-50">
                            {stats.loading ? <Skeleton variant="rectangular" width="6rem" height="2rem" /> : `${stats.availableTechs} فني باشر مهامه التشغيلية`}
                        </p>
                    </div>
                    <button onClick={() => navigate('/map')} className="mr-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors">
                        استعرض الخريطة التفاعلية
                    </button>
                </div>
            )}

            <h3 className="font-bold text-surface-300 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-surface-400" /> اختصارات سريعة
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {shortcuts.map(s => (
                    <button key={s.path} onClick={() => navigate(s.path)} className="bg-surface-900 border border-surface-800 rounded-2xl p-6 text-right hover:shadow-md hover:border-brand-blaban/30 transition-all group flex items-center gap-4">
                        <div className={`w-12 h-12 ${s.color} text-white rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                            <s.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm">{s.label}</p>
                            <p className="text-xs text-surface-400 mt-0.5">{s.desc}</p>
                        </div>
                    </button>
                ))}
            </div>
        </DashboardLayout>
    );
}
