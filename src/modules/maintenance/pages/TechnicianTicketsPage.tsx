import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@shared/components/layout/DashboardLayout';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { applyRBACFilter, getRBACSelect } from '@shared/lib/rbac';
import TicketFlow from '@/modules/maintenance/components/TicketFlow';
import { Clock, ChevronDown, ChevronUp, Wrench, Zap, CheckCircle, MapPin, ClipboardCheck, ArrowUpRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ShiftStatus from '@shared/components/layout/ShiftStatus';
import Skeleton from '@shared/components/ui/Skeleton';
import clsx from 'clsx';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    open: { label: 'قيد التدقيق الإداري', color: 'bg-blue-900/30 text-blue-400 border border-blue-900/50' },
    assigned: { label: 'تكليف تشغيلي (إبداء الاستعداد)', color: 'bg-amber-900/30 text-amber-400 border border-amber-900/50' },
    in_progress: { label: 'مباشرة ميدانية (قيد التنفيذ برعايتكم)', color: 'bg-purple-900/30 text-purple-400 border border-purple-900/50' },
    resolved: { label: 'تم الإنجاز (بانتظار الاعتماد النهائي)', color: 'bg-teal-900/30 text-teal-400 border border-teal-900/50' },
};

export default function TechnicianTicketsPage() {
    const { profile } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchTickets = useCallback(async () => {
        if (!profile) return;
        setLoading(true);

        let query = supabase
            .from('tickets')
            .select(getRBACSelect('tickets'))
            .eq('assigned_to', profile.id)
            .eq('is_deleted', false)
            .in('status', ['assigned', 'in_progress'])
            .order('created_at', { ascending: false });

        // Apply RBAC (technician level usually filters by branch/self)
        query = applyRBACFilter(query, 'tickets', profile);

        const { data } = await query;
        if (data) setTickets(data);
        setLoading(false);
    }, [profile]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    const stats = useMemo(() => ({
        total: tickets.length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        emergency: tickets.filter(t => t.is_emergency).length,
    }), [tickets]);


    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                <ShiftStatus />

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-surface-800/50 pb-6">
                    <div>
                        <h2 className="text-3xl font-black text-white flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-surface-900 border border-surface-800 shadow-xl">
                                <ClipboardCheck className="w-8 h-8 text-brand-blaban" />
                            </div>
                            جدول التكليفات التشغيلية
                        </h2>
                        <p className="text-surface-400 font-medium mt-1">المتابعة الميدانية اللحظية للمهام الفنية المسندة إليكم</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={fetchTickets}
                            disabled={loading}
                            className="px-4 py-3 bg-surface-900 rounded-2xl border border-surface-800 text-brand-blaban flex items-center gap-2 shadow-sm hover:bg-surface-800 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={clsx("w-5 h-5", loading && "animate-spin")} />
                            <span className="text-xs font-black hidden sm:inline">تحديث</span>
                        </button>
                        <div className="px-5 py-3 bg-surface-900 rounded-2xl border border-surface-800 flex items-center gap-3 shadow-sm">
                            <div className="flex -space-x-3 rtl:space-x-reverse">
                                <div className="w-8 h-8 rounded-full border-2 border-surface-900 bg-brand-blaban/20 flex items-center justify-center text-[10px] font-black text-brand-blaban">#{stats.total}</div>
                            </div>
                            <span className="text-xs font-black text-surface-500 uppercase tracking-widest">إجمالي المهام</span>
                        </div>
                    </div>
                </div>

                {/* KPI Cards for Technician */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-premium p-6 rounded-3xl border border-surface-800 flex items-center gap-4 group hover:border-brand-blaban/30 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-surface-800 flex items-center justify-center text-surface-400 group-hover:text-brand-blaban transition-colors">
                            <Wrench className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-surface-500 uppercase tracking-widest">المهام المسندة</p>
                            <p className="text-2xl font-black text-white">{stats.total}</p>
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-surface-700 mr-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="glass-premium p-6 rounded-3xl border border-surface-800 flex items-center gap-4 group hover:border-purple-500/30 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:text-purple-300">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-surface-500 uppercase tracking-widest">تحت التنفيذ</p>
                            <p className="text-2xl font-black text-white">{stats.inProgress}</p>
                        </div>
                    </div>
                    <div className="glass-premium p-6 rounded-3xl border border-red-500/10 flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-red-500/70 uppercase tracking-widest">بلاغات استعجال</p>
                            <p className="text-2xl font-black text-white">{stats.emergency}</p>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="glass-premium rounded-3xl border border-surface-800 p-6 flex items-center justify-between opacity-50">
                                    <div className="flex items-center gap-5">
                                        <Skeleton variant="circular" width="3.5rem" height="3.5rem" className="rounded-2xl" />
                                        <div className="space-y-2">
                                            <Skeleton variant="text" width="15rem" height="1.5rem" />
                                            <Skeleton variant="text" width="10rem" height="1rem" />
                                        </div>
                                    </div>
                                    <Skeleton variant="circular" width="2.5rem" height="2.5rem" className="rounded-xl" />
                                </div>
                            ))}
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="glass-premium rounded-[3rem] border border-surface-800 p-24 text-center">
                            <div className="w-24 h-24 bg-surface-900 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-surface-800 shadow-2xl transition-transform hover:scale-110">
                                <CheckCircle className="w-12 h-12 text-emerald-500/50" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">إنجاز العمليات مكتمل</h3>
                            <p className="text-surface-500 font-bold max-w-sm mx-auto leading-relaxed">
                                نثمن مجهوداتكم؛ لا توجد تكليفات معلقة حالياً. سيتم إخطاركم فور توفر مأموريات جديدة.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {tickets.map(ticket => {
                                const st = STATUS_LABELS[ticket.status] || { label: ticket.status, color: 'bg-surface-800 text-surface-500' };
                                const isExpanded = expandedId === ticket.id;
                                return (
                                    <div
                                        key={ticket.id}
                                        className={clsx(
                                            "glass-premium rounded-3xl border transition-all duration-300 overflow-hidden",
                                            isExpanded ? "border-brand-blaban/30 shadow-2xl bg-surface-900/60" : "border-surface-800 hover:border-surface-700 shadow-sm"
                                        )}
                                    >
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                                            className="w-full flex flex-col md:flex-row md:items-center gap-6 p-6 text-right group"
                                        >
                                            <div className={clsx(
                                                "w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                                                ticket.is_emergency ? "bg-red-500/10 text-red-500" : "bg-surface-800 text-surface-400"
                                            )}>
                                                {ticket.is_emergency ? <Zap className="w-7 h-7 animate-pulse" /> : <Wrench className="w-7 h-7" />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                                    <span className={clsx("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border", st.color)}>
                                                        {st.label}
                                                    </span>
                                                    {ticket.is_emergency && <span className="bg-red-500/20 text-red-500 text-[9px] font-black px-2 py-1 rounded-lg border border-red-500/20">حالة طوارئ</span>}
                                                </div>
                                                <h4 className="text-xl font-black text-white truncate mb-2">{ticket.asset_name || 'تكليف صيانة فني'}</h4>

                                                <div className="flex flex-wrap items-center gap-4">
                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-950/50 rounded-xl border border-surface-800/50">
                                                        <MapPin className="w-3.5 h-3.5 text-brand-blaban" />
                                                        <span className="text-xs font-black text-surface-400 uppercase tracking-widest">{ticket.branches?.name || 'موقع غير محدد'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-surface-500 font-bold">
                                                        <Clock className="w-3.5 h-3.5 text-surface-600" />
                                                        {format(new Date(ticket.created_at), 'PPP · p', { locale: ar })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between md:flex-col md:items-end gap-3 border-t md:border-0 border-surface-800 pt-4 md:pt-0">
                                                <div className="text-[10px] font-black text-surface-600 uppercase tracking-[0.2em] md:mb-1">Ops Profile #0{ticket.id.slice(0, 4)}</div>
                                                <div className={clsx("p-2.5 rounded-2xl border border-surface-800 transition-all shadow-sm", isExpanded ? "bg-brand-blaban text-white scale-110" : "bg-surface-800 text-surface-500 group-hover:bg-surface-700")}>
                                                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </div>
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t border-surface-800 p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                <TicketFlow ticket={ticket} onUpdate={fetchTickets} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
