import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { UISchema, FieldConfig } from '../../types/schema';
import { getGeoLocation } from '../../lib/geo';
import { X, Save, Loader2, MapPin, Navigation } from 'lucide-react';

interface SovereignActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    schema: UISchema;
    record: any | null; // null means create mode
    onSuccess: () => void;
}

export default function SovereignActionModal({ isOpen, onClose, schema, record, onSuccess }: SovereignActionModalProps) {
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lookupData, setLookupData] = useState<Record<string, any[]>>({});
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsSuccess, setGpsSuccess] = useState(false);

    const { form_config, table_name } = schema;
    const isEdit = !!record;

    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (isEdit && record) {
                // Handle JSON object parsing for edit mode
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
            fetchLookups();
        }
    }, [isOpen, record, schema]);

    // Smart Fetch for Dropdowns (The Reverse Lookup)
    const fetchLookups = async () => {
        const lookupFields = form_config.fields.filter(f => f.type === 'select' && f.dataSource);

        for (const field of lookupFields) {
            if (!field.dataSource) continue;
            try {
                const { data } = await supabase.from(field.dataSource as any).select('*');
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
            // Process form data to convert JSON strings back to objects before saving
            const processedData = { ...formData };
            schema.form_config.fields.forEach(field => {
                if (field.type === 'textarea') {
                    try {
                        const parsed = JSON.parse(processedData[field.key]);
                        if (typeof parsed === 'object') {
                            processedData[field.key] = parsed;
                        }
                    } catch (e) {
                        // Not JSON, leave as text
                    }
                }
            });

            if (isEdit) {
                if (table_name === 'profiles') {
                    // Update profile info (Note: does not update password)
                    const { error: updateError } = await supabase
                        .from(table_name as any)
                        .update(processedData)
                        .eq('id', record.id);
                    if (updateError) throw updateError;
                } else {
                    const { error: updateError } = await supabase
                        .from(table_name as any)
                        .update(processedData)
                        .eq('id', record.id);
                    if (updateError) throw updateError;
                }
            } else {
                if (table_name === 'profiles') {
                    // ─── Create Employee via Admin API (Reliable Method) ───────────
                    if (!supabaseAdmin) {
                        throw new Error('مفتاح الخدمة (Service Role Key) غير مُعرَّف. أضف VITE_SUPABASE_SERVICE_ROLE_KEY في ملف .env.local');
                    }

                    const employeeCode = (processedData.employee_code || '').trim();
                    const email = `${employeeCode}@fsc-system.local`;
                    const password = processedData.password || '12345';

                    // Step 1: Create the auth user with auto-confirm
                    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                        email,
                        password,
                        email_confirm: true,
                        user_metadata: {
                            employee_code: employeeCode,
                            full_name: processedData.full_name,
                            role: processedData.role,
                        },
                    });
                    if (createError) throw createError;

                    // Step 2: Upsert the profile (trigger may have already created it)
                    const { error: profileError } = await supabase
                        .from('profiles' as any)
                        .upsert({
                            id: newUser.user.id,
                            employee_code: employeeCode,
                            full_name: processedData.full_name,
                            role: processedData.role,
                        }, { onConflict: 'id' });
                    if (profileError) throw profileError;
                } else {
                    const { error: insertError } = await supabase
                        .from(table_name as any)
                        .insert([processedData]);
                    if (insertError) throw insertError;
                }
            }
            onSuccess();
        } catch (e: any) {
            setError(e.message || 'حدث خطأ أثناء حفظ البيانات.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal Content */}
            <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-surface-100 flex justify-between items-center bg-surface-50">
                    <h3 className="text-xl font-bold text-surface-900">
                        {isEdit ? 'تعديل السجل' : form_config.title || 'إضافة جديد'}
                    </h3>
                    <button onClick={onClose} className="p-2 text-surface-400 hover:text-surface-700 hover:bg-surface-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6">
                    <form id="sovereign-form" onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                                {error}
                            </div>
                        )}

                        {/* GPS Auto-fill Banner — shows only when form has lat/lng fields */}
                        {hasGpsFields && (
                            <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
                                <div className="flex items-center gap-2 text-teal-700">
                                    <MapPin className="w-4 h-4 shrink-0" />
                                    <span className="text-sm font-medium">
                                        {gpsSuccess ? '✅ تم التقاط الإحداثيات بنجاح!' : 'انقر لتحديد الموقع الحالي تلقائياً'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleGPS}
                                    disabled={gpsLoading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-70 shrink-0"
                                >
                                    {gpsLoading
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Navigation className="w-3.5 h-3.5" />
                                    }
                                    {gpsLoading ? 'جاري التحديد...' : 'تحديد موقعي'}
                                </button>
                            </div>
                        )}

                        {form_config.fields.map((field) => (
                            <div key={field.key} className={field.type === 'hidden' ? 'hidden' : 'block'}>
                                <label className="block text-sm font-semibold text-surface-700 mb-1.5">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>

                                {field.type === 'text' || field.type === 'number' || field.type === 'email' ? (
                                    <input
                                        type={field.type}
                                        required={field.required}
                                        placeholder={field.placeholder}
                                        value={formData[field.key] || ''}
                                        onChange={(e) => handleChange(field.key, e.target.value)}
                                        className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all text-surface-900"
                                    />
                                ) : field.type === 'textarea' ? (
                                    <textarea
                                        required={field.required}
                                        placeholder={field.placeholder}
                                        value={formData[field.key] || ''}
                                        rows={4}
                                        onChange={(e) => handleChange(field.key, e.target.value)}
                                        className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all text-surface-900"
                                    />
                                ) : field.type === 'select' ? (
                                    <select
                                        required={field.required}
                                        value={formData[field.key] || ''}
                                        onChange={(e) => handleChange(field.key, e.target.value)}
                                        className="w-full px-4 py-2.5 bg-surface-50 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all text-surface-900"
                                    >
                                        <option value="" disabled>-- اختر --</option>
                                        {/* Fixed options if no dataSource, or dynamic if dataSource present */}
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
                                ) : null}
                            </div>
                        ))}
                    </form>
                </div>

                <div className="p-6 border-t border-surface-100 bg-surface-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-surface-600 font-medium hover:bg-surface-200 rounded-xl transition-colors"
                    >
                        إلغاء
                    </button>
                    <button
                        type="submit"
                        form="sovereign-form"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-70"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        <span>حفظ البيانات</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
