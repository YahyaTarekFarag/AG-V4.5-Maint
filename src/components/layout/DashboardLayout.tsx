import React from 'react';
import Sidebar from './Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-surface-50 flex">
            <Sidebar />
            <div className="flex-1 mr-64 flex flex-col min-h-screen relative overflow-hidden">
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-surface-200 sticky top-0 z-30 flex items-center justify-between px-8 shadow-sm">
                    <h1 className="text-xl font-bold text-surface-800">النظام السيادي</h1>
                    <div className="flex items-center gap-4">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
                        </span>
                        <span className="text-sm font-medium text-surface-500">متصل (Connected)</span>
                    </div>
                </header>

                <main className="flex-1 p-6 lg:p-8 overflow-y-auto custom-scrollbar">
                    {children}
                </main>
            </div>
        </div>
    );
}
