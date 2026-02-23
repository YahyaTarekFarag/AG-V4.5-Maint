import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Clock, Play, Square, Loader2, AlertCircle, Timer } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getGeoLocation } from '../../lib/geo';

export default function ShiftStatus() {
    const { profile } = useAuth();
    const [activeShift, setActiveShift] = useState<any | null>(null);
    const [shiftLoading, setShiftLoading] = useState(true);
    const [shiftError, setShiftError] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState<string>('');

    useEffect(() => {
        fetchActiveShift();
    }, [profile]);

    // Live elapsed timer
    useEffect(() => {
        if (!activeShift) {
            setElapsed('');
            return;
        }
        const timer = setInterval(() => {
            const mins = differenceInMinutes(new Date(), new Date(activeShift.start_at));
            const h = Math.floor(mins / 60).toString().padStart(2, '0');
            const m = (mins % 60).toString().padStart(2, '0');
            setElapsed(`${h}:${m}`);
        }, 1000);
        return () => clearInterval(timer);
    }, [activeShift]);

    const fetchActiveShift = async () => {
        if (!profile || profile.role !== 'technician') {
            setShiftLoading(false);
            return;
        }

        try {
            const { data } = await supabase
                .from('shifts')
                .select('*')
                .eq('technician_id', profile.id)
                .is('end_at', null)
                .order('start_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            setActiveShift(data);
        } catch (e) {
            console.error('Error fetching shift', e);
        } finally {
            setShiftLoading(false);
        }
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
                    .update({
                        end_at: new Date().toISOString(),
                        end_lat: coords.lat,
                        end_lng: coords.lng
                    })
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

    if (!profile || profile.role !== 'technician') return null;

    return (
        <div className={`rounded-2xl p-5 mb-6 border flex items-center justify-between flex-wrap gap-4 transition-all duration-300 ${activeShift
            ? 'bg-teal-50 border-teal-200 shadow-sm'
            : 'bg-surface-50 border-surface-200'
            }`}>
            <div>
                <h3 className={`font-bold text-lg flex items-center gap-2 ${activeShift ? 'text-teal-800' : 'text-surface-700'}`}>
                    <div className={`w-2 h-2 rounded-full ${activeShift ? 'bg-teal-500 animate-pulse' : 'bg-surface-400'}`} />
                    {activeShift ? 'مناوبتك جارية الآن' : 'خارج وقت المناوبة'}
                </h3>
                {activeShift ? (
                    <div className="text-sm text-teal-700 mt-1 space-y-0.5">
                        <p className="flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            وقت الحضور: {format(new Date(activeShift.start_at), 'hh:mm a - PPP', { locale: ar })}
                        </p>
                        <p className="flex items-center gap-2">
                            <Timer className="w-4 h-4" />
                            <span className="font-mono font-bold text-teal-900 text-xl tracking-wider">{elapsed}</span>
                            <span className="text-xs font-semibold">(ساعة:دقيقة)</span>
                        </p>
                        {activeShift.start_lat && (
                            <p className="flex items-center gap-1 text-xs text-teal-600 bg-teal-100/50 w-fit px-2 py-0.5 rounded-full mt-1">
                                <MapPin className="w-3 h-3" />
                                الموقع مسجّل آلياً بنجاح
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-surface-500 mt-1 font-medium">اضغط على الزر أدناه لبدء مناوبتك وتسجيل موقعك الجغرافي</p>
                )}
            </div>

            <div className="flex flex-col items-end gap-2">
                {shiftError && (
                    <div className="flex items-center gap-1 text-red-600 text-xs bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 mb-1 animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{shiftError}</span>
                    </div>
                )}
                <button
                    onClick={handleShiftToggle}
                    disabled={shiftLoading}
                    className={`flex items-center gap-2 px-8 py-3.5 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-70 ${activeShift
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
                    <span>{activeShift ? 'إنهاء المناوبة' : 'تسجيل حضور (بدأ)'}</span>
                </button>
            </div>
        </div>
    );
}
