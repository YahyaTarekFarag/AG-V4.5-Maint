import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import TicketFlow from '../components/tickets/TicketFlow';
import { MapPin, Clock, Play, Square, Loader2, ChevronDown, ChevronUp, AlertCircle, Timer } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getGeoLocation } from '../lib/geo';

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

    // Shift state
    const [activeShift, setActiveShift] = useState<any | null>(null);
    const [shiftLoading, setShiftLoading] = useState(false);
    const [shiftError, setShiftError] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState<string>('');

    useEffect(() => { fetchTickets(); fetchActiveShift(); }, [profile]);

    // Live elapsed timer
    useEffect(() => {
        if (!activeShift) { setElapsed(''); return; }
        const timer = setInterval(() => {
            const mins = differenceInMinutes(new Date(), new Date(activeShift.start_at));
            const h = Math.floor(mins / 60).toString().padStart(2, '0');
            const m = (mins % 60).toString().padStart(2, '0');
            setElapsed(`${h}:${m}`);
        }, 1000);
        return () => clearInterval(timer);
    }, [activeShift]);

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

    const fetchActiveShift = async () => {
        if (!profile) return;
        const { data } = await supabase
            .from('shifts')
            .select('*')
            .eq('technician_id', profile.id)
            .is('end_at', null)
            .order('start_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        setActiveShift(data);
    };

    const handleShiftToggle = async () => {
        if (!profile) return;
        setShiftLoading(true);
        setShiftError(null);
        try {
            const coords = await getGeoLocation();
            if (activeShift) {
                // End shift
                const { error } = await supabase
                    .from('shifts')
                    .update({ end_at: new Date().toISOString(), end_lat: coords.lat, end_lng: coords.lng })
                    .eq('id', activeShift.id);
                if (error) throw error;
                setActiveShift(null);
            } else {
                // Start shift
                const { data, error } = await supabase
                    .from('shifts')
                    .insert([{
                        technician_id: profile.id,
                        start_at: new Date().toISOString(),
                        start_lat: coords.lat,
                        start_lng: coords.lng,
                    }])
                    .select()
                    .single();
                if (error) throw error;
                setActiveShift(data);
            }
        } catch (e: any) {
            setShiftError(e.message);
        } finally {
            setShiftLoading(false);
        }
    };

    return (
        <DashboardLayout>
            {/* Shift Banner */}
            <div className={`rounded-2xl p-5 mb-6 border flex items-center justify-between flex-wrap gap-4 ${activeShift
                ? 'bg-teal-50 border-teal-200'
                : 'bg-surface-50 border-surface-200'
                }`}>
                <div>
                    <h3 className={`font-bold text-lg ${activeShift ? 'text-teal-800' : 'text-surface-700'}`}>
                        {activeShift ? '🟢 مناوبتك جارية' : '⚫ خارج المناوبة'}
                    </h3>
                    {activeShift ? (
                        <div className="text-sm text-teal-700 mt-1 space-y-0.5">
                            <p className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                بدأت: {format(new Date(activeShift.start_at), 'hh:mm a - PPP', { locale: ar })}
                            </p>
                            <p className="flex items-center gap-2">
                                <Timer className="w-3.5 h-3.5" />
                                <span className="font-mono font-bold text-teal-900 text-lg">{elapsed}</span>
                                ساعة:دقيقة
                            </p>
                            {activeShift.start_lat && (
                                <p className="flex items-center gap-1 text-xs text-teal-600">
                                    <MapPin className="w-3 h-3" />
                                    موقع البداية مُسجَّل
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-surface-500 mt-1">اضغط لبدء مناوبتك وتسجيل موقعك</p>
                    )}
                </div>

                <div className="flex flex-col items-end gap-2">
                    {shiftError && (
                        <div className="flex items-center gap-1 text-red-600 text-xs bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                            <AlertCircle className="w-3 h-3" />{shiftError}
                        </div>
                    )}
                    <button
                        onClick={handleShiftToggle}
                        disabled={shiftLoading}
                        className={`flex items-center gap-2 px-6 py-3 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-70 ${activeShift
                            ? 'bg-red-500 hover:bg-red-400 shadow-red-500/20'
                            : 'bg-teal-600 hover:bg-teal-500 shadow-teal-500/20'
                            }`}
                    >
                        {shiftLoading
                            ? <Loader2 className="w-5 h-5 animate-spin" />
                            : activeShift
                                ? <Square className="w-5 h-5" />
                                : <Play className="w-5 h-5 fill-white" />
                        }
                        {activeShift ? 'إنهاء المناوبة' : 'بدء المناوبة'}
                    </button>
                </div>
            </div>

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
