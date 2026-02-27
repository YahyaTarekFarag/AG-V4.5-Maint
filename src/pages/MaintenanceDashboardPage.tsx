import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import TicketFlow from '../components/tickets/TicketFlow';
import Skeleton from '../components/ui/Skeleton';
import { Wrench, Users, AlertTriangle, CheckCircle, Clock, Loader2, ChevronDown, ChevronUp, Star, Filter, TrendingUp } from 'lucide-react';
import { format, eachDayOfInterval, subDays, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import clsx from 'clsx';
import {
    XAxis, Tooltip, ResponsiveContainer,
    AreaChart, Area, CartesianGrid, BarChart, Bar, Cell
} from 'recharts';
import { Shield, Activity, Sparkles, Zap, TrendingDown } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    open: { label: 'بلاغ جديد (قيد التدقيق)', color: 'bg-blue-900/30 text-blue-400 border-blue-900/50' },
    assigned: { label: 'تم الإسناد (بانتظار المباشرة)', color: 'bg-amber-900/30 text-amber-400 border-amber-900/50' },
    in_progress: { label: 'قيد الإصلاح الميداني', color: 'bg-purple-900/30 text-purple-400 border-purple-900/50' },
    resolved: { label: 'تم الإصلاح (بانتظار الاعتماد)', color: 'bg-teal-900/30 text-teal-400 border-teal-900/50' },
    closed: { label: 'بلاغ مغلق (مكتمل) ✓', color: 'bg-surface-800 text-surface-500 border-surface-700' },
};

const PRIORITY_OPTIONS = [
    { value: 'normal', label: 'عادي', color: 'bg-surface-800 text-surface-400 border-surface-700' },
    { value: 'high', label: 'مرتفع', color: 'bg-amber-900/30 text-amber-400 border-amber-900/50' },
    { value: 'urgent', label: 'عاجل', color: 'bg-orange-900/30 text-orange-400 border-orange-900/50' },
    { value: 'critical', label: 'حرج', color: 'bg-red-900/30 text-red-400 border-red-900/50' },
];

