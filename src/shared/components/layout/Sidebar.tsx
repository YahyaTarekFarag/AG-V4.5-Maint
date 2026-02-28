import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { LogOut, Smartphone } from 'lucide-react';
import { SOVEREIGN_REGISTRY } from '@engine/lib/sovereign';
import * as LucideIcons from 'lucide-react';
import clsx from 'clsx';

export default function Sidebar({ onItemClick }: { onItemClick?: () => void }) {
    const { profile, signOut } = useAuth();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [logoError, setLogoError] = useState(false);


    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const ROLE_LABELS: Record<string, string> = {
        admin: 'المدير العام للنظام',
        brand_ops_manager: 'مدير العمليات المركزية',
        sector_manager: 'مدير الخدمات اللوجستية',
        area_manager: 'مدير النطاق التشغيلي',
        manager: 'مدير الموقع الإداري',
        maintenance_manager: 'مدير عام الصيانة الاستراتيجي',
        maintenance_supervisor: 'مشرف العمليات الفنية',
        technician: 'أخصائي صيانة ميدانية',
    };


    // ─── Dynamic Navigation (Registry Driven) ───
    const authorizedLinks = Object.values(SOVEREIGN_REGISTRY)
        .filter(entry => profile && entry.roles.includes(profile.role))
        .map(entry => ({
            label: entry.label,
            path: entry.path,
            icon: entry.icon || 'Layout',
            isCustomPage: entry.isCustomPage
        }));

    return (
        <aside className="w-72 brand-gradient text-white flex flex-col h-full transition-all duration-500 shadow-2xl overflow-y-auto custom-scrollbar relative z-50">
            <div className="absolute inset-0 bg-black/10 -z-10" />
            <div className="p-6 flex items-center gap-4 border-b border-surface-800 shrink-0">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
                    {logoError ? (
                        <div className="w-8 h-8 bg-brand-blaban text-white font-black flex items-center justify-center rounded-lg text-lg">B</div>
                    ) : (
                        <img
                            src="/logo.png"
                            alt="B.Laban"
                            className="w-8 h-8 object-contain"
                            onError={() => setLogoError(true)}
                        />
                    )}
                </div>
                <div>
                    <h2 className="text-xl font-black tracking-tighter text-white">B.LABAN</h2>
                    <p className="text-[10px] text-primary-400 font-bold uppercase tracking-widest">Sovereign Engine</p>
                </div>
            </div>

            <div className="p-6 pb-4 border-b border-white/10 bg-black/10 shrink-0">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-inner">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary-600 font-black text-lg shrink-0 border border-white/20 shadow-lg">
                        {profile?.full_name?.charAt(0) || 'M'}
                    </div>
                    <div className="overflow-hidden">
                        <p className="font-black text-sm text-white truncate">{profile?.full_name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent-sky animate-pulse" />
                            <p className="text-[10px] text-white/80 font-black uppercase tracking-widest truncate">
                                {ROLE_LABELS[profile?.role || ''] || profile?.role}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
                {authorizedLinks.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onItemClick}
                        className={({ isActive }: { isActive: boolean }) => clsx(
                            "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 text-sm font-black group relative overflow-hidden",
                            isActive
                                ? "bg-white text-primary-600 shadow-xl shadow-black/20 translate-x-3 scale-[1.02]"
                                : "text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-2"
                        )}
                    >
                        {({ isActive }: { isActive: boolean }) => (
                            <>
                                <div className={clsx(
                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-inner",
                                    isActive ? "bg-primary-50 text-primary-600 rotate-6" : "bg-white/10 group-hover:bg-white/20 group-hover:rotate-6 border border-white/5"
                                )}>
                                    {(() => {
                                        const IconComponent = (LucideIcons as any)[item.icon] || LucideIcons.Layout;
                                        return <IconComponent className={clsx("w-5 h-5 shrink-0 transition-transform duration-500", !isActive && "group-hover:scale-110")} />;
                                    })()}
                                </div>
                                <span className="flex-1 font-outfit tracking-wide">{item.label}</span>
                                {isActive && <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,1)] animate-pulse" />}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-surface-800 bg-surface-800/10 space-y-2 shrink-0">
                {deferredPrompt && !isInstalled && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleInstall(); }}
                        className="btn-3d flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-all border border-emerald-500/20 shadow-lg shadow-emerald-900/10"
                    >
                        <Smartphone className="w-5 h-5 shrink-0" />
                        <span>تنشيط وضع الوصول الذكي (Mobile PWA)</span>
                    </button>
                )}

                <button
                    onClick={() => { if (window.confirm('تأكيد إنهاء الجلسة الآمنة والتسجيل خارج النظام؟')) signOut(); }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all"
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span>إنهاء الجلسة الآمنة</span>
                </button>
            </div>
        </aside>
    );
}
