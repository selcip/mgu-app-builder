// The Designer's DesignStore: one record in IndexedDB, which keeps the images' bytes as they are.
import type { DesignStore, StoredDesign } from './model/index.ts';

const DB = 'mgu-designer';
const STORE = 'autosave';
const KEY = 'design';

function request<T>(r: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
    });
}

function openDb(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('this browser gives the Designer no storage (private window?).'));
    }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    return request(r);
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();
    try {
        const tx = db.transaction(STORE, mode);
        const result = await request(fn(tx.objectStore(STORE)));
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('saving was cancelled.'));
        });
        return result;
    } finally {
        db.close();
    }
}

export function indexedDbStore(): DesignStore {
    return {
        read: () => run('readonly', (s) => s.get(KEY) as IDBRequest<StoredDesign | undefined>),
        write: async (design) => { await run('readwrite', (s) => s.put(design, KEY)); },
    };
}
