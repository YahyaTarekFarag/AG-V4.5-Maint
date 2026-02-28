import React, { useState } from 'react';
import { useAuth } from '@shared/hooks/useAuth';
import { Settings, LogIn, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export default function Login() {
    const { signIn } = useAuth();
    const [employeeCode, setEmployeeCode] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employeeCode || !password) {
            setError('يتطلب الدخول إدخال الرقم الوظيفي وكلمة المرور المعتمدة.');
            return;
        }
        setError(null);
        setLoading(true);

        const { error: signInError } = await signIn(employeeCode, password);
        if (signInError) {
            if (signInError.message?.includes('Invalid login credentials')) {
                setError('لم نتمكن من التحقق من بيانات الدخول؛ يرجى مراجعة الرقم الوظيفي أو كلمة المرور.');
            } else if (signInError.message?.includes('Email not confirmed')) {
                setError('الحساب قيد المراجعة الإدارية؛ يرجى التواصل مع إدارة التقنية لتفعيل الدخول.');
            } else {
                setError(`خطأ في الاتصال: ${signInError.message}`);
            }
        }
        setLoading(false);
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-surface-900 overflow-hidden">
            {/* Background decoration - Premium Aesthetics */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-brand-blaban/20 rounded-full blur-[120px] mix-blend-screen"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-teal-800/30 rounded-full blur-[150px] mix-blend-screen"></div>
            </div>

            <div className="relative z-10 w-full max-w-md px-6">
                <div className="bg-surface-800/60 backdrop-blur-xl border border-surface-700 shadow-2xl rounded-3xl p-8 transform transition-all">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-brand-blaban to-brand-basbosa rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-blaban/30 mb-6 border-2 border-white/20">
                            <Settings className="w-10 h-10 text-white animate-spin-slow" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">منصة الحوكمة الموحدة (ERP)</h1>
                        <p className="text-surface-400 text-sm tracking-wide">نظام إدارة الصيانة الاستراتيجية — V10.0</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p className="text-sm">{error}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-2">الرقم الوظيفي</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    dir="ltr"
                                    value={employeeCode}
                                    onChange={(e) => setEmployeeCode(e.target.value)}
                                    className="w-full bg-surface-900/50 border border-surface-600 text-white rounded-xl px-4 py-3 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-medium text-left"
                                    placeholder="Employee ID"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-2">كلمة المرور</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    dir="ltr"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-surface-900/50 border border-surface-600 text-white rounded-xl px-4 py-3 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-medium text-left"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={clsx(
                                "w-full flex items-center justify-center gap-2 py-4 px-4 bg-brand-blaban hover:bg-brand-blaban/90 text-white rounded-2xl font-black shadow-2xl shadow-brand-blaban/30 transition-all focus:outline-none focus:ring-2 focus:ring-accent-sky/50 focus:ring-offset-2 focus:ring-offset-surface-900 active:scale-95",
                                loading && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    <span>دخول آمن للمنصة</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-surface-500">هذا النظام محمي لأغراض مؤسسية فقط؛ يرجى الامتناع عن محاولة الدخول لغير المصرح لهم.<br />إدارة الحسابات تتم مركزياً عبر قسم الموارد البشرية.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
