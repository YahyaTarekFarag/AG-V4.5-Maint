import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
    Calendar, Download, Filter, BarChart3, TrendingUp, PieChart as PieIcon,
    FileText, CalendarDays, RefreshCw, Loader2
} from 'lucide-react';
import { format, startOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
import Skeleton from '../components/ui/Skeleton';

const COLORS = ['#004aad', '#f58220', '#662d91', '#4b2c20', '#ed1c24', '#0ea5e9', '#d9b382', '#bbf7d0'];

export default function ReportsPage() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // Filters
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [selectedBrand, setSelectedBrand] = useState('all');
    const [selectedSector, setSelectedSector] = useState('all');
    const [selectedArea, setSelectedArea] = useState('all');

    const [branches, setBranches] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [sectors, setSectors] = useState<any[]>([]);
    const [areas, setAreas] = useState<any[]>([]);

    // Data
    const [reportData, setReportData] = useState<any>({
        totalTickets: 0,
        resolvedTickets: 0,
        avgMttr: 0,
        totalCost: 0,
        dailyTrends: [],
        categoryDistribution: [],
        branchPerformance: [],
        rawTickets: []
    });

    useEffect(() => {
        fetchInitialData();
    }, [profile]);

    useEffect(() => {
        if (profile) fetchReports();
    }, [dateRange, selectedBranch, selectedArea, selectedSector, selectedBrand, profile]);

    const fetchInitialData = async () => {
        const { data: bData } = await supabase.from('brands').select('id, name').order('name');
        setBrands(bData || []);

        const { data: sData } = await supabase.from('sectors').select('id, name, brand_id').order('name');
        setSectors(sData || []);

        const { data: aData } = await supabase.from('areas').select('id, name, sector_id').order('name');
        setAreas(aData || []);

        const { data: branchData } = await supabase.from('branches').select('id, name, area_id').order('name');
        setBranches(branchData || []);
    };

    const fetchReports = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('tickets')
                .select('*, branches!inner(id, name, area_id, areas!inner(id, sector_id, sectors!inner(id, brand_id))), maintenance_categories(name), inventory_transactions(quantity_used, inventory(unit_cost))')
                .gte('created_at', dateRange.start)
                .lte('created_at', dateRange.end + 'T23:59:59');

            if (selectedBranch !== 'all') query = query.eq('branch_id', selectedBranch);
            if (selectedArea !== 'all') query = query.eq('branches.area_id', selectedArea);
            if (selectedSector !== 'all') query = query.eq('branches.areas.sector_id', selectedSector);
            if (selectedBrand !== 'all') query = query.eq('branches.areas.sectors.brand_id', selectedBrand);

            const { data, error } = await query;
            if (error) throw error;

            processReportData(data || []);
        } catch (e) {
            console.error('Error fetching reports:', e);
        } finally {
            setLoading(false);
        }
    };

    const processReportData = (tickets: any[]) => {
        const total = tickets.length;
        const resolved = tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length;

        const resolvedWithDates = tickets.filter(t => (t.status === 'closed' || t.status === 'resolved') && t.resolved_at);
        const totalHours = resolvedWithDates.reduce((acc, t) => {
            const start = new Date(t.created_at);
            const end = new Date(t.resolved_at);
            return acc + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }, 0);
        const avgMttr = resolvedWithDates.length > 0 ? (totalHours / resolvedWithDates.length).toFixed(1) : 0;

        const days = eachDayOfInterval({
            start: new Date(dateRange.start),
            end: new Date(dateRange.end)
        });
        const dailyTrends = days.map(day => ({
            date: format(day, 'MM/dd'),
            count: tickets.filter(t => isSameDay(new Date(t.created_at), day)).length,
            resolved: tickets.filter(t => t.resolved_at && isSameDay(new Date(t.resolved_at), day)).length
        }));

        const catMap: Record<string, number> = {};
        tickets.forEach(t => {
            const cat = t.maintenance_categories?.name || 'غير محدد';
            catMap[cat] = (catMap[cat] || 0) + 1;
        });
        const categoryDistribution = Object.entries(catMap).map(([name, value]) => ({ name, value }));

        const branchMap: Record<string, { total: number; resolved: number }> = {};
        tickets.forEach(t => {
            const b = t.branches?.name || 'غير محدد';
            if (!branchMap[b]) branchMap[b] = { total: 0, resolved: 0 };
            branchMap[b].total++;
            if (t.status === 'closed' || t.status === 'resolved') branchMap[b].resolved++;
        });
        const branchPerformance = Object.entries(branchMap).map(([name, stats]) => ({
            name,
            total: stats.total,
            resolved: stats.resolved,
            rate: Math.round((stats.resolved / stats.total) * 100)
        })).sort((a, b) => b.total - a.total).slice(0, 10);

        const totalEconomicImpact = tickets.reduce((acc, t) => {
            const partsCost = (t.inventory_transactions || []).reduce((pAcc: number, trans: any) => {
                return pAcc + (Number(trans.quantity_used) * (Number(trans.inventory?.unit_cost) || 0));
            }, 0);

            let downtimeLoss = 0;
            if (t.downtime_start && t.resolved_at) {
                const hours = (new Date(t.resolved_at).getTime() - new Date(t.downtime_start).getTime()) / (1000 * 60 * 60);
                downtimeLoss = hours * 500;
            }
            return acc + partsCost + downtimeLoss;
        }, 0);

        setReportData({
            totalTickets: total,
            resolvedTickets: resolved,
            avgMttr,
            totalCost: totalEconomicImpact,
            dailyTrends,
            categoryDistribution,
            branchPerformance,
            rawTickets: tickets
        });
    };

    const handleExport = () => {
        setExporting(true);
        try {
            const flatData = reportData.rawTickets.map((t: any) => {
                const partsCost = (t.inventory_transactions || []).reduce((pAcc: number, trans: any) => {
                    return pAcc + (Number(trans.quantity_used) * (Number(trans.inventory?.unit_cost) || 0));
                }, 0);

                return {
                    'رقم البلاغ': t.id.slice(0, 8),
                    'الفرع': t.branches?.name,
                    'التصنيف': t.maintenance_categories?.name,
                    'الحالة': t.status,
                    'التاريخ': format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
                    'تاريخ الإغلاق': t.resolved_at ? format(new Date(t.resolved_at), 'yyyy-MM-dd HH:mm') : '-',
                    'تكلفة قطع الغيار': partsCost,
                    'التقييم': t.rating_score || '-'
                };
            });

            const ws = XLSX.utils.json_to_sheet(flatData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "التقارير");
            XLSX.writeFile(wb, `Sovereign_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        } catch (e) {
            console.error('Export failed:', e);
        } finally {
            setExporting(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div>
                        <h1 className="text-3xl font-black text-white flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-surface-900 border border-surface-800 shadow-2xl">
                                <BarChart3 className="w-8 h-8 text-brand-blaban" />
                            </div>
                            مركز التقارير والذكاء التشغيلي
                        </h1>
                        <p className="text-surface-400 font-medium mt-1">تحليل شامل للأداء، التكاليف، وكفاءة العمليات الميدانية</p>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={exporting || loading}
                        className="flex items-center gap-2 px-6 py-3 bg-surface-900 hover:bg-surface-800 border border-surface-800 text-white rounded-2xl font-bold transition-all shadow-xl disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5 text-brand-blaban" />}
                        تصدير البيانات (Excel)
                    </button>
                </div>

                <div className="bg-surface-900/50 backdrop-blur-xl border border-surface-800 rounded-3xl p-6 flex flex-wrap gap-4 items-end animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="flex-1 min-w-[200px] space-y-2">
                        <label className="text-xs font-bold text-surface-500 block">الفترة من</label>
                        <div className="relative">
                            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-blaban" />
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="w-full pl-3 pr-10 py-3 bg-surface-900 border border-surface-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-blaban/30 transition-all font-outfit"
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-2">
                        <label className="text-xs font-bold text-surface-500 block">إلى</label>
                        <div className="relative">
                            <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-blaban" />
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="w-full pl-3 pr-10 py-3 bg-surface-900 border border-surface-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-blaban/30 transition-all font-outfit"
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-2">
                        <label className="text-xs font-bold text-surface-500 block">العلامة التجارية</label>
                        <select
                            value={selectedBrand}
                            onChange={(e) => {
                                setSelectedBrand(e.target.value);
                                setSelectedSector('all');
                                setSelectedArea('all');
                                setSelectedBranch('all');
                            }}
                            className="w-full px-4 py-3 bg-surface-900 border border-surface-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-blaban/30 transition-all font-outfit"
                        >
                            <option value="all">كافة البراندات</option>
                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <div className="flex-1 min-w-[200px] space-y-2">
                        <label className="text-xs font-bold text-surface-500 block">القطاع</label>
                        <select
                            value={selectedSector}
                            onChange={(e) => {
                                setSelectedSector(e.target.value);
                                setSelectedArea('all');
                                setSelectedBranch('all');
                            }}
                            className="w-full px-4 py-3 bg-surface-900 border border-surface-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-blaban/30 transition-all font-outfit"
                        >
                            <option value="all">كافة القطاعات</option>
                            {sectors.filter(s => selectedBrand === 'all' || s.brand_id === selectedBrand).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1 min-w-[200px] space-y-2">
                        <label className="text-xs font-bold text-surface-500 block">المنطقة</label>
                        <select
                            value={selectedArea}
                            onChange={(e) => {
                                setSelectedArea(e.target.value);
                                setSelectedBranch('all');
                            }}
                            className="w-full px-4 py-3 bg-surface-900 border border-surface-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-blaban/30 transition-all font-outfit"
                        >
                            <option value="all">كافة المناطق</option>
                            {areas.filter(a => selectedSector === 'all' || a.sector_id === selectedSector).map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex-1 min-w-[200px] space-y-2">
                        <label className="text-xs font-bold text-surface-500 block">الفرع</label>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="w-full px-4 py-3 bg-surface-900 border border-surface-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-blaban/30 transition-all font-outfit"
                        >
                            <option value="all">كافة الفروع</option>
                            {branches.filter(b => selectedArea === 'all' || b.area_id === selectedArea).map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={fetchReports}
                        className="p-3.5 bg-brand-blaban text-white rounded-xl hover:bg-opacity-90 transition-all shadow-lg shadow-brand-blaban/20"
                    >
                        <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin")} />
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ReportCard
                        title="إجمالي البلاغات"
                        value={reportData.totalTickets}
                        icon={FileText}
                        color="text-blue-400"
                        loading={loading}
                    />
                    <ReportCard
                        title="معدل الإنجاز"
                        value={`${reportData.totalTickets ? Math.round((reportData.resolvedTickets / reportData.totalTickets) * 100) : 0}%`}
                        icon={TrendingUp}
                        color="text-emerald-400"
                        loading={loading}
                    />
                    <ReportCard
                        title="متوسط الإصلاح (MTTR)"
                        value={`${reportData.avgMttr} س`}
                        icon={BarChart3}
                        color="text-amber-400"
                        loading={loading}
                    />
                    <ReportCard
                        title="الأثر الاقتصادي الإجمالي"
                        value={`${reportData.totalCost.toLocaleString()} ج.م`}
                        icon={PieIcon}
                        color="text-red-400"
                        loading={loading}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-1000">
                    <div className="bg-surface-900 border border-surface-800 rounded-3xl p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-brand-blaban" /> كثافة الأعطال اليومية
                        </h3>
                        <div className="h-[300px] w-full">
                            {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={reportData.dailyTrends}>
                                        <defs>
                                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#004aad" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#004aad" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                        />
                                        <Area type="monotone" dataKey="count" stroke="#004aad" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="bg-surface-900 border border-surface-800 rounded-3xl p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <PieIcon className="w-5 h-5 text-brand-blaban" /> توزيع البلاغات حسب التصنيف
                        </h3>
                        <div className="h-[300px] w-full">
                            {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={reportData.categoryDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {reportData.categoryDistribution.map((_: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-surface-900 border border-surface-800 rounded-3xl p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Filter className="w-5 h-5 text-brand-blaban" /> تحليل كفاءة الفروع والمواقع (Top 10)
                        </h3>
                        <div className="h-[400px] w-full">
                            {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={reportData.branchPerformance} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                        <XAxis type="number" stroke="#64748b" fontSize={10} hide />
                                        <YAxis dataKey="name" type="category" stroke="#fff" fontSize={12} width={120} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                                        />
                                        <Bar dataKey="total" fill="#334155" radius={[0, 4, 4, 0]} barSize={20} />
                                        <Bar dataKey="resolved" fill="#004aad" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

function ReportCard({ title, value, icon: Icon, color, loading }: any) {
    return (
        <div className="bg-surface-900 border border-surface-800 p-6 rounded-3xl shadow-sm relative overflow-hidden group hover:border-surface-700 transition-all">
            <div className={clsx("absolute top-0 right-0 w-24 h-24 rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-125 bg-current opacity-5", color)} />
            <div className="flex items-center justify-between mb-4">
                <div className={clsx("p-2.5 rounded-xl bg-surface-800 border border-surface-700 shadow-inner", color)}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            {loading ? <Skeleton variant="text" width="60%" height="2rem" /> : (
                <>
                    <p className="text-3xl font-black text-white tracking-tight">{value}</p>
                    <p className="text-xs font-bold text-surface-500 mt-1 uppercase tracking-widest">{title}</p>
                </>
            )}
        </div>
    );
}
