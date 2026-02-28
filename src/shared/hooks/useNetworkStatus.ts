import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success('تم استعادة الاتصال بالشبكة بنجاح', {
                icon: '🌐',
                style: {
                    borderRadius: '1rem',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(0, 74, 173, 0.3)'
                }
            });
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.error('أنت تعمل الآن في وضع عدم الاتصال. بعض العمليات قد تكون محدودة.', {
                icon: '📡',
                duration: 5000,
                style: {
                    borderRadius: '1rem',
                    background: '#1e293b',
                    color: '#f87171',
                    border: '1px solid rgba(153, 27, 27, 0.3)'
                }
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline };
}
