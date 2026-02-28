import { NavLink } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';
import * as LucideIcons from 'lucide-react';
import clsx from 'clsx';

export default function MobileBottomNav() {
    const { profile } = useAuth();

    const authorizedLinks = Object.values(SOVEREIGN_REGISTRY)
        .filter(entry => profile && entry.roles.includes(profile.role))
        .map(entry => ({
            label: entry.label,
            path: entry.path,
            icon: entry.icon || 'Layout',
        }))
        .slice(0, 5); // Limit to top 5 for mobile bottom bar

    if (!profile) return null;

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] px-4 pb-6 pt-2 h-auto pointer-events-none">
            <div className="max-w-md mx-auto h-20 glass-premium rounded-[2rem] border border-white/10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] flex items-center justify-around px-2 pointer-events-auto relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-brand-blaban/5 to-transparent pointer-events-none" />

                {authorizedLinks.map((item) => {
                    const IconComponent = (LucideIcons as any)[item.icon] || LucideIcons.Layout;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }: { isActive: boolean }) => clsx(
                                "flex flex-col items-center gap-1.5 transition-all duration-500 relative py-2 px-4 rounded-2xl",
                                isActive ? "opacity-100" : "opacity-40 hover:opacity-70"
                            )}
                        >
                            {({ isActive }: { isActive: boolean }) => (
                                <>
                                    <div className={clsx(
                                        "transition-all duration-500",
                                        isActive ? "text-brand-blaban scale-110 drop-shadow-[0_0_8px_rgba(0,74,173,0.5)]" : "text-white"
                                    )}>
                                        <IconComponent className="w-6 h-6" />
                                    </div>
                                    <span className={clsx(
                                        "text-[9px] font-black uppercase tracking-wider transition-all duration-500",
                                        isActive ? "text-brand-blaban" : "text-white/70"
                                    )}>
                                        {item.label}
                                    </span>
                                    {isActive && (
                                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-blaban rounded-full shadow-[0_0_8px_#004aad] animate-pulse" />
                                    )}
                                </>
                            )}
                        </NavLink>
                    );
                })}
            </div>
        </nav>
    );
}
