import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { UISchema, FieldConfig } from '../../types/schema';
import { getGeoLocation } from '../../lib/geo';
import { X, Loader2, MapPin, Navigation, Upload, QrCode } from 'lucide-react';
import { compressImage } from '../../lib/image';
import { uploadToDrive } from '../../lib/drive';
import { useAuth } from '../../contexts/AuthContext';
import { applyRBACFilter, getSecureProfileSelect } from '../../lib/rbac';
import clsx from 'clsx';
import BottomSheet from '../ui/BottomSheet';
import QRScanner from '../ui/QRScanner';
import { useToast } from '../../contexts/ToastContext';

interface SovereignActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    schema: UISchema;
    record: any | null; // null means create mode
    onSuccess: () => void;
    isAssignMode?: boolean;
    actionTitle?: string;
}

export default function SovereignActionModal({ isOpen, onClose, schema, record, onSuccess, isAssignMode, actionTitle }: SovereignActionModalProps) {
    const { profile: currentUserProfile } = useAuth();
    const { showToast } = useToast();
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lookupData, setLookupData] = useState<Record<string, any[]>>({});
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsSuccess, setGpsSuccess] = useState(false);
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [activeScannerField, setActiveScannerField] = useState<string | null>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const { form_config, table_name } = schema;
    const isEdit = !!record;

    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (isEdit && record) {
                const initialData = { ...record };
                for (const key in initialData) {
                    if (typeof initialData[key] === 'object' && initialData[key] !== null) {
                        initialData[key] = JSON.stringify(initialData[key], null, 2);
                    }
                }
                setFormData(initialData);
            } else {
                setFormData({});
            }
            fetchInitialData();
        }
    }, [isOpen, record, schema]);

    const fetchInitialData = async () => {
        await Promise.all([fetchLookups(), fetchSettings()]);
    };

    const fetchSettings = async () => {
        try {
            const { data } = await supabase.from('system_settings').select('*');
            if (data) {
                const mapped = data.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
                setSettings(mapped);

                // [SINGULARITY FIX] Use existing currentUserProfile to avoid redundant DB call
                const branchCol = schema.directBranchColumn;
                if (branchCol && !isEdit && currentUserProfile?.role === 'manager' && mapped.restrict_branch_submission === 'true') {
                    if (currentUserProfile?.branch_id) {
                        setFormData(prev => ({ ...prev, [branchCol]: currentUserProfile.branch_id }));
                    }
                }
            }
        } catch (e) {
            console.error('Settings fetch error', e);
        }
    };

    // Smart Fetch for Dropdowns (The Reverse Lookup)
    const fetchLookups = async () => {
        const lookupFields = form_config.fields.filter(f => f.type === 'select' && f.dataSource);

        for (const field of lookupFields) {
            if (!field.dataSource) continue;
            try {
                let query = supabase.from(field.dataSource as any).select(
                    field.dataSource === 'profiles' ? getSecureProfileSelect(currentUserProfile?.role || '') : '*'
                );

                // Apply RBAC filters to lookups
                query = applyRBACFilter(query, field.dataSource, currentUserProfile);

                // If in Assign Mode, only show technicians
                if (isAssignMode && field.key === 'assigned_to' && field.dataSource === 'profiles') {
                    query = query.eq('role', 'technician');
                }

                const { data } = await query;
                if (data) {
                    setLookupData(prev => ({ ...prev, [field.key]: data }));
                }
            } catch (e) {
                console.error(`Error fetching lookup data for ${field.key}`, e);
            }
        }
    };

    const handleChange = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleImageUpload = async (key: string, file: File) => {
        setUploading(key);
        setError(null);
        try {
            const compressed = await compressImage(file);
            const url = await uploadToDrive(compressed as File);
            setFormData(prev => ({ ...prev, [key]: url }));
        } catch (e: any) {
            setError('خطأ في رفع الصورة: ' + e.message);
        } finally {
            setUploading(null);
        }
    };

    // GPS auto-fill — robust check that works with any lat/lng field naming
    const isLatField = (f: FieldConfig) => {
        const k = f.key.toLowerCase();
        const l = (f.label || '').toLowerCase();
        return k === 'latitude' || k === 'lat' || k.includes('_lat') || l.includes('latitude');
    };
    const isLngField = (f: FieldConfig) => {
        const k = f.key.toLowerCase();
        const l = (f.label || '').toLowerCase();
        return k === 'longitude' || k === 'lng' || k === 'lon' || k.includes('_lng') || l.includes('longitude');
    };
    const hasGpsFields = form_config.fields.some(f => isLatField(f) || isLngField(f));

    const handleGPS = async () => {
        setGpsLoading(true);
        setGpsSuccess(false);
        try {
            const coords = await getGeoLocation();
            const updates: Record<string, number> = {};
            form_config.fields.forEach(f => {
                if (isLatField(f)) updates[f.key] = coords.lat;
                if (isLngField(f)) updates[f.key] = coords.lng;
            });
            setFormData(prev => ({ ...prev, ...updates }));
            setGpsSuccess(true);
            setTimeout(() => setGpsSuccess(false), 3000);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setGpsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Process form data...
            const processedData = { ...formData };

            // ─── Stage 1: Geofencing for Ticket Creation ───────────
            if (table_name === 'tickets' && !isEdit) {
                const isGeofenceEnabled = settings.geofencing_enabled === 'true';
                const radius = parseInt(settings.geofencing_radius || '100');
                const branchId = processedData.branch_id;

                if (isGeofenceEnabled && branchId) {
                    const { data: branch } = await supabase.from('branches').select('latitude, longitude').eq('id', branchId).single();
                    if (branch?.latitude && branch?.longitude) {
                        const coords = await getGeoLocation();
                        const { calculateDistance } = await import('../../lib/geo');
                        const dist = calculateDistance(coords.lat, coords.lng, branch.latitude, branch.longitude);

                        if (dist > radius) {
                            throw new Error(`خطأ أمني: يجب أن تكون داخل نطاق الفرع(أقل من ${radius}م) لفتح بلاغ.المسافة الحالية: ${Math.round(dist)} متر.`);
                        }

                        // Store the reporting location
                        processedData.reported_lat = coords.lat;
                        processedData.reported_lng = coords.lng;
                    }
                }
            }

            // [SINGULARITY FIX] Type Mutation Safety: Ensure we only parse if valid JSON object string
            schema.form_config.fields.forEach(field => {
                if (field.type === 'textarea' && processedData[field.key]) {
                    const val = String(processedData[field.key]).trim();
                    if (val.startsWith('{') || val.startsWith('[')) {
                        try {
                            const parsed = JSON.parse(val);
                            if (typeof parsed === 'object') {
                                processedData[field.key] = parsed;
                            }
                        } catch (e) { /* Fallback to raw text */ }
                    }
                }
            });

            // ─── Stage 2: Payload Cleaning (Whitelist valid columns only) ───────────
            const allowedKeys = new Set([
                ...schema.form_config.fields.map(f => f.key),
                'status', 'reported_lat', 'reported_lng', 'started_lat', 'started_lng',
                'resolved_lat', 'resolved_lng', 'resolved_at', 'rating_score', 'rating_comment',
                'asset_id', 'fault_type_id', 'downtime_start', 'submission_id', 'version'
            ]);

            const finalPayload: Record<string, any> = {};
            Object.keys(processedData).forEach(key => {
                // Only include keys in the schema or operational whitelist
                // AND exclude objects/arrays that wasn't explicitly handled (like joined relation objects)
                const val = processedData[key];
                if (allowedKeys.has(key)) {
                    finalPayload[key] = val;
                }
            });

            if (isEdit) {
                // AUTO-STATUS FOR ASSIGNMENT
                if (isAssignMode) {
                    finalPayload.status = 'assigned';
                }

                if (table_name === 'profiles') {
                    // Update profile info (Exclude password/email virtual fields from public.profiles table update)
                    const { password, ...updatePayload } = finalPayload;
                    const { error: updateError } = await supabase
                        .from(table_name as any)
                        .update(updatePayload)
                        .eq('id', record.id);
                    if (updateError) throw updateError;
                } else {
                    // --- OPTIMISTIC LOCKING IMPLEMENTATION ---
                    // We check the 'version' column. If it changed since we opened the modal, the update fails.
                    const query = supabase
                        .from(table_name as any)
                        .update(finalPayload)
                        .eq('id', record.id);

                    // Only apply version check if version exists (to avoid breaking other tables)
                    if (record.version !== undefined) {
                        const { data: updateData, error: updateError } = await query
                            .eq('version', record.version)
                            .select();

                        if (updateError) throw updateError;
                        if (!updateData || updateData.length === 0) {
                            throw new Error('فشل التحديث: قام مستخدم آخر بتعديل هذا السجل أثناء انشغالك. يرجى إغلاق النافذة وإعادة المحاولة.');
                        }
                    } else {
                        const { error: updateError } = await query;
                        if (updateError) throw updateError;
                    }
                }
            } else {
                if (table_name === 'profiles') {
                    // ─── Create Employee via Admin API ───────────
                    if (!supabaseAdmin) {
                        throw new Error('مفتاح الخدمة (Service Role Key) غير مُعرَّف.');
                    }

                    const employeeCode = (finalPayload.employee_code || '').trim();
                    const email = `${employeeCode} @fsc-system.local`;
                    const password = finalPayload.password || '12345';

                    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                        email,
                        password,
                        email_confirm: true,
                        user_metadata: {
                            employee_code: employeeCode,
                            full_name: finalPayload.full_name,
                            role: finalPayload.role,
                        },
                    });
                    if (createError) throw createError;

                    const { error: profileError } = await supabase
                        .from('profiles' as any)
                        .upsert({
                            id: newUser.user.id,
                            employee_code: employeeCode,
                            full_name: finalPayload.full_name,
                            role: finalPayload.role,
                            brand_id: finalPayload.brand_id,
                            sector_id: finalPayload.sector_id,
                            area_id: finalPayload.area_id,
                            branch_id: finalPayload.branch_id,
                        }, { onConflict: 'id' });
                    if (profileError) throw profileError;
                } else {
                    const { error: insertError } = await supabase
                        .from(table_name as any)
                        .insert([finalPayload]);
                    if (insertError) throw insertError;
                }
            }
            showToast(isEdit ? 'تم تحديث البيانات بنجاح' : 'تم تسجيل القيد الجديد بنجاح', 'success');
            onSuccess();
        } catch (e: any) {
            const errorMsg = e.message || 'فيه مشكلة حصلت وإحنا بنسجل البيانات.';
            setError(errorMsg);
            showToast(errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const title = isAssignMode ? (actionTitle || 'توجيه المأمورية لكادر فني معتمد') : isEdit ? 'تعديل بيانات القيد المعتمدة' : form_config.title || 'تسجيل قيد جديد';

    const renderFormContent = () => (
        <div className="flex flex-col">
            <div className="flex-1">
                <form id="sovereign-form" onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30">
                            {error}
                        </div>
                    )}

                    {/* GPS Auto-fill Banner — shows only when form has lat/lng fields */}
                    {hasGpsFields && (
                        <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 dark:bg-teal-900/20 dark:border-teal-900/30">
                            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                                <MapPin className="w-4 h-4 shrink-0" />
                                <span className="text-sm font-medium">
                                    {gpsSuccess ? '✅ تم استدعاء الإحداثيات الجغرافية بنجاح.' : 'استدعاء الإحداثيات الجغرافية آلياً (GPS)'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleGPS}
                                disabled={gpsLoading}
                                className="btn-3d flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-70 shrink-0"
                            >
                                {gpsLoading
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Navigation className="w-3.5 h-3.5" />
                                }
                                {gpsLoading ? 'بانتظار الاستجابة...' : 'استدعاء الموقع'}
                            </button>
                        </div>
                    )}

                    {form_config.fields.map((field) => {
                        // If in Assign Mode, only show assigned_to/technician_id fields
                        if (isAssignMode && field.key !== 'assigned_to') return null;

                        // Hide password field in Edit mode for profiles (passwords managed via Auth/Admin)
                        if (isEdit && table_name === 'profiles' && field.key === 'password') return null;

                        return (
                            <div key={field.key} className={field.type === 'hidden' ? 'hidden' : 'block'}>
                                <label className="block text-sm font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>

                                {field.type === 'text' || field.type === 'number' || field.type === 'email' || field.type === 'date' || field.type === 'datetime' || field.type === 'color' ? (
                                    <div className="relative group/field">
                                        <input
                                            type={field.type === 'datetime' ? 'datetime-local' : field.type}
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            value={formData[field.key] || ''}
                                            onChange={(e) => handleChange(field.key, e.target.value)}
                                            className={clsx(
                                                "w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-bold dark:bg-surface-800/80 dark:border-surface-700 dark:text-white dark:placeholder-surface-500",
                                                field.scanable && "pl-12",
                                                field.type === 'color' && "h-12 p-1 cursor-pointer"
                                            )}
                                        />
                                        {field.scanable && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveScannerField(field.key)}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-surface-500 hover:text-brand-blaban hover:bg-brand-blaban/10 rounded-lg transition-all"
                                                title="امسح QR Code"
                                            >
                                                <QrCode className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                ) : field.type === 'checkbox' ? (
                                    <label className="flex items-center gap-3 p-3 bg-surface-50 border border-surface-200 rounded-xl cursor-pointer hover:bg-surface-100 dark:bg-surface-800 dark:border-surface-700 dark:hover:bg-surface-700 transition-all">
                                        <input
                                            type="checkbox"
                                            checked={!!formData[field.key]}
                                            onChange={(e) => handleChange(field.key, e.target.checked)}
                                            className="w-5 h-5 rounded border-surface-600 text-brand-blaban focus:ring-brand-blaban bg-surface-900"
                                        />
                                        <span className="text-sm font-black text-white">{field.placeholder || field.label}</span>
                                    </label>
                                ) : field.type === 'textarea' ? (
                                    <textarea
                                        required={field.required}
                                        placeholder={field.placeholder}
                                        value={formData[field.key] || ''}
                                        rows={4}
                                        onChange={(e) => handleChange(field.key, e.target.value)}
                                        className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all text-surface-900 dark:bg-surface-800 dark:border-surface-700 dark:text-white dark:placeholder-surface-500"
                                    />
                                ) : field.type === 'select' ? (
                                    <select
                                        required={field.required}
                                        value={formData[field.key] || ''}
                                        disabled={field.key === 'branch_id' && currentUserProfile?.role === 'manager' && settings.restrict_branch_submission === 'true'}
                                        onChange={(e) => handleChange(field.key, e.target.value)}
                                        className="w-full px-4 py-2.5 bg-surface-800/80 border border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blaban/30 focus:border-brand-blaban transition-all text-white disabled:opacity-60"
                                    >
                                        <option value="" disabled>-- يرجى اختيار مدخل من القائمة --</option>
                                        {field.dataSource && lookupData[field.key] ? (
                                            lookupData[field.key].map(opt => (
                                                <option key={opt[field.dataValue || 'id']} value={opt[field.dataValue || 'id']}>
                                                    {opt[field.dataLabel || 'name'] || opt.full_name || opt.id}
                                                </option>
                                            ))
                                        ) : field.options ? (
                                            field.options.map(opt => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))
                                        ) : null}
                                    </select>
                                ) : field.type === 'image' ? (
                                    <div className="space-y-3">
                                        {formData[field.key] ? (
                                            <div className="relative w-full aspect-video rounded-xl border border-surface-200 overflow-hidden bg-surface-50">
                                                <img src={formData[field.key]} alt={field.label} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange(field.key, null)}
                                                    className="absolute top-2 right-2 p-1.5 bg-surface-900/80 hover:bg-surface-900 text-red-500 rounded-full shadow-md backdrop-blur-sm"
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
                                                    onChange={(e) => e.target.files?.[0] && handleImageUpload(field.key, e.target.files[0])}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                    disabled={!!uploading}
                                                />
                                                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-surface-200 group-hover:border-primary-400 bg-surface-50 rounded-2xl transition-all dark:bg-surface-800 dark:border-surface-700 dark:group-hover:border-primary-500">
                                                    {uploading === field.key ? (
                                                        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                                                    ) : (
                                                        <Upload className="w-8 h-8 text-surface-400 dark:text-surface-500 group-hover:text-primary-500 mb-2 transition-colors" />
                                                    )}
                                                    <span className="text-sm text-surface-500 font-medium dark:text-surface-400">
                                                        {uploading === field.key ? 'قيد ضغط ورفع الوسائط الرقمية...' : 'النقر هنا لإرفاق أو التقاط صورة توثيقية'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </form>
            </div>

            <div className="mt-8 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-6 py-4 bg-surface-800 text-white rounded-2xl font-black transition-all hover:bg-surface-700"
                >
                    إلغاء
                </button>
                <button
                    type="submit"
                    form="sovereign-form"
                    disabled={loading}
                    className="flex-1 px-6 py-4 bg-brand-blaban text-white rounded-2xl font-black shadow-xl shadow-brand-blaban/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {isEdit ? 'تحديث البيانات' : 'تأكيد التسجيل'}
                </button>
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
                {renderFormContent()}
            </BottomSheet>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal Content */}
            <div className="relative glass-premium w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-500">
                <div className="absolute inset-0 bg-white/40 dark:bg-surface-950/60 -z-10" />
                <div className="p-8 border-b border-white/10 flex justify-between items-center bg-transparent">
                    <h3 className="text-2xl font-black text-white font-outfit tracking-tight">{title}</h3>
                    <button onClick={onClose} className="p-2.5 text-surface-500 hover:text-brand-blaban hover:bg-brand-blaban/10 rounded-full transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 text-right">
                    {renderFormContent()}
                </div>
            </div>

            {/* QR Scanner Overlay */}
            {activeScannerField && (
                <QRScanner
                    onScan={(text) => {
                        handleChange(activeScannerField, text);
                        setActiveScannerField(null);
                    }}
                    onClose={() => setActiveScannerField(null)}
                    title={`مسح كود: ${form_config.fields.find(f => f.key === activeScannerField)?.label} `}
                />
            )}
        </div>
    );
}
