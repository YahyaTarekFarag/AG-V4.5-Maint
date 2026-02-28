import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Clock, MapPin, Zap, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import TicketFlow from './TicketFlow';

interface VirtualTicketListProps {
    tickets: any[];
    expandedId: string | null;
    setExpandedId: (id: string | null) => void;
    onUpdate: () => void;
    statusLabels: Record<string, { label: string; color: string }>;
}

export const VirtualTicketList: React.FC<VirtualTicketListProps> = ({
    tickets,
    expandedId,
    setExpandedId,
    onUpdate,
    statusLabels
}) => {
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: tickets.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100, // Estimated height of a collapsed row
        overscan: 5,
    });

    return (
        <div
            ref={parentRef}
            className="h-[600px] overflow-auto custom-scrollbar pr-2"
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                    const ticket = tickets[virtualItem.index];
                    const isExpanded = expandedId === ticket.id;
                    const st = statusLabels[ticket.status] || { label: ticket.status, color: 'bg-surface-800 text-surface-500' };

                    return (
                        <div
                            key={virtualItem.key}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: isExpanded ? 'auto' : `${virtualItem.size}px`,
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                            className="pb-4"
                        >
                            <div
                                className={clsx(
                                    "glass-premium rounded-3xl border transition-all duration-300 overflow-hidden",
                                    isExpanded ? "border-brand-blaban/30 shadow-2xl bg-surface-900/60" : "border-surface-800 hover:border-surface-700 shadow-sm"
                                )}
                            >
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                                    className="w-full flex items-center gap-6 p-6 text-right group"
                                >
                                    <div className={clsx(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 shadow-inner",
                                        ticket.is_emergency ? "bg-red-500/10 text-red-500" : "bg-surface-800 text-surface-400"
                                    )}>
                                        {ticket.is_emergency ? <Zap className="w-6 h-6 animate-pulse" /> : <Wrench className="w-6 h-6" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className={clsx("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border", st.color)}>
                                                {st.label}
                                            </span>
                                            {ticket.is_emergency && <span className="bg-red-500/20 text-red-500 text-[9px] font-black px-2 py-1 rounded-lg border border-red-500/20">EMERGENCY</span>}
                                        </div>
                                        <h4 className="text-lg font-black text-white truncate">{ticket.asset_name || 'بلاغ صيانة عام'}</h4>
                                        <div className="flex items-center gap-4 mt-1.5">
                                            <div className="flex items-center gap-1.5 text-xs text-surface-500 font-bold">
                                                <Clock className="w-3.5 h-3.5" />
                                                {format(new Date(ticket.reported_at), 'PPP · p', { locale: ar })}
                                            </div>
                                            {ticket.reported_lat && (
                                                <div className="flex items-center gap-1.5 text-xs text-emerald-500/70 font-black uppercase">
                                                    <MapPin className="w-3.5 h-3.5" /> GPS Verified
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                        <div className={clsx("p-2 rounded-xl border border-surface-800 transition-colors shadow-sm", isExpanded ? "bg-brand-blaban text-white" : "bg-surface-800 text-surface-500")}>
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-surface-800 p-8 animate-in fade-in zoom-in-95 duration-300 min-h-[400px]">
                                        <TicketFlow ticket={ticket} onUpdate={onUpdate} />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
