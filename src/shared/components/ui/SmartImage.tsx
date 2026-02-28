import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface SmartImageProps {
    src: string | null;
    alt: string;
    className?: string;
}

export const SmartImage: React.FC<SmartImageProps> = ({ src, alt, className }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    if (!src) return null;

    return (
        <div className={clsx("relative overflow-hidden bg-surface-900", className)}>
            {!loaded && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-950/50 backdrop-blur-sm z-10">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-blaban" />
                </div>
            )}

            {error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900 text-surface-500 p-4 text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest leading-relaxed">خطأ في تحميل المعاينة البصرية</span>
                </div>
            ) : (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    onLoad={() => setLoaded(true)}
                    onError={() => setError(true)}
                    className={clsx(
                        "w-full h-full object-cover transition-all duration-700",
                        loaded ? "opacity-100 scale-100 grayscale-0" : "opacity-0 scale-105 grayscale"
                    )}
                />
            )}
        </div>
    );
};
