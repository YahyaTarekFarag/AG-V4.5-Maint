import { useParams } from 'react-router-dom';
import SovereignPage from '../components/sovereign/SovereignPage';
import { AlertTriangle } from 'lucide-react';

export default function MasterDataPage({ tableName: propTableName }: { tableName?: string }) {
    const { tableName: urlTableName } = useParams();
    const tableName = propTableName || urlTableName;

    if (!tableName) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] p-8 text-center">
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-3xl p-8 max-w-md">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-red-900 dark:text-red-400 mb-2">خطأ في تحميل البيانات</h3>
                    <p className="text-red-700 dark:text-red-500 text-sm">لم يتم تحديد مرجع الجدول المطلوب استعراضه. يرجى العودة للوحة التحكم والمحاولة مرة أخرى.</p>
                </div>
            </div>
        );
    }

    return <SovereignPage tableName={tableName} />;
}
