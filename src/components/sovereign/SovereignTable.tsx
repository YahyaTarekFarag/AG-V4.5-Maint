import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { ColumnConfig } from '../../types/schema';
import { Plus, Search, Edit2, Trash2, Loader2, AlertCircle, Download, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import SovereignActionModal from './SovereignActionModal';
import { useSovereign } from '../../hooks/useSovereign';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface SovereignTableProps {
    tableName: string;
}

export default function SovereignTable({ tableName }: SovereignTableProps) {
    const { schema, data, loading, error, refetch, page, totalPages, totalCount, pageSize, goToPage, fetchAllRows } = useSovereign(tableName);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; errors: number; message?: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            // Priority: Soft Delete
            const { error: softError } = await supabase
                .from(tableName as any)
                .update({ is_deleted: true } as any)
                .eq('id', id);

            if (softError) {
                // Fallback: Hard Delete (if is_deleted not implemented on table yet)
                const { error: hardError } = await supabase
                    .from(tableName as any)
                    .delete()
                    .eq('id', id);
                if (hardError) throw hardError;
            }
            refetch();
        } catch (e: any) {
            alert(`خطأ في الحذف: ${e.message}`);
        }
    };

    // ─── Excel Export (fetches ALL rows, not just current page) ───
    const handleExport = async () => {
        if (totalCount === 0 && (!data || data.length === 0)) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }
        // Fetch ALL data for export (not just current page)
        const allData = await fetchAllRows();
        if (allData.length === 0) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }
        // Use column labels as headers if schema available
        const columns = schema?.list_config?.columns;
        let exportData: any[];

        if (columns && columns.length > 0) {
            // Map to nice headers + include all raw keys
            const allKeys = Object.keys(allData[0]);
            exportData = allData.map(row => {
                const obj: any = {};
                allKeys.forEach(key => {
                    const col = columns.find(c => c.key === key);
                    const label = col ? col.label : key;
                    const val = row[key];
                    obj[label] = (val !== null && typeof val === 'object') ? JSON.stringify(val) : val;
                });
                return obj;
            });
        } else {
            exportData = allData.map(row => {
                const obj: any = {};
                Object.entries(row).forEach(([k, v]) => {
                    obj[k] = (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
                });
                return obj;
            });
        }

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, tableName);

        // Auto-size columns
        const colWidths = Object.keys(exportData[0]).map(key => ({
            wch: Math.max(key.length, ...exportData.map(r => String(r[key] || '').length).slice(0, 100)) + 2
        }));
        ws['!cols'] = colWidths;

        XLSX.writeFile(wb, `${tableName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // ─── Excel Import ───
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        setImportResult(null);

        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData: any[] = XLSX.utils.sheet_to_json(ws);

            if (jsonData.length === 0) {
                setImportResult({ success: 0, errors: 0, message: 'الملف فارغ — لا توجد بيانات.' });
                return;
            }

            // Reverse-map labels to keys if form schema exists
            const formFields = schema?.form_config?.fields;
            const labelToKey: Record<string, string> = {};
            const listCols = schema?.list_config?.columns;
            if (listCols) {
                listCols.forEach(c => { labelToKey[c.label] = c.key; });
            }
            if (formFields) {
                formFields.forEach((f: any) => { labelToKey[f.label] = f.key; });
            }

            // Map rows: try label→key mapping first, then use raw key
            const mappedRows = jsonData.map(row => {
                const mapped: any = {};
                Object.entries(row).forEach(([header, value]) => {
                    const key = labelToKey[header] || header;
                    // Skip system fields that shouldn't be imported
                    if (['id', 'created_at', 'updated_at', 'is_deleted'].includes(key)) return;
                    mapped[key] = value;
                });
                return mapped;
            });

            let successCount = 0;
            let errorCount = 0;

            // Insert in batches of 50
            for (let i = 0; i < mappedRows.length; i += 50) {
                const batch = mappedRows.slice(i, i + 50);
                const { error: insertError } = await supabase
                    .from(tableName as any)
                    .insert(batch as any);

                if (insertError) {
                    console.error('Import batch error:', insertError);
                    errorCount += batch.length;
                } else {
                    successCount += batch.length;
                }
            }

            setImportResult({ success: successCount, errors: errorCount });
            if (successCount > 0) refetch();
        } catch (err: any) {
            setImportResult({ success: 0, errors: 0, message: 'خطأ في قراءة الملف: ' + err.message });
        } finally {
            setImporting(false);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = '';
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
                try {
                    return <span>{format(new Date(val), 'PPP hh:mm a', { locale: ar })}</span>;
                } catch {
                    return <span>{val}</span>;
                }
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
                <p className="text-red-700 font-medium text-center">{error}</p>
                <button onClick={refetch} className="mt-4 px-4 py-2 bg-white text-red-600 rounded-lg shadow-sm border border-red-100 hover:bg-red-50 transition-colors">إعادة المحاولة</button>
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
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                    {list_config.searchable !== false && (
                        <div className="relative flex-1 sm:w-56">
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
                        onClick={handleExport}
                        disabled={data.length === 0}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-all disabled:opacity-50 shrink-0"
                        title="تصدير Excel"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">تصدير</span>
                    </button>
                    <div className="relative shrink-0">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleImport}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            disabled={importing}
                        />
                        <button
                            className={clsx(
                                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border rounded-xl transition-all shrink-0",
                                importing
                                    ? "bg-blue-100 text-blue-600 border-blue-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                            )}
                            title="استيراد من Excel"
                        >
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            <span className="hidden sm:inline">استيراد</span>
                        </button>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-primary-500/20 transition-all shrink-0"
                    >
                        <Plus className="w-5 h-5" />
                        <span>إضافة</span>
                    </button>
                </div>
            </div>

            {/* Import Result Banner */}
            {importResult && (
                <div className={clsx(
                    "mx-6 mt-4 p-3 rounded-xl flex items-center gap-2 text-sm font-medium border",
                    importResult.message
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : importResult.errors > 0
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                )}>
                    {importResult.message ? (
                        <><AlertCircle className="w-4 h-4 shrink-0" />{importResult.message}</>
                    ) : (
                        <>
                            ✅ تم استيراد <strong>{importResult.success}</strong> سجل بنجاح
                            {importResult.errors > 0 && <> | ❌ <strong>{importResult.errors}</strong> سجل فشل</>}
                        </>
                    )}
                    <button onClick={() => setImportResult(null)} className="mr-auto text-xs hover:underline">إغلاق</button>
                </div>
            )}

            <div className="overflow-x-auto flex-1">
                <table className="w-full text-right text-sm">
                    <thead className="sticky top-0 z-20">
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

            {/* ─── Pagination Bar ─── */}
            {totalPages > 1 && (
                <div className="px-6 py-3 border-t border-surface-100 bg-surface-50/50 flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-sm text-surface-500">
                        عرض <strong>{page * pageSize + 1}</strong>–<strong>{Math.min((page + 1) * pageSize, totalCount)}</strong> من <strong>{totalCount}</strong> سجل
                    </p>
                    <div className="flex items-center gap-1" dir="ltr">
                        <button
                            onClick={() => goToPage(0)}
                            disabled={page === 0 || loading}
                            className="p-2 rounded-lg hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="الصفحة الأولى"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => goToPage(page - 1)}
                            disabled={page === 0 || loading}
                            className="p-2 rounded-lg hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="السابق"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        {/* Page Numbers */}
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 7) {
                                pageNum = i;
                            } else if (page < 3) {
                                pageNum = i;
                            } else if (page > totalPages - 4) {
                                pageNum = totalPages - 7 + i;
                            } else {
                                pageNum = page - 3 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => goToPage(pageNum)}
                                    disabled={loading}
                                    className={clsx(
                                        "w-9 h-9 rounded-lg text-sm font-medium transition-all",
                                        page === pageNum
                                            ? "bg-primary-600 text-white shadow-sm"
                                            : "hover:bg-surface-200 text-surface-600"
                                    )}
                                >
                                    {pageNum + 1}
                                </button>
                            );
                        })}

                        <button
                            onClick={() => goToPage(page + 1)}
                            disabled={page >= totalPages - 1 || loading}
                            className="p-2 rounded-lg hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="التالي"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => goToPage(totalPages - 1)}
                            disabled={page >= totalPages - 1 || loading}
                            className="p-2 rounded-lg hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="الصفحة الأخيرة"
                        >
                            <ChevronsRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <SovereignActionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                schema={schema}
                record={selectedRecord}
                onSuccess={() => {
                    setIsModalOpen(false);
                    refetch();
                }}
            />
        </div>
    );
}
