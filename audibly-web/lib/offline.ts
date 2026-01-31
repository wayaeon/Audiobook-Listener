const DB_NAME = 'audibly-offline';
const DB_VERSION = 1;
const STORE_NAME = 'audiobooks';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
  });
}

export type OfflineKey = {
  userId: string;
  audiobookId: string;
  index: number;
};

function toStoreKey(k: OfflineKey): string {
  return `${k.userId}:${k.audiobookId}:${k.index}`;
}

export async function saveOfflineBlob(
  userId: string,
  audiobookId: string,
  index: number,
  blob: Blob
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const key = toStoreKey({ userId, audiobookId, index });
    const req = store.put({ key, blob });
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

export async function getOfflineBlob(
  userId: string,
  audiobookId: string,
  index: number
): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const key = toStoreKey({ userId, audiobookId, index });
    const req = store.get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const row = req.result as { key: string; blob: Blob } | undefined;
      resolve(row?.blob ?? null);
    };
    tx.oncomplete = () => db.close();
  });
}

export async function getOfflineSourceCount(
  userId: string,
  audiobookId: string
): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const prefix = `${userId}:${audiobookId}:`;
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rows = (req.result as { key: string }[]) ?? [];
      const maxIndex = rows
        .filter((r) => r.key.startsWith(prefix))
        .map((r) => parseInt(r.key.slice(prefix.length), 10))
        .filter((n) => !Number.isNaN(n));
      resolve(maxIndex.length === 0 ? 0 : Math.max(...maxIndex) + 1);
    };
    tx.oncomplete = () => db.close();
  });
}

export async function hasOfflineAudiobook(
  userId: string,
  audiobookId: string,
  sourceFileCount: number
): Promise<boolean> {
  const count = await getOfflineSourceCount(userId, audiobookId);
  return count >= sourceFileCount;
}

export async function removeOfflineAudiobook(
  userId: string,
  audiobookId: string
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const prefix = `${userId}:${audiobookId}:`;
  const getAllReq = store.getAll();
  getAllReq.onsuccess = () => {
    const rows = (getAllReq.result as { key: string }[]) ?? [];
    rows.filter((r) => r.key.startsWith(prefix)).forEach((r) => store.delete(r.key));
  };
  tx.oncomplete = () => db.close();
}
