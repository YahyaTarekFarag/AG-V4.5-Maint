import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { OfflineQueue } from '../../lib/offlineQueue';
import { RefreshCcw, WifiOff } from 'lucide-react';

export default function NetworkSynchronizer() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        const updateCount = () => setPendingCount(OfflineQueue.getQueue().length);
        updateCount();

        // Listen for internal enqueue events
        window.addEventListener('sovereign_offline_enqueued', updateCount);
        window.addEventListener('online', flushQueue);

        // Periodic check every 30 seconds as fallback
        const interval = setInterval(flushQueue, 30000);

        return () => {
            window.removeEventListener('sovereign_offline_enqueued', updateCount);
            window.removeEventListener('online', flushQueue);
            clearInterval(interval);
        };
    }, []);

    const flushQueue = async () => {
        if (!navigator.onLine || isSyncing) return;

        const queue = OfflineQueue.getQueue();
        if (queue.length === 0) return;

        setIsSyncing(true);
        console.log(`🔃 Syncing ${queue.length} pending actions in parallel...`);

        for (const action of queue) {
            try {
                let error;
                if (action.action === 'update' && action.filter) {
                    const { error: err } = await supabase
                        .from(action.table)
                        .update(action.data)
                        .eq(action.filter.column, action.filter.value);
                    error = err;
                } else if (action.action === 'insert') {
                    const { error: err } = await supabase
                        .from(action.table)
                        .insert(action.data);
                    error = err;
                } else if (action.action === 'delete' && action.filter) {
                    const { error: err } = await supabase
                        .from(action.table)
                        .delete()
                        .eq(action.filter.column, action.filter.value);
                    error = err;
                }

                if (!error) {
                    OfflineQueue.dequeue(action.id);
                } else {
                    console.error(`❌ Sync failed for action ${action.id}:`, error);
                    // Increment retry or keep in queue
                    action.retryCount++;
                    OfflineQueue.updateAction(action);
                }
            } catch (e) {
                console.error('Fatal sync error:', e);
            }
        }

        setPendingCount(OfflineQueue.getQueue().length);
        setIsSyncing(false);
    };

    if (pendingCount === 0 && !isSyncing) return null;

    return (
        <div className="fixed bottom-20 left-4 z-[100] animate-in fade-in slide-in-from-bottom-4">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl transition-all ${isSyncing ? 'bg-primary-600 text-white border-primary-500' : 'bg-amber-600 text-white border-amber-500'
                }`}>
                {isSyncing ? (
                    <RefreshCcw className="w-5 h-5 animate-spin" />
                ) : (
                    <WifiOff className="w-5 h-5 animate-pulse" />
                )}
                <div className="text-right">
                    <p className="text-xs font-black uppercase tracking-tighter">
                        {isSyncing ? 'جاري المزامنة...' : 'بيانات معلقة (أوفلاين)'}
                    </p>
                    <p className="text-[10px] opacity-80">
                        {isSyncing ? `يتم الآن رفع ${pendingCount} عملية للسيقان` : `يوجد ${pendingCount} عملية بانتظار عودة الشبكة`}
                    </p>
                </div>
                {navigator.onLine && !isSyncing && (
                    <button
                        onClick={flushQueue}
                        className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
