import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
            setError('يرجى إدخال كود الموظف وكلمة المرور.');
            return;
        }
        setError(null);
        setLoading(true);

        const { error: signInError } = await signIn(employeeCode, password);
        if (signInError) {
            if (signInError.message?.includes('Invalid login credentials')) {
                setError('كود الموظف أو كلمة المرور غير صحيحة.');
            } else if (signInError.message?.includes('Email not confirmed')) {
                setError('الحساب غير مفعّل. تواصل مع المدير.');
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
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-teal-800/30 rounded-full blur-[150px] mix-blend-screen"></div>
            </div>

            <div className="relative z-10 w-full max-w-md px-6">
                <div className="bg-surface-800/60 backdrop-blur-xl border border-surface-700 shadow-2xl rounded-3xl p-8 transform transition-all">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 mb-4">
                            <Settings className="w-8 h-8 text-white animate-spin-slow" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">النظام الموحد</h1>
                        <p className="text-surface-400 text-sm tracking-wide">FSC Maintenance App V10.0</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <p className="text-sm">{error}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-surface-300 mb-2">كود الموظف</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    dir="ltr"
                                    value={employeeCode}
                                    onChange={(e) => setEmployeeCode(e.target.value)}
                                    className="w-full bg-surface-900/50 border border-surface-600 text-white rounded-xl px-4 py-3 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-medium text-left"
                                    placeholder="1001"
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
                                "w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold shadow-lg shadow-primary-900/20 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-surface-800",
                                loading && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    <span>تسجيل الدخول</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-xs text-surface-500">نظام مغلق مخصص لموظفي الشركة فقط.<br />لا يوجد خيار لإنشاء حساب.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
