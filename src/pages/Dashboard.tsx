import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import SovereignKPICard, { KPICardConfig } from '../components/sovereign/SovereignKPICard';
import { Users, Clock, ClipboardList, Timer, Map, Wrench } from 'lucide-react';

// Fallback static KPI cards if no schema defines them
const DEFAULT_ADMIN_KPIS: KPICardConfig[] = [
    { label: 'إجمالي البلاغات', table: 'tickets', aggregate: 'count', color: 'blue', icon: 'Wrench', link_to: '/tickets' },
    { label: 'قيد المعالجة', table: 'tickets', aggregate: 'count', filter: { status: 'in_progress' }, color: 'amber', icon: 'Activity', link_to: '/tickets' },
    { label: 'تنتظر استلام', table: 'tickets', aggregate: 'count', filter: { status: 'resolved' }, color: 'red', icon: 'AlertTriangle', link_to: '/tickets' },
    { label: 'مُغلَقة', table: 'tickets', aggregate: 'count', filter: { status: 'closed' }, color: 'green', icon: 'CheckCircle', link_to: '/tickets' },
];
const DEFAULT_MANAGER_KPIS: (userId: string) => KPICardConfig[] = (uid) => [
    { label: 'بلاغاتي', table: 'tickets', aggregate: 'count', filter: { manager_id: uid }, color: 'blue', icon: 'Wrench', link_to: '/my-tickets' },
    { label: 'تنتظر استلامي', table: 'tickets', aggregate: 'count', filter: { manager_id: uid, status: 'resolved' }, color: 'red', icon: 'AlertTriangle', link_to: '/my-tickets' },
    { label: 'قيد الإصلاح', table: 'tickets', aggregate: 'count', filter: { manager_id: uid, status: 'in_progress' }, color: 'amber', icon: 'Activity', link_to: '/my-tickets' },
    { label: 'مُغلَقة', table: 'tickets', aggregate: 'count', filter: { manager_id: uid, status: 'closed' }, color: 'green', icon: 'CheckCircle', link_to: '/my-tickets' },
];
const DEFAULT_TECH_KPIS: (userId: string) => KPICardConfig[] = (uid) => [
    { label: 'مهامي المفتوحة', table: 'tickets', aggregate: 'count', filter: { assigned_to: uid, status: 'assigned' }, color: 'blue', icon: 'Wrench', link_to: '/tech-tickets' },
    { label: 'قيد إصلاحي', table: 'tickets', aggregate: 'count', filter: { assigned_to: uid, status: 'in_progress' }, color: 'amber', icon: 'Activity', link_to: '/tech-tickets' },
    { label: 'أنجزتها اليوم', table: 'tickets', aggregate: 'count', filter: { assigned_to: uid, status: 'resolved' }, color: 'green', icon: 'CheckCircle', link_to: '/tech-tickets' },
];

export default function Dashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [kpiCards, setKpiCards] = useState<KPICardConfig[]>([]);
    const [availableTechs, setAvailableTechs] = useState(0);
    const [loadingTechs, setLoadingTechs] = useState(true);

    useEffect(() => {
        if (!profile) return;
        loadKPICards();
        loadAvailableTechs();
    }, [profile]);

    // Try to load KPI cards from ui_schemas.page_config, fall back to static defaults
    const loadKPICards = async () => {
        const { data } = await supabase
            .from('ui_schemas' as any)
            .select('page_config')
            .eq('table_name', 'tickets')
            .single();

        const schemaKPIs: KPICardConfig[] = (data as any)?.page_config?.kpi_cards || [];

        if (schemaKPIs.length > 0 && profile?.role === 'admin') {
            setKpiCards(schemaKPIs);
        } else {
            // Use role-specific defaults with user filter
            if (profile?.role === 'admin') setKpiCards(DEFAULT_ADMIN_KPIS);
            else if (profile?.role === 'manager') setKpiCards(DEFAULT_MANAGER_KPIS(profile.id));
            else if (profile?.role === 'technician') setKpiCards(DEFAULT_TECH_KPIS(profile.id));
        }
    };

    const loadAvailableTechs = async () => {
        const { count } = await supabase
            .from('shifts').select('*', { count: 'exact', head: true }).is('end_at', null);
        setAvailableTechs(count || 0);
        setLoadingTechs(false);
    };

    // Shortcuts by role
    const shortcuts =
        profile?.role === 'manager' ? [
            { icon: ClipboardList, label: 'سجّل بلاغاً جديداً', desc: 'تسجيل عطل مع التقاط الموقع', path: '/my-tickets', color: 'bg-primary-600' },
            { icon: Map, label: 'الخريطة التشغيلية', desc: 'تتبع الفنيين المتاحين', path: '/map', color: 'bg-teal-600' },
        ] :
            profile?.role === 'technician' ? [
                { icon: Timer, label: 'بلاغاتي المفتوحة', desc: 'ابدأ مناوبتك وعالج البلاغات المسنَدة إليك', path: '/tech-tickets', color: 'bg-primary-600' },
                { icon: Wrench, label: 'إدارة المخزون', desc: 'تحقق من القطع المتاحة', path: '/inventory', color: 'bg-amber-600' },
            ] : [
                { icon: Wrench, label: 'كل البلاغات', desc: 'عرض وإدارة جميع البلاغات', path: '/tickets', color: 'bg-blue-600' },
                { icon: Map, label: 'الخريطة التشغيلية', desc: 'مواقع الفروع والفنيين المتاحين', path: '/map', color: 'bg-teal-600' },
                { icon: Users, label: 'إدارة الموظفين', desc: 'إضافة وتعديل الحسابات', path: '/users', color: 'bg-purple-600' },
            ];

    return (
        <DashboardLayout>
            {/* Greeting */}
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-surface-900">
                    مرحباً، {profile?.full_name} 👋
                </h2>
                <p className="text-surface-500 mt-1 text-base">
                    {profile?.role === 'admin' && 'نظرة عامة على النظام — كل شيء تحت السيطرة'}
                    {profile?.role === 'manager' && 'تابع بلاغات فرعك وتأكد من إغلاقها'}
                    {profile?.role === 'technician' && 'تحقق من بلاغاتك المفتوحة وابدأ مناوبتك'}
                </p>
            </div>

            {/* ── KPI Cards (driven by Sovereign Engine) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {kpiCards.map((card, i) => (
                    <SovereignKPICard key={i} config={card} userId={profile?.id} />
                ))}
            </div>

            {/* Available Techs (admin/manager only) */}
            {profile?.role !== 'technician' && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 mb-8 flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-emerald-700">الفنيون المتاحون الآن</p>
                        <p className="text-2xl font-bold text-emerald-900">
                            {loadingTechs ? '...' : availableTechs} فني في المناوبة
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/map')}
                        className="mr-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        عرض الخريطة
                    </button>
                </div>
            )}

            {/* Shortcuts */}
            <h3 className="font-bold text-surface-700 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-surface-400" /> اختصارات سريعة
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {shortcuts.map(s => (
                    <button
                        key={s.path}
                        onClick={() => navigate(s.path)}
                        className="bg-white border border-surface-200 rounded-2xl p-6 text-right hover:shadow-md hover:border-primary-200 transition-all group flex items-center gap-4"
                    >
                        <div className={`w-12 h-12 ${s.color} text-white rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                            <s.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-bold text-surface-900 text-sm">{s.label}</p>
                            <p className="text-xs text-surface-400 mt-0.5">{s.desc}</p>
                        </div>
                    </button>
                ))}
            </div>
        </DashboardLayout>
    );
}
