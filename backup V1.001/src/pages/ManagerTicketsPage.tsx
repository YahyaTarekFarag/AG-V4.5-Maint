import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import TicketFlow from '../components/tickets/TicketFlow';
import { MapPin, Clock, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Plus, Camera, X } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getGeoLocation } from '../lib/geo';
import { compressImage } from '../lib/image';
import { uploadToDrive } from '../lib/drive';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    open: { label: 'جديد', color: 'bg-blue-100 text-blue-700' },
    assigned: { label: 'مُسنَد للفني', color: 'bg-amber-100 text-amber-700' },
    in_progress: { label: 'قيد الإصلاح', color: 'bg-purple-100 text-purple-700' },
    resolved: { label: '⚡ ينتظر استلامك', color: 'bg-teal-100 text-teal-700 font-bold' },
    closed: { label: 'مُغلق ✓', color: 'bg-surface-100 text-surface-500' },
};

export default function ManagerTicketsPage() {
    const { profile } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'closed'>('all');
    const [showForm, setShowForm] = useState(false);

    // New ticket form
    const [newAssetName, setNewAssetName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [reportedImageUrl, setReportedImageUrl] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => { fetchTickets(); }, [profile]);

    const fetchTickets = async () => {
        if (!profile) return;
        setLoading(true);
        const { data } = await supabase
            .from('tickets')
            .select('*')
            .eq('manager_id', profile.id)
            .order('created_at', { ascending: false });
        if (data) setTickets(data);
        setLoading(false);
    };

    const handleImageUpload = async (file: File) => {
        setUploading(true);
        setFormError(null);
        try {
            const compressed = await compressImage(file);
            const url = await uploadToDrive(compressed as File);
            setReportedImageUrl(url);
        } catch (e: any) {
            setFormError('خطأ في رفع صورة العطل: ' + e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleNewTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || !newAssetName.trim()) return;

        // branch_id is required — must be set on the manager's profile
        if (!profile.branch_id) {
            setFormError('حسابك غير مرتبط بفرع. يرجى التواصل مع الأدمن لتعيين فرعك.');
            return;
        }

        setSubmitting(true);
        setFormError(null);
        try {
            // Attempt GPS (optional — don't block on failure)
            let coords: { lat: number; lng: number } | null = null;
            try { coords = await getGeoLocation(); } catch { /* GPS optional */ }

            const { error } = await supabase.from('tickets').insert([{
                asset_name: newAssetName.trim(),
                description: newDesc.trim(),
                status: 'open',
                manager_id: profile.id,
                branch_id: profile.branch_id,
                reported_at: new Date().toISOString(),
                reported_image_url: reportedImageUrl,
                ...(coords ? { reported_lat: coords.lat, reported_lng: coords.lng } : {}),
            }]);
            if (error) throw error;
            setNewAssetName(''); setNewDesc(''); setReportedImageUrl(null); setShowForm(false);
            fetchTickets();
        } catch (e: any) {
            setFormError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const filtered = tickets.filter(t => {
        if (filter === 'pending') return t.status === 'resolved';
        if (filter === 'closed') return t.status === 'closed';
        return true;
    });

    const input = 'w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all';

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900">بلاغاتي</h2>
                    <p className="text-surface-500 text-sm mt-1">جميع بلاغات العطل التي قمت بتسجيلها</p>
                </div>
                <button
                    onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-primary-500/20 transition-all"
                >
                    <Plus className="w-4 h-4" /> تسجيل بلاغ جديد
                </button>
            </div>

            {/* New Ticket Form */}
            {showForm && (
                <form onSubmit={handleNewTicket} className="bg-white rounded-2xl border border-primary-200 shadow-sm p-6 mb-6 space-y-4">
                    <h3 className="font-bold text-surface-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-primary-500" />
                        تسجيل بلاغ عطل جديد — سيُلتقط موقعك تلقائياً
                    </h3>
                    {formError && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                            <AlertCircle className="w-4 h-4 shrink-0" />{formError}
                        </div>
                    )}
                    <div>
                        <label className="text-xs font-semibold text-surface-500 mb-1 block">عنوان العطل أو اسم المعدة *</label>
                        <input required value={newAssetName} onChange={e => setNewAssetName(e.target.value)} placeholder="مثال: عطل في التكييف المركزي" className={input} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-surface-500 mb-1 block">وصف تفصيلي</label>
                        <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} placeholder="اشرح المشكلة بالتفصيل..." className={input} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-surface-500 mb-1 block">صورة العطل (اختياري)</label>
                        {reportedImageUrl ? (
                            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-primary-100 bg-primary-50">
                                <img src={reportedImageUrl} className="w-full h-full object-cover" />
                                <button type="button" onClick={() => setReportedImageUrl(null)} className="absolute top-2 right-2 p-1.5 bg-white/80 text-red-600 rounded-full shadow-md"><X className="w-4 h-4" /></button>
                            </div>
                        ) : (
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    disabled={uploading}
                                />
                                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary-100 group-hover:border-primary-400 rounded-2xl bg-primary-50/30 transition-all">
                                    {uploading ? (
                                        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                                    ) : (
                                        <Camera className="w-8 h-8 text-primary-400 mb-2" />
                                    )}
                                    <span className="text-sm text-primary-600 font-medium font-bold">التقط صورة للعطل</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 text-surface-600 hover:bg-surface-100 rounded-xl text-sm font-medium transition-colors">إلغاء</button>
                        <button type="submit" disabled={submitting} className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-xl disabled:opacity-70 transition-all">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                            تسجيل مع التقاط الموقع
                        </button>
                    </div>
                </form>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-1 bg-surface-100 p-1 rounded-xl w-fit mb-5">
                {[
                    { id: 'all', label: `الكل (${tickets.length})` },
                    { id: 'pending', label: `ينتظر استلامك (${tickets.filter(t => t.status === 'resolved').length})` },
                    { id: 'closed', label: 'المُغلقة' },
                ].map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f.id ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                            }`}
                    >{f.label}</button>
                ))}
            </div>

            {/* Tickets List */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-400" /></div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-surface-200 p-16 text-center text-surface-400">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-surface-300" />
                    <p className="font-medium">لا توجد بلاغات في هذه الفئة</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(ticket => {
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
                                            <div className="flex items-center gap-3 mt-1 text-xs text-surface-400">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {ticket.reported_at ? format(new Date(ticket.reported_at), 'PPP - hh:mm a', { locale: ar }) : '—'}
                                                </span>
                                                {ticket.reported_lat && (
                                                    <span className="flex items-center gap-1 text-teal-600">
                                                        <MapPin className="w-3 h-3" /> تم التقاط الموقع
                                                    </span>
                                                )}
                                            </div>
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
