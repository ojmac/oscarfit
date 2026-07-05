/* db.js — Capa de acceso a datos con IndexedDB para Oscar Fit 78 */

const DB_NAME = 'oscarfit78';
const DB_VERSION = 2;

const STORES = [
  { name: 'profile', keyPath: 'id' },
  { name: 'weightLogs', keyPath: 'id', autoIncrement: true, indexes: ['date'] },
  { name: 'measurements', keyPath: 'id', autoIncrement: true, indexes: ['date'] },
  { name: 'meals', keyPath: 'id', autoIncrement: true, indexes: ['date'] },
  { name: 'water', keyPath: 'id', autoIncrement: true, indexes: ['date'] },
  { name: 'beers', keyPath: 'id', autoIncrement: true, indexes: ['date'] },
  { name: 'swimWorkouts', keyPath: 'id', autoIncrement: true, indexes: ['date'] },
  { name: 'calisthenicsWorkouts', keyPath: 'id', autoIncrement: true, indexes: ['date'] },
  { name: 'healthLogs', keyPath: 'id', autoIncrement: true, indexes: ['date'] },
  { name: 'coachMessages', keyPath: 'id', autoIncrement: true, indexes: ['date'] },
  { name: 'achievements', keyPath: 'id' },
  { name: 'gamification', keyPath: 'id' },
  { name: 'settings', keyPath: 'id' }
];

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      STORES.forEach((store) => {
        if (!db.objectStoreNames.contains(store.name)) {
          const os = db.createObjectStore(store.name, {
            keyPath: store.keyPath,
            autoIncrement: !!store.autoIncrement
          });
          (store.indexes || []).forEach((idx) => os.createIndex(idx, idx, { unique: false }));
        }
      });
    };

    req.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

async function tx(storeName, mode = 'readonly') {
  const db = await openDB();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

const DB = {
  async add(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async get(storeName, key) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // --- Backup / Restore ---
  async exportAll() {
    const dump = {};
    for (const store of STORES) {
      dump[store.name] = await DB.getAll(store.name);
    }
    dump._meta = { exportedAt: new Date().toISOString(), version: DB_VERSION };
    return dump;
  },

  async importAll(dump) {
    for (const store of STORES) {
      if (!dump[store.name]) continue;
      await DB.clear(store.name);
      const s = await tx(store.name, 'readwrite');
      for (const item of dump[store.name]) {
        s.put(item);
      }
    }
    return true;
  },

  STORES
};

window.DB = DB;
