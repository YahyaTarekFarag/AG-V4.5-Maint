import clsx from 'clsx';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
}

export default function Skeleton({
    className,
    variant = 'text', // Changed default variant from 'rectangular' to 'text'
    width,
    height
}: SkeletonProps) {
    return (
        <div
            className={clsx(
                'animate-pulse-premium bg-surface-800/60 transition-colors',
                {
                    'rounded-md': variant === 'text' || variant === 'rectangular',
                    'rounded-full': variant === 'circular',
                    'h-4 w-full mb-2': variant === 'text' && !height,
                },
                className
            )}
            style={{
                width: width,
                height: height,
            }}
        />
    );
}
