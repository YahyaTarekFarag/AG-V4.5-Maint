import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import clsx from 'clsx';

interface Props {
    filteredCount: number;
    totalCount: number;
    pageSize: number;
    page: number;
    totalPages: number;
    goToPage: (p: number) => void;
}

export default function SovereignTablePagination({
    filteredCount, totalCount, pageSize, page, totalPages, goToPage
}: Props) {
    return (
        <div className="px-6 py-4 border-t border-surface-800 bg-surface-900 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs font-bold text-surface-500">تم عرض {filteredCount} سجل من إجمالي {totalCount} | حجم الصفحة: {pageSize}</p>
            {totalPages > 1 && (
                <div className="flex items-center gap-1.5" dir="ltr">
                    <button onClick={() => goToPage(0)} disabled={page === 0} className="p-2 rounded-xl hover:bg-surface-800 disabled:opacity-20 text-surface-500"><ChevronsLeft className="w-4 h-4" /></button>
                    <button onClick={() => goToPage(page - 1)} disabled={page === 0} className="p-2 rounded-xl hover:bg-surface-800 disabled:opacity-20 text-surface-500"><ChevronLeft className="w-4 h-4" /></button>
                    {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => {
                        const p = totalPages <= 3 ? i : (page < 1 ? i : (page > totalPages - 2 ? totalPages - 3 + i : page - 1 + i));
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
    );
}