export default function MaintenanceDashboardPage() {
    const { profile } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'>('all');
    const [assigning, setAssigning] = useState<string | null>(null); // ticket id being assigned
    const [selectedTech, setSelectedTech] = useState('');
    const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);
    const [techPerformance, setTechPerformance] = useState<any[]>([]);
    const [criticalAssets, setCriticalAssets] = useState<any[]>([]);
    const [showIntelligence, setShowIntelligence] = useState(false);
    const [dailyTrends, setDailyTrends] = useState<any[]>([]);
    const [branchHealth, setBranchHealth] = useState<any[]>([]);
    const [financialImpact, setFinancialImpact] = useState<any[]>([]);

    useEffect(() => {
        fetchAll();
    }, [profile]);

    const fetchAll = async () => {
        if (!profile) return;
        setLoading(true);

        const GLOBAL_ROLES = ['admin', 'maint_manager', 'maint_supervisor'];
        const needsFiltering = !GLOBAL_ROLES.includes(profile.role);

        let query = supabase
            .from('tickets')
            .select('*, branches(name, area_id), maintenance_categories(name)')
            .order('created_at', { ascending: false });

        if (needsFiltering) {
            if (profile.branch_id) {
                query = query.eq('branch_id', profile.branch_id);
            } else if (profile.area_id) {
                query = query.select('*, branches!inner(name, area_id), maintenance_categories(name)')
                    .eq('branches.area_id', profile.area_id);
            } else if (profile.sector_id) {
                query = query.select('*, branches!inner(name, area_id, areas!inner(sector_id)), maintenance_categories(name)')
                    .eq('branches.areas.sector_id', profile.sector_id);
            } else if (profile.brand_id) {
                query = query.select('*, branches!inner(name, area_id, areas!inner(sector_id, sectors!inner(brand_id))), maintenance_categories(name)')
                    .eq('branches.areas.sectors.brand_id', profile.brand_id);
            }
        }

        const { data: ticketData } = await query;
        const processedTickets = ticketData || [];
        setTickets(processedTickets);

        // Process Daily Trends for the last 7 days
        const days = eachDayOfInterval({
            start: subDays(new Date(), 6),
            end: new Date()
        });
        const trends = days.map(day => ({
            date: format(day, 'MM/dd'),
            count: processedTickets.filter(t => isSameDay(new Date(t.created_at), day)).length,
            resolved: processedTickets.filter(t => t.resolved_at && isSameDay(new Date(t.resolved_at), day)).length
        }));
        setDailyTrends(trends);

        // Load Intelligence Data
        const { data: perfData } = await supabase.from('v_technician_performance').select('*').limit(5);
        setTechPerformance(perfData || []);

        const { data: assetData } = await supabase.from('v_critical_assets_report').select('*').limit(5);
        setCriticalAssets(assetData || []);

        try {
            const { data: techData } = await supabase
                .from('profiles')
                .select('id, full_name, employee_code')
                .in('role', ['technician', 'maint_supervisor']);
            setTechnicians(techData || []);

            const { data: healthData } = await supabase.from('v_branch_health_index').select('*').limit(3);
            setBranchHealth(healthData || []);

            const { data: financeData } = await supabase.from('v_financial_impact_report').select('*').limit(3);
            setFinancialImpact(financeData || []);
        } catch (e) { console.error("Error loading intelligence data", e); }

        setLoading(false);
    };

    const handleAssign = async (ticketId: string) => {
        if (!selectedTech || !profile) return;
        setAssigning(ticketId);
        try {
            const { error } = await supabase
                .from('tickets')
                .update({
                    assigned_to: selectedTech,
                    assigned_by: profile.id,
                    status: 'assigned',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', ticketId);
            if (error) throw error;
            setSelectedTech('');
            fetchAll();
        } catch (e: any) {
            alert('خطأ في التعيين: ' + e.message);
        } finally {
            setAssigning(null);
        }
    };

    const handlePriorityChange = async (ticketId: string, newPriority: string) => {
        if (profile?.role !== 'maint_manager' && profile?.role !== 'admin') return;
        setUpdatingPriority(ticketId);
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ priority: newPriority, updated_at: new Date().toISOString() })
                .eq('id', ticketId);
            if (error) throw error;
            fetchAll();
        } catch (e: any) {
            alert('خطأ: ' + e.message);
        } finally {
            setUpdatingPriority(null);
        }
    };

    const filtered = tickets.filter(t => {
        if (filter === 'all') return true;
        return t.status === filter;
    });

    const counts = {
        all: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        assigned: tickets.filter(t => t.status === 'assigned').length,
        in_progress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length,
    };

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">
                    {profile?.role === 'admin' ? '🛡️ لوحة التحكم الإستراتيجية (الإدارة العليا)' :
                        profile?.role === 'maint_manager' ? '🛠️ منصة إدارة العمليات الفنية (مدير الصيانة)' : '🔧 منصة الإشراف والمتابعة الميدانية'}
                </h2>
                <p className="text-surface-400 text-sm mt-1">
                    {profile?.role === 'admin' ? 'إدارة عليا لكافة بلاغات وعمليات الصيانة في النظام' :
                        profile?.role === 'maint_manager'
                            ? 'حوكمة متكاملة لمنظومة البلاغات، الكوادر الفنية، سلاسل الإمداد، ومعايير الجودة'
                            : 'إدارة توزيع التدفقات التشغيلية ومتابعة مؤشرات الإنجاز الميداني'}
                </p>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                {([
                    { key: 'all', label: 'الكل', icon: Wrench, color: 'bg-surface-900 border-surface-800 text-surface-400' },
                    { key: 'open', label: 'جديد', icon: AlertTriangle, color: 'bg-blue-900/10 border-blue-900/30 text-blue-400' },
                    { key: 'assigned', label: 'تم الإسناد', icon: Users, color: 'bg-amber-900/10 border-amber-900/30 text-amber-400' },
                    { key: 'in_progress', label: 'قيد الإصلاح', icon: Clock, color: 'bg-purple-900/10 border-purple-900/30 text-purple-400' },
                    { key: 'resolved', label: 'ينتظر اعتماد', icon: Star, color: 'bg-teal-900/10 border-teal-900/30 text-teal-400' },
                    { key: 'closed', label: 'مكتمل', icon: CheckCircle, color: 'bg-green-900/10 border-green-900/30 text-green-400' },
                ] as const).map(item => (
                    <button
                        key={item.key}
                        onClick={() => setFilter(item.key)}
                        className={`p-4 rounded-2xl border text-right transition-all ${item.color} ${filter === item.key ? 'ring-2 ring-brand-blaban shadow-md' : 'hover:shadow-sm'}`}
                    >
                        <item.icon className="w-5 h-5 mb-1 opacity-60" />
                        <p className="text-2xl font-bold text-white">{counts[item.key]}</p>
                        <p className="text-xs font-medium mt-0.5">{item.label}</p>
                    </button>
                ))}
            </div>

            {/* Daily Performance Trend */}
            <div className="bg-surface-900 border border-surface-800 rounded-3xl p-6 mb-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-brand-blaban" /> كثافة وتدفق البلاغات (آخر 7 أيام)
                    </h3>
                    <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest font-bold">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-brand-blaban" /> البلاغات الجديدة</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-teal-400" /> البلاغات المنجزة</div>
                    </div>
                </div>
                <div className="h-[200px] w-full">
                    {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyTrends}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#004aad" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#004aad" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="count" name="جديد" stroke="#004aad" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                                <Area type="monotone" dataKey="resolved" name="منجز" stroke="#2dd4bf" strokeWidth={3} fillOpacity={1} fill="url(#colorResolved)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Intelligence Highlights Toggle */}
            <div className="mb-6">
                <button
                    onClick={() => setShowIntelligence(!showIntelligence)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-brand-blaban to-brand-blaban/80 text-white rounded-2xl shadow-lg shadow-brand-blaban/20 hover:shadow-xl transition-all font-bold"
                >
                    <Star className={clsx("w-5 h-5", showIntelligence && "fill-white")} />
                    <span>{showIntelligence ? 'إخفاء مؤشرات التحليل السيادي (Sovereign Intelligence)' : 'استعراض التوقعات والتحليلات التنبؤية (Sovereign Intelligence)'}</span>
                </button>
            </div>

            {showIntelligence && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    {loading ? (
                        <>
                            <div className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-surface-800 p-8 h-[400px]">
                                <Skeleton variant="text" width="60%" height="2rem" className="mb-8" />
                                <div className="space-y-6">
                                    {[1, 2, 3].map(i => <Skeleton key={i} variant="rectangular" width="100%" height="3rem" className="rounded-2xl" />)}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-surface-800 p-8 h-[400px]">
                                <Skeleton variant="text" width="40%" height="2rem" className="mb-8" />
                                <div className="space-y-4">
                                    {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rectangular" width="100%" height="4rem" className="rounded-2xl" />)}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Economic Impact - Total Cost of Failures */}
                            <div className="bg-surface-900 rounded-3xl border border-surface-800 p-6 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                                <div className="flex items-center justify-between mb-8 relative">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <TrendingDown className="w-5 h-5 text-red-500" /> تحليل الأثر الاقتصادي للأعطال (Economic Impact)
                                    </h3>
                                    <span className="text-[10px] font-bold text-red-400 bg-red-900/20 px-3 py-1 rounded-full border border-red-900/30">تقدير الخسائر</span>
                                </div>
                                <div className="space-y-4">
                                    {financialImpact.map((item, i) => (
                                        <div key={i} className="p-4 bg-surface-800/50 rounded-2xl border border-surface-800 hover:border-red-900/30 transition-all group">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="font-bold text-white text-sm">{item.asset_name}</p>
                                                    <p className="text-[10px] text-surface-500">📍 {item.branch_name}</p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-black text-red-400">{Number(item.total_economic_impact).toLocaleString()} ج.م</p>
                                                    <p className="text-[9px] text-surface-500 uppercase">إجمالي الخسائر</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-surface-800">
                                                <div>
                                                    <p className="text-[9px] text-surface-500">قطع غيار</p>
                                                    <p className="text-xs font-bold text-white">{Number(item.direct_parts_cost).toLocaleString()} ج.م</p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[9px] text-surface-500">خسائر التوقف</p>
                                                    <p className="text-xs font-bold text-amber-500">{Number(item.estimated_downtime_loss).toLocaleString()} ج.م</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Branch Health Index - Strategic Map Representation */}
                            <div className="bg-surface-900 rounded-3xl border border-surface-800 p-6 shadow-sm relative overflow-hidden lg:col-span-2">
                                <div className="absolute top-0 left-0 w-64 h-64 bg-brand-blaban/5 rounded-full -ml-32 -mt-32 blur-3xl" />
                                <div className="flex items-center justify-between mb-8 relative">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-brand-blaban" /> كشافة الصحة التشغيلية للفروع (Branch Health Index)
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> <span className="text-[9px] text-surface-500">مستقر</span></div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> <span className="text-[9px] text-surface-500">متحفز</span></div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> <span className="text-[9px] text-surface-500">حرج</span></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {branchHealth.map((branch, i) => (
                                        <div key={i} className="relative p-6 bg-surface-800/30 rounded-3xl border border-surface-800 hover:bg-surface-800/50 transition-all group overflow-hidden">
                                            <div className={clsx(
                                                "absolute top-0 right-0 w-16 h-16 opacity-10 -mr-8 -mt-8 rounded-full",
                                                branch.health_score > 80 ? "bg-green-500" : branch.health_score > 60 ? "bg-orange-500" : "bg-red-500"
                                            )} />
                                            <div className="flex flex-col items-center text-center">
                                                <div className="relative mb-4">
                                                    <svg className="w-24 h-24 transform -rotate-90">
                                                        <circle cx="48" cy="48" r="42" className="stroke-surface-800 fill-none" strokeWidth="8" />
                                                        <circle
                                                            cx="48" cy="48" r="42"
                                                            className={clsx(
                                                                "fill-none transition-all duration-1000",
                                                                branch.health_score > 80 ? "stroke-green-500" : branch.health_score > 60 ? "stroke-orange-500" : "stroke-red-500"
                                                            )}
                                                            strokeWidth="8"
                                                            strokeDasharray={264}
                                                            strokeDashoffset={264 - (branch.health_score * 2.64)}
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        <span className="text-2xl font-black text-white">{Math.round(branch.health_score)}%</span>
                                                        <span className="text-[8px] font-bold text-surface-500 uppercase tracking-tighter">Health</span>
                                                    </div>
                                                </div>
                                                <h4 className="font-bold text-white mb-1">{branch.branch_name}</h4>
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-surface-900 rounded-full border border-surface-800">
                                                    <Activity className="w-3 h-3 text-brand-blaban" />
                                                    <span className="text-[10px] text-surface-400">{branch.tickets_count} بلاغ نشط</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Predictive Maintenance & Technician Efficiency */}
                            <div className="bg-surface-900 rounded-3xl border border-surface-800 p-6 shadow-sm relative overflow-hidden lg:col-span-2">
                                <div className="flex items-center justify-between mb-8 relative">
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-amber-500" /> تحليل كفاءة الموارد الفنية (Technician Efficiency Matrix)
                                    </h3>
                                    <button className="text-xs text-brand-blaban font-bold flex items-center gap-1">استعراض خرائط الأداء <Zap className="w-3 h-3" /></button>
                                </div>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={techPerformance}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis dataKey="technician_name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                            />
                                            <Bar dataKey="avg_repair_hours" name="متوسط زمن الإصلاح (س)" radius={[6, 6, 0, 0]} barSize={40}>
                                                {techPerformance.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#004aad' : '#f58220'} fillOpacity={0.8} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            {/* MTBF Analysis - Critical Assets Reliability */}
                            <div className="bg-surface-900 rounded-3xl border border-surface-800 p-6 shadow-sm relative overflow-hidden lg:col-span-2">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                                    <AlertTriangle className="w-5 h-5 text-orange-500" /> تحليل موثوقية الأصول الحرجة (Asset Reliability - MTBF)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                    {criticalAssets.map((asset, i) => (
                                        <div key={i} className="p-4 bg-surface-800/30 rounded-2xl border border-surface-800 hover:border-orange-500/30 transition-all text-center">
                                            <p className="text-xs font-bold text-white mb-2 truncate">{asset.asset_name}</p>
                                            <div className="text-xl font-black text-orange-500 mb-1">{asset.failure_count}</div>
                                            <p className="text-[9px] text-surface-500 uppercase">تكرار الأعطال</p>
                                            <div className="mt-3 pt-3 border-t border-surface-800">
                                                <p className="text-[10px] text-surface-400">Downtime: {asset.total_downtime_hours}h</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Tickets List */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-400" /></div>
            ) : filtered.length === 0 ? (
                <div className="bg-surface-900 rounded-2xl border border-surface-800 p-16 text-center text-surface-500">
                    <Filter className="w-12 h-12 mx-auto mb-3 text-surface-700" />
                    <p className="font-medium">لا توجد بيانات تشغيلية متاحة لهذا التصنيف حالياً</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(ticket => {
                        const st = STATUS_LABELS[ticket.status] || { label: ticket.status, color: 'bg-surface-100 text-surface-500 border-surface-200' };
                        const isExpanded = expandedId === ticket.id;
                        const assignedTech = technicians.find(t => t.id === ticket.assigned_to);

                        return (
                            <div key={ticket.id} className="bg-surface-900 rounded-2xl border border-surface-800 shadow-sm overflow-hidden">
                                {/* Ticket Header */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                                    className="w-full flex items-center justify-between p-5 text-right hover:bg-surface-800 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${st.color}`}>{st.label}</span>
                                        {ticket.priority && ticket.priority !== 'normal' && (
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${ticket.priority === 'critical' ? 'bg-red-900/30 text-red-400 border border-red-900/50' :
                                                ticket.priority === 'urgent' ? 'bg-orange-900/30 text-orange-400 border border-orange-900/50' :
                                                    'bg-amber-900/30 text-amber-400 border border-amber-900/50'
                                                }`}>
                                                {ticket.priority === 'critical' ? '🔴 حرج' : ticket.priority === 'urgent' ? '🟠 عاجل' : '🟡 مرتفع'}
                                            </span>
                                        )}
                                        <div className="text-right">
                                            <p className="font-semibold text-white truncate max-w-[200px]">{ticket.asset_name || 'مهمة صيانة'}</p>
                                            <div className="flex items-center gap-3 mt-1 text-[10px] text-surface-500">
                                                <span className="flex items-center gap-1 text-brand-blaban font-bold">
                                                    🏢 {ticket.branches?.name || 'فرع غير محدد'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {ticket.created_at ? format(new Date(ticket.created_at), 'PPP - hh:mm a', { locale: ar }) : '—'}
                                                </span>
                                                {assignedTech && (
                                                    <span className="text-brand-blaban font-medium">👤 {assignedTech.full_name}</span>
                                                )}
                                                {ticket.rating_score && (
                                                    <span className="text-amber-500">⭐ {ticket.rating_score}/5</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-surface-400" /> : <ChevronDown className="w-5 h-5 text-surface-400" />}
                                </button>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-surface-800 p-5 space-y-4">
                                        {/* Assignment Section */}
                                        {(ticket.status === 'open' || ticket.status === 'assigned') && (
                                            <div className="bg-brand-blaban/5 rounded-xl p-4 border border-brand-blaban/20 space-y-3">
                                                <h4 className="font-bold text-brand-blaban flex items-center gap-2">
                                                    <Users className="w-5 h-5" /> إسناد المهمة الفنية للكوادر المختصة
                                                </h4>
                                                <div className="flex gap-3">
                                                    <select
                                                        value={selectedTech}
                                                        onChange={(e) => setSelectedTech(e.target.value)}
                                                        className="flex-1 bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-blaban/30 text-white"
                                                    >
                                                        <option value="">تحديد الفني المختص...</option>
                                                        {technicians.map(t => (
                                                            <option key={t.id} value={t.id}>
                                                                {t.full_name} ({t.employee_code})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => handleAssign(ticket.id)}
                                                        disabled={!selectedTech || assigning === ticket.id}
                                                        className="px-5 py-2 bg-brand-blaban hover:bg-opacity-90 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-all shadow-md shadow-brand-blaban/20"
                                                    >
                                                        {assigning === ticket.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الإسناد'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Priority Change (maint_manager and admin) */}
                                        {(profile?.role === 'maint_manager' || profile?.role === 'admin') && ticket.status !== 'closed' && (
                                            <div className="bg-amber-900/10 rounded-xl p-4 border border-amber-900/20 space-y-3">
                                                <h4 className="font-bold text-amber-400 flex items-center gap-2">
                                                    <AlertTriangle className="w-5 h-5" /> تعديل مستوى الأهمية التشغيلية
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {PRIORITY_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => handlePriorityChange(ticket.id, opt.value)}
                                                            disabled={updatingPriority === ticket.id}
                                                            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${opt.color} ${ticket.priority === opt.value ? 'ring-2 ring-offset-1 ring-offset-surface-900 ring-brand-blaban' : 'hover:shadow-sm'
                                                                }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Rating Display for closed tickets */}
                                        {ticket.status === 'closed' && ticket.rating_score && (
                                            <div className="bg-green-900/10 rounded-xl p-4 border border-green-900/20">
                                                <h4 className="font-bold text-green-400 flex items-center gap-2 mb-2">
                                                    <Star className="w-5 h-5" /> مؤشر رضا الجهة المستفيدة (مدير الفرع)
                                                </h4>
                                                <div className="flex items-center gap-2 text-xl mb-1" dir="ltr">
                                                    {[1, 2, 3, 4, 5].map(v => (
                                                        <Star key={v} className={`w-6 h-6 ${ticket.rating_score >= v ? 'text-amber-400 fill-amber-400' : 'text-surface-700'}`} />
                                                    ))}
                                                    <span className="text-sm text-green-400 font-bold mr-2">{ticket.rating_score}/5</span>
                                                </div>
                                                {ticket.rating_comment && (
                                                    <p className="text-sm text-green-200 mt-2 bg-green-900/20 rounded-lg p-3 border border-green-900/30 italic">"{ticket.rating_comment}"</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Standard TicketFlow for technician actions */}
                                        <TicketFlow ticket={ticket} onUpdate={fetchAll} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </DashboardLayout>
    );
}
