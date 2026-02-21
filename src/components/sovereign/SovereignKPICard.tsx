import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, ArrowLeft } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export interface KPICardConfig {
    label: string;
    table: string;
    aggregate: 'count' | 'sum' | 'avg';
    aggregate_col?: string;          // for sum/avg
    filter?: Record<string, any>; // e.g. { status: 'open' }
    color: 'blue' | 'red' | 'green' | 'amber' | 'purple' | 'teal';
    icon?: string;            // Lucide icon name
    link_to?: string;            // route to navigate on click
    description?: string;
}

const COLOR_MAP: Record<string, { bg: string; icon: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-900', border: 'border-blue-100' },
    red: { bg: 'bg-red-50', icon: 'text-red-600', text: 'text-red-900', border: 'border-red-100' },
    green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-900', border: 'border-green-100' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-900', border: 'border-amber-100' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-900', border: 'border-purple-100' },
    teal: { bg: 'bg-teal-50', icon: 'text-teal-600', text: 'text-teal-900', border: 'border-teal-100' },
};

interface Props { config: KPICardConfig; userId?: string; }

export default function SovereignKPICard({ config, userId }: Props) {
    const [value, setValue] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => { fetchValue(); }, [config, userId]);

    const fetchValue = async () => {
        setLoading(true);
        try {
            // Resolve filters — replace $user_id placeholder
            const resolvedFilter: Record<string, any> = {};
            if (config.filter) {
                for (const [col, val] of Object.entries(config.filter)) {
                    resolvedFilter[col] = val === '$user_id' ? userId : val;
                }
            }

            // Call the Optimized Server-Side Aggregator
            const { data, error } = await supabase.rpc('sovereign_get_aggregate', {
                p_table: config.table,
                p_aggregate: config.aggregate,
                p_column: config.aggregate_col || 'id',
                p_filter: resolvedFilter
            });

            if (error) throw error;
            setValue(Number(data) || 0);

        } catch (e) {
            console.error('KPI Fetch Error:', e);
            setValue(null);
        } finally {
            setLoading(false);
        }
    };

    const colors = COLOR_MAP[config.color] || COLOR_MAP.blue;

    // Resolve icon from Lucide
    const IconComp = config.icon ? (LucideIcons as any)[config.icon] : TrendingUp;

    return (
        <div
            onClick={() => config.link_to && navigate(config.link_to)}
            className={`bg-white rounded-2xl border ${colors.border} p-5 flex items-center gap-4 shadow-sm transition-all
                ${config.link_to ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`}
        >
            <div className={`w-14 h-14 ${colors.bg} ${colors.icon} rounded-2xl flex items-center justify-center shrink-0`}>
                {IconComp && <IconComp className="w-7 h-7" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-500 mb-0.5 truncate">{config.label}</p>
                <h3 className={`text-3xl font-bold ${colors.text}`}>
                    {loading
                        ? <span className="inline-block w-16 h-8 bg-surface-100 rounded animate-pulse" />
                        : (value?.toLocaleString('ar-EG') ?? '—')
                    }
                </h3>
                {config.description && <p className="text-xs text-surface-400 mt-0.5">{config.description}</p>}
            </div>
            {config.link_to && (
                <ArrowLeft className="w-4 h-4 text-surface-300 shrink-0 rotate-180" />
            )}
        </div>
    );
}
