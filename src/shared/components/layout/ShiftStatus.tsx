import { useEffect, useState } from 'react';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { MapPin, Clock, Play, Square, Loader2, AlertCircle, Timer } from 'lucide-react';
import { format, differenceInMinutes, differenceInHours } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getGeoLocation } from '@shared/lib/geo';

export default function ShiftStatus() {
    const { profile } = useAuth();
    const [activeShift, setActiveShift] = useState<any | null>(null);
    const [shiftLoading, setShiftLoading] = useState(true);
    const [shiftError, setShiftError] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState<string>('');

    useEffect(() => {
        fetchActiveShift();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    // Live elapsed timer
    useEffect(() => {
        if (!activeShift) {
            setElapsed('');
            return;
        }
        const timer = setInterval(() => {
            const mins = differenceInMinutes(new Date(), new Date(activeShift.clock_in));
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
                .from('technician_attendance' as any)
                .select('*')
                .eq('profile_id', profile.id)
                .is('clock_out', null)
                .order('clock_in', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                const diffHours = differenceInHours(new Date(), new Date(data.clock_in));
                if (diffHours >= 16) {
                    // Auto-close shift that exceeded 16h
                    await supabase
                        .from('technician_attendance' as any)
                        .update({
                            clock_out: new Date(new Date(data.clock_in).getTime() + 16 * 60 * 60 * 1000).toISOString(),
                            notes: (data.notes ? data.notes + '\n' : '') + '⚠️ تم إغلاق المناوبة تلقائياً (تجاوز الحد الأقصى 16 ساعة)'
                        })
                        .eq('id', data.id);

                    setActiveShift(null);
                    setShiftError('تم إغلاق مناوبتك السابقة تلقائياً بسبب تركها معلقة لأكثر من 16 ساعة.');
                } else {
                    setActiveShift(data);
                }
            } else {
                setActiveShift(null);
            }
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
                    .from('technician_attendance' as any)
                    .update({
                        clock_out: new Date().toISOString(),
                        clock_out_lat: coords.lat,
                        clock_out_lng: coords.lng
                    })
                    .eq('id', activeShift.id);
                if (error) throw error;
                setActiveShift(null);
            } else {
                // Start shift
                const { data, error } = await supabase
                    .from('technician_attendance' as any)
                    .insert([{
                        profile_id: profile.id,
                        clock_in: new Date().toISOString(),
                        clock_in_lat: coords.lat,
                        clock_in_lng: coords.lng,
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
            ? 'bg-teal-900/10 border-teal-900/30 shadow-sm'
            : 'bg-surface-900 border-surface-800'
            }`}>
            <div>
                <h3 className={`font-bold text-lg flex items-center gap-2 ${activeShift ? 'text-teal-400' : 'text-surface-300'}`}>
                    <div className={`w-2 h-2 rounded-full ${activeShift ? 'bg-teal-500 animate-pulse' : 'bg-surface-600'}`} />
                    {activeShift ? 'مناوبتك جارية الآن' : 'خارج وقت المناوبة'}
                </h3>
                {activeShift ? (
                    <div className="text-sm text-teal-400 mt-1 space-y-0.5">
                        <p className="flex items-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            وقت الحضور: {format(new Date(activeShift.clock_in), 'hh:mm a - PPP', { locale: ar })}
                        </p>
                        <p className="flex items-center gap-2">
                            <Timer className="w-4 h-4" />
                            <span className="font-mono font-bold text-teal-100 text-xl tracking-wider">{elapsed}</span>
                            <span className="text-xs font-semibold">(ساعة:دقيقة)</span>
                        </p>
                        {activeShift.clock_in_lat && (
                            <p className="flex items-center gap-1 text-xs text-teal-400/80 bg-teal-900/20 w-fit px-2 py-0.5 rounded-full mt-1">
                                <MapPin className="w-3 h-3" />
                                الموقع مسجّل آلياً بنجاح (GPS)
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-surface-500 mt-1 font-medium">اضغط على الزر أدناه لبدء مناوبتك وتسجيل موقعك الجغرافي</p>
                )}
            </div>

            <div className="flex flex-col items-end gap-2">
                {shiftError && (
                    <div className="flex items-center gap-1 text-red-400 text-xs bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-900/30 mb-1 animate-in fade-in slide-in-from-top-1">
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
