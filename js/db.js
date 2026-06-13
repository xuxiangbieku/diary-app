// -*- coding: utf-8 -*-
const DB = (() => {
  const DB_NAME = "DiaryDB", DB_VER = 1, STORE = "entries";
  let db = null;
  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: "date" });
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = e => reject(e.target.error);
    });
  }
  async function getEntry(dateStr) {
    const d = await open();
    return new Promise(resolve => {
      const tx = d.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(dateStr);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }
  async function getAllEntries() {
    const d = await open();
    return new Promise(resolve => {
      const tx = d.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }
  async function saveEntry(entry) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).put(entry);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
  async function deleteEntry(dateStr) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).delete(dateStr);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
  async function exportAll() {
    return await getAllEntries();
  }
  async function importAll(entries) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let count = 0;
      entries.forEach(e => {
        const req = store.put(e);
        req.onsuccess = () => count++;
      });
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    });
  }
  return { getEntry, getAllEntries, saveEntry, deleteEntry, exportAll, importAll };
})();
