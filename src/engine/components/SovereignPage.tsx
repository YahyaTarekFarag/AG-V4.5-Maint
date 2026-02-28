import DashboardLayout from '@shared/components/layout/DashboardLayout';
import SovereignTable from './SovereignTable';
import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';
import * as Icons from 'lucide-react';

interface SovereignPageProps {
    tableName: string;
}

/**
 * SovereignPage
 * A high-level wrapper that renders a full functional page based on registry metadata.
 * Use this to eliminate boilerplate for standard listing pages.
 */
export default function SovereignPage({ tableName }: SovereignPageProps) {
    const config = SOVEREIGN_REGISTRY[tableName];

    // Resolve Dynamic Icon
    const IconComponent = (Icons as any)[config?.icon || 'Layout'] || Icons.Layout;

    return (
        <DashboardLayout>
            <div className="flex flex-col h-full gap-6">
                {/* Header Section */}
                {config && (
                    <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="p-4 rounded-2xl bg-surface-900 shadow-2xl border border-surface-800 transition-colors">
                            <IconComponent className="w-8 h-8 text-brand-blaban" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
                                {config.label}
                            </h1>
                            <p className="text-surface-400 font-medium">
                                {config.description}
                            </p>
                        </div>
                    </div>
                )}

                {/* Main Table Content */}
                <div className="flex-1 min-h-[500px]">
                    <SovereignTable tableName={tableName} />
                </div>
            </div>
        </DashboardLayout>
    );
}
