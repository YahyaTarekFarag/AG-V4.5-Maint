import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import TicketFlow from '../components/tickets/TicketFlow';
import { MapPin, Clock, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Plus, Camera, X, Ticket, FileText, ShieldCheck, Zap, Wrench } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getGeoLocation } from '../lib/geo';
import { compressImage } from '../lib/image';
import { uploadToDrive } from '../lib/drive';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    open: { label: 'بلاغ جديد (قيد التدقيق الإداري)', color: 'bg-blue-900/30 text-blue-400 border border-blue-900/50' },
    assigned: { label: 'تكليف تشغيلي (مسند للفريق)', color: 'bg-amber-900/30 text-amber-400 border border-amber-900/50' },
    in_progress: { label: 'مباشرة ميدانية (قيد التنفيذ)', color: 'bg-purple-900/30 text-purple-400 border border-purple-900/50' },
    resolved: { label: 'تم الإنجاز (بانتظار الحوكمة والاعتماد)', color: 'bg-teal-900/30 text-teal-400 border border-teal-900/50 font-bold' },
    closed: { label: 'مكتمل (تم الإغلاق المؤسسي بنجاح) ✓', color: 'bg-surface-800 text-surface-500 border border-surface-700' },
};

export default function ManagerTicketsPage() {
    const { profile } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'closed'>('all');
    const [showForm, setShowForm] = useState(false);

    // New ticket form
    const [assets, setAssets] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [isEmergency, setIsEmergency] = useState(false);
    const [newAssetName, setNewAssetName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [reportedImageUrl, setReportedImageUrl] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    // Reporter Details (Manual)
    const [reporterName, setReporterName] = useState('');
    const [reporterJob, setReporterJob] = useState('');
    const [reporterPhone, setReporterPhone] = useState('');
    // [TEMPORAL FIX] Initialize with local time instead of UTC to prevent timezone offset drift
    const getLocalISOString = () => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 16);
    };
    const [breakdownTime, setBreakdownTime] = useState(getLocalISOString());

    useEffect(() => {
        fetchTickets();
        if (profile?.branch_id) {
            fetchBranchResources();
        }
    }, [profile]);

    const fetchBranchResources = async () => {
        // Fetch assets for this branch
        const { data: assetData } = await supabase
            .from('maintenance_assets')
            .select('*')
            .eq('branch_id', profile?.branch_id)
            .order('name');
        setAssets(assetData || []);

        // Fetch categories
        const { data: catData } = await supabase
            .from('maintenance_categories')
            .select('*')
            .order('name');
        setCategories(catData || []);
    };

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

        // Validation
        const finalAssetName = selectedAssetId ? assets.find(a => a.id === selectedAssetId)?.name : newAssetName;
        if (!profile || !finalAssetName?.trim()) {
            setFormError('تنبيه: يجب تحديد المعدة من السجل أو تدوين بياناتها يدوياً.');
            return;
        }

        // branch_id is required — must be set on the manager's profile
        if (!profile.branch_id) {
            setFormError('الحساب قيد المراجعة الإدارية؛ لم يتم رصد ارتباط الموقع الإداري (الفرع) بمؤشر صلاحياتك.');
            return;
        }

        setSubmitting(true);
        setFormError(null);
        try {
            // Attempt GPS (optional — don't block on failure)
            let coords: { lat: number; lng: number } | null = null;
            try { coords = await getGeoLocation(); } catch { /* GPS optional */ }

            const { error } = await supabase.from('tickets').insert([{
                asset_id: selectedAssetId || null,
                asset_name: finalAssetName.trim(),
                category_id: selectedCategoryId || null,
                is_emergency: isEmergency,
                description: newDesc.trim(),
                status: 'open',
                manager_id: profile.id,
                branch_id: profile.branch_id,
                reported_at: new Date().toISOString(),
                reported_image_url: reportedImageUrl,
                downtime_start: new Date(breakdownTime).toISOString(),
                reporter_name: reporterName.trim(),
                reporter_job: reporterJob.trim(),
                reporter_phone: reporterPhone.trim(),
                breakdown_time: new Date(breakdownTime).toISOString(),
                ...(coords ? { reported_lat: coords.lat, reported_lng: coords.lng } : {}),
            }]);
            if (error) throw error;

            // Reset form
            setNewAssetName('');
            setSelectedAssetId('');
            setSelectedCategoryId('');
            setIsEmergency(false);
            setNewDesc('');
            setReporterName('');
            setReporterJob('');
            setReporterPhone('');
            setBreakdownTime(new Date().toISOString().slice(0, 16));
            setReportedImageUrl(null);
            setShowForm(false);
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


    const stats = {
        total: tickets.length,
        pending: tickets.filter(t => t.status === 'open' || t.status === 'assigned' || t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        emergency: tickets.filter(t => t.is_emergency && t.status !== 'closed').length
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-white flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-surface-900 border border-surface-800 shadow-2xl">
                                <Ticket className="w-8 h-8 text-brand-blaban" />
                            </div>
                            إدارة العمليات الميدانية بالفرع
                        </h2>
                        <p className="text-surface-400 font-medium mt-1">مركز التحكم في بلاغات الصيانة، الكوادر الفنية، والجودة التشغيلية</p>
                    </div>
                    <button
                        onClick={() => setShowForm(v => !v)}
                        className="flex items-center gap-2 px-6 py-3.5 bg-brand-blaban hover:bg-opacity-90 text-white font-bold rounded-2xl shadow-xl shadow-brand-blaban/20 transition-all active:scale-95"
                    >
                        {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                        {showForm ? 'إغلاق نافذة البلاغ' : 'فتح بلاغ صيانة جديد'}
                    </button>
                </div>

                {/* KPI Bar */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-premium p-6 rounded-3xl border border-surface-800 flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-surface-800 flex items-center justify-center text-surface-400 group-hover:text-brand-blaban transition-colors shadow-inner">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-surface-500 uppercase tracking-widest">إجمالي البلاغات</p>
                            <p className="text-2xl font-black text-white">{stats.total}</p>
                        </div>
                    </div>
                    <div className="glass-premium p-6 rounded-3xl border border-surface-800 flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-surface-500 uppercase tracking-widest">قيد المعالجة</p>
                            <p className="text-2xl font-black text-white">{stats.pending}</p>
                        </div>
                    </div>
                    <div className="glass-premium p-6 rounded-3xl border border-surface-800 flex items-center gap-4 group">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-surface-500 uppercase tracking-widest">بانتظار الاعتماد</p>
                            <p className="text-2xl font-black text-white tracking-tight">{stats.resolved}</p>
                        </div>
                    </div>
                    <div className="glass-premium p-6 rounded-3xl border border-red-500/10 flex items-center gap-4 group animate-pulse-premium">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-500 shadow-inner">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-red-500/70 uppercase tracking-widest">بلاغات حرجة</p>
                            <p className="text-2xl font-black text-white">{stats.emergency}</p>
                        </div>
                    </div>
                </div>

                {/* New Ticket Form (Modern Glass) */}
                {showForm && (
                    <div className="glass-premium rounded-[2.5rem] border border-brand-blaban/20 p-8 shadow-2xl animate-in fade-in slide-in-from-top-6 duration-500">
                        <form onSubmit={handleNewTicket} className="space-y-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-black text-white flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-brand-blaban/10 flex items-center justify-center text-brand-blaban">
                                        <Plus className="w-6 h-6" />
                                    </div>
                                    توصيف مأمورية صيانة جديدة
                                </h3>
                                <div className="px-4 py-2 bg-surface-950 rounded-xl border border-surface-800 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-surface-500 uppercase tracking-widest">GPS Tracking Active</span>
                                </div>
                            </div>

                            {formError && (
                                <div className="flex items-center gap-3 p-4 bg-red-900/20 text-red-400 rounded-2xl text-sm border border-red-900/30 animate-in shake duration-300">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <span className="font-bold">{formError}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-surface-500 uppercase tracking-widest block px-1">المعدة من سجل الأصول</label>
                                    <select
                                        value={selectedAssetId}
                                        onChange={e => setSelectedAssetId(e.target.value)}
                                        className="w-full bg-surface-950 border border-surface-800 rounded-2xl px-5 py-4 text-white focus:border-brand-blaban outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">-- اختر المعدة من السجل المعتمد --</option>
                                        {assets.map(a => (
                                            <option key={a.id} value={a.id}>{a.name} ({a.model_number || 'S/N: Not Specified'})</option>
                                        ))}
                                        <option value="manual">-- تدوين بيانات غير مسجلة --</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-surface-500 uppercase tracking-widest block px-1">تصنيف النطاق الفني</label>
                                    <select
                                        required
                                        value={selectedCategoryId}
                                        onChange={e => setSelectedCategoryId(e.target.value)}
                                        className="w-full bg-surface-950 border border-surface-800 rounded-2xl px-5 py-4 text-white focus:border-brand-blaban outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">-- حدد التصنيف الفني --</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {(selectedAssetId === 'manual' || (selectedAssetId === '' && assets.length === 0)) && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="text-xs font-black text-surface-500 uppercase tracking-widest block px-1 mb-2">اسم المعدة / عنوان البلاغ المالي</label>
                                    <input
                                        required
                                        value={newAssetName}
                                        onChange={e => setNewAssetName(e.target.value)}
                                        placeholder="مثال: تعطل ضاغط التبريد رقم 4"
                                        className="w-full bg-surface-950 border border-surface-800 rounded-2xl px-5 py-4 text-white focus:border-brand-blaban outline-none transition-all"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-black text-surface-500 uppercase tracking-widest block px-1 mb-2">اسم مدير الموقع</label>
                                    <input required value={reporterName} onChange={e => setReporterName(e.target.value)} placeholder="الاسم الكامل" className="w-full bg-surface-950 border border-surface-800 rounded-2xl px-5 py-4 text-white" />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-surface-500 uppercase tracking-widest block px-1 mb-2">الوظيفة الإدارية</label>
                                    <input required value={reporterJob} onChange={e => setReporterJob(e.target.value)} placeholder="المسمى الوظيفي" className="w-full bg-surface-950 border border-surface-800 rounded-2xl px-5 py-4 text-white" />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-surface-500 uppercase tracking-widest block px-1 mb-2">رقم التواصل المباشر</label>
                                    <input required value={reporterPhone} onChange={e => setReporterPhone(e.target.value)} placeholder="01XXXXXXXXX" className="w-full bg-surface-950 border border-surface-800 rounded-2xl px-5 py-4 text-white font-outfit" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-surface-500 uppercase tracking-widest block px-1">توقيت التوقف الفعلي</label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={breakdownTime}
                                            onChange={e => setBreakdownTime(e.target.value)}
                                            className="w-full bg-surface-950 border border-surface-800 rounded-2xl px-5 py-4 text-white font-outfit"
                                        />
                                    </div>
                                    <div className="flex items-center gap-4 p-4 bg-red-950/20 border border-red-900/30 rounded-2xl">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={isEmergency} onChange={e => setIsEmergency(e.target.checked)} className="sr-only peer" />
                                            <div className="w-12 h-6 bg-surface-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 shadow-inner"></div>
                                        </label>
                                        <div>
                                            <p className="text-sm font-black text-red-500">بلاغ طوارئ (حرج للغاية)</p>
                                            <p className="text-[10px] text-red-500/70 font-bold uppercase tracking-wider">High-Priority Operational Outage</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-black text-surface-500 uppercase tracking-widest block px-1">توثيق الحالة (اختياري)</label>
                                    {reportedImageUrl ? (
                                        <div className="relative group rounded-2xl overflow-hidden border border-surface-800 bg-surface-950 aspect-[2/1]">
                                            <img src={reportedImageUrl} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500" />
                                            <button type="button" onClick={() => setReportedImageUrl(null)} className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-xl shadow-xl hover:scale-110 transition-transform"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <div className="relative group aspect-[2/1]">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                disabled={uploading}
                                            />
                                            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-surface-800 hover:border-brand-blaban/50 rounded-2xl bg-surface-950/50 hover:bg-surface-900 transition-all group">
                                                {uploading ? <Loader2 className="w-10 h-10 text-brand-blaban animate-spin" /> : <Camera className="w-10 h-10 text-surface-700 group-hover:text-brand-blaban transition-colors" />}
                                                <p className="text-xs font-black text-surface-500 mt-3 uppercase tracking-widest">إدراج صورة العطل</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-surface-500 uppercase tracking-widest block px-1">التوصيف الفني للعجز/العطل</label>
                                <textarea
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    rows={3}
                                    placeholder="يرجى وصف الأعراض بدقة لتسريع عملية التشخيص الفنية..."
                                    className="w-full bg-surface-950 border border-surface-800 rounded-2xl px-5 py-4 text-white focus:border-brand-blaban outline-none transition-all"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-4 pt-4 border-t border-surface-800">
                                <button type="button" onClick={() => setShowForm(false)} className="px-8 py-4 text-surface-500 font-black uppercase tracking-widest hover:text-white transition-colors">إلغاء الأمر</button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-10 py-4 bg-brand-blaban text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-brand-blaban/30 flex items-center gap-3 disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                    تأكيد البلاغ وتفعيل الرصد
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filter and Content */}
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex gap-2 p-1.5 bg-surface-900 rounded-2xl border border-surface-800 w-fit">
                            {[
                                { id: 'all', label: 'كافة المأموريات' },
                                { id: 'pending', label: 'بانتظار الاعتماد' },
                                { id: 'closed', label: 'المؤرشف والمنتهي' },
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id as any)}
                                    className={clsx(
                                        "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                        filter === f.id ? "bg-surface-800 text-brand-blaban shadow-inner" : "text-surface-500 hover:text-surface-300"
                                    )}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 opacity-20">
                            <Loader2 className="w-16 h-16 animate-spin text-brand-blaban mb-4" />
                            <p className="text-xs font-black uppercase tracking-[0.3em]">Synchronizing Operations...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="glass-premium rounded-[3rem] border border-surface-800 p-24 text-center">
                            <div className="w-20 h-20 bg-surface-800/50 rounded-full flex items-center justify-center mx-auto mb-6 text-surface-700">
                                <FileText className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-black text-white mb-2">السجل التشغيلي فارغ حالياً</h3>
                            <p className="text-surface-500 font-bold max-w-sm mx-auto">لم يتم رصد بلاغات للصيانة أو مهام ميدانية ضمن هذا التصنيف في نطاق صلاحياتك الحالية.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filtered.map(ticket => {
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
                                            className="w-full flex items-center gap-6 p-6 text-right group"
                                        >
                                            <div className={clsx(
                                                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                                                ticket.is_emergency ? "bg-red-500/10 text-red-500" : "bg-surface-800 text-surface-400"
                                            )}>
                                                {ticket.is_emergency ? <Zap className="w-6 h-6 animate-pulse" /> : <Wrench className="w-6 h-6" />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className={clsx("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border", st.color)}>
                                                        {st.label}
                                                    </span>
                                                    {ticket.is_emergency && <span className="bg-red-500/20 text-red-500 text-[9px] font-black px-2 py-1 rounded-lg border border-red-500/20">EMERGENCY</span>}
                                                </div>
                                                <h4 className="text-lg font-black text-white truncate">{ticket.asset_name || 'بلاغ صيانة عام'}</h4>
                                                <div className="flex items-center gap-4 mt-1.5">
                                                    <div className="flex items-center gap-1.5 text-xs text-surface-500 font-bold">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {format(new Date(ticket.reported_at), 'PPP · p', { locale: ar })}
                                                    </div>
                                                    {ticket.reported_lat && (
                                                        <div className="flex items-center gap-1.5 text-xs text-emerald-500/70 font-black uppercase">
                                                            <MapPin className="w-3.5 h-3.5" /> GPS Verified
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                <div className="flex -space-x-3 rtl:space-x-reverse opacity-40">
                                                    <div className="w-8 h-8 rounded-full border-2 border-surface-900 bg-surface-800" />
                                                    <div className="w-8 h-8 rounded-full border-2 border-surface-900 bg-brand-blaban/20" />
                                                </div>
                                                <div className={clsx("p-2 rounded-xl border border-surface-800 transition-colors", isExpanded ? "bg-brand-blaban text-white" : "bg-surface-800 text-surface-500")}>
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t border-surface-800 p-8 animate-in fade-in zoom-in-95 duration-300">
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
