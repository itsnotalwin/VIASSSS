export class IndexedDBStorage {
  private static DB_NAME = 'atlas_db';
  private static STORE_NAME = 'files';
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IndexedDBStorage.DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IndexedDBStorage.STORE_NAME)) {
          db.createObjectStore(IndexedDBStorage.STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  public async put(id: string, blob: Blob): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(IndexedDBStorage.STORE_NAME, 'readwrite');
      const store = tx.objectStore(IndexedDBStorage.STORE_NAME);
      store.put({ id, blob, ts: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async get(id: string): Promise<Blob | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(IndexedDBStorage.STORE_NAME, 'readonly');
      const store = tx.objectStore(IndexedDBStorage.STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        resolve(req.result?.blob || null);
      };
      req.onerror = () => {
        reject(req.error);
      };
    });
  }

  public async delete(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(IndexedDBStorage.STORE_NAME, 'readwrite');
      tx.objectStore(IndexedDBStorage.STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async clear(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(IndexedDBStorage.STORE_NAME, 'readwrite');
      tx.objectStore(IndexedDBStorage.STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const idbStorage = new IndexedDBStorage();
