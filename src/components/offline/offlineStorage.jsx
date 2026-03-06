// IndexedDB wrapper for offline storage
const DB_NAME = 'nw_fire_offline';
const DB_VERSION = 1;

class OfflineStorage {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store for pending syncs
        if (!db.objectStoreNames.contains('pending_syncs')) {
          const syncStore = db.createObjectStore('pending_syncs', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('type', 'type', { unique: false });
        }

        // Store for cached data
        if (!db.objectStoreNames.contains('cached_data')) {
          const cacheStore = db.createObjectStore('cached_data', { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store for offline photos
        if (!db.objectStoreNames.contains('offline_photos')) {
          const photoStore = db.createObjectStore('offline_photos', { keyPath: 'id', autoIncrement: true });
          photoStore.createIndex('inspectionId', 'inspectionId', { unique: false });
        }
      };
    });
  }

  async addPendingSync(type, data) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pending_syncs'], 'readwrite');
      const store = transaction.objectStore('pending_syncs');
      
      const sync = {
        type,
        data,
        timestamp: Date.now()
      };

      const request = store.add(sync);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSyncs() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pending_syncs'], 'readonly');
      const store = transaction.objectStore('pending_syncs');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingSync(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pending_syncs'], 'readwrite');
      const store = transaction.objectStore('pending_syncs');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async cacheData(key, data, ttl = 3600000) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cached_data'], 'readwrite');
      const store = transaction.objectStore('cached_data');
      
      const cached = {
        key,
        data,
        timestamp: Date.now(),
        ttl
      };

      const request = store.put(cached);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedData(key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cached_data'], 'readonly');
      const store = transaction.objectStore('cached_data');
      const request = store.get(key);

      request.onsuccess = () => {
        const cached = request.result;
        if (!cached) {
          resolve(null);
          return;
        }

        // Check if expired
        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
          resolve(null);
          return;
        }

        resolve(cached.data);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveOfflinePhoto(inspectionId, photoData) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_photos'], 'readwrite');
      const store = transaction.objectStore('offline_photos');
      
      const photo = {
        inspectionId,
        photoData,
        timestamp: Date.now()
      };

      const request = store.add(photo);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getOfflinePhotos(inspectionId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_photos'], 'readonly');
      const store = transaction.objectStore('offline_photos');
      const index = store.index('inspectionId');
      const request = index.getAll(inspectionId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removeOfflinePhoto(id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['offline_photos'], 'readwrite');
      const store = transaction.objectStore('offline_photos');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();