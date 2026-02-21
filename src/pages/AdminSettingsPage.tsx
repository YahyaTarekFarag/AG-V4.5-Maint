import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, ShieldCheck, ToggleLeft, ToggleRight, Loader2, Save } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function AdminSettingsPage() {
    // ... existing state ...
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);
    // ... rest of logic stays same ...

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from('system_settings').select('*');
            if (data) {
                const mapped = data.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
                setSettings(mapped);
            }
        } catch (e) {
            console.error('Error fetching settings:', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSetting = (key: string) => {
        setSettings(prev => ({
            ...prev,
            [key]: prev[key] === 'true' ? 'false' : 'true'
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSuccess(false);
        try {
            const updates = Object.entries(settings).map(([key, value]) => ({
                key,
                value
            }));

            const { error } = await supabase.from('system_settings').upsert(updates);
            if (error) throw error;
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e: any) {
            alert('خطأ في حفظ الإعدادات: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6 max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-primary-50 text-primary-600 rounded-2xl">
                        <Settings className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-surface-900">إعدادات النظام</h1>
                        <p className="text-surface-500">إدارة الصلاحيات والقيود العامة للمنصة</p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-surface-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-surface-100 flex items-center gap-2 bg-surface-50">
                        <ShieldCheck className="w-5 h-5 text-primary-500" />
                        <h2 className="text-lg font-bold text-surface-900">قيود التشغيل</h2>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between p-4 bg-surface-50 rounded-2xl border border-surface-100">
                            <div className="flex-1">
                                <h3 className="font-bold text-surface-900">تقييد بلاغات مديري الفروع</h3>
                                <p className="text-sm text-surface-500 mt-1">
                                    عند التفعيل، لن يتمكن مدير الفرع من تسجيل بلاغ إلا لفرعه الخاص فقط.
                                    عند الإلغاء، يمكن للمدير اختيار أي فرع يتواجد به يدوياً.
                                </p>
                            </div>
                            <button
                                onClick={() => toggleSetting('restrict_branch_submission')}
                                className="ml-4 transition-colors"
                            >
                                {settings.restrict_branch_submission === 'true' ? (
                                    <ToggleRight className="w-12 h-12 text-primary-600" />
                                ) : (
                                    <ToggleLeft className="w-12 h-12 text-surface-300" />
                                )}
                            </button>
                        </div>

                        <div className="flex justify-end p-2">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-70"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {success ? 'تم الحفظ بنجاح!' : 'حفظ التغييرات'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
