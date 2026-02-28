import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Zap } from 'lucide-react';
import Skeleton from '@shared/components/ui/Skeleton';

interface Props {
    loading: boolean;
    dailyTrends: any[];
    techPerformance: any[];
}

export default function MaintenanceCharts({ loading, dailyTrends, techPerformance }: Props) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Daily Performance Trend */}
            <div className="bg-surface-900 border border-surface-800 rounded-3xl p-6 shadow-sm">
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
                        <ResponsiveContainer width="99%" height="100%" debounce={50} minWidth={1} minHeight={1}>
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

            {/* Predictive Maintenance & Technician Efficiency */}
            <div className="bg-surface-900 border border-surface-800 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between mb-8 relative">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" /> تحليل كفاءة الموارد الفنية (Technician Efficiency)
                    </h3>
                </div>
                <div className="h-[200px] w-full">
                    {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                        <ResponsiveContainer width="99%" height="100%" debounce={50} minWidth={1} minHeight={1}>
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
                    )}
                </div>
            </div>
        </div>
    );
}
