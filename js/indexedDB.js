const DB_NAME = "SalesDB";
const DB_VERSION = 2; // Incremented version to trigger upgrade and create all stores
const STORE_PENDING = "pendingSales";
const STORE_PRODUCTS = "cachedProducts";

let DB = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (DB) return resolve(DB);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      DB = e.target.result;

      // Create object stores if they don't exist
      if (!DB.objectStoreNames.contains(STORE_PENDING)) {
        DB.createObjectStore(STORE_PENDING, {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      if (!DB.objectStoreNames.contains(STORE_PRODUCTS)) {
        DB.createObjectStore(STORE_PRODUCTS); // Key will be e.g., "all"
      }
    };

    request.onsuccess = (e) => {
      DB = e.target.result;
      resolve(DB);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

// -------------------- Products Cache --------------------

export function saveProductsToIndexedDB(products) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PRODUCTS, "readwrite");
      const store = tx.objectStore(STORE_PRODUCTS);
      store.clear();
      store.put(products, "all");
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  });
}

export function getProductsFromIndexedDB() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PRODUCTS, "readonly");
      const store = tx.objectStore(STORE_PRODUCTS);
      const request = store.get("all");
      request.onsuccess = () => resolve(request.result || {});
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

// -------------------- Pending Sales Transactions --------------------

export function savePendingTransaction(data, type) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, "readwrite");
      const store = tx.objectStore(STORE_PENDING);

      const record = {
        type,
        data,
        savedAt: new Date().toLocaleString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }), // human-readable local date in English
      };

      store.add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  });
}

export function getAllPendingTransactions() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, "readonly");
      const store = tx.objectStore(STORE_PENDING);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

export function deletePendingTransaction(id) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, "readwrite");
      const store = tx.objectStore(STORE_PENDING);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  });
}
