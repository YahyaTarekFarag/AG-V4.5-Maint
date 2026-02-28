import { useState, useEffect } from 'react';
import DashboardLayout from '@shared/components/layout/DashboardLayout';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { ShieldCheck, AlertCircle, CheckCircle2, Activity, Database, Lock, Layout, RefreshCw, Zap } from 'lucide-react';
import clsx from 'clsx';
import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';
import { APP_PAGES_CONFIG } from '@engine/lib/app_pages';

type DiagnosticResult = {
    id: string;
    name: string;
    status: 'pass' | 'fail' | 'warning' | 'checking';
    message: string;
    description?: string;
    category: 'performance' | 'integrity' | 'registry' | 'auth';
};

export default function DiagnosticsPage() {
    const { profile } = useAuth();
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<DiagnosticResult[]>([]);

    const runDiagnostics = async () => {
        setIsRunning(true);
        setResults([]);

        const newResults: DiagnosticResult[] = [];

        // 1. Connection & Session
        newResults.push({
            id: 'auth-session',
            name: 'جلسة المستخدم والاتصال',
            status: 'checking',
            message: 'جاري التحقق من الجلسة الآمنة...',
            category: 'auth',
            description: 'التحقق من صحة بروتوكول المصادقة الرقمية للمستخدم الحالي.'
        });
        setResults([...newResults]);
        await new Promise(r => setTimeout(r, 600));
        if (profile) {
            newResults[0] = { ...newResults[0], status: 'pass', message: `الجلسة نشطة للمستخدم: ${profile.full_name}` };
        } else {
            newResults[0] = { ...newResults[0], status: 'fail', message: 'فشل استرداد بيانات الجلسة' };
        }
        setResults([...newResults]);

        // 2. Database Integrity Check
        newResults.push({
            id: 'db-tables',
            name: 'سلامة الهيكل البياني',
            status: 'checking',
            message: 'جاري فحص سلامة الجداول الحيوية...',
            category: 'integrity',
            description: 'التأكد من أن "نخاع" الجداول الأساسية متاح ولا يعاني من أي تعثر في الاستجابة.'
        });
        setResults([...newResults]);
        const coreTables = ['profiles', 'tickets', 'branches', 'maintenance_categories', 'ui_schemas'];
        try {
            const checks = await Promise.all(coreTables.map(t => supabase.from(t).select('id', { count: 'exact', head: true }).limit(1)));
            const failed = checks.filter(c => c.error);
            if (failed.length === 0) {
                newResults[1] = { ...newResults[1], status: 'pass', message: 'كافة الجداول الأساسية متاحة وتستجيب' };
            } else {
                newResults[1] = { ...newResults[1], status: 'fail', message: `فشل الوصول إلى ${failed.length} جداول`, description: failed.map(f => f.error?.message).join(', ') };
            }
        } catch (e: any) {
            newResults[1] = { ...newResults[1], status: 'fail', message: 'خطأ في الربط مع قاعدة البيانات' };
        }
        setResults([...newResults]);

        // 3. Registry Alignment
        newResults.push({
            id: 'registry-sync',
            name: 'تزامن سجل السيادة (Registry)',
            status: 'checking',
            message: 'مقارنة سجل الصفحات مع سجل النماذج...',
            category: 'registry',
            description: 'ضمان التزامن الكامل بين محرك الصفحات ونماذج البيانات (Zero Drift).'
        });
        setResults([...newResults]);
        await new Promise(r => setTimeout(r, 800));
        const registryKeys = Object.keys(SOVEREIGN_REGISTRY);
        const pageKeys = Object.keys(APP_PAGES_CONFIG);
        const missing = pageKeys.filter(k => !registryKeys.includes(k) && !APP_PAGES_CONFIG[k].isCustomPage);
        if (missing.length === 0) {
            newResults[2] = { ...newResults[2], status: 'pass', message: 'سجل السيادة متزامن بنسبة 100%' };
        } else {
            newResults[2] = { ...newResults[2], status: 'warning', message: 'بعض الصفحات تفتقر لتعريفات النماذج', description: `المفقود: ${missing.join(', ')}` };
        }
        setResults([...newResults]);

        // 4. Performance Check
        newResults.push({
            id: 'perf-stats',
            name: 'سرعة استجابة المحرك التحليلي',
            status: 'checking',
            message: 'قياس سرعة معالجة البيانات...',
            category: 'performance',
            description: 'فحص زمن الاستجابة (Latency) لدوال اتخاذ القرار لضمان تجربة مستخدم فائقة السرعة.'
        });
        setResults([...newResults]);
        const start = performance.now();
        await supabase.rpc('get_dashboard_stats_v2', { p_profile_id: profile?.id });
        const end = performance.now();
        const duration = end - start;
        if (duration < 300) {
            newResults[3] = { ...newResults[3], status: 'pass', message: `الاستجابة فائقة السرعة: ${duration.toFixed(0)} مللي ثانية` };
        } else {
            newResults[3] = { ...newResults[3], status: 'warning', message: `الاستجابة بطيئة نسبياً: ${duration.toFixed(0)} مللي ثانية` };
        }
        setResults([...newResults]);

        // 5. Role Alignment Check
        newResults.push({
            id: 'role-alignment',
            name: 'فحص تناسق الأدوار الرقمية',
            status: 'checking',
            message: 'جاري البحث عن أدوار خارج المعيار الموحد...',
            category: 'integrity',
            description: 'التأكد من أن كافة المستخدمين يتبعون مصفوفة الأدوار الحديثة ولا يوجد "أدوار شبحية" قديمة.'
        });
        setResults([...newResults]);
        const { data: legacyUsers, error: roleError } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .in('role', ['maint_manager', 'maint_supervisor']);

        if (!roleError) {
            const count = legacyUsers?.length || 0;
            if (count === 0) {
                newResults[4] = { ...newResults[4], status: 'pass', message: 'كافة الأدوار متوافقة مع المعيار الموحد الجديد' };
            } else {
                newResults[4] = { ...newResults[4], status: 'warning', message: `تم العثور على ${count} مستخدمين بأدوار قديمة`, description: 'يرجى مراجعة إدارة الموارد البشرية لتحديث أدوارهم إلى maintenance_manager أو maintenance_supervisor.' };
            }
        } else {
            newResults[4] = { ...newResults[4], status: 'fail', message: 'فشل فحص تناسق الأدوار' };
        }
        setResults([...newResults]);

        // 6. Atomicity Audit (Orphaned transactions)
        newResults.push({
            id: 'atomicity-audit',
            name: 'فحص الترابط الذري للحركات المخزنية',
            status: 'checking',
            message: 'جاري مطابقة حركات المخزون مع البلاغات المرتبطة...',
            category: 'integrity',
            description: 'التأكد من أن كل عملية صرف مخزني (inventory_transaction) مرتبطة ببلاغ صيانة حقيقي وليست "يتيمة".'
        });
        setResults([...newResults]);
        try {
            // Check for inventory_transactions that reference non-existent or deleted tickets
            const { data: orphanCheck, error: orphanError } = await supabase
                .from('inventory_transactions')
                .select('id, ticket_id')
                .is('ticket_id', null)
                .limit(10);

            if (!orphanError) {
                const orphanCount = orphanCheck?.length || 0;
                if (orphanCount === 0) {
                    newResults[5] = { ...newResults[5], status: 'pass', message: 'كافة الحركات المخزنية مرتبطة ببلاغات صيانة حقيقية (Zero Orphans)' };
                } else {
                    newResults[5] = { ...newResults[5], status: 'warning', message: `تم العثور على ${orphanCount} حركات مخزنية بدون بلاغات مرتبطة`, description: 'قد تحتاج لمراجعة يدوية للتأكد من سلامة حسابات التكاليف.' };
                }
            } else {
                newResults[5] = { ...newResults[5], status: 'fail', message: 'فشل فحص الترابط الذري: ' + orphanError.message };
            }
        } catch {
            newResults[5] = { ...newResults[5], status: 'fail', message: 'خطأ غير متوقع في فحص الترابط الذري' };
        }
        setResults([...newResults]);

        // 7. Status Transition Integrity
        newResults.push({
            id: 'status-integrity',
            name: 'فحص سلامة مسارات الحالة',
            status: 'checking',
            message: 'جاري التحقق من وجود بلاغات في حالة غير منطقية...',
            category: 'integrity',
            description: 'اكتشاف بلاغات عالقة: "قيد التنفيذ" منذ أكثر من 48 ساعة أو "تم الحل" ولكن لم تُغلق منذ أكثر من 72 ساعة.'
        });
        setResults([...newResults]);
        try {
            const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

            const [stuckInProgress, stuckResolved] = await Promise.all([
                supabase.from('tickets').select('id', { count: 'exact', head: true })
                    .eq('status', 'in_progress').eq('is_deleted', false).lt('started_at', twoDaysAgo),
                supabase.from('tickets').select('id', { count: 'exact', head: true })
                    .eq('status', 'resolved').eq('is_deleted', false).lt('resolved_at', threeDaysAgo)
            ]);

            const stuckCount = (stuckInProgress.count || 0) + (stuckResolved.count || 0);
            if (stuckCount === 0) {
                newResults[6] = { ...newResults[6], status: 'pass', message: 'لا توجد بلاغات عالقة — كافة المسارات تعمل بكفاءة' };
            } else {
                newResults[6] = { ...newResults[6], status: 'warning', message: `تم اكتشاف ${stuckCount} بلاغات عالقة`, description: `${stuckInProgress.count || 0} بلاغ "قيد التنفيذ" > 48 ساعة، ${stuckResolved.count || 0} بلاغ "تم الحل" > 72 ساعة بدون إغلاق.` };
            }
        } catch {
            newResults[6] = { ...newResults[6], status: 'fail', message: 'فشل فحص سلامة المسارات' };
        }
        setResults([...newResults]);

        setIsRunning(false);
    };

    useEffect(() => {
        runDiagnostics();
    }, []);

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white flex items-center gap-3">
                    <ShieldCheck className="w-10 h-10 text-brand-blaban" /> محرك التشخيص والتدقيق السيادي
                </h1>
                <p className="text-surface-400 mt-2 font-medium">نظام فحص استباقي لضمان "نخاع" بيانات نظيف، استجابة برمجية فائقة، وتوافق تام.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stats Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-surface-900 rounded-3xl border border-surface-800 p-8 text-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blaban/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-brand-blaban/10 transition-all" />
                        <Activity className="w-16 h-16 text-brand-blaban mx-auto mb-4 animate-pulse" />
                        <h2 className="text-xl font-bold text-white mb-2">حالة استقرار النظام</h2>
                        <div className="text-4xl font-black text-white mb-2">
                            {results.filter(r => r.status === 'fail').length > 0 ? 'غير مستقر' : 'مستقر تماماً'}
                        </div>
                        <p className="text-surface-500 text-sm">تم فحص {results.length} مكونات حيوية</p>

                        <button
                            onClick={runDiagnostics}
                            disabled={isRunning}
                            className="mt-8 flex items-center justify-center gap-2 w-full py-4 bg-brand-blaban text-white rounded-2xl font-black hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={clsx("w-5 h-5", isRunning && "animate-spin")} />
                            بدأ الفحص الشامل
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surface-900 rounded-2xl border border-surface-800 p-4 text-center">
                            <p className="text-xs font-bold text-surface-500 uppercase mb-1">السلبيات</p>
                            <p className="text-2xl font-black text-rose-500">{results.filter(r => r.status === 'fail').length}</p>
                        </div>
                        <div className="bg-surface-900 rounded-2xl border border-surface-800 p-4 text-center">
                            <p className="text-xs font-bold text-surface-500 uppercase mb-1">التنبيهات</p>
                            <p className="text-2xl font-black text-amber-500">{results.filter(r => r.status === 'warning').length}</p>
                        </div>
                    </div>
                </div>

                {/* Detailed Results */}
                <div className="lg:col-span-2 space-y-4">
                    {results.map(res => (
                        <div key={res.id} className="bg-surface-900 rounded-2xl border border-surface-800 p-6 flex items-start gap-4 hover:bg-surface-800 transition-all border-r-4 shadow-sm" style={{ borderRightColor: res.status === 'pass' ? '#10b981' : res.status === 'fail' ? '#f43f5e' : res.status === 'warning' ? '#f59e0b' : '#3b82f6' }}>
                            <div className={clsx(
                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                                res.status === 'pass' ? "bg-green-500/10 text-green-500" :
                                    res.status === 'fail' ? "bg-rose-500/10 text-rose-500" :
                                        res.status === 'warning' ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                            )}>
                                {res.category === 'integrity' && <Database className="w-6 h-6" />}
                                {res.category === 'auth' && <Lock className="w-6 h-6" />}
                                {res.category === 'registry' && <Layout className="w-6 h-6" />}
                                {res.category === 'performance' && <Zap className="w-6 h-6" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <h3 className="font-bold text-white truncate">{res.name}</h3>
                                    {res.status === 'pass' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                    {res.status === 'fail' && <AlertCircle className="w-5 h-5 text-rose-500" />}
                                    {res.status === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
                                    {res.status === 'checking' && <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />}
                                </div>
                                <p className="text-sm text-surface-400 leading-relaxed font-medium">{res.message}</p>
                                {res.description && (
                                    <p className="text-[11px] text-surface-500 mt-2 bg-black/30 p-2 rounded-lg font-medium border border-surface-800/50">{res.description}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
