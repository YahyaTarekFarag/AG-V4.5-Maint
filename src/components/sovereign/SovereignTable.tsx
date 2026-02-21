import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UISchema, ListConfig, ColumnConfig } from '../../types/schema';
import { Plus, Search, Edit2, Trash2, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import SovereignActionModal from './SovereignActionModal';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface SovereignTableProps {
    tableName: string;
}

export default function SovereignTable({ tableName }: SovereignTableProps) {
    const [schema, setSchema] = useState<UISchema | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

    useEffect(() => {
        fetchSchemaAndData();
    }, [tableName]);

    const fetchSchemaAndData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Schema Definition
            const { data: schemaData, error: schemaError } = await supabase
                .from('ui_schemas')
                .select('*')
                .eq('table_name', tableName)
                .single();

            if (schemaError) throw new Error(`لم يتم العثور على إعدادات الواجهة للجدول: ${tableName}`);
            if (!schemaData) throw new Error('لا توجد بيانات وصفية.');

            setSchema(schemaData as UISchema);

            // 2. Fetch Actual Data
            await loadData(schemaData.list_config);

        } catch (e: any) {
            setError(e.message || 'حدث خطأ مجهول أثناء جلب الواجهة.');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadData = async (config: ListConfig) => {
        let query = supabase.from(tableName as any).select('*');
        if (config.defaultSort) {
            query = query.order(config.defaultSort.column, { ascending: config.defaultSort.ascending });
        } else {
            query = query.order('created_at', { ascending: false }); // Default fallback
        }
        const { data: rows, error: rowsError } = await query;
        if (rowsError) throw new Error(`خطأ في جلب بيانات الجدول: ${rowsError.message}`);
        setData(rows || []);
    };

    const handleCreate = () => {
        setSelectedRecord(null);
        setIsModalOpen(true);
    };

    const handleEdit = (record: any) => {
        setSelectedRecord(record);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('هل أنت متأكد من الحذف؟')) return;
        try {
            const { error } = await supabase.from(tableName as any).delete().eq('id', id);
            if (error) throw error;
            setData(data.filter(item => item.id !== id));
        } catch (e: any) {
            alert(`خطأ في الحذف: ${e.message}`);
        }
    };

    const renderCell = (row: any, col: ColumnConfig) => {
        const val = row[col.key];
        if (val == null) return <span className="text-surface-400">-</span>;

        switch (col.type) {
            case 'status':
                return (
                    <span className={clsx(
                        "px-2.5 py-1 rounded-full text-xs font-semibold border",
                        val === 'open' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            val === 'assigned' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                val === 'in_progress' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                    val === 'resolved' ? "bg-teal-50 text-teal-700 border-teal-200" :
                                        val === 'closed' ? "bg-zinc-100 text-zinc-700 border-zinc-200" :
                                            "bg-surface-100 text-surface-700 border-surface-200"
                    )}>
                        {val === 'open' ? 'جديد' :
                            val === 'assigned' ? 'موجه للفني' :
                                val === 'in_progress' ? 'قيد العمل' :
                                    val === 'resolved' ? 'بانتظار الاعتماد' :
                                        val === 'closed' ? 'مغلق' : val}
                    </span>
                );
            case 'date':
                return <span>{format(new Date(val), 'PPP hh:mm a', { locale: ar })}</span>;
            case 'badge':
                return <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded text-sm font-medium">{val}</span>;
            default:
                return <span>{val}</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-sm border border-surface-200">
                <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
                <p className="text-surface-500 font-medium">جاري تشغيل واجهة {tableName}...</p>
            </div>
        );
    }

    if (error || !schema) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-red-50 rounded-3xl border border-red-200">
                <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
                <p className="text-red-700 font-medium">{error}</p>
                <button onClick={fetchSchemaAndData} className="mt-4 px-4 py-2 bg-white text-red-600 rounded-lg shadow-sm border border-red-100 hover:bg-red-50 transition-colors">إعادة المحاولة</button>
            </div>
        );
    }

    const { list_config } = schema;
    const filteredData = data.filter(row => {
        if (!searchTerm) return true;
        return list_config.columns.some(col =>
            String(row[col.key] || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-surface-200 overflow-hidden flex flex-col h-full z-10 relative">
            <div className="p-6 border-b border-surface-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-50/50">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900">{list_config.title}</h2>
                    <p className="text-surface-500 text-sm mt-1">{filteredData.length} سجل متاح</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {list_config.searchable !== false && (
                        <div className="relative flex-1 sm:w-64">
                            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-surface-400" />
                            <input
                                type="text"
                                placeholder={list_config.searchPlaceholder || "بحث سريع..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-4 pr-10 py-2.5 bg-white border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-shadow"
                            />
                        </div>
                    )}
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-primary-500/20 transition-all shrink-0"
                    >
                        <Plus className="w-5 h-5" />
                        <span>إضافة</span>
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                    <thead>
                        <tr className="bg-surface-50 text-surface-500 font-medium border-b border-surface-200">
                            {list_config.columns.map((col, idx) => (
                                <th key={idx} className="px-6 py-4 whitespace-nowrap">{col.label}</th>
                            ))}
                            <th className="px-6 py-4 w-24">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100/80 bg-white">
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={list_config.columns.length + 1} className="px-6 py-12 text-center text-surface-400">
                                    لا توجد بيانات متاحة للعرض.
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((row, i) => (
                                <tr key={row.id || i} className="hover:bg-surface-50/50 transition-colors group">
                                    {list_config.columns.map((col, colIdx) => (
                                        <td key={colIdx} className="px-6 py-4 text-surface-700">
                                            {renderCell(row, col)}
                                        </td>
                                    ))}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(row.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <SovereignActionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                schema={schema}
                record={selectedRecord}
                onSuccess={() => {
                    setIsModalOpen(false);
                    loadData(list_config);
                }}
            />
        </div>
    );
}
