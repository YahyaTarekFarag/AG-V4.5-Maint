import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxHeight?: string;
}

export default function BottomSheet({
    isOpen,
    onClose,
    title,
    children,
    maxHeight = '90vh'
}: BottomSheetProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => {
                setMounted(false);
                document.body.style.overflow = '';
            }, 300);
            return () => {
                clearTimeout(timer);
                document.body.style.overflow = '';
            };
        }
    }, [isOpen]);

    if (!mounted) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-black/40 transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className={clsx(
                    "relative w-full max-w-lg bg-surface-900 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out transform safe-area-bottom",
                    isOpen ? "translate-y-0" : "translate-y-full"
                )}
                style={{ maxHeight }}
            >
                {/* Handle bar for dragging feel */}
                <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                    <div className="w-12 h-1.5 bg-surface-800 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-surface-800">
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-surface-800 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-surface-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: `calc(${maxHeight} - 80px)` }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
