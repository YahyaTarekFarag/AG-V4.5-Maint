import React, { memo } from 'react';
import { Edit3, Trash2, Zap } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';
import clsx from 'clsx';
import { ColumnConfig } from '../../types/schema';

export interface MobileCardProps {
    row: any;
    columns: ColumnConfig[];
    tableName: string;
    onEdit?: (row: any) => void;
    onDelete?: (id: string) => void;
    onAction: (action: any, row: any) => void;
    renderCell: (row: any, col: ColumnConfig) => React.ReactNode;
}

const SovereignMobileCard = memo(({ row, columns, tableName, onEdit, onDelete, onAction, renderCell }: MobileCardProps) => {
    const config = SOVEREIGN_REGISTRY[tableName];

    return (
        <div className="glass-premium rounded-3xl p-5 md:p-6 border border-surface-800 flex flex-col gap-4 active:scale-[0.98] transition-all hover:shadow-2xl hover:border-brand-blaban/50">
            <div className="grid grid-cols-1 gap-2">
                {columns.map((col: any, colIdx: number) => (
                    <div key={colIdx} className="flex justify-between items-start gap-4 pb-2.5 border-b border-surface-800/10 last:border-0">
                        <span className="text-[9px] font-black text-surface-500 uppercase tracking-widest shrink-0 font-outfit mt-1 max-w-[40%] text-right">{col.label}</span>
                        <div className="text-sm font-bold text-white text-left break-words">
                            {renderCell(row, col)}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-800 flex-wrap">
                {config?.actions?.filter(a => !a.condition || a.condition(row)).map((action: any) => (
                    <button
                        key={action.key}
                        onClick={() => onAction(action, row)}
                        className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold border min-w-[120px]",
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

                {onEdit && (
                    <button
                        onClick={() => onEdit(row)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-blaban text-white rounded-2xl font-black shadow-lg shadow-brand-blaban/20 min-w-[140px] hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <Edit3 className="w-4 h-4" />
                        <span>مراجعة وتعديل البيانات</span>
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={() => onDelete(row.id)}
                        className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-900/20 hover:scale-[1.05] active:scale-[0.95] transition-all"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
});

export default SovereignMobileCard;
