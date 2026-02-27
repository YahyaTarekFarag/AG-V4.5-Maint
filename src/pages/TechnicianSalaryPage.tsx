import { useEffect, useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Wallet, TrendingUp, Star, History, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function TechnicianSalaryPage() {
    const { profile } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile) {
            fetchPayrollData();
        }
    }, [profile]);

    const fetchPayrollData = async () => {
        try {
            // Get today's earnings
            const today = new Date().toISOString().split('T')[0];
            const { data: todayData } = await supabase
                .from('payroll_logs' as any)
                .select('*')
                .eq('profile_id', profile?.id)
                .eq('date', today)
                .maybeSingle();

            setStats(todayData);

            // Get last 7 days history
            const { data: historyData } = await supabase
                .from('payroll_logs' as any)
                .select('*')
                .eq('profile_id', profile?.id)
                .order('date', { ascending: false })
                .limit(7);

            setHistory(historyData || []);
        } catch (e) {
            console.error('Error fetching payroll', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-surface-900 dark:text-white flex items-center gap-3 transition-colors">
                            <Wallet className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                            مركز الاستحقاقات المالية للفنيين
                        </h2>
                        <p className="text-surface-500 dark:text-surface-400 mt-1 transition-colors">المتابعة الفورية للاستحقاقات المالية ومكافآت الإنجاز التشغيلي</p>
                    </div>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-surface-900 border border-surface-800 text-surface-300 rounded-2xl text-sm font-bold hover:bg-surface-800 transition-all shadow-xl">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        طلب تدقيق مالي للدفعة
                    </button>
                </div>
            </div>

            {/* Today's Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-3xl p-6 text-white shadow-xl shadow-primary-500/20 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-primary-100 text-sm font-medium">إجمالي صافي الاستحقاقات (اليوم)</p>
                            <h3 className="text-4xl font-black mt-1">
                                {stats?.net_earning ? Number(stats.net_earning).toLocaleString() : '0'} <span className="text-lg font-normal">جنيه</span>
                            </h3>
                        </div>
                        <TrendingUp className="w-8 h-8 text-primary-200 opacity-50" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-primary-500/30">
                        <div>
                            <p className="text-primary-200 text-xs">بدلات التنقل التشغيلي (المأموريات)</p>
                            <p className="font-bold text-lg">{stats?.total_allowance || 0} ج.م</p>
                        </div>
                        <div>
                            <p className="text-primary-200 text-xs">حوافز مؤشر الجودة (تقييم النجوم)</p>
                            <p className="font-bold text-lg">{stats?.total_star_bonus || 0} ج.م</p>
                        </div>
                    </div>
                </div>

                <div className="bg-surface-900 border border-surface-800 rounded-3xl p-6 flex flex-col justify-between transition-colors shadow-2xl">
                    <div className="flex items-center gap-3 text-white font-bold mb-4">
                        <div className="p-2 bg-amber-900/20 rounded-xl">
                            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                        </div>
                        خلاصة الأداء اليومي
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-surface-400">الأجر الأساسي اليومي الثابت</span>
                            <span className="font-bold text-white">{stats?.base_salary || profile?.base_daily_rate || 100} ج.م</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-surface-400">الموقف الضريبي والاستقطاعات</span>
                            <span className="text-green-400 font-semibold">لا يوجد خصومات</span>
                        </div>
                    </div>
                    <div className="mt-6 p-3 bg-surface-950 rounded-2xl text-center border border-surface-800">
                        <p className="text-xs text-surface-500">يتم تحديث البيانات المالية المجمعة فور اعتماد إغلاق المهام الفنية</p>
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-surface-900 border border-surface-800 rounded-3xl overflow-hidden shadow-2xl transition-colors">
                <div className="p-6 border-b border-surface-800 flex items-center justify-between bg-surface-800/50">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-surface-500" /> الأرشيف الزمني للاستحقاقات التشغيلية
                    </h3>
                    <Calendar className="w-5 h-5 text-surface-600" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="bg-surface-800/50 text-surface-400 text-xs uppercase tracking-wider transition-colors">
                                <th className="px-6 py-4 font-bold">بيان التاريخ</th>
                                <th className="px-6 py-4 font-bold">إجمالي البدلات</th>
                                <th className="px-6 py-4 font-bold">إجمالي الحوافز</th>
                                <th className="px-6 py-4 font-bold">صافي الاستحقاق</th>
                                <th className="px-6 py-4 font-bold text-center">حالة الصرف</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                            {history.length > 0 ? history.map((day, idx) => (
                                <tr key={idx} className="hover:bg-surface-800 transition-colors">
                                    <td className="px-6 py-4 font-semibold text-white">
                                        {format(new Date(day.date), 'EEEE, d MMMM', { locale: ar })}
                                    </td>
                                    <td className="px-6 py-4 text-surface-400">{day.total_allowance} ج.م</td>
                                    <td className="px-6 py-4 text-amber-400 font-medium">+{day.total_star_bonus} ج.م</td>
                                    <td className="px-6 py-4 font-bold text-white">{day.net_earning} ج.م</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${day.is_paid ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>
                                            {day.is_paid ? 'تم تسوية الصرف' : 'قيد الاستحقاق'}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-surface-400 italic">
                                        لا تتوفر سجلات تاريخية للاستحقاقات في الأرشيف المالي حالياً
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Support Box */}
            <div className="mt-8 p-6 bg-blue-900/20 border border-blue-900/30 rounded-3xl flex items-start gap-4 transition-colors">
                <div className="p-3 bg-surface-800 rounded-2xl shadow-lg border border-white/5">
                    <History className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                    <h4 className="font-bold text-blue-300">سياسات حوكمة واحتساب البدلات التشغيلية</h4>
                    <p className="text-sm text-blue-400/80 mt-1 leading-relaxed">
                        تُعتمد البدلات التشغيلية آلياً وفق معايير الحوكمة المعتمدة للمسافات الجغرافية بين مواقع الفروع المسجلة.
                        يرجى التأكد من تفعيل "مباشرة الصيانة" و"إشعار الإنجاز" ضمن النطاق الجغرافي المعتمد للفرع (Geofencing) لضمان الدقة الكاملة في الأرشفة المالية للمأمورية.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
}
