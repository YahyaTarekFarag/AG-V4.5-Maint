import React from 'react';
import { Edit3, Trash2, Zap } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import clsx from 'clsx';
import { ColumnConfig } from '../../../types/schema';

interface Props {
    row: any;
    columns: ColumnConfig[];
    configActions: any[];
    handleAction: (action: any, row: any) => void;
    handleEdit?: (row: any) => void;
    handleDelete?: (id: string) => void;
    renderCellWithHighlight: (row: any, col: ColumnConfig) => React.ReactNode;
}

export default function SovereignTableRow({
    row, columns, configActions, handleAction, handleEdit, handleDelete, renderCellWithHighlight
}: Props) {
    return (
        <tr className="hover:bg-surface-800/40 transition-colors group">
            {columns.map((col, colIdx) => (
                <td key={colIdx} className="px-6 py-5 text-surface-300 font-medium group-hover:text-white transition-colors">
                    {renderCellWithHighlight(row, col)}
                </td>
            ))}
            <td className="px-6 py-5">
                <div className="flex items-center justify-center gap-1.5">
                    {configActions.filter(a => !a.condition || a.condition(row)).map(action => (
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
                    {handleEdit && <button onClick={() => handleEdit(row)} className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-xl transition-all" title="تعديل"><Edit3 className="w-4.5 h-4.5" /></button>}
                    {handleDelete && <button onClick={() => handleDelete(row.id)} className="p-2 text-rose-500 hover:bg-rose-900/30 rounded-xl transition-all" title="حذف"><Trash2 className="w-4.5 h-4.5" /></button>}
                </div>
            </td>
        </tr>
    );
}
