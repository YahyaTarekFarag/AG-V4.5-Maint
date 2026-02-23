import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import TicketFlow from '../components/tickets/TicketFlow';
import { Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ShiftStatus from '../components/layout/ShiftStatus';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    open: { label: 'جديد', color: 'bg-blue-100 text-blue-700' },
    assigned: { label: 'مُسنَد إليك', color: 'bg-amber-100 text-amber-700' },
    in_progress: { label: 'قيد الإصلاح', color: 'bg-purple-100 text-purple-700' },
    resolved: { label: 'تم الإصلاح', color: 'bg-teal-100 text-teal-700' },
};

export default function TechnicianTicketsPage() {
    const { profile } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    useEffect(() => { fetchTickets(); }, [profile]);

    const fetchTickets = async () => {
        if (!profile) return;
        setLoading(true);
        // Show open tickets assigned to this technician (not closed)
        const { data } = await supabase
            .from('tickets')
            .select('*')
            .eq('assigned_to', profile.id)
            .in('status', ['assigned', 'in_progress'])
            .order('created_at', { ascending: false });
        if (data) setTickets(data);
        setLoading(false);
    };

    return (
        <DashboardLayout>
            <ShiftStatus />

            {/* Header */}
            <div className="mb-5">
                <h2 className="text-2xl font-bold text-surface-900">البلاغات المُسنَدة إليّ</h2>
                <p className="text-surface-500 text-sm mt-1">البلاغات المفتوحة التي تحتاج إلى تدخلك</p>
            </div>

            {/* Tickets */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-400" /></div>
            ) : tickets.length === 0 ? (
                <div className="bg-white rounded-2xl border border-surface-200 p-16 text-center text-surface-400">
                    <div className="w-16 h-16 bg-surface-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-surface-200">
                        <Clock className="w-8 h-8 text-surface-300" />
                    </div>
                    <p className="font-medium text-lg">لا توجد بلاغات مفتوحة حالياً</p>
                    <p className="text-sm mt-1">جميع البلاغات المُسنَدة إليك تمت معالجتها</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {tickets.map(ticket => {
                        const st = STATUS_LABELS[ticket.status] || { label: ticket.status, color: 'bg-surface-100 text-surface-500' };
                        const isExpanded = expandedId === ticket.id;
                        return (
                            <div key={ticket.id} className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                                    className="w-full flex items-center justify-between p-5 text-right hover:bg-surface-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>
                                        <div className="text-right">
                                            <p className="font-semibold text-surface-900">{ticket.asset_name || ticket.description || 'بلاغ صيانة'}</p>
                                            <p className="text-xs text-surface-400 mt-0.5 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {format(new Date(ticket.created_at), 'PPP - hh:mm a', { locale: ar })}
                                            </p>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-surface-400" /> : <ChevronDown className="w-5 h-5 text-surface-400" />}
                                </button>
                                {isExpanded && (
                                    <div className="border-t border-surface-100 p-5">
                                        <TicketFlow ticket={ticket} onUpdate={fetchTickets} />
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
