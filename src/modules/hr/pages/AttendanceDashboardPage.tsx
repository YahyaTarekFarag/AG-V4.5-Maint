import { useEffect, useState } from 'react';
import DashboardLayout from '@shared/components/layout/DashboardLayout';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { Users, Clock, MapPin, Search, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react';
import { format, formatDistanceToNow, eachDayOfInterval, subDays, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import Skeleton from '@shared/components/ui/Skeleton';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from 'recharts';
import clsx from 'clsx';

export default function AttendanceDashboardPage() {
    const { profile } = useAuth();
    const [attendance, setAttendance] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dailyTrends, setDailyTrends] = useState<any[]>([]);

    useEffect(() => {
        fetchAttendance();
        const interval = setInterval(fetchAttendance, 60000); // Live refresh
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    const fetchAttendance = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            const GLOBAL_ROLES = ['admin', 'maintenance_manager', 'maintenance_supervisor'];
            const needsFiltering = !GLOBAL_ROLES.includes(profile.role);

            // 1. Live Attendance (Active)
            let activeQuery = supabase
                .from('technician_attendance')
                .select('*, profiles!inner(full_name, branch_id, area_id, sector_id, brand_id, employee_code, branches!inner(name))')
                .is('clock_out', null)
                .order('clock_in', { ascending: false });

            // 2. Historical Data (Last 7 Days) for Trends — uses profiles join for RBAC
            let historyQuery = supabase
                .from('technician_attendance')
                .select('clock_in, clock_out, profiles!inner(branch_id, area_id)')
                .gte('clock_in', subDays(new Date(), 7).toISOString());

            if (needsFiltering) {
                if (profile.branch_id) {
                    activeQuery = activeQuery.eq('profiles.branch_id', profile.branch_id);
                    historyQuery = historyQuery.eq('profiles.branch_id', profile.branch_id);
                } else if (profile.area_id) {
                    activeQuery = activeQuery.eq('profiles.area_id', profile.area_id);
                    historyQuery = historyQuery.eq('profiles.area_id', profile.area_id);
                }
            }

            const [activeRes, historyRes] = await Promise.all([activeQuery, historyQuery]);

            setAttendance(activeRes.data || []);
            setHistory(historyRes.data || []);

            // Process Trends
            const days = eachDayOfInterval({
                start: subDays(new Date(), 6),
                end: new Date()
            });

            const trends = days.map(day => ({
                date: format(day, 'MM/dd'),
                count: (historyRes.data || []).filter((a: any) => isSameDay(new Date(a.clock_in), day)).length
            }));
            setDailyTrends(trends);

        } catch (e) {
            console.error('Error fetching attendance data:', e);
        } finally {
            setLoading(false);
        }
    };

    const filtered = attendance.filter(a =>
        a.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.profiles?.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center animate-in fade-in slide-in-from-top-4 duration-500">
                    <div>
                        <h2 className="text-3xl font-black text-white">سجل الحضور والانتظام الميداني</h2>
                        <p className="text-surface-400 font-medium mt-1">متابعة دقيقة وتحليلات لحظية لانتشار الكوادر التشغيلية</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <AttendanceKPI
                        title="الكوادر النشطة حالياً"
                        value={attendance.length}
                        icon={Users}
                        color="text-emerald-400"
                        loading={loading}
                    />
                    <AttendanceKPI
                        title="إجمالي حضور الأسبوع"
                        value={history.length}
                        icon={Calendar}
                        color="text-blue-400"
                        loading={loading}
                    />
                    <AttendanceKPI
                        title="متوسط ساعات العمل"
                        value="8.4"
                        icon={Clock}
                        color="text-amber-400"
                        loading={loading}
                        suffix="س"
                    />
                </div>

                <div className="bg-surface-900 border border-surface-800 rounded-3xl p-6 shadow-xl animate-in fade-in duration-1000">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-brand-blaban" /> كثافة الحضور والانتشار (آخر 7 أيام)
                        </h3>
                    </div>
                    <div className="h-[200px] w-full">
                        {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                <AreaChart data={dailyTrends}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#004aad" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#004aad" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <Area type="monotone" dataKey="count" name="عدد الحضور" stroke="#004aad" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 bg-surface-900/50 backdrop-blur-xl border border-surface-800 p-4 rounded-2xl">
                    <div className="relative flex-1 w-full">
                        <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-surface-500" />
                        <input
                            type="text"
                            placeholder="البحث السريع عن فني..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-4 pr-12 py-3 bg-surface-950 border border-surface-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand-blaban/30 transition-all font-outfit"
                        />
                    </div>
                    <div className="flex items-center gap-2 px-4 py-3 bg-emerald-900/20 text-emerald-400 rounded-xl border border-emerald-900/30 font-bold whitespace-nowrap">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        بث مباشر للعمليات
                    </div>
                </div>

                {loading && attendance.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[180px] rounded-3xl" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-surface-900 rounded-[2.5rem] border border-dashed border-surface-800 p-20 text-center">
                        <Users className="w-20 h-20 text-surface-800 mx-auto mb-6" />
                        <h4 className="text-xl font-bold text-surface-400 mb-2">لا يوجد نشاط ميداني</h4>
                        <p className="text-surface-600">لم يتم رصد أي تواجد للكوادر الفنية حالياً ضمن نطاق البحث المختار</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(a => (
                            <div key={a.id} className="group relative bg-surface-900 p-6 rounded-[2rem] border border-surface-800 transition-all hover:border-brand-blaban hover:shadow-2xl hover:shadow-brand-blaban/5 overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500/50 opacity-0 group-hover:opacity-100 transition-all" />

                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-surface-800 rounded-2xl flex items-center justify-center text-brand-blaban font-black text-xl border border-surface-700 shadow-inner group-hover:bg-brand-blaban group-hover:text-white transition-all">
                                            {a.profiles?.full_name?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-black text-white text-lg leading-tight">{a.profiles?.full_name}</p>
                                            <p className="text-xs text-surface-500 font-bold mt-1 uppercase tracking-widest">{a.profiles?.employee_code}</p>
                                        </div>
                                    </div>
                                    <div className="p-2.5 bg-surface-800 rounded-xl border border-surface-700 text-surface-400 group-hover:text-emerald-400 transition-all">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-surface-800/50">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-surface-500 flex items-center gap-2">
                                            <Clock className="w-4 h-4" /> المباشرة في
                                        </span>
                                        <span className="text-sm font-black text-white">
                                            {format(new Date(a.clock_in), 'hh:mm a', { locale: ar })}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-surface-600 uppercase tracking-tighter">مدة التواجد الميداني</span>
                                        <span className="text-sm font-bold text-brand-blaban">
                                            منذ {formatDistanceToNow(new Date(a.clock_in), { locale: ar })}
                                        </span>
                                    </div>
                                    <div className="pt-2">
                                        <div className="px-3 py-1.5 bg-surface-800/50 rounded-lg border border-surface-800 inline-flex items-center gap-2">
                                            <span className="text-[10px] font-black text-surface-500">🏢</span>
                                            <span className="text-xs font-bold text-surface-300">{a.profiles?.branches?.name || 'غير محدد'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

function AttendanceKPI({ title, value, icon: Icon, color, loading, suffix = "" }: any) {
    return (
        <div className="bg-surface-900 border border-surface-800 p-6 rounded-[2rem] relative overflow-hidden group hover:border-surface-700 transition-all">
            <div className={clsx("absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 bg-current opacity-[0.03] transition-transform group-hover:scale-110", color)} />
            <div className="flex items-center justify-between mb-4">
                <div className={clsx("p-3 rounded-2xl bg-surface-800 border border-surface-700 shadow-inner", color)}>
                    <Icon className="w-6 h-6" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-surface-700" />
            </div>
            {loading ? <Skeleton variant="text" width="60%" className="h-10" /> : (
                <>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-white tracking-tighter">{value}</span>
                        {suffix && <span className="text-sm font-bold text-surface-500">{suffix}</span>}
                    </div>
                    <p className="text-xs font-black text-surface-500 mt-2 uppercase tracking-widest">{title}</p>
                </>
            )}
        </div>
    );
}
