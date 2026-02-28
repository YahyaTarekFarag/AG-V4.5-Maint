import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import OmniSearch from './OmniSearch';
import NetworkSynchronizer from './NetworkSynchronizer';
import { Menu, X, WifiOff } from 'lucide-react';
import clsx from 'clsx';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (!mobile) setIsSidebarOpen(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div className="min-h-screen bg-surface-950 text-surface-50 flex transition-colors duration-500 overflow-x-hidden relative">
            <div className="noise-overlay" />
            <OmniSearch />
            <NetworkSynchronizer />
            {/* Sidebar with Mobile Drawer Logic */}
            <div className={clsx(
                "fixed inset-0 z-50 transition-all duration-300 lg:relative lg:z-auto",
                isMobile && !isSidebarOpen ? "pointer-events-none opacity-0" : "opacity-100"
            )}>
                {/* Backdrop */}
                {isMobile && (
                    <div
                        className={clsx(
                            "absolute inset-0 bg-surface-900/60 backdrop-blur-md transition-opacity duration-300",
                            isSidebarOpen ? "opacity-100" : "opacity-0"
                        )}
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                <div className={clsx(
                    "fixed right-0 top-0 bottom-0 transition-transform duration-500 transform lg:translate-x-0 w-72 z-[60] glass-premium shadow-2xl overflow-hidden",
                    isMobile && !isSidebarOpen ? "translate-x-full" : "translate-x-0"
                )}>
                    <Sidebar onItemClick={isMobile ? () => setIsSidebarOpen(false) : undefined} />
                    {isMobile && isSidebarOpen && (
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="absolute left-[-50px] top-4 p-2 bg-brand-blaban text-white rounded-full shadow-lg lg:hidden border border-white/10"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    )}
                </div>
            </div>

            <div className={clsx(
                "flex-1 flex flex-col min-h-screen relative overflow-hidden transition-all duration-300",
                !isMobile && "mr-72"
            )}>
                <header className="h-20 bg-surface-950/80 backdrop-blur-3xl border-b border-white/5 sticky top-0 z-30 flex items-center justify-between px-6 lg:px-10 shadow-2xl transition-colors">
                    <div className="flex items-center gap-3">
                        {isMobile && (
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2.5 hover:bg-surface-800 rounded-xl transition-colors border border-surface-700 shadow-sm"
                            >
                                <Menu className="w-6 h-6 text-surface-900 dark:text-white" />
                            </button>
                        )}
                        <div className="flex flex-col items-start leading-tight">
                            <h1 className="text-xl lg:text-2xl font-black text-brand-blaban dark:text-accent-sky tracking-tighter uppercase">B.Laban</h1>
                            <span className="text-[10px] font-black text-surface-500 uppercase tracking-widest -mt-1">ERP Sovereign Fleet</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all",
                            isOnline
                                ? "bg-teal-50 dark:bg-teal-900/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-900/30"
                                : "bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30"
                        )}>
                            <span className="relative flex h-2 w-2">
                                {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>}
                                <span className={clsx(
                                    "relative inline-flex rounded-full h-2 w-2",
                                    isOnline ? "bg-teal-500" : "bg-red-500"
                                )}></span>
                            </span>
                            <span className="hidden sm:inline">
                                {isOnline ? 'مية مية.. أنت أونلاين' : 'النت قاطع يا باشا'}
                            </span>
                            {!isOnline && <WifiOff className="w-3.5 h-3.5 sm:hidden" />}
                        </div>
                    </div>
                </header>

                {!isOnline && (
                    <div className="bg-red-600 text-white px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top duration-500 shadow-lg">
                        <div className="flex items-center gap-3 font-bold text-sm">
                            <WifiOff className="w-5 h-5 animate-pulse" />
                            <span>تنبيه: أنت الآن تعمل في وضع الـ Offline. يمكنك متابعة العمل وسيتم حفظ البيانات كمسودات ومزامنتها تلقائياً عند عودة الاتصال.</span>
                        </div>
                    </div>
                )}

                <main className="flex-1 p-4 lg:p-8 overflow-y-auto custom-scrollbar bg-transparent">
                    {children}
                </main>
            </div>
        </div>
    );
}
