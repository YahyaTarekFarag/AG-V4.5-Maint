import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@shared/lib/supabase';
import { getGeoLocation } from '@shared/lib/geo';
import { useAuth } from '@shared/hooks/useAuth';
import {
    MapPin, Play, CheckCircle, Star, Package, Loader2, AlertCircle, Camera, Eye,
    X, Save, QrCode, ClipboardList, ShieldCheck, Zap,
    History, UserCog, HardHat, Wrench
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { compressImage } from '@shared/lib/image';
import { uploadToDrive } from '@shared/lib/drive';
import BottomSheet from '@shared/components/ui/BottomSheet';
import QRScanner from '@shared/components/ui/QRScanner';
import { MaintenanceOrchestrator } from '../lib/maintenance-orchestrator';

interface TicketFlowProps {
    ticket: any;
    onUpdate: () => void;
}

export default function TicketFlow({ ticket, onUpdate }: TicketFlowProps) {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isResolveSheetOpen, setIsResolveSheetOpen] = useState(false);
    const [isRateSheetOpen, setIsRateSheetOpen] = useState(false);
    const [isAssetScannerOpen, setIsAssetScannerOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [inventory, setInventory] = useState<any[]>([]);
    const [selectedPart, setSelectedPart] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [partsUsed, setPartsUsed] = useState<{ part_id: string, name: string, qty: number, cost_unit: number, total: number }[]>([]);

    // Financial States
    const [partsCost, setPartsCost] = useState(ticket.parts_cost || 0);
    const [laborCost, setLaborCost] = useState(ticket.labor_cost || 0);

    // States for Manager Evaluation
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');

    // State for Technician Repair Photo
    const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // KPI Readiness States
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [assets, setAssets] = useState<any[]>([]);
    const [selectedAsset, setSelectedAsset] = useState(ticket.asset_id || '');
    const [downtimeStart, setDowntimeStart] = useState(ticket.downtime_start || '');

    useEffect(() => {
        if (ticket.status === 'in_progress' && profile && (['technician', 'maintenance_supervisor', 'admin', 'manager', 'maintenance_manager'].includes(profile.role))) {
            fetchInventory();
            fetchKPIData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticket.status, profile]);

    const fetchInventory = async () => {
        const { data } = await supabase.from('inventory').select('*').eq('is_deleted', false).gt('quantity', 0);
        if (data) setInventory(data);
    };

    const fetchKPIData = async () => {
        const { data: cats } = await supabase.from('maintenance_categories').select('*').order('name');
        if (cats) setCategories(cats);

        const { data: asts } = await supabase.from('maintenance_assets').select('*').eq('branch_id', ticket.branch_id).eq('is_deleted', false).order('name');
        if (asts) setAssets(asts);
    };

    const addPart = () => {
        if (!selectedPart || quantity <= 0) return;
        const part = inventory.find(p => p.id === selectedPart);
        if (part) {
            if (quantity > part.quantity) {
                setError(`تنبيه: الكمية المتوفرة في المخزن هي ${part.quantity} وحدة فقط.`);
                return;
            }
            const costUnit = part.price || 0;
            const total = costUnit * quantity;
            setPartsUsed([...partsUsed, {
                part_id: part.id,
                name: part.name,
                qty: quantity,
                cost_unit: costUnit,
                total: total
            }]);

            // Auto-update total parts cost
            setPartsCost((prev: number) => prev + total);

            setSelectedPart('');
            setQuantity(1);
            setError(null);
        }
    };

    const removePart = (index: number) => {
        const removed = partsUsed[index];
        setPartsCost((prev: number) => Math.max(0, prev - removed.total));
        setPartsUsed(partsUsed.filter((_, i) => i !== index));
    };

    const handleImageUpload = async (file: File) => {
        setUploading(true);
        setError(null);
        try {
            const compressed = await compressImage(file);
            const url = await uploadToDrive(compressed as File);
            setResolvedImageUrl(url);
        } catch (e: any) {
            setError('خطأ في رفع صورة الإصلاح: ' + e.message);
        } finally {
            setUploading(false);
        }
    };

    const renderResolutionForm = () => (
        <div className="space-y-6">
            <h4 className="font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-teal-400" />
                اعتماد الإصلاح وتوثيق الأعمال الفنية
            </h4>

            {/* Inventory / Parts Consumption */}
            <div className="bg-surface-900 rounded-2xl p-5 border border-surface-800 space-y-5">
                <div className="flex items-center gap-2 text-white border-b border-surface-800 pb-3">
                    <Package className="w-5 h-5 text-surface-500" />
                    <h4 className="font-semibold">دراسة استهلاك قطع الغيار (اختياري)</h4>
                </div>

                <div className="flex flex-col gap-3">
                    <select
                        className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-blaban/30 text-white"
                        value={selectedPart}
                        onChange={(e) => setSelectedPart(e.target.value)}
                    >
                        <option value="">تحديد الصنف المخزني...</option>
                        {inventory.map(p => <option key={p.id} value={p.id}>{p.name} (المتوفر: {p.quantity})</option>)}
                    </select>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="w-24 bg-surface-800 border border-surface-700 rounded-xl px-4 py-2 text-sm text-white"
                        />
                        <button
                            type="button"
                            onClick={addPart}
                            className="flex-1 px-4 py-2 bg-surface-700 text-white rounded-xl font-bold hover:bg-surface-600 transition-colors"
                        >
                            تأكيد الإضافة
                        </button>
                    </div>
                </div>

                {partsUsed.length > 0 && (
                    <ul className="space-y-2">
                        {partsUsed.map((pt, i) => (
                            <li key={i} className="flex justify-between items-center bg-surface-800 border border-surface-700 p-3 rounded-xl text-sm shadow-sm">
                                <span className="text-white">{pt.name} <span className="text-surface-500 mx-2">×</span> <span className="font-black text-brand-blaban">{pt.qty}</span></span>
                                <button type="button" onClick={() => removePart(i)} className="text-red-400 font-bold hover:bg-red-400/10 p-1.5 rounded-lg transition-colors">إزالة</button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Image Upload for Resolution */}
            <div className="space-y-3">
                <label className="text-sm font-bold text-white flex items-center gap-1">
                    <Camera className="w-4 h-4 text-brand-blaban" /> توثيق الإصلاح (صورة إجبارية)
                </label>
                {resolvedImageUrl ? (
                    <div className="relative w-full aspect-video rounded-xl border border-surface-700 overflow-hidden group">
                        <img src={resolvedImageUrl} className="w-full h-full object-cover" alt="Repair" />
                        <button
                            onClick={() => setResolvedImageUrl('')}
                            className="absolute top-2 right-2 p-1.5 bg-surface-900/80 text-red-400 rounded-full shadow-md backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="relative group">
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-surface-800 group-hover:border-brand-blaban/30 bg-surface-950 rounded-2xl transition-all">
                            {uploading ? (
                                <Loader2 className="w-8 h-8 text-brand-blaban animate-spin" />
                            ) : (
                                <Camera className="w-8 h-8 text-surface-600 group-hover:text-brand-blaban mb-2 transition-colors" />
                            )}
                            <span className="text-sm text-surface-400 font-medium text-center">
                                {uploading ? 'جاري معالجة وتوثيق الصورة...' : 'يرجى التقاط صورة للمعدة بعد إتمام الإصلاح'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-white flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-500" /> تصنيف العطل الفني (إلزامي)
                    </label>
                    <select
                        className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2 text-sm text-white"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="">تحديد نوع العطل المكتشف...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-white flex items-center gap-1">
                        <Package className="w-4 h-4 text-teal-400" /> الارتباط بالسجل الفني للمعدة (الأصل)
                    </label>
                    <div className="flex gap-2">
                        <select
                            className="flex-1 bg-surface-800 border border-surface-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-brand-blaban/30 text-white"
                            value={selectedAsset}
                            onChange={(e) => setSelectedAsset(e.target.value)}
                        >
                            <option value="">البحث في سجل المعدات والأصول...</option>
                            {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.serial_number || 'بدون رقم تسلسلي'})</option>)}
                        </select>
                        <button
                            type="button"
                            onClick={() => setIsAssetScannerOpen(true)}
                            className="p-2 bg-surface-800 border border-surface-700 rounded-xl text-surface-400 hover:text-brand-blaban hover:border-brand-blaban/30 transition-all shadow-sm"
                            title="مسح رمز الاستجابة السريعة (QR)"
                        >
                            <QrCode className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="space-y-4 sm:col-span-2 bg-surface-900 p-5 rounded-2xl border border-surface-800">
                    <h5 className="text-xs font-black text-brand-blaban uppercase tracking-widest flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4" /> التكاليف المالية التقريبية
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-surface-500 uppercase">تكلفة قطع الغيار</label>
                            <input
                                type="number"
                                value={partsCost}
                                onChange={(e) => setPartsCost(Number(e.target.value))}
                                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2 text-sm text-white"
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-surface-500 uppercase">تكلفة العمالة/أخرى</label>
                            <input
                                type="number"
                                value={laborCost}
                                onChange={(e) => setLaborCost(Number(e.target.value))}
                                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2 text-sm text-white"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-bold text-white">وقت التوقف الفعلي للمعدة (Downtime)</label>
                    <input
                        type="datetime-local"
                        className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2 text-sm text-white"
                        value={downtimeStart ? format(new Date(downtimeStart), "yyyy-MM-dd'T'HH:mm") : ''}
                        onChange={(e) => setDowntimeStart(e.target.value)}
                    />
                    <p className="text-[10px] text-surface-500">يرجى دقة تحديد وقت التوقف لضمان دقة معايير كفاءة المعدات (OEE).</p>
                </div>
            </div>

            <p className="text-xs text-surface-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> سيتم التقاط آخر موقع لك لإثبات إتمام العمل موقعياً</p>

            <button
                onClick={() => handleAction('resolve')}
                disabled={loading || !resolvedImageUrl || uploading || !selectedCategory}
                className="flex items-center justify-center gap-2 w-full px-6 py-5 bg-brand-blaban hover:bg-brand-blaban/90 text-white rounded-2xl font-black shadow-2xl shadow-brand-blaban/30 transition-all disabled:opacity-70 active:scale-95"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                <span>اعتماد الإصلاح وتحديث مؤشرات الجودة</span>
            </button>
        </div>
    );

    const renderRateForm = () => (
        <div className="bg-brand-blaban/5 rounded-2xl p-6 border border-brand-blaban/20 space-y-6">
            <h4 className="font-bold text-white border-b border-surface-800 pb-3 flex items-center gap-2 text-lg">
                <CheckCircle className="w-6 h-6 text-teal-400" />
                اعتماد الاستلام وتقييم جودة الخدمة
            </h4>

            {/* Display Technician's Repair Photo for Manager */}
            {ticket.resolved_image_url && (
                <div className="space-y-2">
                    <p className="text-sm font-bold text-brand-blaban">توثيق الإصلاح الفني:</p>
                    <a href={ticket.resolved_image_url} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl aspect-video w-full bg-surface-900 border border-surface-800 shadow-sm">
                        <img src={ticket.resolved_image_url} className="w-full h-full object-cover" alt="Repair Complete" />
                        <div className="absolute inset-0 bg-brand-blaban/10 flex items-center justify-center group-hover:bg-brand-blaban/20 transition-all">
                            <Eye className="w-8 h-8 text-brand-blaban opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </a>
                </div>
            )}

            <div className="bg-surface-900 p-5 rounded-2xl border border-surface-800 shadow-sm space-y-5">
                <div>
                    <label className="block text-sm font-semibold text-brand-blaban mb-3">تقييم الخدمة الميدانية (إلزامي)</label>
                    <div className="flex gap-3 text-3xl" dir="ltr">
                        {[1, 2, 3, 4, 5].map(v => (
                            <button key={v} onClick={() => setRating(v)} className={clsx("transition-transform hover:scale-110 active:scale-95", rating >= v ? "text-amber-400" : "text-surface-700")}>
                                <Star className={clsx("w-9 h-9", rating >= v ? "fill-current" : "")} />
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-brand-blaban mb-2">ملاحظات جودة الإصلاح (إلزامي)</label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="يرجى تدوين الملاحظات حول كفاءة الإصلاح ونظافة موقع العمل..."
                        className="w-full bg-surface-800 border border-surface-700 rounded-xl p-4 focus:ring-4 focus:ring-brand-blaban/10 focus:border-brand-blaban transition-all text-white"
                        rows={3}
                    />
                </div>

                <button
                    onClick={() => handleAction('close')}
                    disabled={loading || !comment.trim()}
                    className="flex items-center justify-center w-full px-6 py-5 bg-brand-blaban hover:bg-brand-blaban/90 text-white rounded-2xl font-black shadow-2xl shadow-brand-blaban/30 transition-all disabled:opacity-70 active:scale-95"
                >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6 ml-2" />}
                    <span>اعتماد التقييم النهائي وإغلاق البلاغ</span>
                </button>
            </div>
        </div>
    );

    const handleAction = async (action: 'start_work' | 'resolve' | 'close') => {
        setLoading(true);
        setError(null);
        try {
            // 1. Capture GeoLocation for critical steps
            const coords = await getGeoLocation();

            if (action === 'start_work') {
                // ─── Stage 3: Dynamic Geofencing for Start Work ───────────
                const { data: rawSettings } = await supabase.from('system_settings').select('*');
                const settings = rawSettings?.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as any) || {};

                const isGeofenceEnabled = settings.geofencing_enabled === 'true';
                const radius = parseInt(settings.geofencing_radius || '100');

                if (isGeofenceEnabled) {
                    const { data: branch } = await supabase.from('branches').select('latitude, longitude, name').eq('id', ticket.branch_id).single();
                    if (!branch?.latitude || !branch?.longitude) {
                        throw new Error(`🚫 فشل التحقق الأمني: إحداثيات الموقع (الفرع: ${branch?.name || 'مجهول'}) غير معرّفة في النظام. يرجى مراجعة الإدارة المختصة لتحديث البيانات الجغرافية قبل المباشرة.`);
                    }

                    const { calculateDistance } = await import('@shared/lib/geo');
                    const dist = calculateDistance(coords.lat, coords.lng, branch.latitude, branch.longitude);
                    if (dist > radius) {
                        throw new Error(`تنبيه أمني: يتطلب بدء العمل التواجد الفعلي داخل النطاق الجغرافي للفرع (أقل من ${radius}م). المسافة الحالية: ${Math.round(dist)} متر.`);
                    }
                }

                // ─── Shift Enforcement ───
                const { data: activeShift } = await supabase
                    .from('technician_attendance')
                    .select('id')
                    .eq('profile_id', (profile?.id || ''))
                    .is('clock_out', null)
                    .maybeSingle();

                if (!activeShift) {
                    throw new Error('🚫 لا يمكن بدء المهمة دون تسجيل الحضور (Clock-in). يرجى تفعيل المناوبة من القائمة الجانبية أولاً.');
                }


                // ─── Automated HR Mission Logging & Status Update ───────────
                await MaintenanceOrchestrator.startWork(ticket, profile?.id || '', coords);
            }
            else if (action === 'resolve') {
                // ─── Operational Excellence: Atomic Unified Resolution via Orchestrator ───────────
                await MaintenanceOrchestrator.resolveTicket({
                    ticketId: ticket.id,
                    technicianId: profile?.id || '',
                    partsUsed: partsUsed.map(p => ({ part_id: p.part_id, qty: p.qty })),
                    laborCost: laborCost,
                    resolvedImageUrl: resolvedImageUrl || '',
                    resolvedLat: coords.lat,
                    resolvedLng: coords.lng,
                    faultTypeId: selectedCategory,
                    assetId: selectedAsset || ticket.asset_id,
                    downtimeStart: downtimeStart || ticket.downtime_start
                });
            }
            else if (action === 'close') {
                // ─── Stage 5: Mandatory Evaluation via Orchestrator ───────────
                if (!rating || !comment.trim()) {
                    throw new Error('يرجى تحديد التقييم وتدوين الملاحظات لإتمام إغلاق البلاغ.');
                }

                await MaintenanceOrchestrator.closeTicket(ticket.id, rating, comment);
            }

            onUpdate();

        } catch (e: any) {
            console.error('Ticket Action Error:', e);
            setError(e.message || 'حدث خطأ غير متوقع أثناء معالجة البيانات التشغيلية.');
        } finally {
            setLoading(false);
        }
    };

    // ─── Shift Check for UI Logic ───
    const [activeShiftId, setActiveShiftId] = useState<string | null>(null);

    useEffect(() => {
        const checkShift = async () => {
            if (!(profile?.id || '')) return;
            const { data } = await supabase
                .from('technician_attendance')
                .select('id')
                .eq('profile_id', profile?.id || '')
                .is('clock_out', null)
                .maybeSingle();
            setActiveShiftId(data?.id || null);
        };
        checkShift();
    }, [(profile?.id || ''), ticket.status]);

    // Memoize the timeline events for the ledger view
    const ledgerEvents = useMemo(() => {
        const events = [
            { id: 'created', label: 'إنشاء البلاغ', time: ticket.created_at, icon: ClipboardList, status: 'completed', desc: 'تم تسجيل العطل وتوثيق الحالة المبدئية' },
            { id: 'assigned', label: 'تخصيص الفريق', time: ticket.assigned_at, icon: UserCog, status: ticket.assigned_to ? 'completed' : 'pending', desc: ticket.assigned_to ? 'تم إسناد المهمة للفريق الفني المختص' : 'بانتظار تخصيص الكواد الفنية' },
            { id: 'started', label: 'المباشرة الميدانية', time: ticket.started_at, icon: HardHat, status: ticket.started_at ? 'completed' : (ticket.status === 'assigned' ? 'active' : 'pending'), desc: ticket.started_at ? 'تم تأكيد الحضور وبدء العمليات الفنية' : 'بانتظار وصول الفريق للموقع' },
            { id: 'resolved', label: 'إتمام الإصلاح', time: ticket.resolved_at, icon: Wrench, status: ticket.resolved_at ? 'completed' : (ticket.status === 'in_progress' ? 'active' : 'pending'), desc: ticket.resolved_at ? 'تمت معالجة العطل وتوثيق حالة التشغيل' : 'العمليات الفنية قيد التنفيذ' },
            { id: 'closed', label: 'الإغلاق المؤسسي', time: ticket.closed_at, icon: ShieldCheck, status: ticket.closed_at ? 'completed' : (ticket.status === 'resolved' ? 'active' : 'pending'), desc: ticket.closed_at ? 'تم اعتماد الجودة وإغلاق السجل المالي' : 'بانتظار الحوكمة والاعتماد النهائي' },
        ];
        return events;
    }, [ticket]);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Field Ops Ledger Header */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-premium rounded-3xl border border-surface-800 p-8 shadow-inner bg-surface-950/40">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 bg-brand-blaban/10 text-brand-blaban text-[10px] font-black uppercase tracking-[0.2em] rounded-lg border border-brand-blaban/20">رقم البلاغ: #{ticket.id.slice(0, 8)}</span>
                                    {ticket.is_emergency && <span className="px-3 py-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg border border-red-500/20 animate-pulse">أولوية قصوى</span>}
                                </div>
                                <h3 className="text-2xl font-black text-white mb-2">{ticket.asset_name || 'بلاغ صيانة إستراتيجي'}</h3>
                                <p className="text-surface-400 font-medium leading-relaxed">{ticket.description}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-surface-800/50 pt-6">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-surface-600 uppercase tracking-widest">توقيت البلاغ</p>
                                <p className="text-xs font-bold text-white">{format(new Date(ticket.created_at), 'PPP · p', { locale: ar })}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-surface-600 uppercase tracking-widest">موقع العمل</p>
                                <p className="text-xs font-bold text-brand-blaban">{ticket.branches?.name || 'موقع غير معرف'}</p>
                            </div>
                            {ticket.reported_lat && (
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-surface-600 uppercase tracking-widest">تتبع الموقع (GPS)</p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <p className="text-xs font-bold text-emerald-500/80">موقع موثق</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Operational Actions */}
                    {error && (
                        <div className="p-4 bg-red-900/20 border border-red-900/30 rounded-2xl flex items-center gap-3 text-red-400 text-sm font-bold animate-in shake">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Technician Actions */}
                        {(ticket.status === 'assigned' || ticket.status === 'open') && profile && (['technician', 'maintenance_supervisor', 'admin', 'manager', 'maintenance_manager'].includes(profile.role)) && (
                            <div className="glass-premium p-6 rounded-3xl border border-brand-blaban/30 bg-brand-blaban/5 shadow-2xl">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-brand-blaban/10 flex items-center justify-center text-brand-blaban">
                                        <Play className="w-6 h-6 fill-current" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-white">بدء المباشرة الميدانية</h4>
                                        <p className="text-xs text-surface-500 font-bold uppercase tracking-wider">التحقق الميداني مطلوب للمتابعة</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleAction('start_work')}
                                    disabled={loading || !activeShiftId}
                                    className="w-full py-4 bg-brand-blaban text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-brand-blaban/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تأكيد الحضور وبدء الإصلاح'}
                                </button>
                                {!activeShiftId && (
                                    <p className="mt-4 text-[10px] text-red-500 font-black text-center uppercase tracking-widest animate-pulse">تنبيه: يجب تفعيل المناوبة (Clock-in) لمعالجة البيانات الميدانية</p>
                                )}
                            </div>
                        )}

                        {ticket.status === 'in_progress' && profile && (['technician', 'maintenance_supervisor', 'admin', 'manager', 'maintenance_manager'].includes(profile.role)) && (
                            <div className="glass-premium p-8 rounded-[2.5rem] border border-surface-800 bg-surface-950/50 shadow-2xl">
                                {isMobile ? (
                                    <button onClick={() => setIsResolveSheetOpen(true)} className="w-full py-5 bg-emerald-600 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-500/20">إتمام المهام والتوثيق</button>
                                ) : renderResolutionForm()}
                            </div>
                        )}

                        {/* Manager Actions */}
                        {ticket.status === 'resolved' && profile && (['manager', 'maintenance_manager', 'admin'].includes(profile.role)) && (
                            <div className="glass-premium p-8 rounded-[2.5rem] border border-surface-800 bg-surface-950/50 shadow-2xl">
                                {isMobile ? (
                                    <button onClick={() => setIsRateSheetOpen(true)} className="w-full py-5 bg-brand-blaban text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-brand-blaban/30">مراجعة واعتماد الإغلاق</button>
                                ) : renderRateForm()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Vertical Timeline (Operational Ledger) */}
                <div className="space-y-6">
                    <div className="glass-premium rounded-3xl border border-surface-800 p-6 flex flex-col gap-8 relative overflow-hidden">
                        <div className="absolute top-0 left-10 bottom-0 w-px bg-surface-800 z-0" />
                        <h4 className="flex items-center gap-3 text-xs font-black text-surface-500 uppercase tracking-[0.3em] z-10">
                            <History className="w-4 h-4 text-brand-blaban" />
                            سير العمليات التشغيلية
                        </h4>

                        <div className="space-y-10 relative z-10">
                            {ledgerEvents.map((event) => (
                                <div key={event.id} className="flex gap-6 group">
                                    <div className={clsx(
                                        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-500 group-hover:scale-110",
                                        event.status === 'completed' ? "bg-brand-blaban/20 border-brand-blaban/40 text-brand-blaban" :
                                            event.status === 'active' ? "bg-amber-500/10 border-amber-500/40 text-amber-500 animate-pulse" :
                                                "bg-surface-900 border-surface-800 text-surface-600"
                                    )}>
                                        <event.icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h5 className={clsx("text-sm font-black tracking-tight", event.status === 'completed' ? "text-white" : "text-surface-500")}>{event.label}</h5>
                                            {event.time && !isNaN(new Date(event.time).getTime()) && <span className="text-[9px] font-black text-surface-600 uppercase tracking-widest">{format(new Date(event.time), 'hh:mm a', { locale: ar })}</span>}
                                        </div>
                                        <p className="text-[10px] font-bold text-surface-500 leading-relaxed uppercase tracking-wider">{event.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Operational Insights */}
                    <div className="glass-premium rounded-3xl border border-surface-800 p-6 bg-surface-950/40">
                        <h4 className="flex items-center gap-3 text-xs font-black text-surface-500 uppercase tracking-[0.3em] mb-6">
                            <Zap className="w-4 h-4 text-amber-500" />
                            ذكاء ونظام التحليل الميداني
                        </h4>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-surface-900 rounded-xl border border-surface-800/50">
                                <span className="text-[10px] font-black text-surface-600 uppercase">Responders</span>
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full bg-brand-blaban/20 border border-brand-blaban/30" />
                                    <div className="w-6 h-6 rounded-full bg-surface-800 border border-surface-700" />
                                </div>
                            </div>
                            <div className="p-4 bg-surface-900 rounded-2xl border border-surface-800/50">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-black text-surface-500 uppercase">Operational Status</span>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">تدفق حي</span>
                                </div>
                                <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-brand-blaban rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(33,150,243,0.5)]"
                                        style={{ width: `${(ledgerEvents.filter(e => e.status === 'completed').length / ledgerEvents.length) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Sheets for Mobile Integration */}
            <BottomSheet isOpen={isResolveSheetOpen} onClose={() => setIsResolveSheetOpen(false)} title="توثيق إتمام العمليات الفنية">
                <div className="p-4">{renderResolutionForm()}</div>
            </BottomSheet>
            <BottomSheet isOpen={isRateSheetOpen} onClose={() => setIsRateSheetOpen(false)} title="مراجعة الإدارة وتدقيق الجودة">
                <div className="p-4">{renderRateForm()}</div>
            </BottomSheet>

            {isAssetScannerOpen && (
                <QRScanner
                    onScan={(text: string) => {
                        const foundAsset = assets.find(a => a.id === text || a.serial_number === text);
                        if (foundAsset) {
                            setSelectedAsset(foundAsset.id);
                            setIsAssetScannerOpen(false);
                        } else {
                            setError('فشل التحقق من الأصل: تباين البيانات في سجل هذا الفرع.');
                            setIsAssetScannerOpen(false);
                        }
                    }}
                    onClose={() => setIsAssetScannerOpen(false)}
                    title="ماسح الأصول الذكي"
                />
            )}
        </div>
    );
}
