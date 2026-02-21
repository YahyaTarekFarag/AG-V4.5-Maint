import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import TicketFlow from '../components/tickets/TicketFlow';
import { Wrench, Users, AlertTriangle, CheckCircle, Clock, Loader2, ChevronDown, ChevronUp, Star, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    open: { label: 'جديد', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    assigned: { label: 'مُسنَد للفني', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    in_progress: { label: 'قيد الإصلاح', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    resolved: { label: 'بانتظار الاعتماد', color: 'bg-teal-100 text-teal-700 border-teal-200' },
    closed: { label: 'مُغلق ✓', color: 'bg-surface-100 text-surface-500 border-surface-200' },
};

const PRIORITY_OPTIONS = [
    { value: 'normal', label: 'عادي', color: 'bg-surface-100 text-surface-600' },
    { value: 'high', label: 'مرتفع', color: 'bg-amber-100 text-amber-700' },
    { value: 'urgent', label: 'عاجل', color: 'bg-orange-100 text-orange-700' },
    { value: 'critical', label: 'حرج', color: 'bg-red-100 text-red-700' },
];

export default function MaintDashboardPage() {
    const { profile } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'>('all');
    const [assigning, setAssigning] = useState<string | null>(null); // ticket id being assigned
    const [selectedTech, setSelectedTech] = useState('');
    const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);

    useEffect(() => {
        fetchAll();
    }, [profile]);

    const fetchAll = async () => {
        if (!profile) return;
        setLoading(true);

        // Load ALL tickets (maint roles see everything)
        const { data: ticketData } = await supabase
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });
        setTickets(ticketData || []);

        // Load ALL technicians (not just online ones)
        const { data: techData } = await supabase
            .from('profiles')
            .select('id, full_name, employee_code')
            .in('role', ['technician', 'maint_supervisor']);
        setTechnicians(techData || []);

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
        if (profile?.role !== 'maint_manager') return;
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
                <h2 className="text-2xl font-bold text-surface-900">
                    {profile?.role === 'maint_manager' ? '🛠️ لوحة تحكم مدير الصيانة' : '🔧 لوحة المشرف'}
                </h2>
                <p className="text-surface-500 text-sm mt-1">
                    {profile?.role === 'maint_manager'
                        ? 'إدارة شاملة للبلاغات والفنيين والمخزون والتقييمات'
                        : 'توزيع البلاغات على الفنيين ومتابعة الإصلاح'}
                </p>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                {([
                    { key: 'all', label: 'الكل', icon: Wrench, color: 'bg-surface-50 border-surface-200 text-surface-700' },
                    { key: 'open', label: 'جديد', icon: AlertTriangle, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                    { key: 'assigned', label: 'مُسنَد', icon: Users, color: 'bg-amber-50 border-amber-200 text-amber-700' },
                    { key: 'in_progress', label: 'قيد الإصلاح', icon: Clock, color: 'bg-purple-50 border-purple-200 text-purple-700' },
                    { key: 'resolved', label: 'ينتظر اعتماد', icon: Star, color: 'bg-teal-50 border-teal-200 text-teal-700' },
                    { key: 'closed', label: 'مُغلق', icon: CheckCircle, color: 'bg-green-50 border-green-200 text-green-700' },
                ] as const).map(item => (
                    <button
                        key={item.key}
                        onClick={() => setFilter(item.key)}
                        className={`p-4 rounded-2xl border text-right transition-all ${item.color} ${filter === item.key ? 'ring-2 ring-primary-500 shadow-md' : 'hover:shadow-sm'}`}
                    >
                        <item.icon className="w-5 h-5 mb-1 opacity-60" />
                        <p className="text-2xl font-bold">{counts[item.key]}</p>
                        <p className="text-xs font-medium mt-0.5">{item.label}</p>
                    </button>
                ))}
            </div>

            {/* Tickets List */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-400" /></div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-surface-200 p-16 text-center text-surface-400">
                    <Filter className="w-12 h-12 mx-auto mb-3 text-surface-300" />
                    <p className="font-medium">لا توجد بلاغات في هذه الفئة</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(ticket => {
                        const st = STATUS_LABELS[ticket.status] || { label: ticket.status, color: 'bg-surface-100 text-surface-500 border-surface-200' };
                        const isExpanded = expandedId === ticket.id;
                        const assignedTech = technicians.find(t => t.id === ticket.assigned_to);

                        return (
                            <div key={ticket.id} className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                                {/* Ticket Header */}
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                                    className="w-full flex items-center justify-between p-5 text-right hover:bg-surface-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${st.color}`}>{st.label}</span>
                                        {ticket.priority && ticket.priority !== 'normal' && (
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${ticket.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                                ticket.priority === 'urgent' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                {ticket.priority === 'critical' ? '🔴 حرج' : ticket.priority === 'urgent' ? '🟠 عاجل' : '🟡 مرتفع'}
                                            </span>
                                        )}
                                        <div className="text-right">
                                            <p className="font-semibold text-surface-900">{ticket.asset_name || 'بلاغ صيانة'}</p>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {ticket.created_at ? format(new Date(ticket.created_at), 'PPP - hh:mm a', { locale: ar }) : '—'}
                                                </span>
                                                {assignedTech && (
                                                    <span className="text-primary-600 font-medium">👤 {assignedTech.full_name}</span>
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
                                    <div className="border-t border-surface-100 p-5 space-y-4">
                                        {/* Assignment Section */}
                                        {(ticket.status === 'open' || ticket.status === 'assigned') && (
                                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 space-y-3">
                                                <h4 className="font-bold text-blue-900 flex items-center gap-2">
                                                    <Users className="w-5 h-5" /> تعيين فني للإصلاح
                                                </h4>
                                                <div className="flex gap-3">
                                                    <select
                                                        value={selectedTech}
                                                        onChange={(e) => setSelectedTech(e.target.value)}
                                                        className="flex-1 bg-white border border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/30"
                                                    >
                                                        <option value="">اختر الفني...</option>
                                                        {technicians.map(t => (
                                                            <option key={t.id} value={t.id}>
                                                                {t.full_name} ({t.employee_code})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => handleAssign(ticket.id)}
                                                        disabled={!selectedTech || assigning === ticket.id}
                                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-all"
                                                    >
                                                        {assigning === ticket.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تعيين'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Priority Change (maint_manager only) */}
                                        {profile?.role === 'maint_manager' && ticket.status !== 'closed' && (
                                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-3">
                                                <h4 className="font-bold text-amber-900 flex items-center gap-2">
                                                    <AlertTriangle className="w-5 h-5" /> تعديل الأولوية
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {PRIORITY_OPTIONS.map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => handlePriorityChange(ticket.id, opt.value)}
                                                            disabled={updatingPriority === ticket.id}
                                                            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${opt.color} ${ticket.priority === opt.value ? 'ring-2 ring-offset-1 ring-primary-500' : 'hover:shadow-sm'
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
                                            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                                                <h4 className="font-bold text-green-900 flex items-center gap-2 mb-2">
                                                    <Star className="w-5 h-5" /> تقييم مدير الفرع
                                                </h4>
                                                <div className="flex items-center gap-2 text-xl mb-1" dir="ltr">
                                                    {[1, 2, 3, 4, 5].map(v => (
                                                        <Star key={v} className={`w-6 h-6 ${ticket.rating_score >= v ? 'text-amber-400 fill-amber-400' : 'text-surface-200'}`} />
                                                    ))}
                                                    <span className="text-sm text-green-700 font-bold mr-2">{ticket.rating_score}/5</span>
                                                </div>
                                                {ticket.rating_comment && (
                                                    <p className="text-sm text-green-800 mt-2 bg-green-100/50 rounded-lg p-2">"{ticket.rating_comment}"</p>
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
