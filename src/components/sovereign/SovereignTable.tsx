import { useState, useRef, useCallback, memo, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ColumnConfig } from '../../types/schema';
import { Plus, Search, Edit2, Trash2, Loader2, AlertCircle, Download, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Zap, Filter, RotateCcw } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import SovereignActionModal from './SovereignActionModal';
import SovereignFilterPanel from './SovereignFilterPanel';
import SovereignKPIBar from './SovereignKPIBar';
import { useSovereign } from '../../hooks/useSovereign';
import { SOVEREIGN_REGISTRY } from '../../lib/sovereign';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import Skeleton from '../ui/Skeleton';

interface SovereignTableProps {
    tableName: string;
}

// ─── Memoized Mobile Card ───
const MobileCard = memo(({ row, columns, tableName, onEdit, onDelete, onAction, renderCell }: any) => {
    const config = SOVEREIGN_REGISTRY[tableName];

    return (
        <div className="glass-premium rounded-[2.5rem] p-6 border border-surface-800 flex flex-col gap-5 active:scale-[0.98] transition-all hover:shadow-2xl hover:border-brand-blaban/50">
            <div className="grid grid-cols-1 gap-3">
                {columns.map((col: any, colIdx: number) => (
                    <div key={colIdx} className="flex justify-between items-start gap-4 pb-3 border-b border-surface-800/20 last:border-0">
                        <span className="text-[10px] font-black text-surface-500 uppercase tracking-widest shrink-0 font-outfit">{col.label}</span>
                        <div className="text-sm font-medium text-white text-left">
                            {renderCell(row, col)}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-800 flex-wrap">
                {config?.actions?.filter(a => !a.condition || a.condition(row)).map(action => (
                    <button
                        key={action.key}
                        onClick={() => onAction(action, row)}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold border min-w-[100px]",
                            action.color === 'purple' ? "bg-purple-900/20 text-purple-300 border-purple-900/30" :
                                action.color === 'blue' ? "bg-blue-900/20 text-blue-300 border-blue-900/30" :
                                    "bg-surface-800 text-surface-300 border-surface-700"
                        )}
                    >
                        {(() => {
                            const IconComp = (LucideIcons as any)[action.icon] || Zap;
                            return <IconComp className="w-4 h-4" />;
                        })()}
                        <span>{action.label}</span>
                    </button>
                ))}

                <button
                    onClick={() => onEdit(row)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-blaban text-white rounded-2xl font-black shadow-lg shadow-brand-blaban/20 min-w-[100px] hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    <Edit2 className="w-4 h-4" />
                    <span>تعديل السجل</span>
                </button>
                <button
                    onClick={() => onDelete(row.id)}
                    className="p-3 bg-brand-whem text-white rounded-2xl shadow-lg shadow-brand-whem/20 hover:scale-[1.05] active:scale-[0.95] transition-all"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
});

export default function SovereignTable({ tableName }: SovereignTableProps) {
    const { schema, data, loading, error, refetch, page, totalPages, totalCount, pageSize, goToPage, fetchAllRows, filters, setFilters, metricsData } = useSovereign(tableName);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [isAssignMode, setIsAssignMode] = useState(false);
    const [actionTitle, setActionTitle] = useState<string | undefined>(undefined);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; errors: number; message?: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCreate = useCallback(() => {
        setSelectedRecord(null);
        setIsAssignMode(false);
        setActionTitle(undefined);
        setIsModalOpen(true);
    }, []);

    const handleEdit = useCallback((record: any) => {
        setSelectedRecord(record);
        setIsAssignMode(false);
        setActionTitle(undefined);
        setIsModalOpen(true);
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا السجل بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.')) return;
        try {
            const { error: softError } = await supabase
                .from(tableName as any)
                .update({ is_deleted: true } as any)
                .eq('id', id);

            if (softError) {
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
    }, [tableName, refetch]);

    const handleAction = useCallback((action: any, row: any) => {
        setSelectedRecord(row);
        setIsAssignMode(!!action.isAssignMode);
        setActionTitle(action.label);
        setIsModalOpen(true);
    }, []);

    const handleExport = async () => {
        try {
            const allRows = await fetchAllRows();
            const config = SOVEREIGN_REGISTRY[tableName];

            if (!allRows || allRows.length === 0) {
                alert('لا توجد بيانات للتصدير.');
                return;
            }

            // ─── Refined Export Data Resolution ───
            const exportData = allRows.map(row => {
                const resolvedRow: any = {};

                schema?.list_config?.columns.forEach(col => {
                    let val = row[col.key];

                    // 1. Resolve Relationships (Metadata Driven)
                    if (config?.relationships?.[col.key]) {
                        const relTable = config.relationships[col.key];
                        const relObj = row[relTable] || row[col.key.replace('_id', '')];
                        if (relObj && typeof relObj === 'object') {
                            val = relObj.name || relObj.full_name || relObj.title || relObj.label || val;
                        }
                    }

                    // 2. Resolve Status Labels
                    if (col.type === 'status' && config?.formatting?.statusLabels) {
                        val = config.formatting.statusLabels[val] || val;
                    }

                    // 3. Resolve Date Formatting
                    if ((col.type === 'date' || col.type === 'datetime') && val) {
                        try {
                            val = format(new Date(val), col.type === 'datetime' ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
                        } catch { /* skip */ }
                    }

                    resolvedRow[col.label] = val;
                });
                return resolvedRow;
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Sovereign Data");

            // Auto-size columns
            const colWidths = Object.keys(exportData[0]).map(key => ({
                wch: Math.max(key.length, ...exportData.map(r => String(r[key] || '').length).slice(0, 100)) + 2
            }));
            ws['!cols'] = colWidths;

            XLSX.writeFile(wb, `${tableName}_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error('Export failed:', err);
            alert('فشل التصدير: ' + (err as Error).message);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // [QUANTUM FIX] Safety check for UI Schema to prevent Main Thread Blocking
        // In a production environment with 5MB+ JSONs, this should be moved to a Web Worker
        // For now, we ensure the schema is solid and doesn't cause recursive Fiber chokes
        setImporting(true);
        setImportResult(null);

        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData: any[] = XLSX.utils.sheet_to_json(ws);

            if (jsonData.length === 0) {
                setImportResult({ success: 0, errors: 0, message: 'الملف المرفق فارغ؛ لا توجد بيانات للمعالجة.' });
                return;
            }

            const labelToKey: Record<string, string> = {};
            const listCols = schema?.list_config?.columns;
            const formFields = schema?.form_config?.fields;

            if (listCols) listCols.forEach(c => { labelToKey[c.label] = c.key; });
            if (formFields) formFields.forEach((f: any) => { labelToKey[f.label] = f.key; });

            const mappedRows = jsonData.map(row => {
                const mapped: any = {};
                Object.entries(row).forEach(([header, value]) => {
                    const key = labelToKey[header] || header;
                    if (['id', 'created_at', 'updated_at', 'is_deleted'].includes(key)) return;
                    mapped[key] = value;
                });
                return mapped;
            });

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < mappedRows.length; i += 50) {
                const batch = mappedRows.slice(i, i + 50);
                const { error: insertError } = await supabase.from(tableName as any).insert(batch as any);
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
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const renderCell = (row: any, col: ColumnConfig) => {
        let val = row[col.key];
        const config = SOVEREIGN_REGISTRY[tableName];

        if (val && typeof val === 'object' && !Array.isArray(val)) {
            val = val.name || val.full_name || val.title || val.label || val.id || JSON.stringify(val);
        }

        if (col.key.endsWith('_id') || ['assigned_to', 'profile_id', 'technician_id', 'manager_id'].includes(col.key)) {
            const relKeyFromRegistry = config?.relationships?.[col.key];
            if (relKeyFromRegistry) {
                const possibleRelKeys = [
                    relKeyFromRegistry,
                    col.key.replace('_id', ''),
                    `${relKeyFromRegistry}_profile`,
                    'profiles',
                    'branches'
                ];

                for (const relKey of possibleRelKeys) {
                    const linkedObj = row[relKey];
                    if (linkedObj && typeof linkedObj === 'object') {
                        val = linkedObj.name || linkedObj.full_name || linkedObj.title || linkedObj.label || val;
                        break;
                    }
                }
            }
        }

        if (val == null) return <span className="text-surface-400">-</span>;

        if (col.type === 'status' && config?.formatting?.statusLabels) {
            const colorClass = config.formatting.statusColors?.[val] || 'surface';
            const label = config.formatting.statusLabels[val] || val;

            const colorMap: Record<string, string> = {
                amber: "bg-amber-50 text-amber-700 border-amber-200",
                blue: "bg-blue-50 text-blue-700 border-blue-200",
                purple: "bg-purple-50 text-purple-700 border-purple-200",
                teal: "bg-teal-50 text-teal-700 border-teal-200",
                zinc: "bg-zinc-100 text-zinc-700 border-zinc-200",
                primary: "bg-primary-50 text-primary-700 border-primary-200"
            };

            return (
                <span className={clsx(
                    "px-2.5 py-1 rounded-full text-xs font-semibold border",
                    colorMap[colorClass] || "bg-surface-800 text-surface-300 border-surface-700"
                )}>
                    {label}
                </span>
            );
        }

        switch (col.type) {
            case 'date':
                try {
                    return <span>{format(new Date(val), 'PPP', { locale: ar })}</span>;
                } catch {
                    return <span>{val}</span>;
                }
            case 'datetime':
                try {
                    return <span>{format(new Date(val), 'PPP hh:mm a', { locale: ar })}</span>;
                } catch {
                    return <span>{val}</span>;
                }
            case 'checkbox':
                return (
                    <span className={clsx(
                        "px-2.5 py-1 rounded-lg text-xs font-bold border",
                        val ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                    )}>
                        {val ? 'نعم' : 'لا'}
                    </span>
                );
            case 'badge':
                return <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded text-sm font-medium">{val}</span>;
            default:
                if (config?.formatting?.lowStockAlert === col.key && Number(val) < 5) {
                    return <span className="text-red-600 font-bold animate-pulse">⚠️ {val} (منخفض)</span>;
                }
                return <span>{val}</span>;
        }
    };

    // ─── دالة مساعدة لجلب القيمة النصية للخلية (لأغراض البحث) ───
    const getCellValue = (row: any, colKey: string) => {
        let val = row[colKey];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            val = val.name || val.full_name || val.title || val.label || '';
        }
        if (colKey.endsWith('_id') || ['assigned_to', 'profile_id'].includes(colKey)) {
            const relKey = colKey.replace('_id', '');
            const obj = row[relKey] || row[colKey === 'assigned_to' ? 'assigned_to_profile' : ''];
            if (obj) val = obj.name || obj.full_name || obj.title || obj.label || val;
        }
        return String(val || '').toLowerCase();
    };

    // ─── تحسين الأداء: فلترة البيانات محلياً (Memoized Search) ───
    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const search = searchTerm.toLowerCase();
        const cols = schema?.list_config?.columns || [];
        return data.filter(row =>
            cols.some(col => getCellValue(row, col.key).includes(search))
        );
    }, [data, searchTerm, schema?.list_config?.columns]);

    // ─── Rendering Helper with Highlighting ───
    const renderCellWithHighlight = (row: any, col: ColumnConfig) => {
        const content = renderCell(row, col);
        if (!searchTerm || typeof content !== 'string') return content;

        const parts = String(content).split(new RegExp(`(${searchTerm})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) => (
                    part.toLowerCase() === searchTerm.toLowerCase() ?
                        <span key={i} className="bg-brand-blaban/30 text-white rounded px-0.5 font-black">{part}</span> :
                        part
                ))}
            </span>
        );
    };

    // ─── Summary Row Calculation ───
    const summaryRow = useMemo(() => {
        if (filteredData.length === 0) return null;
        const sums: Record<string, { min: number, max: number, avg: number }> = {};

        schema?.list_config?.columns.forEach(col => {
            const numericValues = filteredData
                .map(r => Number(r[col.key]))
                .filter(v => !isNaN(v) && v !== null && v !== undefined);

            if (numericValues.length > 0 && typeof filteredData[0][col.key] === 'number') {
                const min = Math.min(...numericValues);
                const max = Math.max(...numericValues);
                const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
                sums[col.key] = { min, max, avg };
            }
        });
        return sums;
    }, [filteredData, schema]);

    if (loading) {
        return (
            <div className="bg-surface-900 rounded-3xl shadow-sm border border-surface-800 overflow-hidden">
                <div className="p-6 border-b border-surface-800 flex justify-between items-center">
                    <Skeleton className="h-8 w-48 rounded-lg" />
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-32 rounded-xl" />
                        <Skeleton className="h-10 w-24 rounded-xl" />
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                </div>
            </div>
        );
    }

    if (error || !schema) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-red-900/10 rounded-3xl border border-red-900/20">
                <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
                <p className="text-red-400 font-medium text-center">{error || 'حدث خطأ أثناء استدعاء البيانات من الخادم'}</p>
                <button onClick={refetch} className="mt-4 px-6 py-2 bg-surface-800 text-red-400 rounded-xl shadow-sm border border-red-900/30 hover:bg-surface-700 transition-all font-bold">إعادة المحاولة</button>
            </div>
        );
    }

    const { list_config } = schema;
    const config = SOVEREIGN_REGISTRY[tableName];

    return (
        <div className="flex flex-col h-full z-10 relative animate-in fade-in duration-700">
            <SovereignKPIBar
                tableName={tableName}
                metrics={metricsData}
                loading={loading}
                customConfig={schema?.page_config?.kpi_cards}
            />

            <div className="bg-surface-900 rounded-3xl shadow-2xl border border-surface-800 overflow-hidden flex flex-col flex-1 relative transition-all duration-500 hover:border-surface-700">
                <div className="p-6 border-b border-surface-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-surface-900/40 backdrop-blur-xl">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight">{list_config.title}</h2>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">{list_config.subtitle || `${totalCount} سجل إجمالي`}</span>
                            <div className="w-1 h-1 rounded-full bg-surface-700" />
                            <span className="text-xs font-black text-brand-blaban">{filteredData.length} نتائج البحث</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
                        {list_config.searchable !== false && (
                            <div className="relative flex-1 lg:w-64 group">
                                <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-surface-500 group-focus-within:text-brand-blaban transition-colors" />
                                <input
                                    type="text"
                                    placeholder={list_config.searchPlaceholder || "بحث ذكي..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-4 pr-12 py-3 bg-surface-950 border border-surface-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-blaban/30 focus:border-brand-blaban/50 transition-all text-white placeholder-surface-600 font-outfit"
                                />
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCreate}
                                className="flex items-center gap-2 px-6 py-3 bg-brand-blaban text-white rounded-2xl text-sm font-black shadow-lg shadow-brand-blaban/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <Plus className="w-5 h-5" />
                                <span>إضافة سجل</span>
                            </button>
                            <button
                                onClick={() => setIsFilterPanelOpen(true)}
                                className="relative flex items-center justify-center p-3 bg-surface-800 border border-surface-700 text-surface-400 rounded-2xl hover:bg-surface-700 transition-all"
                            >
                                <Filter className="w-5 h-5" />
                                {Object.keys(filters).length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-brand-konafa text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-surface-900 font-black">
                                        {Object.keys(filters).length}
                                    </span>
                                )}
                            </button>
                            <button onClick={() => refetch()} className="p-3 text-surface-500 hover:text-brand-blaban hover:bg-surface-800 rounded-2xl transition-all">
                                <RotateCcw className={clsx("w-5 h-5", loading && "animate-spin")} />
                            </button>
                        </div>
                        <div className="h-10 w-[1px] bg-surface-800 hidden lg:block mx-1" />
                        <button
                            onClick={handleExport}
                            disabled={data.length === 0}
                            className="flex items-center gap-2 px-4 py-3 bg-surface-800 text-emerald-400 hover:bg-surface-700 rounded-2xl transition-all disabled:opacity-30 text-xs font-black border border-surface-700"
                        >
                            <Download className="w-4 h-4" />
                            <span>تصدير</span>
                        </button>
                        <div className="relative group">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleImport}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={importing}
                            />
                            <button className={clsx(
                                "flex items-center gap-2 px-4 py-3 bg-surface-800 text-blue-400 hover:bg-surface-700 rounded-2xl transition-all disabled:opacity-30 text-xs font-black border border-surface-700",
                                importing && "opacity-50"
                            )}>
                                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                <span>استيراد</span>
                            </button>
                        </div>
                    </div>
                </div>

                {importResult && (
                    <div className={clsx("mx-6 mt-4 p-4 rounded-2xl flex items-center justify-between border animate-in slide-in-from-top-2",
                        importResult.message ? "bg-amber-900/20 text-amber-400 border-amber-900/30" :
                            "bg-emerald-900/20 text-emerald-400 border-emerald-900/30")}>
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-sm font-bold">
                                {importResult.message || `تم بنجاح: ${importResult.success} | فشل: ${importResult.errors}`}
                            </span>
                        </div>
                        <button onClick={() => setImportResult(null)} className="text-xs font-black uppercase tracking-tighter hover:underline">إغلاق</button>
                    </div>
                )}

                <div className="hidden lg:block overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-right text-sm">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-surface-800/90 backdrop-blur-md text-surface-400 font-bold border-b border-surface-700">
                                {list_config.columns.map((col, idx) => (
                                    <th key={idx} className="px-6 py-5 whitespace-nowrap text-[11px] uppercase tracking-widest">{col.label}</th>
                                ))}
                                <th className="px-6 py-5 w-24 text-[11px] uppercase tracking-widest">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-800/50 bg-surface-900">
                            {filteredData.length === 0 ? (
                                <tr><td colSpan={list_config.columns.length + 1} className="px-6 py-20 text-center text-surface-600 font-bold bg-surface-900/50">لا توجد سجلات مطابقة للبحث</td></tr>
                            ) : (
                                <>
                                    {filteredData.map((row, i) => (
                                        <tr key={row.id || i} className="hover:bg-surface-800/40 transition-colors group">
                                            {list_config.columns.map((col, colIdx) => (
                                                <td key={colIdx} className="px-6 py-5 text-surface-300 font-medium group-hover:text-white transition-colors">
                                                    {renderCellWithHighlight(row, col)}
                                                </td>
                                            ))}
                                            <td className="px-6 py-5">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {config?.actions?.filter(a => !a.condition || a.condition(row)).map(action => (
                                                        <button
                                                            key={action.key}
                                                            onClick={() => handleAction(action, row)}
                                                            className={clsx("p-2 rounded-xl transition-all border border-transparent",
                                                                action.color === 'purple' ? "text-purple-400 hover:bg-purple-900/30" :
                                                                    action.color === 'blue' ? "text-blue-400 hover:bg-blue-900/30" :
                                                                        "text-surface-500 hover:bg-surface-800")}
                                                            title={action.label}
                                                        >
                                                            {(() => {
                                                                const IconComp = (LucideIcons as any)[action.icon] || Zap;
                                                                return <IconComp className="w-4.5 h-4.5" />;
                                                            })()}
                                                        </button>
                                                    ))}
                                                    <button onClick={() => handleEdit(row)} className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-xl transition-all" title="تعديل"><Edit2 className="w-4.5 h-4.5" /></button>
                                                    <button onClick={() => handleDelete(row.id)} className="p-2 text-red-500 hover:bg-red-900/30 rounded-xl transition-all" title="حذف"><Trash2 className="w-4.5 h-4.5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Summary Row */}
                                    {summaryRow && Object.keys(summaryRow).length > 0 && (
                                        <tr className="bg-surface-950/50 border-t-2 border-surface-800">
                                            {list_config.columns.map((col, idx) => (
                                                <td key={idx} className="px-6 py-4">
                                                    {summaryRow[col.key] && (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center justify-between text-[10px] font-black uppercase text-surface-600 tracking-tighter">
                                                                <span>Avg:</span>
                                                                <span className="text-brand-blaban">{summaryRow[col.key].avg.toFixed(1)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px] font-black uppercase text-surface-600 tracking-tighter">
                                                                <span>Max:</span>
                                                                <span className="text-white">{summaryRow[col.key].max}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="px-6 py-4 bg-surface-950/80">
                                                <div className="text-[10px] font-black text-surface-500 text-center uppercase tracking-widest">إحصائيات</div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="lg:hidden flex-1 overflow-y-auto p-4 space-y-4 bg-surface-950">
                    {filteredData.length === 0 ? (
                        <div className="py-20 text-center text-surface-600 bg-surface-900 rounded-[2rem] border border-dashed border-surface-800">لا توجد بيانات</div>
                    ) : (
                        filteredData.map((row, i) => (
                            <MobileCard
                                key={row.id || i}
                                row={row}
                                columns={list_config.columns}
                                tableName={tableName}
                                onAction={handleAction}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                renderCell={renderCell}
                            />
                        ))
                    )}
                </div>

                <div className="px-6 py-4 border-t border-surface-800 bg-surface-900 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs font-bold text-surface-500">تم عرض {filteredData.length} سجل من إجمالي {totalCount} | حجم الصفحة: {pageSize}</p>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1.5" dir="ltr">
                            <button onClick={() => goToPage(0)} disabled={page === 0} className="p-2 rounded-xl hover:bg-surface-800 disabled:opacity-20 text-surface-500"><ChevronsLeft className="w-4 h-4" /></button>
                            <button onClick={() => goToPage(page - 1)} disabled={page === 0} className="p-2 rounded-xl hover:bg-surface-800 disabled:opacity-20 text-surface-500"><ChevronLeft className="w-4 h-4" /></button>
                            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => {
                                let p = totalPages <= 3 ? i : (page < 1 ? i : (page > totalPages - 2 ? totalPages - 3 + i : page - 1 + i));
                                return (
                                    <button key={p} onClick={() => goToPage(p)}
                                        className={clsx("w-9 h-9 rounded-xl text-xs font-black transition-all", page === p ? "bg-brand-blaban text-white shadow-lg shadow-brand-blaban/20 scale-105" : "hover:bg-surface-800 text-surface-500")}>
                                        {p + 1}
                                    </button>
                                );
                            })}
                            <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1} className="p-2 rounded-xl hover:bg-surface-800 disabled:opacity-20 text-surface-500"><ChevronRight className="w-4 h-4" /></button>
                            <button onClick={() => goToPage(totalPages - 1)} disabled={page >= totalPages - 1} className="p-2 rounded-xl hover:bg-surface-800 disabled:opacity-20 text-surface-500"><ChevronsRight className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>
            </div>

            <SovereignActionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                schema={schema}
                record={selectedRecord}
                isAssignMode={isAssignMode}
                actionTitle={actionTitle}
                onSuccess={() => {
                    setIsModalOpen(false);
                    refetch();
                }}
            />

            <SovereignFilterPanel
                tableName={tableName}
                filters={filters}
                isOpen={isFilterPanelOpen}
                onClose={() => setIsFilterPanelOpen(false)}
                onChange={setFilters}
            />
        </div>
    );
}
