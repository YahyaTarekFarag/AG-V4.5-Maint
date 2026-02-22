import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    return (
        <div className="min-h-screen bg-surface-50 flex overflow-x-hidden">
            {/* Backdrop for mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 lg:mr-64 flex flex-col min-h-screen relative overflow-hidden">
                <header className="h-16 lg:h-18 bg-white/80 backdrop-blur-md border-b border-surface-200 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 shadow-sm safe-pt">
                    <div className="flex items-center gap-3">
                        {/* Hamburger Button */}
                        <button
                            onClick={toggleSidebar}
                            className="lg:hidden p-2 text-surface-600 hover:bg-surface-100 rounded-xl transition-colors"
                        >
                            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                        <h1 className="text-lg lg:text-xl font-bold text-surface-800">النظام السيادي</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                        </span>
                        <span className="hidden sm:inline text-sm font-medium text-surface-500">متصل (Connected)</span>
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-8 overflow-y-auto custom-scrollbar">
                    {children}
                </main>
            </div>
        </div>
    );
}
