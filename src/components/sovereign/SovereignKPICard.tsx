import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import * as LucideIcons from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import { applyRBACFilter } from '../../lib/rbac';

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

const COLOR_MAP: Record<string, { bg: string; icon: string; text: string; border: string; dot: string }> = {
    blue: { bg: 'bg-blue-900/20', icon: 'text-blue-400', text: 'text-blue-100', border: 'border-blue-900/30', dot: 'bg-blue-500' },
    red: { bg: 'bg-red-900/20', icon: 'text-red-400', text: 'text-red-100', border: 'border-red-900/30', dot: 'bg-red-500' },
    green: { bg: 'bg-green-900/20', icon: 'text-green-400', text: 'text-green-100', border: 'border-green-900/30', dot: 'bg-emerald-500' },
    amber: { bg: 'bg-amber-900/20', icon: 'text-amber-400', text: 'text-amber-100', border: 'border-amber-900/30', dot: 'bg-amber-500' },
    purple: { bg: 'bg-purple-900/20', icon: 'text-purple-400', text: 'text-purple-100', border: 'border-purple-900/30', dot: 'bg-purple-500' },
    teal: { bg: 'bg-teal-900/20', icon: 'text-teal-400', text: 'text-teal-100', border: 'border-teal-900/30', dot: 'bg-teal-500' },
};

interface Props { config: KPICardConfig; userId?: string; }

export default function SovereignKPICard({ config, userId }: Props) {
    const [value, setValue] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { profile } = useAuth();

    useEffect(() => { fetchValue(); }, [config, userId, profile]);

    const fetchValue = async () => {
        setLoading(true);
        try {
            // ─── RBAC Auto-Injection for KPIs ───
            let query = supabase.from(config.table).select('*', { count: 'exact', head: true });

            // Apply standard filters from config
            if (config.filter) {
                for (const [col, val] of Object.entries(config.filter)) {
                    query = query.eq(col, val === '$user_id' ? userId : val);
                }
            }

            // Universal RBAC Filter
            query = applyRBACFilter(query, config.table, profile as any);

            const { count, error } = await query;

            if (error) throw error;
            setValue(Number(count) || 0);

        } catch (e) {
            console.error('KPI Fetch Error:', e);
            setValue(null);
        } finally {
            setLoading(false);
        }
    };

    const colors = COLOR_MAP[config.color] || COLOR_MAP.blue;
    const IconComp = config.icon ? (LucideIcons as any)[config.icon] : TrendingUp;

    return (
        <div
            onClick={() => config.link_to && navigate(config.link_to)}
            className={`glass-premium rounded-[2rem] border ${colors.border} p-6 flex items-center gap-5 transition-all relative overflow-hidden group
                ${config.link_to ? 'cursor-pointer hover:shadow-2xl hover:-translate-y-1 hover:border-brand-blaban/50' : ''}`}
        >
            <div className={`w-16 h-16 ${colors.bg} ${colors.icon} rounded-2xl flex items-center justify-center shrink-0 border border-white/10 group-hover:scale-110 transition-transform duration-500 shadow-inner`}>
                {IconComp && <IconComp className="w-8 h-8" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${colors.dot} animate-pulse`} />
                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider truncate">{config.label}</p>
                </div>
                <h3 className={`text-3xl font-black ${colors.text} tracking-tighter font-outfit mt-1`}>
                    {loading
                        ? <Skeleton variant="rectangular" width="4rem" height="2rem" />
                        : (value?.toLocaleString('en-US') ?? '—')
                    }
                </h3>
                {config.description && <p className="text-[10px] text-surface-500 mt-1 font-medium">{config.description}</p>}
            </div>
            {config.link_to && (
                <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    <ArrowLeft className="w-4 h-4 text-brand-blaban rotate-180" />
                </div>
            )}

            {/* Decorative background element */}
            <div className={`absolute -right-4 -bottom-4 w-20 h-20 ${colors.bg} rounded-full opacity-0 group-hover:opacity-20 transition-opacity blur-2xl`} />
        </div>
    );
}
