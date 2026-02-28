import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * ErrorBoundary
 * يحمي التطبيق من الانهيار الكامل (White Screen) في حالة تعطل مكون فرعي.
 */
export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Sovereign Error Caught:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in duration-500">
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-3xl p-10 max-w-md shadow-2xl">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-red-900 dark:text-red-400 mb-4">عذراً، حدث خطأ تقني مفاجئ</h3>
                        <p className="text-red-700 dark:text-red-500 text-sm font-medium leading-relaxed mb-8">
                            لقد تم حصر الخطأ لمنع تأثر باقي أجزاء النظام. يمكنك محاولة إعادة تحميل الصفحة أو العودة للوحة التحكم الرئيسية.
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-600/20 w-full"
                            >
                                <RotateCcw className="w-5 h-5" />
                                <span>إعادة تشغيل الواجهة</span>
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-6 py-3 bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700 rounded-xl font-bold hover:bg-surface-50 transition-all w-full"
                            >
                                العودة للمنصة الرئيسية
                            </button>
                        </div>

                        {process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 p-4 bg-black/5 rounded-lg text-left overflow-auto max-h-40">
                                <p className="text-[10px] font-mono text-red-800/60 break-all">
                                    {this.state.error?.toString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
