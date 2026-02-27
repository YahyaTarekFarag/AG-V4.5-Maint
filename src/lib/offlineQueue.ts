
/**
 * Sovereign Offline Queue V1
 * Manages pending actions when the network is unstable.
 */

export interface PendingAction {
    id: string;
    table: string;
    action: 'insert' | 'update' | 'delete';
    data: any;
    filter?: { column: string; value: any };
    timestamp: number;
    retryCount: number;
}

const QUEUE_KEY = 'sovereign_offline_queue';

export const OfflineQueue = {
    /**
     * Adds an action to the local queue.
     */
    enqueue(action: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount'>) {
        const queue = this.getQueue();
        const newAction: PendingAction = {
            ...action,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            retryCount: 0
        };
        queue.push(newAction);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        console.log('📦 Action enqueued for offline sync:', newAction);

        // Trigger generic "offline mode" UI event if needed
        window.dispatchEvent(new CustomEvent('sovereign_offline_enqueued', { detail: newAction }));
    },

    /**
     * Retrieves all pending actions.
     */
    getQueue(): PendingAction[] {
        const stored = localStorage.getItem(QUEUE_KEY);
        try {
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    },

    /**
     * Removes an action from the queue.
     */
    dequeue(id: string) {
        const queue = this.getQueue().filter(a => a.id !== id);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    },

    /**
     * Updates an action (e.g., increment retry count).
     */
    updateAction(updated: PendingAction) {
        const queue = this.getQueue().map(a => a.id === updated.id ? updated : a);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    },

    /**
     * Clears the entire queue.
     */
    clear() {
        localStorage.removeItem(QUEUE_KEY);
    }
};
