import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@shared/lib/supabase';
import { ColumnConfig } from '../../types/schema';
import { AlertCircle, SearchX } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import SovereignActionModal from './SovereignActionModal';
import SovereignFilterPanel from './SovereignFilterPanel';
import SovereignKPIBar from './SovereignKPIBar';
import { useSovereign } from '@/engine/hooks/useSovereign';
import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Skeleton from '@shared/components/ui/Skeleton';
import SovereignMobileCard from './SovereignMobileCard';
import SovereignTableHeader from './table/SovereignTableHeader';
import SovereignTableRow from './table/SovereignTableRow';
import SovereignTablePagination from './table/SovereignTablePagination';

interface SovereignTableProps {
    tableName: string;
}


export default function SovereignTable({ tableName }: SovereignTableProps) {
    const { schema, data, loading, error, refetch, page, totalPages, totalCount, pageSize, goToPage, fetchAllRows, filters, setFilters, metricsData } = useSovereign(tableName);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [isAssignMode, setIsAssignMode] = useState(false);
    const [actionTitle, setActionTitle] = useState<string | undefined>(undefined);

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
        if (action.onClick) {
            action.onClick(row);
            return;
        }
        setSelectedRecord(row);
        setIsAssignMode(!!action.isAssignMode);
        setActionTitle(action.label);
        setIsModalOpen(true);
    }, []);

    const getResolvedValue = useCallback((row: any, colKey: string) => {
        let val = row[colKey];
        const config = SOVEREIGN_REGISTRY[tableName];

        if (val && typeof val === 'object' && !Array.isArray(val)) {
            val = val.name || val.full_name || val.title || val.label || val.id || JSON.stringify(val);
        }

        if (colKey && (colKey.endsWith('_id') || ['assigned_to', 'profile_id', 'technician_id', 'manager_id'].includes(colKey))) {
            const relKeyFromRegistry = config?.relationships?.[colKey];
            const possibleRelKeys = relKeyFromRegistry ? [
                relKeyFromRegistry,
                colKey.replace('_id', ''),
                `${relKeyFromRegistry}_profile`,
                'profiles',
                'branches'
            ] : [
                colKey.replace('_id', ''),
                colKey === 'assigned_to' ? 'assigned_to_profile' : '',
                'profiles',
                'branches'
            ];

            for (const relKey of possibleRelKeys) {
                if (!relKey) continue;
                const linkedObj = row[relKey];
                if (linkedObj && typeof linkedObj === 'object') {
                    val = linkedObj.name || linkedObj.full_name || linkedObj.title || linkedObj.label || val;
                    break;
                }
            }
        }
        return val;
    }, [tableName]);

    const renderCell = (row: any, col: ColumnConfig) => {
        const colKey = col.key || col.field || '';
        const val = getResolvedValue(row, colKey);
        const config = SOVEREIGN_REGISTRY[tableName];

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
                    const d = new Date(val);
                    if (isNaN(d.getTime())) return <span>{val}</span>;
                    return <span>{format(d, 'PPP', { locale: ar })}</span>;
                } catch {
                    return <span>{val}</span>;
                }
            case 'datetime':
                try {
                    const d = new Date(val);
                    if (isNaN(d.getTime())) return <span>{val}</span>;
                    return <span>{format(d, 'PPP hh:mm a', { locale: ar })}</span>;
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
                if (config?.formatting?.lowStockAlert === colKey && Number(val) < 5) {
                    return <span className="text-red-600 font-bold animate-pulse">⚠️ {val} (منخفض)</span>;
                }
                return <span>{val}</span>;
        }
    };

    // ─── دالة مساعدة لجلب القيمة النصية للخلية (لأغراض البحث) ───
    const getCellValue = (row: any, colKey: string) => {
        const val = getResolvedValue(row, colKey);
        return String(val || '').toLowerCase();
    };

    // ─── تحسين الأداء: فلترة البيانات محلياً (Memoized Search) ───
    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const search = searchTerm.toLowerCase();
        const cols = schema?.list_config?.columns || [];
        return data.filter(row =>
            cols.some(col => getCellValue(row, col.key || col.field || '').includes(search))
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

        schema?.list_config?.columns?.forEach(col => {
            if (!col) return;
            const colKey = col.key || col.field || '';
            const numericValues = filteredData
                .map(r => Number(r[colKey]))
                .filter(v => !isNaN(v) && v !== null && v !== undefined);

            if (numericValues.length > 0 && typeof filteredData[0]?.[colKey] === 'number') {
                const min = Math.min(...numericValues);
                const max = Math.max(...numericValues);
                const avg = numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0;
                sums[colKey] = { min, max, avg };
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

    const list_config = schema?.list_config || { columns: [] };
    const columns = Array.isArray(list_config.columns) ? list_config.columns : [];
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
                <SovereignTableHeader
                    title={list_config.title}
                    subtitle={list_config.subtitle}
                    totalCount={totalCount}
                    filteredCount={filteredData.length}
                    searchable={list_config.searchable}
                    searchPlaceholder={list_config.searchPlaceholder}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    handleCreate={handleCreate}
                    setIsFilterPanelOpen={setIsFilterPanelOpen}
                    filterCount={Object.keys(filters).length}
                    refetch={refetch}
                    loading={loading}
                    tableName={tableName}
                    schema={schema}
                    dataLength={data.length}
                    fetchAllRows={fetchAllRows}
                />

                <div className="hidden lg:block overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-right text-sm">
                        <thead className="sticky top-0 z-20">
                            <tr className="bg-surface-800/90 backdrop-blur-md text-surface-400 font-bold border-b border-surface-700">
                                {columns.map((col, idx) => (
                                    <th key={idx} className="px-6 py-5 whitespace-nowrap text-[11px] uppercase tracking-widest">{col.label}</th>
                                ))}
                                <th className="px-6 py-5 w-24 text-[11px] uppercase tracking-widest">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-800/50 bg-surface-900">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 1} className="px-6 py-32 text-center bg-surface-900/50">
                                        <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
                                            <div className="p-8 bg-surface-800/50 rounded-full mb-6 ring-1 ring-white/5 shadow-2xl relative group">
                                                <div className="absolute inset-0 bg-brand-blaban/20 rounded-full blur-2xl group-hover:bg-brand-blaban/30 transition-all duration-700" />
                                                <LucideIcons.SearchX className="w-16 h-16 text-surface-500 relative z-10 animate-pulse" />
                                            </div>
                                            <h3 className="text-2xl font-black text-white mb-3">سجل البيانات فارغ حالياً</h3>
                                            <p className="text-surface-500 text-sm max-w-sm mx-auto leading-relaxed mb-8">
                                                لم نتمكن من العثور على أي بيانات مطابقة لمعايير البحث أو الفلترة التي حددتها. يرجى تجربة كلمات بحث أخرى أو إعادة تعيين الفلاتر.
                                            </p>
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => setSearchTerm('')}
                                                    className="px-6 py-3 bg-surface-800 text-white rounded-xl font-bold border border-surface-700 hover:bg-surface-700 transition-all shadow-lg"
                                                >
                                                    مسح نص البحث
                                                </button>
                                                {Object.keys(filters).length > 0 && (
                                                    <button
                                                        onClick={() => setFilters({})}
                                                        className="px-6 py-3 bg-brand-blaban text-white rounded-xl font-bold shadow-lg shadow-brand-blaban/20 hover:scale-105 active:scale-95 transition-all"
                                                    >
                                                        إعادة تعيين الفلاتر المتقدمة
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {filteredData.map((row, i) => (
                                        <SovereignTableRow
                                            key={row.id || i}
                                            row={row}
                                            columns={columns}
                                            configActions={config?.actions || []}
                                            handleAction={handleAction}
                                            handleEdit={handleEdit}
                                            handleDelete={handleDelete}
                                            renderCellWithHighlight={renderCellWithHighlight}
                                        />
                                    ))}

                                    {/* Summary Row */}
                                    {summaryRow && Object.keys(summaryRow).length > 0 && (
                                        <tr className="bg-surface-950/50 border-t-2 border-surface-800">
                                            {columns.map((col, idx) => (
                                                <td key={idx} className="px-6 py-4">
                                                    {(summaryRow[col.key || col.field || '']) && (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center justify-between text-[10px] font-black uppercase text-surface-600 tracking-tighter">
                                                                <span>Avg:</span>
                                                                <span className="text-brand-blaban">{summaryRow[col.key || col.field || ''].avg.toFixed(1)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px] font-black uppercase text-surface-600 tracking-tighter">
                                                                <span>Max:</span>
                                                                <span className="text-white">{summaryRow[col.key || col.field || ''].max}</span>
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
                        <div className="py-24 text-center bg-surface-900/50 rounded-[2.5rem] border border-dashed border-surface-800 animate-in fade-in zoom-in duration-700">
                            <div className="p-5 bg-surface-800/50 rounded-full w-fit mx-auto mb-4">
                                <SearchX className="w-10 h-10 text-surface-600" />
                            </div>
                            <h3 className="text-lg font-black text-surface-400 mb-2">لا توجد سجلات</h3>
                            <p className="text-surface-600 text-xs px-8">نعتذر، لم نجد أي بيانات مطابقة لعملية البحث الحالية.</p>
                        </div>
                    ) : (
                        filteredData.map((row, i) => (
                            <SovereignMobileCard
                                key={row.id || i}
                                row={row}
                                columns={columns}
                                tableName={tableName}
                                onAction={handleAction}
                                onEdit={config?.readonly ? undefined : handleEdit}
                                onDelete={config?.readonly ? undefined : handleDelete}
                                renderCell={renderCell}
                            />
                        ))
                    )}
                </div>

                <SovereignTablePagination
                    filteredCount={filteredData.length}
                    totalCount={totalCount}
                    pageSize={pageSize}
                    page={page}
                    totalPages={totalPages}
                    goToPage={goToPage}
                />
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
