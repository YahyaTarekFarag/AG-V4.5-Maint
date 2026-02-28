import { Search, Plus, Filter, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import SovereignExport from '../SovereignExport';

interface Props {
    title: string;
    subtitle?: string;
    totalCount: number;
    filteredCount: number;
    searchable?: boolean;
    searchPlaceholder?: string;
    searchTerm: string;
    setSearchTerm: (t: string) => void;
    handleCreate?: () => void;
    setIsFilterPanelOpen: (b: boolean) => void;
    filterCount: number;
    refetch: () => void;
    loading: boolean;
    tableName: string;
    schema: any;
    dataLength: number;
    fetchAllRows: () => Promise<any[]>;
}

export default function SovereignTableHeader({
    title, subtitle, totalCount, filteredCount, searchable, searchPlaceholder,
    searchTerm, setSearchTerm, handleCreate, setIsFilterPanelOpen, filterCount,
    refetch, loading, tableName, schema, dataLength, fetchAllRows
}: Props) {
    return (
        <div className="p-6 border-b border-surface-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-surface-900/40 backdrop-blur-xl">
            <div>
                <h2 className="text-3xl font-black text-white tracking-tight">{title}</h2>
                <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs font-bold text-surface-500 uppercase tracking-widest">{subtitle || `${totalCount} سجل إجمالي`}</span>
                    <div className="w-1 h-1 rounded-full bg-surface-700" />
                    <span className="text-xs font-black text-brand-blaban">{filteredCount} نتائج البحث</span>
                </div>
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
                {searchable !== false && (
                    <div className="relative flex-1 lg:w-64 group">
                        <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-surface-500 group-focus-within:text-brand-blaban transition-colors" />
                        <input
                            type="text"
                            placeholder={searchPlaceholder || "بحث ذكي..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-4 pr-12 py-3 bg-surface-950 border border-surface-700 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-blaban/30 focus:border-brand-blaban/50 transition-all text-white placeholder-surface-600 font-outfit"
                        />
                    </div>
                )}
                <div className="flex items-center gap-2">
                    {handleCreate && (
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-6 py-3 bg-brand-blaban text-white rounded-2xl text-sm font-black shadow-lg shadow-brand-blaban/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            <span>إضافة سجل</span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsFilterPanelOpen(true)}
                        className="relative flex items-center justify-center p-3 bg-surface-800 border border-surface-700 text-surface-400 rounded-2xl hover:bg-surface-700 transition-all"
                    >
                        <Filter className="w-5 h-5" />
                        {filterCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-brand-konafa text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-surface-900 font-black">
                                {filterCount}
                            </span>
                        )}
                    </button>
                    <button onClick={refetch} className="p-3 text-surface-500 hover:text-brand-blaban hover:bg-surface-800 rounded-2xl transition-all">
                        <RotateCcw className={clsx("w-5 h-5", loading && "animate-spin")} />
                    </button>
                </div>
                <div className="h-10 w-[1px] bg-surface-800 hidden lg:block mx-1" />
                <SovereignExport
                    tableName={tableName}
                    schema={schema}
                    dataLength={dataLength}
                    fetchAllRows={fetchAllRows}
                    onImportSuccess={refetch}
                />
            </div>
        </div>
    );
}
