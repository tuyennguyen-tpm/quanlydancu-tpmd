/**
 * High Performance In-Memory & IndexedDB Multi-Tier Cache
 * Provides instant 0-15ms local-first data retrieval with background sync
 */

const DB_NAME = 'CSDL_TDP_CACHE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'app_cache';

// In-Memory L1 Cache (0ms response time)
const memoryCache = new Map<string, { data: any; timestamp: number }>();

// In-Flight Promise Map (Deduplication - prevents duplicate simultaneous network requests)
const inFlightRequests = new Map<string, Promise<any>>();

// IndexedDB Helper
let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in current environment'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[Cache] IndexedDB open error, falling back to memory only:', request.error);
      reject(request.error);
    };
  });
  return dbPromise;
}

export const appCache = {
  /**
   * Lấy dữ liệu từ L1 Cache (Memory - 0ms) hoặc L2 Cache (IndexedDB - 15ms)
   */
  get: async <T>(key: string, maxAgeMs = 10 * 60 * 1000): Promise<T | null> => {
    // 1. Check L1 Memory Cache (Instant 0ms)
    const mem = memoryCache.get(key);
    if (mem) {
      const age = Date.now() - mem.timestamp;
      if (age < maxAgeMs) {
        return mem.data as T;
      }
    }

    // 2. Check L2 IndexedDB Cache (10-20ms)
    try {
      const db = await getIndexedDB();
      return new Promise<T | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          const record = req.result;
          if (record && record.data) {
            const age = Date.now() - (record.timestamp || 0);
            // Cập nhật ngược lại vào L1 Memory để các lần gọi tiếp theo là 0ms
            memoryCache.set(key, { data: record.data, timestamp: record.timestamp || Date.now() });
            if (age < maxAgeMs) {
              resolve(record.data as T);
              return;
            }
            // Nếu quá hạn nhưng vẫn có dữ liệu (Stale), có thể trả về để render trước
            resolve(record.data as T);
            return;
          }
          resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return mem ? (mem.data as T) : null;
    }
  },

  /**
   * Lưu dữ liệu đồng thời vào cả Memory và IndexedDB
   */
  set: async <T>(key: string, data: T): Promise<void> => {
    const timestamp = Date.now();
    memoryCache.set(key, { data, timestamp });

    try {
      const db = await getIndexedDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ data, timestamp }, key);
    } catch {
      // Ignore if IndexedDB fails, memory cache is already set
    }
  },

  /**
   * Xóa cache của 1 key hoặc tất cả keys bắt đầu bằng prefix
   */
  invalidate: async (prefixOrKey: string): Promise<void> => {
    const cleanPrefix = (prefixOrKey || '').replace('*', '');

    // 1. Xóa trong Memory Cache (L1)
    for (const k of Array.from(memoryCache.keys())) {
      if (!cleanPrefix || k === cleanPrefix || k.startsWith(cleanPrefix)) {
        memoryCache.delete(k);
      }
    }

    // 2. Xóa trong IndexedDB (L2) và chờ transaction hoàn tất
    try {
      const db = await getIndexedDB();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();

        if (!cleanPrefix) {
          store.clear();
          return;
        }

        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const keyStr = String(cursor.key);
            if (keyStr === cleanPrefix || keyStr.startsWith(cleanPrefix)) {
              cursor.delete();
            }
            cursor.continue();
          }
        };
        req.onerror = () => resolve();
      });
    } catch {
      // Ignore
    }
  },

  /**
   * Ngăn chặn nhiều lời gọi mạng trùng lặp cùng 1 lúc (Request Deduplication)
   */
  dedupe: async <T>(key: string, fetchFn: () => Promise<T>): Promise<T> => {
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key) as Promise<T>;
    }
    const p = fetchFn().finally(() => {
      inFlightRequests.delete(key);
    });
    inFlightRequests.set(key, p);
    return p;
  }
};
