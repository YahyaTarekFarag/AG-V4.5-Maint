import { useEffect, useState } from 'react';
import DashboardLayout from '@shared/components/layout/DashboardLayout';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
    Calendar, Download, BarChart3, TrendingUp, PieChart as PieIcon,
    FileText, CalendarDays, RefreshCw, Loader2, Zap
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
import Skeleton from '@shared/components/ui/Skeleton';

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
    const [categories, setCategories] = useState<any[]>([]);

    // Data
    const [reportData, setReportData] = useState<any>({
        totalTickets: 0,
        resolvedTickets: 0,
        avgMttr: 0,
        totalCost: 0,
        dailyTrends: [],
        categoryDistribution: [],
        branchPerformance: [],
        efficiency: {
            global_mttr: 0,
            top_failing_assets: []
        }
    });

    useEffect(() => {
        fetchInitialData();
    }, [profile]);

    useEffect(() => {
        if (profile) fetchReports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

        const { data: cData } = await supabase.from('maintenance_categories').select('id, name');
        setCategories(cData || []);
    };

    const fetchReports = async () => {

        setLoading(true);

        try {

            const { data, error } = await supabase.rpc('get_reports_dashboard_data', {

                p_start_date: dateRange.start,

                p_end_date: dateRange.end,

                p_brand_id: selectedBrand !== 'all' ? selectedBrand : null,

                p_sector_id: selectedSector !== 'all' ? selectedSector : null,

                p_area_id: selectedArea !== 'all' ? selectedArea : null,

                p_branch_id: selectedBranch !== 'all' ? selectedBranch : null

            });

            if (error) throw error;



            let dailyQuery = supabase.from('mv_daily_ticket_stats').select('report_date, total_tickets, resolved_tickets')

                .gte('report_date', dateRange.start)

                .lte('report_date', dateRange.end)

                .order('report_date');



            let catQuery = supabase.from('mv_category_distribution').select('category_id, ticket_count')

                .gte('report_month', format(new Date(dateRange.start), 'yyyy-MM-01'));



            if (selectedBranch !== 'all') {

                dailyQuery = dailyQuery.eq('branch_id', selectedBranch);

                catQuery = catQuery.eq('branch_id', selectedBranch);

            }



            const [dailyRes, catRes] = await Promise.all([dailyQuery, catQuery]);



            const dailyTrendsMap: Record<string, any> = {};

            dailyRes.data?.forEach((row: any) => {

                const dateStr = format(new Date(row.report_date), 'MMM dd');

                if (!dailyTrendsMap[dateStr]) {

                    dailyTrendsMap[dateStr] = { date: dateStr, البلاغات_المضافة: 0, البلاغات_المغلقة: 0 };

                }

                dailyTrendsMap[dateStr].البلاغات_المضافة += row.total_tickets;

                dailyTrendsMap[dateStr].البلاغات_المغلقة += row.resolved_tickets;

            });



            const categoryDist = catRes.data?.reduce((acc: any[], row: any) => {
                const cat = categories.find(c => c.id === row.category_id);
                const catName = cat ? cat.name : 'أخرى';
                const existing = acc.find((a: any) => a.name === catName);
                if (existing) existing.value += row.ticket_count;
                else acc.push({ name: catName, value: row.ticket_count });
                return acc;
            }, []) || [];



            if (data) {

                setReportData({

                    totalTickets: data.totalTickets || 0,

                    resolvedTickets: data.resolvedTickets || 0,

                    avgMttr: data.avgMttr || 0,

                    totalCost: data.totalCost || 0,

                    dailyTrends: Object.values(dailyTrendsMap).length > 0 ? Object.values(dailyTrendsMap) : (data.dailyTrends || []),

                    categoryDistribution: categoryDist.length > 0 ? categoryDist : (data.categoryDistribution || []),

                    branchPerformance: data.branchPerformance || [],
                    efficiency: reportData.efficiency // Keep existing until next RPC
                });
            }

            // Fetch New Efficiency Data (V24)
            const { data: effData, error: effError } = await supabase.rpc('get_efficiency_overview');
            if (!effError && effData) {
                setReportData((prev: any) => ({
                    ...prev,
                    efficiency: effData
                }));
            }

        } catch (e) {

            console.error('Error fetching reports:', e);

        } finally {

            setLoading(false);

        }

    };

    const handleExport = async () => {
        setExporting(true);
        try {
            let offset = 0;
            const CHUNK_SIZE = 5000;
            let keepFetching = true;
            let allTickets: any[] = [];

            while (keepFetching) {
                const { data, error } = await supabase.rpc('export_raw_tickets', {
                    p_start_date: dateRange.start,
                    p_end_date: dateRange.end,
                    p_brand_id: selectedBrand !== 'all' ? selectedBrand : null,
                    p_sector_id: selectedSector !== 'all' ? selectedSector : null,
                    p_area_id: selectedArea !== 'all' ? selectedArea : null,
                    p_branch_id: selectedBranch !== 'all' ? selectedBranch : null,
                    p_limit: CHUNK_SIZE,
                    p_offset: offset
                });

                if (error) throw error;

                if (data && data.length > 0) {
                    allTickets = [...allTickets, ...data];
                    offset += CHUNK_SIZE;
                    if (data.length < CHUNK_SIZE) keepFetching = false;
                } else {
                    keepFetching = false;
                }
            }

            if (allTickets.length === 0) {
                alert('لا توجد بيانات للتصدير.');
                return;
            }

            const flatData = allTickets.map((t: any) => ({
                'رقم البلاغ': t.id ? t.id.slice(0, 8) : '-',
                'الفرع': t.branch_name || 'غير محدد',
                'التصنيف': t.category_name || 'غير محدد',
                'الحالة': t.status,
                'التاريخ': t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd HH:mm') : '-',
                'تاريخ الإغلاق': t.resolved_at ? format(new Date(t.resolved_at), 'yyyy-MM-dd HH:mm') : '-',
                'تكلفة قطع الغيار': t.parts_cost || 0,
                'تكلفة العمالة': t.labor_cost || 0,
                'التكلفة الإجمالية': t.total_cost || 0,
                'التقييم': t.rating_score || '-'
            }));

            const ws = XLSX.utils.json_to_sheet(flatData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "التقارير");
            XLSX.writeFile(wb, `Sovereign_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        } catch (e) {
            console.error('Export failed:', e);
            alert('فشل التصدير: ' + (e as Error).message);
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
                                <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1}>
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
                                <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={1}>
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
                            <Zap className="w-5 h-5 text-brand-blaban" /> تحليل الموثوقية وأكثر المعدات تعطلاً (Top 5)
                        </h3>
                        <div className="overflow-hidden rounded-2xl border border-surface-800">
                            <table className="w-full text-right">
                                <thead className="bg-surface-800/50">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-black text-surface-400 uppercase tracking-widest">المعدة / الأصل</th>
                                        <th className="px-6 py-4 text-xs font-black text-surface-400 uppercase tracking-widest text-center">تكرار الأعطال</th>
                                        <th className="px-6 py-4 text-xs font-black text-surface-400 uppercase tracking-widest text-center">MTBF (متوسط التشغيل)</th>
                                        <th className="px-6 py-4 text-xs font-black text-surface-400 uppercase tracking-widest text-center">حالة الموثوقية</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-800">
                                    {reportData.efficiency?.top_failing_assets && reportData.efficiency.top_failing_assets.length > 0 ? reportData.efficiency.top_failing_assets.map((asset: any, i: number) => (
                                        <tr key={i} className="hover:bg-surface-800/30 transition-colors">
                                            <td className="px-6 py-4 text-sm font-bold text-white">{asset.asset_name}</td>
                                            <td className="px-6 py-4 text-sm font-black text-brand-blaban text-center">{asset.failure_count}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-surface-300 text-center">{asset.mtbf_hours} ساعة</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={clsx(
                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight",
                                                    asset.status === 'critical' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                                                        asset.status === 'warning' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                                                            "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                                )}>
                                                    {asset.status === 'critical' ? 'حرج - استبدال فوري' :
                                                        asset.status === 'warning' ? 'تحذير - صيانة معمقة' : 'مستقر'}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-surface-500 font-bold">
                                                لا توجد بيانات كافية لتحليل الموثوقية حالياً
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
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
