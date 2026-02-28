import { useEffect, useState } from 'react';
import { supabase } from '@shared/lib/supabase';
import { Settings, ShieldCheck, ToggleLeft, ToggleRight, Loader2, Save } from 'lucide-react';
import DashboardLayout from '@shared/components/layout/DashboardLayout';

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
                    <div className="p-3 bg-primary-900/20 text-primary-400 rounded-2xl border border-primary-800/30">
                        <Settings className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">تهيئة إعدادات النظام الإستراتيجية</h1>
                        <p className="text-surface-400">إدارة بروتوكولات التشغيل، صلاحيات الوصول، والقيود التنظيمية للمنصة</p>
                    </div>
                </div>

                <div className="bg-surface-900 rounded-3xl border border-surface-800 shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-surface-800 flex items-center gap-2 bg-surface-800/10">
                        <ShieldCheck className="w-5 h-5 text-primary-500" />
                        <h2 className="text-lg font-bold text-white">ضوابط وسياسات التشغيل الميداني</h2>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-2xl border border-surface-100 dark:border-surface-700">
                            <div className="flex-1">
                                <h3 className="font-bold text-white">بروتوكول حوكمة البلاغات المكانية</h3>
                                <p className="text-sm text-surface-400 mt-1">
                                    تفعيل: تقتصر صلاحية مدير الفرع على تقديم البلاغات الفنية المرتبطة بفرعه المسجل فقط.
                                    تعطيل: تمنح الصلاحية للمدير باختيار أي موقع جغرافي لرفع البلاغ يدوياً وفق مقتضيات العمل.
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

                        {/* Dynamic Geofencing Section */}
                        <div className="pt-4 border-t border-surface-800">
                            <div className="flex items-center justify-between p-4 bg-surface-800/50 rounded-2xl border border-surface-800">
                                <div className="flex-1">
                                    <h3 className="font-bold text-white">تفعيل منظومة التحقق الجغرافي الذكي (Geofencing)</h3>
                                    <p className="text-sm text-surface-400 mt-1">
                                        فرض بروتوكول الحضور المكاني للفنيين عند مباشرة المهام، وللمديرين عند إنشاء طلبات الصيانة لضمان دقة البيانات الجغرافية.
                                    </p>
                                </div>
                                <button
                                    onClick={() => toggleSetting('geofencing_enabled')}
                                    className="ml-4 transition-colors p-2 hover:bg-surface-800 rounded-xl"
                                >
                                    {settings.geofencing_enabled === 'true' ? (
                                        <ToggleRight className="w-12 h-12 text-teal-400" />
                                    ) : (
                                        <ToggleLeft className="w-12 h-12 text-surface-600" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-surface-800/50 rounded-2xl border border-surface-800">
                            <div className="flex-1">
                                <h3 className="font-bold text-white">قطر السماح التشغيلي (متر)</h3>
                                <p className="text-sm text-surface-400 mt-1">
                                    تحديد المسافة الشعاعية القصوى (بالمتـر) المسموح بها كفارق بين إحداثيات المستخدم والإحداثيات المرجعية للموقع.
                                </p>
                            </div>
                            <div className="w-32">
                                <input
                                    type="number"
                                    value={settings.geofencing_radius || 100}
                                    onChange={(e) => setSettings(prev => ({ ...prev, geofencing_radius: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-xl border border-surface-800 bg-surface-950 text-white focus:ring-2 focus:ring-primary-500 outline-none font-bold text-center text-lg shadow-inner"
                                    placeholder="100"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end p-2 gap-4 items-center">
                            {success && <span className="text-emerald-600 font-bold animate-pulse">✓ تم الحفظ بنجاح</span>}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl shadow-lg shadow-primary-500/20 transition-all disabled:opacity-70"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {saving ? 'جاري الحفظ...' : 'اعتماد التحديثات الإستراتيجية'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
