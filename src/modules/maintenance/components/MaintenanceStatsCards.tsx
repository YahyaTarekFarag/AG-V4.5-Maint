import { Wrench, AlertTriangle, Users, Clock, Star, CheckCircle } from 'lucide-react';

interface Props {
    counts: { all: number; open: number; assigned: number; in_progress: number; resolved: number; closed: number };
    filter: string;
    setFilter: (f: 'all' | 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed') => void;
    setTicketPage: (p: number) => void;
}

export default function MaintenanceStatsCards({ counts, filter, setFilter, setTicketPage }: Props) {
    const kpiItems = [
        { key: 'all', label: 'الكل', icon: Wrench, color: 'bg-surface-900 border-surface-800 text-surface-400' },
        { key: 'open', label: 'جديد', icon: AlertTriangle, color: 'bg-blue-900/10 border-blue-900/30 text-blue-400' },
        { key: 'assigned', label: 'تم الإسناد', icon: Users, color: 'bg-amber-900/10 border-amber-900/30 text-amber-400' },
        { key: 'in_progress', label: 'قيد الإصلاح', icon: Clock, color: 'bg-purple-900/10 border-purple-900/30 text-purple-400' },
        { key: 'resolved', label: 'ينتظر اعتماد', icon: Star, color: 'bg-teal-900/10 border-teal-900/30 text-teal-400' },
        { key: 'closed', label: 'مكتمل', icon: CheckCircle, color: 'bg-green-900/10 border-green-900/30 text-green-400' },
    ] as const;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {kpiItems.map(item => (
                <button
                    key={item.key}
                    onClick={() => { setFilter(item.key as any); setTicketPage(0); }}
                    className={`p-4 rounded-2xl border text-right transition-all ${item.color} ${filter === item.key ? 'ring-2 ring-brand-blaban shadow-md' : 'hover:shadow-sm'}`}
                >
                    <item.icon className="w-5 h-5 mb-1 opacity-60" />
                    <p className="text-2xl font-bold text-white">{counts[item.key]}</p>
                    <p className="text-xs font-medium mt-0.5">{item.label}</p>
                </button>
            ))}
        </div>
    );
}
