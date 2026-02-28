import { useEffect, useState } from 'react';
import { supabase } from '@shared/lib/supabase';
import { Loader2, History, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface AuditLog {
    id: string;
    table_name: string;
    record_id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    old_data: any;
    new_data: any;
    user_id: string;
    performed_at: string;
    // Optional join
    performer?: { full_name: string };
}

const ACTION_STYLE: Record<string, string> = {
    INSERT: 'text-green-700 bg-green-50 border-green-200',
    UPDATE: 'text-blue-700  bg-blue-50  border-blue-200',
    DELETE: 'text-red-700   bg-red-50   border-red-200',
};
const ACTION_LABEL: Record<string, string> = {
    INSERT: '+ تسجيل قيد جديد',
    UPDATE: '✏ تعديل البيانات',
    DELETE: '✕ حذف السجل',
};

interface Props { tableName: string; }

export default function AuditLogViewer({ tableName }: Props) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 20;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (tableName) load(); }, [tableName, page]);

    const load = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('audit_logs' as any)
            .select('*')
            .eq('table_name', tableName)
            .order('performed_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        setLogs((data || []) as AuditLog[]);
        setLoading(false);
    };

    if (loading) return (
        <div className="bg-white rounded-2xl border border-surface-200 p-16 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-primary-400" />
        </div>
    );

    return (
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-surface-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-primary-500" />
                    <span className="font-semibold text-surface-800">بروتوكول سجل العمليات التشغيلية</span>
                    <span className="text-xs bg-surface-100 text-surface-500 px-2 py-0.5 rounded-full font-mono">{tableName}</span>
                </div>
                <button onClick={load} className="p-2 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-lg transition-colors">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {logs.length === 0 ? (
                <div className="p-12 text-center text-surface-400">
                    <History className="w-10 h-10 mx-auto mb-2 text-surface-200" />
                    <p>لا توجد تغييرات مسجّلة بعد</p>
                    <p className="text-xs mt-1">سيظهر السجل بعد تشغيل sovereign_v2_audit.sql</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-surface-50 border-b border-surface-100 sticky top-0">
                                <tr>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500">الإجراء</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500">المعرف</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500">التوقيت</th>
                                    <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500">البيانات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-surface-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${ACTION_STYLE[log.action] || ''}`}>
                                                {ACTION_LABEL[log.action] || log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs text-surface-500 truncate max-w-[100px] block">{log.record_id || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-surface-500 whitespace-nowrap text-xs">
                                            {log.performed_at ? format(new Date(log.performed_at), 'dd/MM/yyyy HH:mm', { locale: ar }) : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <details className="cursor-pointer">
                                                <summary className="text-xs text-primary-600 hover:text-primary-800 font-medium list-none">عرض التغييرات ←</summary>
                                                <div className="mt-2 grid grid-cols-2 gap-2 max-w-lg">
                                                    {log.old_data && (
                                                        <div>
                                                            <p className="text-xs text-red-500 font-semibold mb-1">قبل:</p>
                                                            <pre className="text-xs bg-red-50 rounded p-2 overflow-x-auto max-h-32 text-red-800 border border-red-100">
                                                                {JSON.stringify(log.old_data, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {log.new_data && (
                                                        <div>
                                                            <p className="text-xs text-green-600 font-semibold mb-1">بعد:</p>
                                                            <pre className="text-xs bg-green-50 rounded p-2 overflow-x-auto max-h-32 text-green-800 border border-green-100">
                                                                {JSON.stringify(log.new_data, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </details>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 border-t border-surface-100 flex justify-between items-center">
                        <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-4 py-2 text-sm text-surface-600 hover:bg-surface-100 rounded-lg disabled:opacity-40 transition-colors">
                            ← السابق
                        </button>
                        <span className="text-xs text-surface-400">صفحة {page + 1}</span>
                        <button disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} className="px-4 py-2 text-sm text-surface-600 hover:bg-surface-100 rounded-lg disabled:opacity-40 transition-colors">
                            التالي →
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
