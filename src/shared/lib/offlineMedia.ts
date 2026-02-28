/**
 * Offline Media Store
 * Handles storing images in IndexedDB when offline and retrieving them for later upload.
 */

const DB_NAME = 'SovereignOfflineMedia';
const STORE_NAME = 'pendingImages';

export interface PendingMedia {
    id: string;
    fileData: Blob;
    fileName: string;
    folder: string;
    timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const OfflineMediaStore = {
    async saveImage(file: File, folder: string): Promise<string> {
        const db = await openDB();
        const id = crypto.randomUUID();
        const media: PendingMedia = {
            id,
            fileData: file,
            fileName: file.name,
            folder,
            timestamp: Date.now()
        };

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(media);
            request.onsuccess = () => resolve(id);
            request.onerror = () => reject(request.error);
        });
    },

    async getPending(): Promise<PendingMedia[]> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async removeImage(id: string): Promise<void> {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};
